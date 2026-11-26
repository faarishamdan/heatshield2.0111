import type {
  ActivityLabel,
  HeatRiskLevel,
  RawBleSensorPayload,
  SensorReading,
  WorkerSettings,
} from '../types/heatshield';

export const HEATSHIELD_BLE_SERVICE_UUID = '12345678-1234-1234-1234-123456789000';
export const HEATSHIELD_BLE_CHARACTERISTIC_UUID = '12345678-1234-1234-1234-123456789001';

export const DEFAULT_SETTINGS: Omit<WorkerSettings, 'ownerId'> = {
  workerName: 'Field Worker',
  siteLocation: 'Sector B — Outdoor Structural Zone',
  emergencyContactName: 'Site Safety Supervisor',
  emergencyContactPhone: '',
  cautionThresholdC: 27,
  warningThresholdC: 32,
  dangerThresholdC: 39,
  notificationsEnabled: true,
};

/**
 * Computes NOAA Rothfusz environmental Heat Index in degrees Celsius
 * from ambient air temperature (°C) and relative humidity (%).
 * Note: Environmental estimate only — NOT core body temperature or WBGT.
 */
export function computeHeatIndexC(tempC: number, humidityPct: number): number {
  const tF = (tempC * 9) / 5 + 32;
  const rh = Math.min(100, Math.max(0, humidityPct));

  let hiF = 0.5 * (tF + 61.0 + (tF - 68.0) * 1.2 + rh * 0.094);

  if (hiF >= 80) {
    hiF =
      -42.379 +
      2.04901523 * tF +
      10.14333127 * rh -
      0.22475541 * tF * rh -
      0.00683783 * tF * tF -
      0.05481717 * rh * rh +
      0.00122874 * tF * tF * rh +
      0.00085282 * tF * rh * rh -
      0.00000199 * tF * tF * rh * rh;

    if (rh < 13 && tF >= 80 && tF <= 112) {
      const adj = ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(tF - 95)) / 17);
      hiF -= adj;
    } else if (rh > 85 && tF >= 80 && tF <= 87) {
      const adj = ((rh - 85) / 10) * ((87 - tF) / 5);
      hiF += adj;
    }
  }

  const hiC = ((hiF - 32) * 5) / 9;
  return Math.round(hiC * 10) / 10;
}

export function classifyHeatRisk(
  heatIndexC: number,
  settings: Pick<WorkerSettings, 'cautionThresholdC' | 'warningThresholdC' | 'dangerThresholdC'>
): {
  level: HeatRiskLevel;
  label: string;
  guidance: string;
  badgeClasses: string;
  surfaceClasses: string;
  accentColor: string;
} {
  if (heatIndexC >= settings.dangerThresholdC) {
    return {
      level: 'danger',
      label: 'Danger Level',
      guidance: 'Stop strenuous outdoor tasks, move to shade/cooling, hydrate, and notify supervisor.',
      badgeClasses: 'text-red-700 bg-red-50 border border-red-200',
      surfaceClasses: 'bg-red-50/70 border-red-200',
      accentColor: '#DC2626',
    };
  }
  if (heatIndexC >= settings.warningThresholdC) {
    return {
      level: 'warning',
      label: 'Extreme Caution',
      guidance: 'Enforce mandatory shaded rest intervals every 20-30 min and active hydration.',
      badgeClasses: 'text-orange-700 bg-orange-50 border border-orange-200',
      surfaceClasses: 'bg-orange-50/70 border-orange-200',
      accentColor: '#EA580C',
    };
  }
  if (heatIndexC >= settings.cautionThresholdC) {
    return {
      level: 'caution',
      label: 'Caution Level',
      guidance: 'Increase water intake and monitor worker exertion closely.',
      badgeClasses: 'text-amber-700 bg-amber-50 border border-amber-200',
      surfaceClasses: 'bg-amber-50/60 border-amber-200',
      accentColor: '#D97706',
    };
  }
  return {
    level: 'nominal',
    label: 'Nominal Range',
    guidance: 'Ambient thermal conditions are below configured caution thresholds.',
    badgeClasses: 'text-teal-700 bg-teal-50 border border-teal-200',
    surfaceClasses: 'bg-teal-50/50 border-teal-200',
    accentColor: '#0D9488',
  };
}

export function analyzeMotionMpu6050(
  ax: number,
  ay: number,
  az: number
): {
  motionMagnitude: number;
  dynamicDelta: number;
  activityLabel: ActivityLabel;
  anomalyFlagged: boolean;
} {
  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const roundedMag = Math.round(mag * 100) / 100;
  const dynamicDelta = Math.abs(mag - 1.0);

  if (mag >= 2.4 || mag <= 0.25) {
    return {
      motionMagnitude: roundedMag,
      dynamicDelta,
      activityLabel: 'Motion Spike (Review)',
      anomalyFlagged: true,
    };
  }
  if (dynamicDelta >= 0.35) {
    return {
      motionMagnitude: roundedMag,
      dynamicDelta,
      activityLabel: 'Active Labor',
      anomalyFlagged: false,
    };
  }
  if (dynamicDelta >= 0.08) {
    return {
      motionMagnitude: roundedMag,
      dynamicDelta,
      activityLabel: 'Light Movement',
      anomalyFlagged: false,
    };
  }
  return {
    motionMagnitude: roundedMag,
    dynamicDelta,
    activityLabel: 'Stationary',
    anomalyFlagged: false,
  };
}

