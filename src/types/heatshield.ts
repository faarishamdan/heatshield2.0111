export type AppScreen =
  | 'welcome'
  | 'dashboard'
  | 'live'
  | 'map'
  | 'history'
  | 'ai'
  | 'sos'
  | 'reports'
  | 'settings';

export type GpsTrackingState =
  | 'idle'
  | 'locating'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  updatedAtIso: string;
}

export type DataSourceType = 'live_ble' | 'live_serial' | 'demo' | 'manual_test';

export type ActivityLabel =
  | 'Stationary'
  | 'Light Movement'
  | 'Active Labor'
  | 'Motion Spike (Review)';

export type HeatRiskLevel = 'nominal' | 'caution' | 'warning' | 'danger';

export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unsupported'
  | 'error';

export interface RawBleSensorPayload {
  temperature: number;
  humidity: number;
  heatIndex?: number;
  ax: number;
  ay: number;
  az: number;
}

export interface SensorReading {
  id: string;
  ownerId: string;
  temperature: number;
  humidity: number;
  heatIndex: number;
  ax: number;
  ay: number;
  az: number;
  motionMagnitude: number;
  activityLabel: ActivityLabel;
  anomalyFlagged: boolean;
  source: DataSourceType;
  recordedAtIso: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracyM?: number;
}

export interface WorkerSettings {
  ownerId: string;
  workerName: string;
  siteLocation: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  cautionThresholdC: number;
  warningThresholdC: number;
  dangerThresholdC: number;
  notificationsEnabled: boolean;
}

export type AlertLevel = 'caution' | 'warning' | 'danger' | 'motion_review';

export interface SafetyAlert {
  id: string;
  ownerId: string;
  level: AlertLevel;
  title: string;
  message: string;
  heatIndexC: number;
  acknowledged: boolean;
  createdAtIso: string;
}

export interface BlePacketLog {
  id: string;
  timestampIso: string;
  rawJson: string;
  valid: boolean;
  error?: string;
  source: DataSourceType;
}
