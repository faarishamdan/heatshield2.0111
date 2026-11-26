import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Play,
  Send,
  Square,
  Usb,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { MotionAxisChart } from '../components/Charts';
import {
  formatShortTime,
  HEATSHIELD_BLE_CHARACTERISTIC_UUID,
  HEATSHIELD_BLE_SERVICE_UUID,
} from '../utils/heatIndex';

const SAMPLE_VALID_JSON =
  '{"temperature":34.6,"humidity":68.0,"heatIndex":48.2,"ax":0.14,"ay":-0.08,"az":0.99}';
const SAMPLE_SPIKE_JSON =
  '{"temperature":32.8,"humidity":61.5,"heatIndex":40.4,"ax":1.92,"ay":1.45,"az":1.61}';

export function LiveMonitorScreen() {
  const {
    bleState,
    bleDeviceName,
    bleError,
    bleSupported,
    connectBle,
    disconnectBle,
    serialState,
    serialError,
    serialSupported,
    connectSerial,
    disconnectSerial,
    demoActive,
    toggleDemoMode,
    currentReading,
    readings,
    packetLogs,
    injectTestJsonPacket,
    gpsPosition,
    gpsState,
    gpsTrackingEnabled,
    startGpsTracking,
    stopGpsTracking,
    setActiveScreen,
  } = useApp();

  const [manualJson, setManualJson] = useState(SAMPLE_VALID_JSON);
  const [injectFeedback, setInjectFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await injectTestJsonPacket(manualJson);
    setInjectFeedback(
      res.valid
        ? { ok: true, msg: 'Valid JSON packet parsed, validated, and recorded.' }
        : { ok: false, msg: res.error ?? 'Validation failed.' }
    );
  };

  return (
    <div className="space-y-6">
      {/* BLE & Serial Connection Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {bleState === 'connected' ? (
                <BluetoothConnected className="w-5 h-5 text-teal-600" />
              ) : (
                <Bluetooth className="w-5 h-5 text-[#0B1F3A]" />
              )}
              <h2 className="font-display font-semibold text-lg text-slate-900">
                ESP32-WROOM-DA Hardware Connection (BLE &amp; Serial)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              BLE: <strong className="text-slate-800">{bleState.toUpperCase()}</strong>
              {bleDeviceName ? ` (${bleDeviceName})` : ''} · Serial:{' '}
              <strong className="text-slate-800">{serialState.toUpperCase()}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {bleState === 'connected' ? (
              <button
                type="button"
                onClick={() => void disconnectBle()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium min-h-[44px]"
              >
                <BluetoothOff className="w-4 h-4" />
                <span>Disconnect BLE</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void connectBle()}
                disabled={!bleSupported || bleState === 'scanning' || bleState === 'connecting'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold min-h-[44px]"
              >
                <Bluetooth className="w-4 h-4" />
                <span>
                  {bleState === 'scanning'
                    ? 'Scanning for ESP32...'
                    : bleState === 'connecting'
                    ? 'Connecting GATT...'
                    : 'Pair ESP32 (BLE)'}
                </span>
              </button>
            )}

            {serialState === 'connected' ? (
              <button
                type="button"
                onClick={() => void disconnectSerial()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium min-h-[44px]"
              >
                <Usb className="w-4 h-4" />
                <span>Disconnect Serial</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void connectSerial()}
                disabled={!serialSupported || serialState === 'connecting'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium min-h-[44px]"
              >
                <Usb className="w-4 h-4" />
                <span>Connect USB / Serial</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleDemoMode}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium min-h-[44px] ${
                demoActive
                  ? 'bg-orange-50 border-orange-300 text-orange-900'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {demoActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{demoActive ? 'Stop Demo Stream' : 'Start Demo Stream'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div>
            <span className="text-slate-500 block">GATT Service UUID (BLE)</span>
            <span className="font-mono text-slate-900 break-all">{HEATSHIELD_BLE_SERVICE_UUID}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Notify Characteristic UUID (BLE)</span>
            <span className="font-mono text-slate-900 break-all">
              {HEATSHIELD_BLE_CHARACTERISTIC_UUID}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 md:border-l md:border-slate-200 md:pl-3">
            <div className="min-w-0">
              <span className="text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                GPS Geotagging ({gpsState.toUpperCase()})
              </span>
              <span className="font-mono text-slate-900 block truncate">
                {gpsPosition
                  ? `${gpsPosition.latitude.toFixed(5)}, ${gpsPosition.longitude.toFixed(5)}`
                  : 'Off — click to tag packets'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={gpsTrackingEnabled ? stopGpsTracking : startGpsTracking}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                  gpsTrackingEnabled
                    ? 'bg-teal-600 text-white'
                    : 'bg-[#0B1F3A] text-white'
                }`}
              >
                <LocateFixed className="w-3 h-3" />
                <span>{gpsTrackingEnabled ? 'On' : 'Enable'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScreen('map')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-medium hover:bg-slate-100"
              >
                Map
              </button>
            </div>
          </div>
        </div>

        {(bleError || serialError) && (
          <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 flex items-start gap-2.5 text-xs text-orange-950">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <span>{bleError || serialError}</span>
          </div>
        )}
      </div>

      {/* Live MPU6050 & Environmental Vector Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900">
                MPU6050 3-Axis Motion Magnitude
              </h3>
              <p className="text-xs text-slate-500">
                Detects movement intensity and flags sudden spikes (&ge;2.4g or &le;0.25g) for review
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-slate-700 tabular-nums">
              {currentReading ? `${currentReading.motionMagnitude.toFixed(2)} g` : '-- g'}
            </span>
          </div>

          <MotionAxisChart readings={readings} />

          <div className="grid grid-cols-3 gap-3 pt-1">
            {(['ax', 'ay', 'az'] as const).map((axis) => (
              <div key={axis} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-mono uppercase text-slate-500 block">{axis}</span>
                <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {currentReading ? `${currentReading[axis].toFixed(2)} g` : '--'}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            <strong>Motion Disclaimer:</strong> Activity labels and spike flags provide operational
            visibility only and do not constitute validated fall detection without dedicated
            clinical/field validation.
          </p>
        </div>

        {/* Manual JSON Validator / Tester */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            <h3 className="font-display font-semibold text-base text-slate-900">
              JSON Telemetry Validator &amp; Test Injector
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Test incoming ESP32 JSON validation, missing-field rejection, and threshold alerting
            before flashing physical hardware. Packets sent here are labeled{' '}
            <span className="font-mono">manual_test</span>.
          </p>

          <form onSubmit={handleInject} className="space-y-3">
            <textarea
              value={manualJson}
              onChange={(e) => setManualJson(e.target.value)}
              rows={4}
              aria-label="Sensor JSON payload"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 text-white text-xs font-semibold min-h-[40px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Validate &amp; Ingest</span>
              </button>
              <button
                type="button"
                onClick={() => setManualJson(SAMPLE_VALID_JSON)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 min-h-[40px]"
              >
                High Heat Sample
              </button>
              <button
                type="button"
                onClick={() => setManualJson(SAMPLE_SPIKE_JSON)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 min-h-[40px]"
              >
                Motion Spike Sample
              </button>
            </div>
          </form>

          {injectFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                injectFeedback.ok
                  ? 'bg-teal-50 border-teal-200 text-teal-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {injectFeedback.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{injectFeedback.msg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Raw BLE Packet Stream Inspector */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-base text-slate-900">
            Incoming Packet Validation Log
          </h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Last {packetLogs.length} frames
          </span>
        </div>

        {packetLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">
            No BLE or test packets received in this session yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {packetLogs.map((pkt) => (
              <div key={pkt.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`font-semibold shrink-0 ${
                      pkt.valid ? 'text-teal-700' : 'text-red-700'
                    }`}
                  >
                    {pkt.valid ? 'VALID' : 'REJECTED'}
                  </span>
                  <span className="font-mono text-slate-500 shrink-0">
                    {formatShortTime(pkt.timestampIso)}
                  </span>
                  <span className="text-slate-500 shrink-0">· {pkt.source}</span>
                  <code className="font-mono text-slate-800 truncate">{pkt.rawJson}</code>
                </div>
                {pkt.error && <span className="text-red-700 shrink-0">{pkt.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
