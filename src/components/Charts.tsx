import React, { useState } from 'react';
import type { SensorReading } from '../types/heatshield';
import { formatShortTime } from '../utils/heatIndex';

interface ThermalChartProps {
  readings: SensorReading[];
  warningThresholdC?: number;
  dangerThresholdC?: number;
  height?: number;
}

export function ThermalHistoryChart({
  readings,
  warningThresholdC = 32,
  dangerThresholdC = 39,
  height = 240,
}: ThermalChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chronological = [...readings].reverse().slice(-36);

  if (chronological.length === 0) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60 text-center px-4">
        <p className="text-sm font-medium text-slate-700">No thermal telemetry recorded yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Pair your ESP32-WROOM-DA wearable via BLE or enable Demonstration Mode to plot temperature, humidity, and heat index.
        </p>
      </div>
    );
  }

  const width = 760;
  const padL = 44;
  const padR = 44;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const temps = chronological.flatMap((r) => [r.temperature, r.heatIndex]);
  const minTemp = Math.floor(Math.min(...temps, 18) - 2);
  const maxTemp = Math.ceil(Math.max(...temps, dangerThresholdC + 2, 42));
  const tempRange = Math.max(5, maxTemp - minTemp);

  const getX = (i: number) =>
    chronological.length === 1 ? padL + plotW / 2 : padL + (i / (chronological.length - 1)) * plotW;
  const getTempY = (t: number) => padT + ((maxTemp - t) / tempRange) * plotH;
  const getHumY = (h: number) => padT + ((100 - Math.min(100, Math.max(0, h))) / 100) * plotH;

  const tempPath = chronological
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getTempY(r.temperature).toFixed(1)}`)
    .join(' ');
  const hiPath = chronological
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getTempY(r.heatIndex).toFixed(1)}`)
    .join(' ');
  const humPath = chronological
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getHumY(r.humidity).toFixed(1)}`)
    .join(' ');

  const warnY = getTempY(warningThresholdC);
  const activePoint = hoverIdx !== null ? chronological[hoverIdx] : chronological[chronological.length - 1];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-900 inline-block" />
            Temperature (°C)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-orange-600 inline-block" />
            Heat Index (°C)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-teal-600 inline-block" />
            Humidity (%)
          </span>
        </div>
        {activePoint && (
          <div className="font-mono text-xs text-slate-700 tabular-nums">
            {formatShortTime(activePoint.recordedAtIso)} · {activePoint.temperature.toFixed(1)}°C ·{' '}
            {activePoint.humidity.toFixed(0)}% RH · HI {activePoint.heatIndex.toFixed(1)}°C
          </div>
        )}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[420px] h-auto select-none"
          role="img"
          aria-label="Temperature, humidity, and environmental heat index chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + frac * plotH;
            const tempLabel = Math.round(maxTemp - frac * tempRange);
            const humLabel = Math.round(100 - frac * 100);
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {tempLabel}°
                </text>
                <text
                  x={width - padR + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-teal-700 text-[10px] font-mono"
                >
                  {humLabel}%
                </text>
              </g>
            );
          })}

          {warnY >= padT && warnY <= padT + plotH && (
            <g>
              <line
                x1={padL}
                y1={warnY}
                x2={width - padR}
                y2={warnY}
                stroke="#EA580C"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.7"
              />
              <text
                x={padL + 6}
                y={warnY - 4}
                className="fill-orange-700 text-[10px] font-medium"
              >
                Warning {warningThresholdC}°C HI
              </text>
            </g>
          )}

          <path d={humPath} fill="none" stroke="#0D9488" strokeWidth="1.8" strokeOpacity="0.85" />
          <path d={tempPath} fill="none" stroke="#0F172A" strokeWidth="2" />
          <path d={hiPath} fill="none" stroke="#EA580C" strokeWidth="2.2" />

          {chronological.map((r, i) => {
            const cx = getX(i);
            const cy = getTempY(r.heatIndex);
            const isHovered = hoverIdx === i;
            return (
              <g key={r.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 4.5 : 2.5}
                  className={isHovered ? 'fill-orange-600' : 'fill-orange-500'}
                />
                <rect
                  x={cx - Math.max(8, plotW / chronological.length / 2)}
                  y={padT}
                  width={Math.max(16, plotW / chronological.length)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              </g>
            );
          })}

          {chronological.length > 1 && (
            <>
              <text
                x={padL}
                y={height - 10}
                textAnchor="start"
                className="fill-slate-500 text-[10px] font-mono"
              >
                {formatShortTime(chronological[0].recordedAtIso)}
              </text>
              <text
                x={width - padR}
                y={height - 10}
                textAnchor="end"
                className="fill-slate-500 text-[10px] font-mono"
              >
                {formatShortTime(chronological[chronological.length - 1].recordedAtIso)}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export function MotionAxisChart({ readings }: { readings: SensorReading[] }) {
  const chronological = [...readings].reverse().slice(-30);
  if (chronological.length === 0) {
    return (
      <div className="h-[170px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60 text-xs text-slate-500">
        Waiting for MPU6050 accelerometer readings (ax, ay, az)...
      </div>
    );
  }

  const width = 640;
  const height = 170;
  const padL = 36;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxMag = Math.max(3, ...chronological.map((r) => r.motionMagnitude));
  const getX = (i: number) =>
    chronological.length === 1 ? padL + plotW / 2 : padL + (i / (chronological.length - 1)) * plotW;
  const getY = (val: number) => padT + ((maxMag - Math.min(maxMag, Math.max(0, val))) / maxMag) * plotH;

  const magPath = chronological
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(r.motionMagnitude).toFixed(1)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="MPU6050 motion vector magnitude chart">
      {[0, 1, 2, 3].map((g) => {
        if (g > maxMag) return null;
        const y = getY(g);
        return (
          <g key={g}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
            <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-slate-500 text-[10px] font-mono">
              {g}g
            </text>
          </g>
        );
      })}
      <path d={magPath} fill="none" stroke="#0B1F3A" strokeWidth="2.2" />
      {chronological.map((r, i) => (
        <circle
          key={r.id}
          cx={getX(i)}
          cy={getY(r.motionMagnitude)}
          r={r.anomalyFlagged ? 4.5 : 2.5}
          className={r.anomalyFlagged ? 'fill-orange-600' : 'fill-teal-600'}
        />
      ))}
    </svg>
  );
}
