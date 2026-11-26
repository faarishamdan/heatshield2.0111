import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ThermalHistoryChart } from '../components/Charts';
import { buildCsvReport } from '../utils/heatIndex';

export function ReportsScreen() {
  const { readings, settings, seedDemoShiftHistory } = useApp();
  const [windowMode, setWindowMode] = useState<'daily' | 'weekly'>('daily');

  const scopedReadings = useMemo(() => {
    const cutoffMs =
      windowMode === 'daily'
        ? Date.now() - 24 * 60 * 60 * 1000
        : Date.now() - 7 * 24 * 60 * 60 * 1000;
    return readings.filter((r) => {
      const t = new Date(r.recordedAtIso).getTime();
      return !Number.isNaN(t) && t >= cutoffMs;
    });
  }, [readings, windowMode]);

  const stats = useMemo(() => {
    if (scopedReadings.length === 0) {
      return null;
    }
    const temps = scopedReadings.map((r) => r.temperature);
    const hums = scopedReadings.map((r) => r.humidity);
    const his = scopedReadings.map((r) => r.heatIndex);

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const cautionOrHigher = scopedReadings.filter(
      (r) => r.heatIndex >= settings.cautionThresholdC
    ).length;
    const warningOrHigher = scopedReadings.filter(
      (r) => r.heatIndex >= settings.warningThresholdC
    ).length;
    const motionSpikes = scopedReadings.filter((r) => r.anomalyFlagged).length;

    return {
      count: scopedReadings.length,
      avgTemp: avg(temps),
      maxTemp: Math.max(...temps),
      avgHumidity: avg(hums),
      avgHeatIndex: avg(his),
      maxHeatIndex: Math.max(...his),
      cautionOrHigher,
      warningOrHigher,
      motionSpikes,
    };
  }, [scopedReadings, settings.cautionThresholdC, settings.warningThresholdC]);

  const handleDownloadCsv = () => {
    const target = scopedReadings.length > 0 ? scopedReadings : readings;
    if (target.length === 0) return;

    const csv = buildCsvReport(target);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `heatshield_${windowMode}_report_${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-lg text-slate-900">
            Daily &amp; Weekly Exposure Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregates temperature, humidity, heat-index exceedances, and timestamps for CSV export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setWindowMode('daily')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowMode === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Daily (24h)
            </button>
            <button
              type="button"
              onClick={() => setWindowMode('weekly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowMode === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Weekly (7d)
            </button>
          </div>

          <button
            type="button"
            disabled={scopedReadings.length === 0 && readings.length === 0}
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {!stats ? (
        <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
          <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-medium text-slate-800">
            No readings recorded in the selected {windowMode} window
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Connect your ESP32 wearable or load a Demonstration Shift Sample to generate daily and
            weekly analytics and CSV exports.
          </p>
          <button
            type="button"
            onClick={() => void seedDemoShiftHistory()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B1F3A] text-white text-xs font-medium min-h-[40px]"
          >
            Load Demo Shift Sample
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Recorded Samples</div>
              <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {stats.count}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {windowMode === 'daily' ? 'Last 24 hours' : 'Last 7 days'}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Avg / Peak Temp</div>
              <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {stats.avgTemp.toFixed(1)}° / {stats.maxTemp.toFixed(1)}°
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Avg Humidity {stats.avgHumidity.toFixed(0)}%
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Peak Heat Index</div>
              <div className="font-mono text-2xl font-bold text-orange-700 mt-1 tabular-nums">
                {stats.maxHeatIndex.toFixed(1)} °C
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Mean {stats.avgHeatIndex.toFixed(1)} °C
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Threshold &amp; Motion Flags</div>
              <div className="font-mono text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {stats.warningOrHigher} / {stats.motionSpikes}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Warning+ HI · Motion Review
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
            <h3 className="font-display font-semibold text-base text-slate-900">
              {windowMode === 'daily' ? '24-Hour' : '7-Day'} Temperature &amp; Humidity Profile
            </h3>
            <ThermalHistoryChart
              readings={scopedReadings}
              warningThresholdC={settings.warningThresholdC}
              dangerThresholdC={settings.dangerThresholdC}
            />
          </div>
        </>
      )}
    </div>
  );
}
