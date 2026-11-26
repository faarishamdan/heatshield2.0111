import React, { useMemo, useState } from 'react';
import { Database, ExternalLink, Search, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ThermalHistoryChart } from '../components/Charts';
import { buildGoogleMapsPlaceUrl, classifyHeatRisk, formatDateTime } from '../utils/heatIndex';

export function HistoryScreen() {
  const {
    readings,
    settings,
    seedDemoShiftHistory,
    deleteReading,
    clearLocalDemoReadings,
    user,
  } = useApp();

  const [sourceFilter, setSourceFilter] = useState<'all' | 'live_ble' | 'live_serial' | 'demo' | 'manual_test'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'elevated'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [seeding, setSeeding] = useState(false);

  const filteredReadings = useMemo(() => {
    return readings.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (riskFilter === 'elevated' && r.heatIndex < settings.cautionThresholdC && !r.anomalyFlagged) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const text = `${r.recordedAtIso} ${r.activityLabel} ${r.source} ${r.temperature} ${r.heatIndex}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [readings, sourceFilter, riskFilter, searchTerm, settings.cautionThresholdC]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoShiftHistory();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900">
              Recorded Thermal &amp; Motion History
            </h2>
            <p className="text-xs text-slate-500">
              Saved locally in your browser across sessions — export CSV anytime
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSeed()}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B1F3A] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium min-h-[40px]"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{seeding ? 'Generating...' : 'Load Demo Shift Sample'}</span>
            </button>
            {readings.length > 0 && (
              <button
                type="button"
                onClick={clearLocalDemoReadings}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 min-h-[40px]"
              >
                Clear Local Data
              </button>
            )}
          </div>
        </div>

        <ThermalHistoryChart
          readings={filteredReadings}
          warningThresholdC={settings.warningThresholdC}
          dangerThresholdC={settings.dangerThresholdC}
        />
      </div>

      {/* Filters & Table */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(['all', 'live_ble', 'live_serial', 'demo', 'manual_test'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    sourceFilter === src
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {src === 'all'
                    ? 'All Sources'
                    : src === 'live_ble'
                    ? 'Live BLE'
                    : src === 'live_serial'
                    ? 'Live Serial'
                    : src === 'demo'
                    ? 'Demo'
                    : 'Manual Test'}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRiskFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  riskFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                All Levels
              </button>
              <button
                type="button"
                onClick={() => setRiskFilter('elevated')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  riskFilter === 'elevated' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Caution / Flagged Only
              </button>
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search activity, source, time..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-600 min-h-[40px]"
            />
          </div>
        </div>

        {filteredReadings.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-sm text-slate-500">
            No matching readings found. Connect your ESP32 wearable or click &ldquo;Load Demo Shift Sample&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Timestamp</th>
                  <th className="py-2.5 pr-4 font-medium">Source</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Temp (°C)</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Humidity</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Heat Index</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Activity (MPU6050)</th>
                  <th className="py-2.5 pr-4 font-medium">GPS</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReadings.map((r) => {
                  const risk = classifyHeatRisk(r.heatIndex, settings);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-4 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                        {formatDateTime(r.recordedAtIso)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600 whitespace-nowrap">
                        {r.source === 'live_ble'
                          ? 'Live BLE'
                          : r.source === 'live_serial'
                          ? 'Live Serial'
                          : r.source === 'demo'
                          ? 'Demo'
                          : 'Manual Test'}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-right text-slate-900 tabular-nums">
                        {r.temperature.toFixed(1)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-right text-slate-900 tabular-nums">
                        {r.humidity.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-right font-semibold text-slate-900 tabular-nums">
                        {r.heatIndex.toFixed(1)}°C
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md font-medium ${risk.badgeClasses}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap">
                        {r.activityLabel} · <span className="font-mono tabular-nums">{r.motionMagnitude.toFixed(2)}g</span>
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap font-mono">
                        {typeof r.latitude === 'number' && typeof r.longitude === 'number' ? (
                          <a
                            href={buildGoogleMapsPlaceUrl(r.latitude, r.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                          >
                            <span>
                              {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                            </span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteReading(r.id)}
                          aria-label="Delete reading"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
