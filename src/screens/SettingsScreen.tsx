import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, Database, Lock, Save, Smartphone } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  HEATSHIELD_BLE_CHARACTERISTIC_UUID,
  HEATSHIELD_BLE_SERVICE_UUID,
} from '../utils/heatIndex';

export function SettingsScreen() {
  const { settings, saveSettings, settingsSaving, user, firestoreReachable } = useApp();

  const [workerName, setWorkerName] = useState(settings.workerName);
  const [siteLocation, setSiteLocation] = useState(settings.siteLocation);
  const [emergencyContactName, setEmergencyContactName] = useState(settings.emergencyContactName);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    settings.emergencyContactPhone
  );
  const [cautionThresholdC, setCautionThresholdC] = useState(settings.cautionThresholdC);
  const [warningThresholdC, setWarningThresholdC] = useState(settings.warningThresholdC);
  const [dangerThresholdC, setDangerThresholdC] = useState(settings.dangerThresholdC);
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    setWorkerName(settings.workerName);
    setSiteLocation(settings.siteLocation);
    setEmergencyContactName(settings.emergencyContactName);
    setEmergencyContactPhone(settings.emergencyContactPhone);
    setCautionThresholdC(settings.cautionThresholdC);
    setWarningThresholdC(settings.warningThresholdC);
    setDangerThresholdC(settings.dangerThresholdC);
    setNotificationsEnabled(settings.notificationsEnabled);
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedBanner(false);
    await saveSettings({
      workerName,
      siteLocation,
      emergencyContactName,
      emergencyContactPhone,
      cautionThresholdC,
      warningThresholdC,
      dangerThresholdC,
      notificationsEnabled,
    });
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 3500);
  };

  const [guideTab, setGuideTab] = useState<'esp32' | 'testing' | 'apk' | 'security'>('esp32');

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Worker Profile, Emergency Contact & Thresholds */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-2xl bg-white border border-slate-200 space-y-6"
      >
        <div>
          <h2 className="font-display font-semibold text-lg text-slate-900">
            Worker Profile, Emergency Contact &amp; Heat Thresholds
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Settings are saved automatically on this device across browser refreshes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="worker-name" className="block text-xs font-semibold text-slate-700">
              Worker Full Name
            </label>
            <input
              id="worker-name"
              type="text"
              required
              maxLength={80}
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="site-zone" className="block text-xs font-semibold text-slate-700">
              Site / Work Zone
            </label>
            <input
              id="site-zone"
              type="text"
              maxLength={120}
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ec-name" className="block text-xs font-semibold text-slate-700">
              Emergency Contact / Supervisor Name
            </label>
            <input
              id="ec-name"
              type="text"
              maxLength={80}
              value={emergencyContactName}
              onChange={(e) => setEmergencyContactName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ec-phone" className="block text-xs font-semibold text-slate-700">
              Emergency Contact Phone (SMS Composer Target)
            </label>
            <input
              id="ec-phone"
              type="tel"
              maxLength={24}
              placeholder="+1 555 010 9988"
              value={emergencyContactPhone}
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[44px]"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          <h3 className="text-xs font-semibold text-slate-800">
            Environmental Heat Index Alert Thresholds (°C)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="t-caution" className="block text-xs text-amber-800 font-medium">
                Caution (°C)
              </label>
              <input
                id="t-caution"
                type="number"
                min={20}
                max={55}
                step={0.5}
                value={cautionThresholdC}
                onChange={(e) => setCautionThresholdC(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="t-warning" className="block text-xs text-orange-800 font-medium">
                Extreme Caution / Warning (°C)
              </label>
              <input
                id="t-warning"
                type="number"
                min={cautionThresholdC}
                max={60}
                step={0.5}
                value={warningThresholdC}
                onChange={(e) => setWarningThresholdC(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="t-danger" className="block text-xs text-red-800 font-medium">
                Danger (°C)
              </label>
              <input
                id="t-danger"
                type="number"
                min={warningThresholdC}
                max={70}
                step={0.5}
                value={dangerThresholdC}
                onChange={(e) => setDangerThresholdC(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm min-h-[44px]"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2.5 pt-2 cursor-pointer text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
            />
            <span>Enable in-app and browser threshold exceedance notifications</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            disabled={settingsSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>{settingsSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>

          {savedBanner && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
              <CheckCircle2 className="w-4 h-4" />
              Settings saved
            </span>
          )}
        </div>
      </form>

      {/* Interactive Setup, Hardware & Android APK Reference */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-slate-900">
              Hardware, Database Security &amp; Android APK Reference
            </h3>
            <p className="text-xs text-slate-500">
              Full source files live in <code className="font-mono">/esp32-firmware</code>,{' '}
              <code className="font-mono">/android-app</code>, and{' '}
              <code className="font-mono">/docs/SETUP_AND_TESTING_GUIDE.md</code>.
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'esp32', label: 'ESP32 Wiring' },
                { id: 'testing', label: 'BLE Testing' },
                { id: 'apk', label: 'Android APK' },
                { id: 'security', label: 'Database & Security' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGuideTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  guideTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {guideTab === 'esp32' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Cpu className="w-4 h-4 text-[#0B1F3A]" />
              <span>ESP32-WROOM-DA Pinout &amp; BLE UUIDs</span>
            </div>
            <p>
              <strong>DHT22 Data:</strong> GPIO 4 (3.3V power) · <strong>MPU6050 I2C:</strong> SDA
              GPIO 21, SCL GPIO 22 (address 0x68).
            </p>
            <p className="font-mono text-[11px] break-all">
              Service: {HEATSHIELD_BLE_SERVICE_UUID}
              <br />
              Characteristic: {HEATSHIELD_BLE_CHARACTERISTIC_UUID}
            </p>
          </div>
        )}

        {guideTab === 'testing' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
            <p>
              1. Flash <code className="font-mono">esp32-firmware/heatshield_esp32.ino</code> and
              verify <code className="font-mono">[BLE] Advertising HEATSHIELD_AI</code> at 115200
              baud.
            </p>
            <p>
              2. Open HEATSHIELD AI in Chrome (Desktop or Android) and click{' '}
              <strong>Live Sensor Monitor &rarr; Scan &amp; Pair ESP32</strong>.
            </p>
            <p>
              3. Without hardware, test JSON schema validation in the{' '}
              <strong>JSON Telemetry Validator</strong> or toggle Demonstration Replay.
            </p>
          </div>
        )}

        {guideTab === 'apk' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Smartphone className="w-4 h-4 text-teal-700" />
              <span>Generating an Android APK</span>
            </div>
            <p>
              <strong>Native Kotlin/Compose:</strong> Open <code className="font-mono">/android-app</code>{' '}
              in Android Studio and run <code className="font-mono">./gradlew assembleDebug</code>{' '}
              (or Build &rarr; Build APK(s)).
            </p>
            <p>
              <strong>Capacitor Hybrid APK:</strong> Run <code className="font-mono">npm run build</code>{' '}
              then <code className="font-mono">npx cap add android &amp;&amp; npx cap sync android</code>{' '}
              using <code className="font-mono">capacitor.config.ts</code>.
            </p>
          </div>
        )}

        {guideTab === 'security' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Database className="w-4 h-4 text-teal-700" />
              <span>
                Firestore Connectivity: {firestoreReachable ? 'Reachable' : 'Offline / Check Config'}
              </span>
            </div>
            <p>
              Worker PII resides inside{' '}
              <code className="font-mono">/users/&#123;uid&#125;/private/settings</code>, readings are
              append-only, and <code className="font-mono">firestore.rules</code> enforces{' '}
              <code className="font-mono">email_verified == true</code>, ownership matching, and
              strict numeric bounds.
            </p>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Lock className="w-3.5 h-3.5" />
              <span>AI API keys remain exclusively on the Express backend.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
