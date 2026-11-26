# HEATSHIELD AI — Installation, Database Security, Hardware Testing & Android APK Guide

## 1. System Architecture Overview
- **Web Application & Server (`server.ts`, `src/`)**: React 19 + Tailwind CSS v4 + Express backend serving Gemini AI safety endpoints (`/api/ai/analyze`, `/api/ai/chat`) and Web Bluetooth BLE telemetry (`navigator.bluetooth`).
- **Cloud Database & Auth (`firebase-applet-config.json`, `firestore.rules`, `firebase-blueprint.json`)**: Firebase Authentication (Google Sign-In) + Cloud Firestore with strict per-user verified-email isolation.
- **ESP32-WROOM-DA Firmware (`esp32-firmware/heatshield_esp32.ino`)**: Reads DHT22 (temperature/humidity) and MPU6050 (3-axis accelerometer) and notifies JSON frames over BLE.
- **Native Android App (`android-app/`)**: Kotlin + Jetpack Compose Android Studio project with `BluetoothGatt` BLE client and native SMS composer (`Intent.ACTION_SENDTO`).

---

## 2. Web Application Setup & Running Locally
1. Install Node.js 22+ and project dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (copy `.env.example` to `.env`):
   - `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser bundles).
3. Start development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build for production and start:
   ```bash
   npm run build
   npm start
   ```

---

## 3. Firebase Database Setup & Security Model
- **Collections (`firebase-blueprint.json`)**:
  - `/users/{userId}/private/settings`: Worker name, site location, emergency contact phone number (PII), and Heat Index thresholds.
  - `/users/{userId}/readings/{readingId}`: Append-only time-stamped temperature, humidity, heat index, and MPU6050 readings.
  - `/users/{userId}/alerts/{alertId}`: Threshold exceedance and motion review notifications.
- **Security Enforcement (`firestore.rules`)**:
  - Default-deny catch-all at root.
  - Requires `request.auth != null && request.auth.token.email_verified == true && request.auth.uid == userId`.
  - Rejects unknown shadow fields via `keys().hasOnly(...)` and enforces numeric sensor bounds (`-40..85°C`, `0..100% RH`, `±20g`) and server timestamps (`request.time`).
  - Readings cannot be modified after creation (`allow update: if false`).
- **Linting & Deploying Rules**:
  ```bash
  npx eslint firestore.rules
  ```

---

## 4. ESP32-WROOM-DA Hardware Wiring & Testing Guide
### Wiring
| Component | ESP32-WROOM-DA Pin | Notes |
|---|---|---|
| DHT22 Data | `GPIO 4` | Add 10kΩ pull-up to 3.3V if bare sensor |
| DHT22 VCC / GND | `3.3V` / `GND` | Do not exceed 3.3V logic |
| MPU6050 SDA | `GPIO 21` | I2C Data |
| MPU6050 SCL | `GPIO 22` | I2C Clock |
| MPU6050 VCC / GND | `3.3V` / `GND` | Default I2C address `0x68` |

### BLE Identifiers
- **Service UUID**: `12345678-1234-1234-1234-123456789000`
- **Characteristic UUID**: `12345678-1234-1234-1234-123456789001`

### Expected JSON Payload
```json
{"temperature":34.6,"humidity":68.0,"heatIndex":48.2,"ax":0.14,"ay":-0.08,"az":0.99}
```

### Hardware Testing Procedure
1. Flash `esp32-firmware/heatshield_esp32.ino` using Arduino IDE (`ESP32 Dev Module`) or PlatformIO (`pio run -t upload`).
2. Open Serial Monitor at `115200 baud` and confirm `[BLE] Advertising HEATSHIELD_AI` and `[TELEMETRY] {...}` prints every 2 seconds.
3. Open HEATSHIELD AI in **Chrome on Android** or **Chrome/Edge on Desktop** (HTTPS or `localhost`).
4. Go to **Live Sensor Monitor -> Scan & Pair ESP32** and select `HEATSHIELD_AI`.
5. Verify the dashboard switches from `Sensor Unpaired` / `Demonstration Replay` to `Live Hardware Connected`, and watch real-time packets appear in the **Incoming Packet Validation Log**.
6. Test threshold alerts by gently warming the DHT22 sensor, and test MPU6050 motion review flags by briskly shaking the enclosure (>2.4g).

---

## 5. Generating an Android APK

### Option A: Native Kotlin + Jetpack Compose APK (`/android-app`)
1. Open **Android Studio** (Ladybug or newer) and choose **Open** -> select `/android-app`.
2. Let Gradle sync (`compileSdk 35`, `minSdk 26`).
3. To enable Firebase in the native Android project, download `google-services.json` from your Firebase Console and place it in `android-app/app/google-services.json`.
4. Connect an Android device with USB Debugging enabled (or build an APK without device):
   - Menu: **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**
   - Or CLI inside `android-app/`:
     ```bash
     ./gradlew assembleDebug
     ```
   - Output APK: `android-app/app/build/outputs/apk/debug/app-debug.apk`.
5. For release signing, use **Build -> Generate Signed Bundle / APK**.

### Option B: Hybrid APK via Capacitor (`capacitor.config.ts`)
1. Build the web bundle:
   ```bash
   npm run build
   ```
2. Install Capacitor Android platform & BLE plugin locally:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   npx cap sync android
   npx cap open android
   ```
3. Build the APK from Android Studio (**Build -> Build APK(s)**).
