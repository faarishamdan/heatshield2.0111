import React from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bluetooth,
  BluetoothConnected,
  CheckCircle2,
  Clock,
  Droplets,
  Info,
  Play,
  Square,
  Thermometer,
  ThermometerSun,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ThermalHistoryChart } from '../components/Charts';
import { WorkerGpsMap } from '../components/WorkerGpsMap';
import { classifyHeatRisk, formatDateTime, formatShortTime } from '../utils/heatIndex';

export function DashboardScreen() {
  const {
    currentReading,
    readings,
    alerts,
    settings,
    bleState,
    bleDeviceName,
    serialState,
    demoActive,
    toggleDemoMode,
    connectBle,
    acknowledgeAlert,
    setActiveScreen,
    lastUpdateIso,
    user,
  } = useApp();

  const risk = currentReading
    ? classifyHeatRisk(currentReading.heatIndex, settings)
    : null;

  const activeAlerts = alerts.filter((a) => !a.acknowledged).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Source Distinction Banner */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          {bleState === 'connected' ? (
            <BluetoothConnected className="w-5 h-5 text-teal-600 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <Bluetooth className="w-5 h-5 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {bleState === 'connected'
                ? `Live Hardware Connected (${bleDeviceName ?? 'HEATSHIELD_AI'})`
                : serialState === 'connected'
                ? 'Live Hardware Connected via Serial / USB (115200 baud)'
                : demoActive
                ? 'Demonstration Replay Active (Synthetic Data — Not Live Hardware)'
                : 'No Hardware Connected — Awaiting ESP32 BLE or Serial Telemetry'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
              <span>Worker: {settings.workerName}</span>
              <span aria-hidden="true">·</span>
              <span>{settings.siteLocation || 'Unassigned Zone'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {lastUpdateIso ? `Last update ${formatShortTime(lastUpdateIso)}` : 'No packets received'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {bleState !== 'connected' && serialState !== 'connected' && (
            <button
              type="button"
              onClick={() => void connectBle()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white text-xs font-medium transition-colors min-h-[40px]"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Connect ESP32</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleDemoMode}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors min-h-[40px] ${
              demoActive
                ? 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-100'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {demoActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{demoActive ? 'Stop Demo Replay' : 'Run Demo Replay'}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Temperature */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Ambient Temperature</span>
            <Thermometer className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {currentReading ? `${currentReading.temperature.toFixed(1)} °C` : '--.- °C'}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {currentReading
              ? `Source: ${
                  currentReading.source === 'live_ble'
                    ? 'ESP32 Live BLE'
                    : currentReading.source === 'live_serial'
                    ? 'ESP32 Live Serial'
                    : currentReading.source === 'demo'
                    ? 'Demonstration'
                    : 'Manual Test'
                }`
              : 'Connect sensor to measure'}
          </div>
        </div>

        {/* Relative Humidity */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Relative Humidity</span>
            <Droplets className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {currentReading ? `${currentReading.humidity.toFixed(1)} %` : '--.- %'}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Atmospheric moisture reading
          </div>
        </div>

        {/* Heat Index */}
        <div className={`p-5 rounded-2xl border ${risk ? risk.surfaceClasses : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span>Environmental Heat Index</span>
            <ThermometerSun className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {currentReading ? `${currentReading.heatIndex.toFixed(1)} °C` : '--.- °C'}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
            {risk ? (
              <span className={`px-2 py-0.5 rounded-md ${risk.badgeClasses}`}>
                {risk.label}
              </span>
            ) : (
              <span className="text-slate-500 font-normal">Threshold: ≥{settings.warningThresholdC}°C Warning</span>
            )}
          </div>
        </div>

        {/* Motion / Activity */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Motion &amp; Activity (MPU6050)</span>
            <Activity className="w-4 h-4 text-[#0B1F3A]" />
          </div>
          <div className="mt-2 font-display text-xl font-bold text-slate-900">
            {currentReading ? currentReading.activityLabel : 'No Signal'}
          </div>
          <div className="mt-2 font-mono text-xs text-slate-600 tabular-nums">
            {currentReading
              ? `|a| = ${currentReading.motionMagnitude.toFixed(2)}g (${currentReading.ax.toFixed(2)}, ${currentReading.ay.toFixed(2)}, ${currentReading.az.toFixed(2)})`
              : 'Waiting for ax, ay, az'}
          </div>
        </div>
      </div>

      {/* Scientific Clarity Disclaimer */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#0B1F3A] shrink-0 mt-0.5" />
        <p className="text-xs text-slate-700 leading-relaxed">
          <strong>Measurement Note:</strong> Heat Index is an <em>environmental estimate</em> derived
          from ambient temperature and relative humidity. It is <strong>not</strong> core body
          temperature and <strong>not</strong> Wet-Bulb Globe Temperature (WBGT). MPU6050 spikes flag
          unusual motion patterns for human review and are not validated fall detection.
        </p>
      </div>

      {/* Main Chart + Active Safety Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900">
                Temperature, Humidity &amp; Heat Index Trend
              </h2>
              <p className="text-xs text-slate-500">
                Most recent {Math.min(readings.length, 36)} recorded readings · Hover points to inspect
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('history')}
              className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
            >
              View Full History
            </button>
          </div>

          <ThermalHistoryChart
            readings={readings}
            warningThresholdC={settings.warningThresholdC}
            dangerThresholdC={settings.dangerThresholdC}
          />
        </div>

        <div className="lg:col-span-4 p-6 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-600" />
                <h2 className="font-display font-semibold text-base text-slate-900">
                  Safety Notifications
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {activeAlerts.length} active
              </span>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 px-4">
                <CheckCircle2 className="w-6 h-6 text-teal-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700">No unacknowledged alerts</p>
                <p className="text-xs text-slate-500 mt-1">
                  Warnings trigger automatically when Heat Index exceeds {settings.cautionThresholdC}°C
                  or an MPU6050 motion spike is flagged.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      alert.level === 'danger'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : alert.level === 'warning' || alert.level === 'motion_review'
                        ? 'bg-orange-50 border-orange-200 text-orange-950'
                        : 'bg-amber-50 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{alert.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void acknowledgeAlert(alert.id)}
                        className="text-[11px] font-medium underline shrink-0"
                      >
                        Acknowledge
                      </button>
                    </div>
                    <p className="leading-relaxed opacity-90">{alert.message}</p>
                    <div className="flex items-center gap-1.5 text-[11px] opacity-75 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(alert.createdAtIso)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Saved locally on this device</span>
            <button
              type="button"
              onClick={() => setActiveScreen('ai')}
              className="font-medium text-teal-700 hover:underline"
            >
              Ask AI Safety Assistant
            </button>
          </div>
        </div>
      </div>

      {/* Live GPS Site Map Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900">
              Live GPS Location &amp; Site Map
            </h2>
            <p className="text-xs text-slate-500">
              Free interactive street &amp; satellite map with heat-risk pin and geotagged trail
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveScreen('map')}
            className="text-xs font-medium text-teal-700 hover:underline whitespace-nowrap"
          >
            Open Full GPS View
          </button>
        </div>
        <WorkerGpsMap heightClass="h-[320px]" compact />
      </div>
    </div>
  );
}
