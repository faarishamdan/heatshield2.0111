# HEATSHIELD AI — Android Application (Kotlin + Jetpack Compose)

## Included Files
- `app/src/main/java/com/heatshield/ai/MainActivity.kt` — Jetpack Compose Material 3 dashboard, threshold config, and cancelable SOS dialog.
- `app/src/main/java/com/heatshield/ai/ble/BleHeatShieldManager.kt` — Android `BluetoothGatt` client connecting to ESP32-WROOM-DA Service `12345678-1234-1234-1234-123456789000` and Characteristic `12345678-1234-1234-1234-123456789001` with automatic reconnection and JSON validation.
- `app/src/main/java/com/heatshield/ai/util/HeatIndexCalculator.kt` — NOAA Rothfusz Heat Index (°C) and MPU6050 vector analyzer.
- `app/src/main/java/com/heatshield/ai/util/SosSmsHelper.kt` — Launches native SMS composer via `Intent.ACTION_SENDTO` (`smsto:`).

## Building an APK
1. Open `/android-app` in **Android Studio**.
2. Sync Gradle and select **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
3. Or build from CLI: `./gradlew assembleDebug` (outputs `app/build/outputs/apk/debug/app-debug.apk`).
