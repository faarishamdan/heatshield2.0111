import {
  HEATSHIELD_BLE_CHARACTERISTIC_UUID,
  HEATSHIELD_BLE_SERVICE_UUID,
  validateBleJsonPayload,
} from '../utils/heatIndex';
import type { BleConnectionState, RawBleSensorPayload } from '../types/heatshield';

export interface BleCallbacks {
  onStateChange: (state: BleConnectionState, deviceName?: string, errorMsg?: string) => void;
  onPacketReceived: (
    rawJson: string,
    validation: ReturnType<typeof validateBleJsonPayload>
  ) => void;
}

interface BluetoothRemoteGATTCharacteristicLike {
  startNotifications: () => Promise<BluetoothRemoteGATTCharacteristicLike>;
  stopNotifications: () => Promise<BluetoothRemoteGATTCharacteristicLike>;
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
  value?: DataView;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic: (uuid: string) => Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothDeviceLike {
  name?: string;
  id: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorBluetoothLike {
  requestDevice: (options: {
    filters?: Array<{ services?: string[]; namePrefix?: string }>;
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }) => Promise<BluetoothDeviceLike>;
}

export class Esp32BleClient {
  private device: BluetoothDeviceLike | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private readonly maxReconnectAttempts = 5;
  private readonly decoder = new TextDecoder('utf-8');
  private callbacks: BleCallbacks;
  private rxBuffer = '';

  constructor(callbacks: BleCallbacks) {
    this.callbacks = callbacks;
  }

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public async connect(): Promise<void> {
    if (!Esp32BleClient.isSupported()) {
      this.callbacks.onStateChange(
        'unsupported',
        undefined,
        'Web Bluetooth is not supported in this browser. Use Chrome/Edge on Android or Desktop over HTTPS, or use Demonstration Mode.'
      );
      return;
    }

    this.manualDisconnect = false;
    this.clearReconnectTimer();
    this.callbacks.onStateChange('scanning');

    try {
      const bt = (navigator as unknown as { bluetooth: NavigatorBluetoothLike }).bluetooth;
      const device = await bt.requestDevice({
        filters: [{ services: [HEATSHIELD_BLE_SERVICE_UUID] }],
        optionalServices: [HEATSHIELD_BLE_SERVICE_UUID],
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', this.handleDisconnected);
      await this.connectGattServer();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Bluetooth pairing cancelled or failed.';
      this.callbacks.onStateChange('error', this.device?.name, message);
    }
  }

  private async connectGattServer(): Promise<void> {
    if (!this.device?.gatt) {
      this.callbacks.onStateChange('error', this.device?.name, 'Selected BLE device has no GATT server.');
      return;
    }

    this.callbacks.onStateChange('connecting', this.device.name || 'ESP32-HEATSHIELD');

    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(HEATSHIELD_BLE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(HEATSHIELD_BLE_CHARACTERISTIC_UUID);

    this.characteristic = characteristic;
    characteristic.addEventListener('characteristicvaluechanged', this.handleCharacteristicChanged);
    await characteristic.startNotifications();

    this.reconnectAttempts = 0;
    this.rxBuffer = '';
    this.callbacks.onStateChange('connected', this.device.name || 'ESP32-HEATSHIELD');
  }

  private handleCharacteristicChanged = (event: Event) => {
    const target = event.target as unknown as BluetoothRemoteGATTCharacteristicLike;
    if (!target?.value) return;

    const chunk = this.decoder.decode(target.value);
    this.rxBuffer += chunk;

    // Support both single-packet JSON and newline-delimited JSON chunks
    if (this.rxBuffer.includes('\n')) {
      const lines = this.rxBuffer.split('\n');
      this.rxBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          const validation = validateBleJsonPayload(trimmed);
          this.callbacks.onPacketReceived(trimmed, validation);
        }
      }
      return;
    }

    const trimmed = this.rxBuffer.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const validation = validateBleJsonPayload(trimmed);
      if (validation.valid) {
        this.rxBuffer = '';
        this.callbacks.onPacketReceived(trimmed, validation);
      } else if (this.rxBuffer.length > 512) {
        this.rxBuffer = '';
        this.callbacks.onPacketReceived(trimmed, validation);
      }
    }
  };

  private handleDisconnected = () => {
    if (this.manualDisconnect) {
      this.callbacks.onStateChange('disconnected', this.device?.name);
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.callbacks.onStateChange(
        'error',
        this.device?.name,
        'BLE connection lost and automatic reconnection failed after 5 attempts.'
      );
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 15000);
    this.callbacks.onStateChange(
      'reconnecting',
      this.device?.name,
      `Connection dropped. Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await this.connectGattServer();
      } catch {
        this.handleDisconnected();
      }
    }, delayMs);
  };

  public async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    try {
      if (this.characteristic) {
        this.characteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleCharacteristicChanged
        );
        await this.characteristic.stopNotifications().catch(() => undefined);
      }
      if (this.device) {
        this.device.removeEventListener('gattserverdisconnected', this.handleDisconnected);
        if (this.device.gatt?.connected) {
          this.device.gatt.disconnect();
        }
      }
    } finally {
      this.characteristic = null;
      this.device = null;
      this.callbacks.onStateChange('disconnected');
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  public static formatPacketForTest(payload: RawBleSensorPayload): string {
    return JSON.stringify(payload);
  }
}
