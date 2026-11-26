package com.heatshield.ai.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import com.heatshield.ai.util.HeatIndexCalculator
import com.heatshield.ai.util.SensorTelemetry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

enum class BleStatus {
    DISCONNECTED,
    SCANNING,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    ERROR
}

class BleHeatShieldManager(private val context: Context) {

    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("12345678-1234-1234-1234-123456789000")
        val CHARACTERISTIC_UUID: UUID = UUID.fromString("12345678-1234-1234-1234-123456789001")
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }

    private val bluetoothManager =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val adapter: BluetoothAdapter? = bluetoothManager.adapter
    private var gatt: BluetoothGatt? = null
    private var manualDisconnect = false
    private val rxBuffer = StringBuilder()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val _status = MutableStateFlow(BleStatus.DISCONNECTED)
    val status: StateFlow<BleStatus> = _status

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _telemetry = MutableStateFlow<SensorTelemetry?>(null)
    val telemetry: StateFlow<SensorTelemetry?> = _telemetry

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            adapter?.bluetoothLeScanner?.stopScan(this)
            _status.value = BleStatus.CONNECTING
            gatt = result.device.connectGatt(context, false, gattCallback)
        }

        override fun onScanFailed(errorCode: Int) {
            _status.value = BleStatus.ERROR
            _error.value = "BLE scan failed with code $errorCode"
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                _error.value = null
                g.requestMtu(185)
                g.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                g.close()
                if (!manualDisconnect) {
                    _status.value = BleStatus.RECONNECTING
                    mainHandler.postDelayed({ startScanAndConnect() }, 2500L)
                } else {
                    _status.value = BleStatus.DISCONNECTED
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                _status.value = BleStatus.ERROR
                _error.value = "Service discovery failed ($status)"
                return
            }
            val service = g.getService(SERVICE_UUID)
            val characteristic = service?.getCharacteristic(CHARACTERISTIC_UUID)
            if (characteristic == null) {
                _status.value = BleStatus.ERROR
                _error.value = "ESP32 HeatShield GATT characteristic not found"
                return
            }

            g.setCharacteristicNotification(characteristic, true)
            val descriptor = characteristic.getDescriptor(CCCD_UUID)
            if (descriptor != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    g.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                } else {
                    @Suppress("DEPRECATION")
                    descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    @Suppress("DEPRECATION")
                    g.writeDescriptor(descriptor)
                }
            }
            _status.value = BleStatus.CONNECTED
        }

        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            value: ByteArray
        ) {
            handleIncomingChunk(String(value, Charsets.UTF_8))
        }

        @Suppress("DEPRECATION")
        @Deprecated("Deprecated in API 33")
        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic
        ) {
            val bytes = characteristic.value ?: return
            handleIncomingChunk(String(bytes, Charsets.UTF_8))
        }
    }

    @SuppressLint("MissingPermission")
    fun startScanAndConnect() {
        val bt = adapter
        if (bt == null || !bt.isEnabled) {
            _status.value = BleStatus.ERROR
            _error.value = "Bluetooth is turned off or unavailable on this device."
            return
        }
        manualDisconnect = false
        _error.value = null
        _status.value = BleStatus.SCANNING

        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(SERVICE_UUID))
            .build()
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        bt.bluetoothLeScanner?.startScan(listOf(filter), settings, scanCallback)
    }

    @SuppressLint("MissingPermission")
    fun disconnect() {
        manualDisconnect = true
        adapter?.bluetoothLeScanner?.stopScan(scanCallback)
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        _status.value = BleStatus.DISCONNECTED
    }

    private fun handleIncomingChunk(chunk: String) {
        rxBuffer.append(chunk)
        val raw = rxBuffer.toString()
        val nlIndex = raw.indexOf('\n')
        if (nlIndex >= 0) {
            val packet = raw.substring(0, nlIndex).trim()
            rxBuffer.delete(0, nlIndex + 1)
            if (packet.isNotEmpty()) parseAndValidateJson(packet)
        } else if (raw.trim().startsWith("{") && raw.trim().endsWith("}")) {
            val packet = raw.trim()
            rxBuffer.clear()
            parseAndValidateJson(packet)
        } else if (rxBuffer.length > 512) {
            rxBuffer.clear()
        }
    }

    private fun parseAndValidateJson(jsonStr: String) {
        try {
            val obj = JSONObject(jsonStr)
            val temp = obj.getDouble("temperature")
            val humidity = obj.getDouble("humidity")
            val ax = obj.getDouble("ax")
            val ay = obj.getDouble("ay")
            val az = obj.getDouble("az")

            if (temp !in -40.0..85.0 || humidity !in 0.0..100.0) {
                _error.value = "Out-of-bounds environmental sensor value received."
                return
            }

            val heatIndex = if (obj.has("heatIndex") && !obj.isNull("heatIndex")) {
                obj.getDouble("heatIndex")
            } else {
                HeatIndexCalculator.computeHeatIndexC(temp, humidity)
            }

            val (mag, label, anomaly) = HeatIndexCalculator.analyzeMotion(ax, ay, az)
            _telemetry.value = SensorTelemetry(
                temperature = temp,
                humidity = humidity,
                heatIndex = heatIndex,
                ax = ax,
                ay = ay,
                az = az,
                motionMagnitude = mag,
                activityLabel = label,
                anomalyFlagged = anomaly,
                timestampIso = Instant.now().toString(),
                isLiveHardware = true
            )
            _error.value = null
        } catch (ex: Exception) {
            _error.value = "Invalid JSON sensor packet: ${ex.message}"
        }
    }
}
