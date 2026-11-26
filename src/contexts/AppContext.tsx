import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../services/firebase';
import { Esp32BleClient } from '../services/bleService';
import { Esp32SerialClient, type SerialConnectionState } from '../services/serialService';
import { gpsService } from '../services/gpsService';
import {
  analyzeMotionMpu6050,
  classifyHeatRisk,
  computeHeatIndexC,
  DEFAULT_SETTINGS,
  generateDemoReadingStep,
  validateBleJsonPayload,
} from '../utils/heatIndex';
import type {
  AlertLevel,
  AppScreen,
  BleConnectionState,
  BlePacketLog,
  DataSourceType,
  GpsPosition,
  GpsTrackingState,
  SafetyAlert,
  SensorReading,
  WorkerSettings,
} from '../types/heatshield';

interface AppContextValue {
  user: User | null;
  authReady: boolean;
  guestPreview: boolean;
  enterGuestPreview: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  authError: string | null;
  firestoreReachable: boolean;

  activeScreen: AppScreen;
  setActiveScreen: (screen: AppScreen) => void;

  settings: WorkerSettings;
  saveSettings: (next: Omit<WorkerSettings, 'ownerId'>) => Promise<void>;
  settingsSaving: boolean;

  bleState: BleConnectionState;
  bleDeviceName: string | null;
  bleError: string | null;
  bleSupported: boolean;
  connectBle: () => Promise<void>;
  disconnectBle: () => Promise<void>;

  serialState: SerialConnectionState;
  serialError: string | null;
  serialSupported: boolean;
  connectSerial: () => Promise<void>;
  disconnectSerial: () => Promise<void>;

  demoActive: boolean;
  toggleDemoMode: () => void;
  seedDemoShiftHistory: () => Promise<void>;
  injectTestJsonPacket: (rawJson: string) => Promise<{ valid: boolean; error?: string }>;

  currentReading: SensorReading | null;
  readings: SensorReading[];
  alerts: SafetyAlert[];
  packetLogs: BlePacketLog[];
  lastUpdateIso: string | null;

  acknowledgeAlert: (alertId: string) => Promise<void>;
  deleteReading: (readingId: string) => Promise<void>;
  clearLocalDemoReadings: () => void;