export function validateBleJsonPayload(rawJson: string): {
  valid: boolean;
  payload?: RawBleSensorPayload;
  computedHeatIndex?: number;
  error?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { valid: false, error: 'Malformed JSON packet received from BLE stream.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Sensor payload must be a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;
  const requiredFields: (keyof RawBleSensorPayload)[] = ['temperature', 'humidity', 'ax', 'ay', 'az'];
  for (const field of requiredFields) {
    const value = obj[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return {
        valid: false,
        error: `Missing or non-numeric required sensor field "${field}".`,
      };
    }
  }

  const temperature = obj.temperature as number;
  const humidity = obj.humidity as number;
  const ax = obj.ax as number;
  const ay = obj.ay as number;
  const az = obj.az as number;

  if (temperature < -40 || temperature > 85) {
    return { valid: false, error: `Temperature ${temperature}°C is outside valid sensor bounds (-40 to 85°C).` };
  }
  if (humidity < 0 || humidity > 100) {
    return { valid: false, error: `Humidity ${humidity}% is outside valid sensor bounds (0 to 100%).` };
  }
  if ([ax, ay, az].some((v) => v < -20 || v > 20)) {
    return { valid: false, error: 'MPU6050 accelerometer axes must be within ±20g.' };
  }

  let heatIndex: number;
  if (typeof obj.heatIndex === 'number' && Number.isFinite(obj.heatIndex)) {
    if (obj.heatIndex < -40 || obj.heatIndex > 100) {
      return { valid: false, error: `heatIndex ${obj.heatIndex}°C is outside valid range (-40 to 100°C).` };
    }
    heatIndex = Math.round(obj.heatIndex * 10) / 10;
  } else {
    heatIndex = computeHeatIndexC(temperature, humidity);
  }

  return {
    valid: true,
    payload: {
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      heatIndex,
      ax: Math.round(ax * 100) / 100,
      ay: Math.round(ay * 100) / 100,
      az: Math.round(az * 100) / 100,
    },
    computedHeatIndex: computeHeatIndexC(temperature, humidity),
  };
}

export function buildGoogleMapsPlaceUrl(latitude: number, longitude: number): string {
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

export function buildCsvReport(readings: SensorReading[]): string {
  const headers = [
    'Recorded Date/Time (ISO)',
    'Source',
    'Temperature (C)',
    'Humidity (%)',
    'Heat Index (C)',
    'AX (g)',
    'AY (g)',
    'AZ (g)',
    'Motion Magnitude (g)',
    'Activity State',
    'Motion Anomaly Flagged',
    'Latitude',
    'Longitude',
    'GPS Accuracy (m)',
  ];

  const escape = (val: string | number | boolean) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };

  const rows = readings.map((r) =>
    [
      r.recordedAtIso,
      r.source,
      r.temperature.toFixed(1),
      r.humidity.toFixed(1),
      r.heatIndex.toFixed(1),
      r.ax.toFixed(2),
      r.ay.toFixed(2),
      r.az.toFixed(2),
      r.motionMagnitude.toFixed(2),
      r.activityLabel,
      r.anomalyFlagged ? 'YES' : 'NO',
      typeof r.latitude === 'number' ? r.latitude.toFixed(6) : '',
      typeof r.longitude === 'number' ? r.longitude.toFixed(6) : '',
      typeof r.gpsAccuracyM === 'number' ? r.gpsAccuracyM.toFixed(1) : '',
    ]
      .map(escape)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateDemoReadingStep(stepIndex: number): RawBleSensorPayload {
  const phase = (stepIndex % 24) / 24;
  const temperature = Math.round((29.5 + Math.sin(phase * Math.PI * 2) * 5.2) * 10) / 10;
  const humidity = Math.round((56 + Math.cos(phase * Math.PI * 2) * 14) * 10) / 10;
  const heatIndex = computeHeatIndexC(temperature, humidity);

  const isSpike = stepIndex > 0 && stepIndex % 17 === 0;
  const ax = isSpike ? 1.85 : Math.round((Math.sin(stepIndex * 0.9) * 0.28) * 100) / 100;
  const ay = isSpike ? 1.42 : Math.round((Math.cos(stepIndex * 1.1) * 0.22) * 100) / 100;
  const az = isSpike ? 1.65 : Math.round((0.98 + Math.sin(stepIndex * 0.5) * 0.12) * 100) / 100;

  return { temperature, humidity, heatIndex, ax, ay, az };
}
