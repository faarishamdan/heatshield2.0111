/**
 * HEATSHIELD AI — ESP32-WROOM-DA Wearable Telemetry Firmware
 * Sensors: DHT22 (Temperature & Humidity) + MPU6050 (3-Axis Accelerometer)
 * Transport: Bluetooth Low Energy (BLE GATT Notify)
 *
 * Service UUID:        12345678-1234-1234-1234-123456789000
 * Characteristic UUID: 12345678-1234-1234-1234-123456789001
 */

#include <Arduino.h>
#include <Wire.h>
#include <DHT.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <math.h>

#define SERVICE_UUID        "12345678-1234-1234-1234-123456789000"
#define CHARACTERISTIC_UUID "12345678-1234-1234-1234-123456789001"
#define DEVICE_NAME         "HEATSHIELD_AI"

#define DHT_PIN   4
#define DHT_TYPE  DHT22
#define MPU_ADDR  0x68
#define I2C_SDA   21
#define I2C_SCL   22

#define SAMPLE_INTERVAL_MS 2000

DHT dht(DHT_PIN, DHT_TYPE);

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long lastSampleMs = 0;

class HeatShieldServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    deviceConnected = true;
    Serial.println("[BLE] Client connected");
  }

  void onDisconnect(BLEServer* server) override {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected");
  }
};

float computeHeatIndexC(float tempC, float humidityPct) {
  float tF = tempC * 9.0f / 5.0f + 32.0f;
  float rh = fminf(100.0f, fmaxf(0.0f, humidityPct));
  float hiF = 0.5f * (tF + 61.0f + ((tF - 68.0f) * 1.2f) + (rh * 0.094f));

  if (hiF >= 80.0f) {
    hiF = -42.379f + 2.04901523f * tF + 10.14333127f * rh
        - 0.22475541f * tF * rh - 0.00683783f * tF * tF
        - 0.05481717f * rh * rh + 0.00122874f * tF * tF * rh
        + 0.00085282f * tF * rh * rh - 0.00000199f * tF * tF * rh * rh;

    if (rh < 13.0f && tF >= 80.0f && tF <= 112.0f) {
      hiF -= ((13.0f - rh) / 4.0f) * sqrtf((17.0f - fabsf(tF - 95.0f)) / 17.0f);
    } else if (rh > 85.0f && tF >= 80.0f && tF <= 87.0f) {
      hiF += ((rh - 85.0f) / 10.0f) * ((87.0f - tF) / 5.0f);
    }
  }
  return (hiF - 32.0f) * 5.0f / 9.0f;
}

bool initMpu6050() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake up MPU6050
  uint8_t err = Wire.endTransmission(true);
  if (err != 0) {
    Serial.printf("[MPU6050] Init failed with I2C error %u\n", err);
    return false;
  }

  // Configure +/- 2g accelerometer range (ACCEL_CONFIG = 0x1C -> 0x00)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);
  Wire.write(0x00);
  Wire.endTransmission(true);
  return true;
}

bool readMpu6050(float& ax, float& ay, float& az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  uint8_t count = Wire.requestFrom((uint16_t)MPU_ADDR, (uint8_t)6, true);
  if (count < 6) {
    return false;
  }

  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();

  ax = rawX / 16384.0f;
  ay = rawY / 16384.0f;
  az = rawZ / 16384.0f;
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("Starting HEATSHIELD AI ESP32-WROOM-DA Node...");

  Wire.begin(I2C_SDA, I2C_SCL);
  initMpu6050();
  dht.begin();

  BLEDevice::init(DEVICE_NAME);
  BLEDevice::setMTU(185);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new HeatShieldServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising HEATSHIELD_AI");
}

void loop() {
  // Handle BLE reconnection advertising
  if (!deviceConnected && oldDeviceConnected) {
    delay(400);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  unsigned long now = millis();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) {
    delay(20);
    return;
  }
  lastSampleMs = now;

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[DHT22] Sensor read returned NaN — skipping packet");
    return;
  }

  float ax = 0.0f, ay = 0.0f, az = 1.0f;
  if (!readMpu6050(ax, ay, az)) {
    Serial.println("[MPU6050] Read failed — skipping packet");
    return;
  }

  float heatIndex = computeHeatIndexC(temperature, humidity);

  char jsonPayload[160];
  int len = snprintf(
    jsonPayload,
    sizeof(jsonPayload),
    "{\"temperature\":%.1f,\"humidity\":%.1f,\"heatIndex\":%.1f,\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f}\n",
    temperature,
    humidity,
    heatIndex,
    ax,
    ay,
    az
  );

  if (len <= 0 || len >= (int)sizeof(jsonPayload)) {
    Serial.println("[JSON] Payload buffer overflow — skipped");
    return;
  }

  Serial.print("[TELEMETRY] ");
  Serial.print(jsonPayload);

  if (deviceConnected) {
    pCharacteristic->setValue((uint8_t*)jsonPayload, (size_t)len);
    pCharacteristic->notify();
  }
}