  gpsState: GpsTrackingState;
  gpsPosition: GpsPosition | null;
  gpsError: string | null;
  gpsSupported: boolean;
  gpsTrackingEnabled: boolean;
  startGpsTracking: () => void;
  stopGpsTracking: () => void;
  refreshGpsOnce: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

const LS_SETTINGS_KEY = 'heatshield_settings_v1';
const LS_READINGS_KEY = 'heatshield_readings_v1';
const LS_ALERTS_KEY = 'heatshield_alerts_v1';

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(true);
  const [guestPreview, setGuestPreview] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreReachable, setFirestoreReachable] = useState(true);

  const [activeScreen, setActiveScreen] = useState<AppScreen>('dashboard');

  const [settings, setSettings] = useState<WorkerSettings>(() => {
    const saved = readLocalJson<Partial<WorkerSettings> | null>(LS_SETTINGS_KEY, null);
    return {
      ownerId: 'local_device',
      ...DEFAULT_SETTINGS,
      ...(saved ?? {}),
    };
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsCreatedInDb, setSettingsCreatedInDb] = useState(false);

  const [bleState, setBleState] = useState<BleConnectionState>(() =>
    Esp32BleClient.isSupported() ? 'disconnected' : 'unsupported'
  );
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [bleError, setBleError] = useState<string | null>(null);

  const [serialState, setSerialState] = useState<SerialConnectionState>(() =>
    Esp32SerialClient.isSupported() ? 'disconnected' : 'unsupported'
  );
  const [serialError, setSerialError] = useState<string | null>(null);

  const [demoActive, setDemoActive] = useState(false);
  const [readings, setReadings] = useState<SensorReading[]>(() => {
    const saved = readLocalJson<SensorReading[]>(LS_READINGS_KEY, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [currentReading, setCurrentReading] = useState<SensorReading | null>(() => {
    const saved = readLocalJson<SensorReading[]>(LS_READINGS_KEY, []);
    return Array.isArray(saved) && saved.length > 0 ? saved[0] : null;
  });
  const [alerts, setAlerts] = useState<SafetyAlert[]>(() => {
    const saved = readLocalJson<SafetyAlert[]>(LS_ALERTS_KEY, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [packetLogs, setPacketLogs] = useState<BlePacketLog[]>([]);

  const [gpsState, setGpsState] = useState<GpsTrackingState>(() =>
    gpsService.isSupported() ? 'idle' : 'unavailable'
  );
  const [gpsPosition, setGpsPosition] = useState<GpsPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(false);

  const bleClientRef = useRef<Esp32BleClient | null>(null);
  const serialClientRef = useRef<Esp32SerialClient | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsPositionRef = useRef<GpsPosition | null>(null);
  const lastDbPersistMsRef = useRef<number>(0);
  const lastAlertKeyRef = useRef<string>('');
  const demoStepRef = useRef<number>(0);
  const settingsRef = useRef<WorkerSettings>(settings);
  const userRef = useRef<User | null>(user);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    gpsPositionRef.current = gpsPosition;
  }, [gpsPosition]);

  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [settings, user]);

  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_READINGS_KEY, JSON.stringify(readings.slice(0, 180)));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [readings, user]);

  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_ALERTS_KEY, JSON.stringify(alerts.slice(0, 40)));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [alerts, user]);

  useEffect(() => {
    return () => {
      gpsService.stopWatching(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    testFirestoreConnection().then((res) => {
      setFirestoreReachable(res.reachable);
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        setGuestPreview(false);
        setSettings((prev) => ({
          ...prev,
          ownerId: firebaseUser.uid,
          workerName:
            prev.workerName === DEFAULT_SETTINGS.workerName && firebaseUser.displayName
              ? firebaseUser.displayName.slice(0, 80)
              : prev.workerName,
        }));
        setActiveScreen((curr) => (curr === 'welcome' ? 'dashboard' : curr));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setSettingsCreatedInDb(false);
      return;
    }

    const uid = user.uid;
    const settingsPath = `users/${uid}/private/settings`;
    const unsubSettings = onSnapshot(
      doc(db, 'users', uid, 'private', 'settings'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setSettingsCreatedInDb(true);
          setSettings({
            ownerId: uid,
            workerName: String(d.workerName ?? DEFAULT_SETTINGS.workerName),
            siteLocation: String(d.siteLocation ?? DEFAULT_SETTINGS.siteLocation),
            emergencyContactName: String(
              d.emergencyContactName ?? DEFAULT_SETTINGS.emergencyContactName
            ),
            emergencyContactPhone: String(d.emergencyContactPhone ?? ''),
            cautionThresholdC: Number(d.cautionThresholdC ?? DEFAULT_SETTINGS.cautionThresholdC),
            warningThresholdC: Number(d.warningThresholdC ?? DEFAULT_SETTINGS.warningThresholdC),
            dangerThresholdC: Number(d.dangerThresholdC ?? DEFAULT_SETTINGS.dangerThresholdC),
            notificationsEnabled: Boolean(d.notificationsEnabled ?? true),
          });
        } else {
          setSettingsCreatedInDb(false);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, settingsPath)
    );

    const readingsPath = `users/${uid}/readings`;
    const readingsQ = query(
      collection(db, 'users', uid, 'readings'),
      where('ownerId', '==', uid),
      limit(200)
    );
    const unsubReadings = onSnapshot(
      readingsQ,
      (snapshot) => {
        const list: SensorReading[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              ownerId: String(d.ownerId),
              temperature: Number(d.temperature),
              humidity: Number(d.humidity),
              heatIndex: Number(d.heatIndex),
              ax: Number(d.ax),
              ay: Number(d.ay),
              az: Number(d.az),
              motionMagnitude: Number(d.motionMagnitude),
              activityLabel: d.activityLabel,
              anomalyFlagged: Boolean(d.anomalyFlagged),
              source: d.source,
              recordedAtIso: String(d.recordedAtIso),
              ...(typeof d.latitude === 'number' && typeof d.longitude === 'number'
                ? {
                    latitude: Number(d.latitude),
                    longitude: Number(d.longitude),
                    ...(typeof d.gpsAccuracyM === 'number'
                      ? { gpsAccuracyM: Number(d.gpsAccuracyM) }
                      : {}),
                  }
                : {}),
            };
          })
          .sort((a, b) => b.recordedAtIso.localeCompare(a.recordedAtIso));
        setReadings(list);
        if (list.length > 0 && !currentReading) {
          setCurrentReading(list[0]);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, readingsPath)
    );

    const alertsPath = `users/${uid}/alerts`;
    const alertsQ = query(
      collection(db, 'users', uid, 'alerts'),
      where('ownerId', '==', uid),
      limit(60)
    );
    const unsubAlerts = onSnapshot(
      alertsQ,
      (snapshot) => {
        const list: SafetyAlert[] = snapshot.docs
          .map((docSnap) => {
            const d = docSnap.data();
            const ts = d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString();
            return {
              id: docSnap.id,
              ownerId: String(d.ownerId),
              level: d.level,
              title: String(d.title),
              message: String(d.message),
              heatIndexC: Number(d.heatIndexC),
              acknowledged: Boolean(d.acknowledged),
              createdAtIso: ts,
            };
          })
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
        setAlerts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, alertsPath)
    );

    return () => {
      unsubSettings();
      unsubReadings();
      unsubAlerts();
    };
  }, [authReady, user]);

  const maybeTriggerNotification = useCallback(
    async (reading: SensorReading, currentSettings: WorkerSettings) => {
      if (!currentSettings.notificationsEnabled) return;

      const risk = classifyHeatRisk(reading.heatIndex, currentSettings);
      let levelToEmit: AlertLevel | null = null;
      let title = '';
      let message = '';

      if (reading.anomalyFlagged) {
        levelToEmit = 'motion_review';
        title = 'Unusual Motion Pattern Flagged';
        message = `MPU6050 detected vector magnitude ${reading.motionMagnitude.toFixed(2)}g. Review worker status (not a validated fall diagnosis).`;
      } else if (risk.level === 'danger') {
        levelToEmit = 'danger';
        title = `Danger Heat Index (${reading.heatIndex.toFixed(1)}°C)`;
        message = risk.guidance;
      } else if (risk.level === 'warning') {
        levelToEmit = 'warning';
        title = `Extreme Caution Heat Index (${reading.heatIndex.toFixed(1)}°C)`;
        message = risk.guidance;
      } else if (risk.level === 'caution') {
        levelToEmit = 'caution';
        title = `Caution Heat Index (${reading.heatIndex.toFixed(1)}°C)`;
        message = risk.guidance;
      }

      if (!levelToEmit) return;

      const dedupeKey = `${levelToEmit}_${Math.floor(Date.now() / 45000)}`;
      if (lastAlertKeyRef.current === dedupeKey) return;
      lastAlertKeyRef.current = dedupeKey;

      const alertId = makeId('alert');
      const nowIso = new Date().toISOString();
      const activeUser = userRef.current;

      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        (levelToEmit === 'danger' || levelToEmit === 'warning' || levelToEmit === 'motion_review')
      ) {
        try {
          new Notification(`HEATSHIELD AI: ${title}`, { body: message });
        } catch {
          // Ignore browser notification errors in restricted contexts
        }
      }

      if (activeUser && activeUser.emailVerified) {
        const alertPath = `users/${activeUser.uid}/alerts/${alertId}`;
        try {
          await setDoc(doc(db, 'users', activeUser.uid, 'alerts', alertId), {
            ownerId: activeUser.uid,
            level: levelToEmit,
            title: title.slice(0, 120),
            message: message.slice(0, 400),
            heatIndexC: reading.heatIndex,
            acknowledged: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, alertPath);
        }
      } else {
        setAlerts((prev) => [
          {
            id: alertId,
            ownerId: 'local_preview',
            level: levelToEmit,
            title,
            message,
            heatIndexC: reading.heatIndex,
            acknowledged: false,
            createdAtIso: nowIso,
          },
          ...prev.slice(0, 39),
        ]);
      }
    },
    []
  );

  const ingestValidSensorPayload = useCallback(
    async (
      rawJson: string,
      source: DataSourceType,
      forcePersist: boolean
    ): Promise<{ valid: boolean; error?: string }> => {
      const validation = validateBleJsonPayload(rawJson);
      const nowIso = new Date().toISOString();

      setPacketLogs((prev) => [
        {
          id: makeId('pkt'),
          timestampIso: nowIso,
          rawJson: rawJson.slice(0, 260),
          valid: validation.valid,
          error: validation.error,
          source,
        },
        ...prev.slice(0, 24),
      ]);

      if (!validation.valid || !validation.payload) {
        return { valid: false, error: validation.error };
      }

      const p = validation.payload;
      const hi = p.heatIndex ?? computeHeatIndexC(p.temperature, p.humidity);
      const motion = analyzeMotionMpu6050(p.ax, p.ay, p.az);
      const activeUser = userRef.current;
      const ownerId = activeUser?.uid ?? 'local_preview';
      const readingId = makeId('rd');

      const activeGps = gpsPositionRef.current;

      const reading: SensorReading = {
        id: readingId,
        ownerId,
        temperature: p.temperature,
        humidity: p.humidity,
        heatIndex: hi,
        ax: p.ax,
        ay: p.ay,
        az: p.az,
        motionMagnitude: motion.motionMagnitude,
        activityLabel: motion.activityLabel,
        anomalyFlagged: motion.anomalyFlagged,
        source,
        recordedAtIso: nowIso,
        ...(activeGps
          ? {
              latitude: activeGps.latitude,
              longitude: activeGps.longitude,
              gpsAccuracyM: activeGps.accuracyM,
            }
          : {}),
      };

      setCurrentReading(reading);
      await maybeTriggerNotification(reading, settingsRef.current);

      const nowMs = Date.now();
      const shouldPersist =
        forcePersist ||
        reading.anomalyFlagged ||
        nowMs - lastDbPersistMsRef.current >= 8000;

      if (activeUser && activeUser.emailVerified) {
        if (shouldPersist) {
          lastDbPersistMsRef.current = nowMs;
          const readingPath = `users/${activeUser.uid}/readings/${readingId}`;
          try {
            await setDoc(doc(db, 'users', activeUser.uid, 'readings', readingId), {
              ownerId: activeUser.uid,
              temperature: reading.temperature,
              humidity: reading.humidity,
              heatIndex: reading.heatIndex,
              ax: reading.ax,
              ay: reading.ay,
              az: reading.az,
              motionMagnitude: reading.motionMagnitude,
              activityLabel: reading.activityLabel,
              anomalyFlagged: reading.anomalyFlagged,
              source: reading.source,
              recordedAtIso: reading.recordedAtIso,
              ...(typeof reading.latitude === 'number' && typeof reading.longitude === 'number'
                ? {
                    latitude: reading.latitude,
                    longitude: reading.longitude,
                    ...(typeof reading.gpsAccuracyM === 'number'
                      ? { gpsAccuracyM: reading.gpsAccuracyM }
                      : {}),
                  }
                : {}),
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, readingPath);
          }
        }
      } else {
        setReadings((prev) => [reading, ...prev.slice(0, 179)]);
      }

      return { valid: true };
    },
    [maybeTriggerNotification]
  );

  // Initialize BLE client once
  useEffect(() => {
    const client = new Esp32BleClient({
      onStateChange: (state, deviceName, errorMsg) => {
        setBleState(state);
        setBleDeviceName(deviceName ?? null);
        setBleError(errorMsg ?? null);
        if (state === 'connected') {
          setDemoActive(false);
        }
      },
      onPacketReceived: (rawJson, validation) => {
        if (validation.valid) {
          void ingestValidSensorPayload(rawJson, 'live_ble', false);
        } else {
          setPacketLogs((prev) => [
            {
              id: makeId('pkt'),
              timestampIso: new Date().toISOString(),
              rawJson: rawJson.slice(0, 260),
              valid: false,
              error: validation.error,
              source: 'live_ble',
            },
            ...prev.slice(0, 24),
          ]);
        }
      },
    });
    bleClientRef.current = client;

    const serialClient = new Esp32SerialClient(
      (state, errorMsg) => {
        setSerialState(state);
        setSerialError(errorMsg ?? null);
        if (state === 'connected') {
          setDemoActive(false);
        }
      },
      (rawLine, validation) => {
        if (validation.valid) {
          void ingestValidSensorPayload(rawLine, 'live_serial', false);
        } else {
          setPacketLogs((prev) => [
            {
              id: makeId('pkt'),
              timestampIso: new Date().toISOString(),
              rawJson: rawLine.slice(0, 260),
              valid: false,
              error: validation.error,
              source: 'live_serial',
            },
            ...prev.slice(0, 24),
          ]);
        }
      }
    );
    serialClientRef.current = serialClient;

    return () => {
      void client.disconnect();
      void serialClient.disconnect();
    };
  }, [ingestValidSensorPayload]);

  // Demonstration Replay loop (explicitly opted-in & labeled)
  useEffect(() => {
    if (!demoActive) return;

    const emitStep = () => {
      demoStepRef.current += 1;
      const payload = generateDemoReadingStep(demoStepRef.current);
      const rawJson = JSON.stringify(payload);
      void ingestValidSensorPayload(rawJson, 'demo', false);
    };

    emitStep();
    const id = window.setInterval(emitStep, 3500);
    return () => window.clearInterval(id);
  }, [demoActive, ingestValidSensorPayload]);

  const connectBle = useCallback(async () => {
    setBleError(null);
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
    await bleClientRef.current?.connect();
  }, []);

  const disconnectBle = useCallback(async () => {
    await bleClientRef.current?.disconnect();
  }, []);

  const connectSerial = useCallback(async () => {
    setSerialError(null);
    await serialClientRef.current?.connect(115200);
  }, []);

  const disconnectSerial = useCallback(async () => {
    await serialClientRef.current?.disconnect();
  }, []);

  const toggleDemoMode = useCallback(() => {
    setDemoActive((prev) => {
      const next = !prev;
      if (next && bleState === 'connected') {
        void bleClientRef.current?.disconnect();
      }
      if (next && serialState === 'connected') {
        void serialClientRef.current?.disconnect();
      }
      return next;
    });
  }, [bleState, serialState]);

  const seedDemoShiftHistory = useCallback(async () => {
    const activeUser = userRef.current;
    const now = Date.now();
    const generated: SensorReading[] = [];

    for (let i = 18; i >= 1; i--) {
      const p = generateDemoReadingStep(i + 3);
      const motion = analyzeMotionMpu6050(p.ax, p.ay, p.az);
      const iso = new Date(now - i * 25 * 60 * 1000).toISOString();
      const id = makeId('demo');
      const ownerId = activeUser?.uid ?? 'local_preview';
      const item: SensorReading = {
        id,
        ownerId,
        temperature: p.temperature,
        humidity: p.humidity,
        heatIndex: p.heatIndex ?? computeHeatIndexC(p.temperature, p.humidity),
        ax: p.ax,
        ay: p.ay,
        az: p.az,
        motionMagnitude: motion.motionMagnitude,
        activityLabel: motion.activityLabel,
        anomalyFlagged: motion.anomalyFlagged,
        source: 'demo',
        recordedAtIso: iso,
      };
      generated.push(item);

      if (activeUser && activeUser.emailVerified) {
        const path = `users/${activeUser.uid}/readings/${id}`;
        try {
          await setDoc(doc(db, 'users', activeUser.uid, 'readings', id), {
            ownerId: activeUser.uid,
            temperature: item.temperature,
            humidity: item.humidity,
            heatIndex: item.heatIndex,
            ax: item.ax,
            ay: item.ay,
            az: item.az,
            motionMagnitude: item.motionMagnitude,
            activityLabel: item.activityLabel,
            anomalyFlagged: item.anomalyFlagged,
            source: item.source,
            recordedAtIso: item.recordedAtIso,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
    }

    if (!activeUser || !activeUser.emailVerified) {
      setReadings((prev) => [...generated.reverse(), ...prev].slice(0, 180));
    }
    if (generated.length > 0) {
      setCurrentReading(generated[generated.length - 1]);
    }
  }, []);

  const injectTestJsonPacket = useCallback(
    async (rawJson: string) => {
      return ingestValidSensorPayload(rawJson, 'manual_test', true);
    },
    [ingestValidSensorPayload]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(message);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setDemoActive(false);
    setGuestPreview(false);
    await bleClientRef.current?.disconnect();
    await firebaseSignOut(auth);
    setReadings([]);
    setAlerts([]);
    setCurrentReading(null);
    setActiveScreen('welcome');
  }, []);

  const enterGuestPreview = useCallback(() => {
    setGuestPreview(true);
    setDemoActive(true);
    setActiveScreen('dashboard');
  }, []);

  const saveSettings = useCallback(
    async (next: Omit<WorkerSettings, 'ownerId'>) => {
      setSettingsSaving(true);
      try {
        const sanitized: Omit<WorkerSettings, 'ownerId'> = {
          workerName: next.workerName.trim().slice(0, 80) || 'Field Worker',
          siteLocation: next.siteLocation.trim().slice(0, 120),
          emergencyContactName: next.emergencyContactName.trim().slice(0, 80),
          emergencyContactPhone: next.emergencyContactPhone
            .replace(/[^0-9+\-()\s]/g, '')
            .trim()
            .slice(0, 24),
          cautionThresholdC: Math.min(55, Math.max(20, Number(next.cautionThresholdC))),
          warningThresholdC: Math.min(60, Math.max(next.cautionThresholdC, Number(next.warningThresholdC))),
          dangerThresholdC: Math.min(70, Math.max(next.warningThresholdC, Number(next.dangerThresholdC))),
          notificationsEnabled: Boolean(next.notificationsEnabled),
        };

        if (user && user.emailVerified) {
          const settingsPath = `users/${user.uid}/private/settings`;
          try {
            if (settingsCreatedInDb) {
              await updateDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
                ...sanitized,
                updatedAt: serverTimestamp(),
              });
            } else {
              await setDoc(doc(db, 'users', user.uid, 'private', 'settings'), {
                ownerId: user.uid,
                ...sanitized,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              setSettingsCreatedInDb(true);
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, settingsPath);
          }
        } else {
          setSettings({ ownerId: 'local_preview', ...sanitized });
        }
      } finally {
        setSettingsSaving(false);
      }
    },
    [settingsCreatedInDb, user]
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (user && user.emailVerified) {
        const path = `users/${user.uid}/alerts/${alertId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'alerts', alertId), {
            acknowledged: true,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
        );
      }
    },
    [user]
  );

  const deleteReading = useCallback(
    async (readingId: string) => {
      if (user && user.emailVerified) {
        const path = `users/${user.uid}/readings/${readingId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'readings', readingId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setReadings((prev) => prev.filter((r) => r.id !== readingId));
      }
    },
    [user]
  );

  const clearLocalDemoReadings = useCallback(() => {
    if (!user) {
      setReadings([]);
      setAlerts([]);
      setCurrentReading(null);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(LS_READINGS_KEY);
          window.localStorage.removeItem(LS_ALERTS_KEY);
        } catch {
          // Ignore storage errors
        }
      }
    }
  }, [user]);

  const stopGpsTracking = useCallback(() => {
    gpsService.stopWatching(gpsWatchIdRef.current);
    gpsWatchIdRef.current = null;
    setGpsTrackingEnabled(false);
    setGpsState((curr) => (curr === 'unavailable' ? 'unavailable' : 'idle'));
  }, []);

  const startGpsTracking = useCallback(() => {
    if (!gpsService.isSupported()) {
      setGpsState('unavailable');
      setGpsError('Geolocation API is not supported in this browser.');
      return;
    }
    gpsService.stopWatching(gpsWatchIdRef.current);
    setGpsError(null);
    setGpsState('locating');
    setGpsTrackingEnabled(true);

    const watchId = gpsService.startWatching({
      onPosition: (pos) => {
        setGpsPosition(pos);
        setGpsState('active');
        setGpsError(null);
      },
      onError: (kind, message) => {
        setGpsError(message);
        setGpsState(kind);
        if (kind === 'denied') {
          setGpsTrackingEnabled(false);
          gpsService.stopWatching(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        }
      },
    });
    gpsWatchIdRef.current = watchId;
  }, []);

  const refreshGpsOnce = useCallback(async () => {
    if (!gpsService.isSupported()) {
      setGpsState('unavailable');
      setGpsError('Geolocation API is not supported in this browser.');
      return;
    }
    setGpsError(null);
    setGpsState('locating');
    try {
      const pos = await gpsService.getCurrentFix();
      setGpsPosition(pos);
      setGpsState('active');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to acquire GPS fix.';
      setGpsError(msg);
      setGpsState(msg.toLowerCase().includes('denied') ? 'denied' : 'error');
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        authReady,
        guestPreview,
        enterGuestPreview,
        signInWithGoogle,
        signOutUser,
        authError,
        firestoreReachable,
        activeScreen,
        setActiveScreen,
        settings,
        saveSettings,
        settingsSaving,
        bleState,
        bleDeviceName,
        bleError,
        bleSupported: Esp32BleClient.isSupported(),
        connectBle,
        disconnectBle,
        serialState,
        serialError,
        serialSupported: Esp32SerialClient.isSupported(),
        connectSerial,
        disconnectSerial,
        demoActive,
        toggleDemoMode,
        seedDemoShiftHistory,
        injectTestJsonPacket,
        currentReading,
        readings,
        alerts,
        packetLogs,
        lastUpdateIso: currentReading?.recordedAtIso ?? null,
        acknowledgeAlert,
        deleteReading,
        clearLocalDemoReadings,
        gpsState,
        gpsPosition,
        gpsError,
        gpsSupported: gpsService.isSupported(),
        gpsTrackingEnabled,
        startGpsTracking,
        stopGpsTracking,
        refreshGpsOnce,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
