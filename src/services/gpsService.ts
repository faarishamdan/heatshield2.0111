import type { GpsPosition } from '../types/heatshield';

export interface GpsWatchCallbacks {
  onPosition: (position: GpsPosition) => void;
  onError: (kind: 'denied' | 'unavailable' | 'error', message: string) => void;
}

function toGpsPosition(pos: GeolocationPosition): GpsPosition {
  return {
    latitude: Math.round(pos.coords.latitude * 1_000_000) / 1_000_000,
    longitude: Math.round(pos.coords.longitude * 1_000_000) / 1_000_000,
    accuracyM: Math.round(pos.coords.accuracy * 10) / 10,
    altitudeM: typeof pos.coords.altitude === 'number' ? Math.round(pos.coords.altitude * 10) / 10 : null,
    speedMps: typeof pos.coords.speed === 'number' ? Math.round(pos.coords.speed * 100) / 100 : null,
    headingDeg: typeof pos.coords.heading === 'number' ? Math.round(pos.coords.heading) : null,
    updatedAtIso: new Date(pos.timestamp || Date.now()).toISOString(),
  };
}

function mapGeolocationError(err: GeolocationPositionError): {
  kind: 'denied' | 'unavailable' | 'error';
  message: string;
} {
  if (err.code === err.PERMISSION_DENIED) {
    return {
      kind: 'denied',
      message:
        'Location permission was denied. Allow location access in your browser or site permissions to track live GPS.',
    };
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return {
      kind: 'unavailable',
      message:
        'Device GPS position is currently unavailable. Check that GPS/Location Services are turned on.',
    };
  }
  if (err.code === err.TIMEOUT) {
    return {
      kind: 'error',
      message: 'GPS fix timed out. Move toward an open sky area or retry Refresh GPS.',
    };
  }
  return {
    kind: 'error',
    message: err.message || 'Unable to acquire device GPS position.',
  };
}

export const gpsService = {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  },

  getCurrentFix(): Promise<GpsPosition> {
    return new Promise((resolve, reject) => {
      if (!gpsService.isSupported()) {
        reject(new Error('Geolocation API is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(toGpsPosition(pos)),
        (err) => {
          const mapped = mapGeolocationError(err);
          reject(new Error(mapped.message));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    });
  },

  startWatching(callbacks: GpsWatchCallbacks): number | null {
    if (!gpsService.isSupported()) {
      callbacks.onError('unavailable', 'Geolocation API is not supported by this browser.');
      return null;
    }
    return navigator.geolocation.watchPosition(
      (pos) => callbacks.onPosition(toGpsPosition(pos)),
      (err) => {
        const mapped = mapGeolocationError(err);
        callbacks.onError(mapped.kind, mapped.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  },

  stopWatching(watchId: number | null): void {
    if (watchId !== null && gpsService.isSupported()) {
      navigator.geolocation.clearWatch(watchId);
    }
  },
};
