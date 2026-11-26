import { validateBleJsonPayload } from '../utils/heatIndex';

export type SerialConnectionState = 'disconnected' | 'connecting' | 'connected' | 'unsupported' | 'error';

interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable?: ReadableStream<Uint8Array>;
}

interface NavigatorSerialLike {
  requestPort: () => Promise<SerialPortLike>;
}

export class Esp32SerialClient {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private keepReading = false;
  private readonly decoder = new TextDecoder('utf-8');
  private rxBuffer = '';

  private onStateChange: (state: SerialConnectionState, errorMsg?: string) => void;
  private onLineReceived: (
    line: string,
    validation: ReturnType<typeof validateBleJsonPayload>
  ) => void;

  constructor(
    onStateChange: (state: SerialConnectionState, errorMsg?: string) => void,
    onLineReceived: (line: string, validation: ReturnType<typeof validateBleJsonPayload>) => void
  ) {
    this.onStateChange = onStateChange;
    this.onLineReceived = onLineReceived;
  }

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public async connect(baudRate = 115200): Promise<void> {
    if (!Esp32SerialClient.isSupported()) {
      this.onStateChange(
        'unsupported',
        'Web Serial is not supported in this browser. Use Chrome/Edge on Desktop over HTTPS.'
      );
      return;
    }

    this.onStateChange('connecting');
    try {
      const serial = (navigator as unknown as { serial: NavigatorSerialLike }).serial;
      const port = await serial.requestPort();
      await port.open({ baudRate });
      this.port = port;
      this.keepReading = true;
      this.rxBuffer = '';
      this.onStateChange('connected');
      void this.readLoop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Serial port connection cancelled or failed.';
      this.onStateChange('error', msg);
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!value) continue;

        this.rxBuffer += this.decoder.decode(value, { stream: true });
        const lines = this.rxBuffer.split(/\r?\n/);
        this.rxBuffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const trimmed = rawLine.trim();
          if (!trimmed) continue;
          // Strip optional "[TELEMETRY] " prefix if reading USB debug logs
          const jsonCandidate = trimmed.startsWith('[TELEMETRY]')
            ? trimmed.replace('[TELEMETRY]', '').trim()
            : trimmed;
          const validation = validateBleJsonPayload(jsonCandidate);
          this.onLineReceived(jsonCandidate, validation);
        }
      }
    } catch (err) {
      if (this.keepReading) {
        const msg = err instanceof Error ? err.message : 'Serial stream interrupted.';
        this.onStateChange('error', msg);
      }
    } finally {
      try {
        this.reader.releaseLock();
      } catch {
        // Ignore lock release errors
      }
      this.reader = null;
    }
  }

  public async disconnect(): Promise<void> {
    this.keepReading = false;
    try {
      await this.reader?.cancel().catch(() => undefined);
      await this.port?.close().catch(() => undefined);
    } finally {
      this.port = null;
      this.reader = null;
      this.onStateChange('disconnected');
    }
  }
}
