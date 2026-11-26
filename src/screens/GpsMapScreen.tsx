import React, { useMemo, useState } from 'react';
import {
  Compass,
  ExternalLink,
  Gauge,
  Info,
  LocateFixed,
  MapPin,
  Mountain,
  Radio,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { WorkerGpsMap } from '../components/WorkerGpsMap';
import { buildGoogleMapsPlaceUrl, classifyHeatRisk, formatDateTime } from '../utils/heatIndex';

export function GpsMapScreen() {
  const {
    gpsState,
    gpsPosition,
    gpsTrackingEnabled,
    startGpsTracking,
    stopGpsTracking,
    readings,
    settings,
    setActiveScreen,
  } = useApp();

  const [focusCoords, setFocusCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const geotaggedReadings = useMemo(
    () =>
      readings.filter(
        (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number'
      ),
    [readings]
  );

  return (
    <div className="space-y-6">
      {/* Interactive Full-Width Map */}
      <WorkerGpsMap heightClass="h-[380px] sm:h-[460px]" focusCoords={focusCoords} />

      {/* GPS Telemetry Readout Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Coordinates (Lat / Lng)</span>
            <MapPin className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 font-mono text-base font-bold text-slate-900 tabular-nums">
            {gpsPosition
              ? `${gpsPosition.latitude.toFixed(5)}, ${gpsPosition.longitude.toFixed(5)}`
              : 'Not acquired'}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Status: <span className="font-semibold text-slate-700">{gpsState.toUpperCase()}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Horizontal Accuracy</span>
            <Compass className="w-4 h-4 text-[#0B1F3A]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {gpsPosition ? `±${gpsPosition.accuracyM.toFixed(1)} m` : '-- m'}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Live device GPS / GNSS fix
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Speed &amp; Altitude</span>
            <Gauge className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {gpsPosition?.speedMps !== null && gpsPosition?.speedMps !== undefined
              ? `${(gpsPosition.speedMps * 3.6).toFixed(1)} km/h`
              : '-- km/h'}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-1 font-mono">
            <Mountain className="w-3.5 h-3.5" />
            <span>
              {gpsPosition?.altitudeM !== null && gpsPosition?.altitudeM !== undefined
                ? `Alt ${gpsPosition.altitudeM.toFixed(1)} m`
                : 'Altitude N/A'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Geotagged Readings</span>
            <Radio className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {geotaggedReadings.length}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {gpsTrackingEnabled
              ? 'New readings auto-tagged with GPS'
              : 'Enable Live GPS to geotag packets'}
          </div>
        </div>
      </div>

      {/* Geotagged Reading Breadcrumbs & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-semibold text-base text-slate-900">
                Geotagged Sensor Checkpoints
              </h2>
              <p className="text-xs text-slate-500">
                Click any checkpoint below to focus the map on where that reading was recorded
              </p>
            </div>
            <button
              type="button"
              onClick={gpsTrackingEnabled ? stopGpsTracking : startGpsTracking}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold min-h-[38px]"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>{gpsTrackingEnabled ? 'Tracking Active' : 'Start Live GPS'}</span>
            </button>
          </div>

          {geotaggedReadings.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60 px-4 text-xs text-slate-600 space-y-2">
              <p className="font-medium text-slate-800">No geotagged sensor readings recorded yet</p>
              <p>
                Turn on <strong>Enable Live GPS</strong> above while receiving ESP32 telemetry (or
                running Demo Replay) to tag readings with real device coordinates on the map and CSV
                exports.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {geotaggedReadings.slice(0, 20).map((r) => {
                const risk = classifyHeatRisk(r.heatIndex, settings);
                const lat = r.latitude as number;
                const lng = r.longitude as number;
                return (
                  <div
                    key={r.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-medium ${risk.badgeClasses}`}>
                          {risk.label} ({r.heatIndex.toFixed(1)}°C)
                        </span>
                        <span className="font-mono text-slate-500">{formatDateTime(r.recordedAtIso)}</span>
                      </div>
                      <div className="font-mono text-slate-700">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                        {typeof r.gpsAccuracyM === 'number' ? ` (±${r.gpsAccuracyM.toFixed(0)}m)` : ''}
                        {' · '}
                        {r.activityLabel}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFocusCoords({ latitude: lat, longitude: lng })}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                      >
                        Focus Map
                      </button>
                      <a
                        href={buildGoogleMapsPlaceUrl(lat, lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-medium"
                      >
                        <span>Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#0B1F3A]" />
            <h2 className="font-display font-semibold text-base text-slate-900">
              Free GPS &amp; Map Architecture
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            HEATSHIELD AI uses your device&apos;s hardware GPS via the browser Geolocation API and
            renders interactive street and satellite tiles using Leaflet with OpenStreetMap and
            Esri public imagery — requiring no paid map API key or billing account.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            When Live GPS is active, Emergency SOS drafts automatically attach your coordinates and
            a direct <span className="font-mono">maps.google.com/?q=lat,lng</span> link so your
            safety supervisor can open your exact position immediately.
          </p>
          <button
            type="button"
            onClick={() => setActiveScreen('sos')}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
          >
            Preview SOS Location Draft
          </button>
        </div>
      </div>
    </div>
  );
}
