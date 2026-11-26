import React, { useState } from 'react';
import { ArrowRight, Bluetooth, Cpu, ShieldCheck, ThermometerSun } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export function WelcomeScreen() {
  const { signInWithGoogle, enterGuestPreview, authError } = useApp();
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [hwImgFailed, setHwImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#0B1F3A] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-slate-900">
              HEATSHIELD AI
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#telemetry" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Telemetry
            </a>
            <a href="#hardware" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              ESP32 Hardware
            </a>
            <a href="#sdg" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              SDG Alignment
            </a>
          </nav>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Sign In with Google
          </button>
        </div>
      </header>

      {/* Hero Split */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="text-xs font-medium text-teal-700 tracking-wide">
              Wearable Environmental Telemetry · Outdoor &amp; Construction Safety
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
              Real-time heat exposure monitoring from the job site to your dashboard.
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Connect an ESP32-WROOM-DA wearable over Bluetooth Low Energy to track ambient temperature,
              relative humidity, environmental heat index, and MPU6050 movement patterns—with
              Firebase cloud history and Gemini-assisted safety guidance.
            </p>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                {authError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white text-sm font-semibold transition-colors min-h-[48px]"
              >
                <span>Sign In with Google (Cloud Sync)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={enterGuestPreview}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-sm font-medium transition-colors min-h-[48px]"
              >
                <span>Explore Demonstration Mode</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Sign in with Google to persist worker profiles, threshold alerts, and sensor history in
              Cloud Firestore. Demonstration Mode uses clearly labeled synthetic replay data and never
              fabricates live hardware readings.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-200">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/heatshield_wearable_hero_1795615618136.jpg"
                  alt="Construction supervisor wearing a compact HEATSHIELD environmental sensor node on a high-visibility safety vest"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0B1F3A] to-teal-900 text-white">
                  <ThermometerSun className="w-12 h-12 text-orange-400 mb-3" />
                  <p className="font-display font-semibold text-lg">HEATSHIELD AI Wearable System</p>
                  <p className="text-xs text-slate-300 mt-1">ESP32-WROOM-DA · MPU6050 · BLE GATT</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* System Capabilities */}
        <section id="telemetry" className="border-t border-slate-200 bg-white py-12">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <Bluetooth className="w-5 h-5 text-teal-700" />
              <h2 className="font-display font-semibold text-base text-slate-900">
                ESP32 BLE JSON Telemetry
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Pairs directly via Web Bluetooth or the companion Android Kotlin app using GATT Service{' '}
                <span className="font-mono text-xs text-slate-800">12345678-...-9000</span> and validates
                every incoming JSON frame.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <ThermometerSun className="w-5 h-5 text-orange-600" />
              <h2 className="font-display font-semibold text-base text-slate-900">
                Environmental Heat Index
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Computes NOAA Rothfusz heat index estimates in °C with configurable caution, warning,
                and danger levels—distinct from core body temperature or WBGT.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
              <Cpu className="w-5 h-5 text-[#0B1F3A]" />
              <h2 className="font-display font-semibold text-base text-slate-900">
                MPU6050 Motion &amp; SOS Composer
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tracks 3-axis movement magnitude, flags unusual motion spikes for supervisor review,
                and prepares cancelable SMS emergency messages in the device composer.
              </p>
            </div>
          </div>
        </section>

        {/* Hardware Showcase + SDG */}
        <section id="hardware" className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200 bg-white">
            {!hwImgFailed ? (
              <img
                src="/src/assets/images/esp32_sensor_node_1795615618500.jpg"
                alt="ESP32-WROOM-DA wearable sensor module with temperature, humidity, and MPU6050 motion sensors"
                referrerPolicy="no-referrer"
                onError={() => setHwImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-10 flex flex-col items-center justify-center bg-slate-100 text-slate-700">
                <Cpu className="w-10 h-10 mb-2" />
                <span className="text-sm font-medium">ESP32-WROOM-DA Wearable Node</span>
              </div>
            )}
          </div>

          <div id="sdg" className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Built for UN SDG 3 &amp; SDG 8 Worker Safety
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              HEATSHIELD AI directly supports <strong>UN Sustainable Development Goal 3 (Good Health and
              Well-being)</strong> and <strong>SDG 8 (Decent Work and Economic Growth)</strong> by
              giving outdoor crews, site supervisors, and safety officers accessible visibility into
              rising ambient heat stress before unsafe thresholds go unnoticed.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs font-semibold text-teal-700">SDG 3 · Good Health &amp; Well-being</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Proactive environmental heat-index alerts, hydration reminders, and fast SMS escalation.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs font-semibold text-[#0B1F3A]">SDG 8 · Decent Work</div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Transparent shift-level environmental logs and downloadable CSV compliance reports.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
