import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Crosshair,
  ExternalLink,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { buildGoogleMapsPlaceUrl, classifyHeatRisk, formatShortTime } from '../utils/heatIndex';

type BaseLayerKind = 'street' | 'satellite';

interface WorkerGpsMapProps {
  heightClass?: string;
  compact?: boolean;
  focusCoords?: { latitude: number; longitude: number } | null;
}

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

export function WorkerGpsMap({
  heightClass = 'h-[360px] sm:h-[420px]',
  compact = false,
  focusCoords = null,
}: WorkerGpsMapProps) {
  const {
    gpsState,
    gpsPosition,
    gpsError,
    gpsTrackingEnabled,
    startGpsTracking,
    stopGpsTracking,
    refreshGpsOnce,
    currentReading,
    readings,
    settings,
  } = useApp();

  const [baseLayer, setBaseLayer] = useState<BaseLayerKind>('street');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const workerMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const trailGroupRef = useRef<L.LayerGroup | null>(null);
  const hasCenteredOnLiveRef = useRef(false);

  const geotaggedReadings = useMemo(
    () =>
      readings
        .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
        .slice(0, 60),
    [readings]
  );

  const risk = currentReading ? classifyHeatRisk(currentReading.heatIndex, settings) : null;
  const markerColor = risk?.accentColor ?? '#0D9488';

  // Initialize Leaflet map instance once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: DEFAULT_CENTER,
      zoom: 2,
      zoomControl: true,
      attributionControl: true,
    });

    const group = L.layerGroup().addTo(map);
    trailGroupRef.current = group;
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      workerMarkerRef.current = null;
      accuracyCircleRef.current = null;
      trailGroupRef.current = null;
    };
  }, []);

  // Switch free public map tile layers (OpenStreetMap Street vs Esri World Imagery Satellite)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const layer =
      baseLayer === 'street'
        ? L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          })
        : L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
              maxZoom: 19,
              attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
            }
          );

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [baseLayer]);

  // Update worker live GPS marker and accuracy radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!gpsPosition) {
      if (workerMarkerRef.current) {
        map.removeLayer(workerMarkerRef.current);
        workerMarkerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      return;
    }

    const latLng: [number, number] = [gpsPosition.latitude, gpsPosition.longitude];
    const icon = L.divIcon({
      className: 'heatshield-gps-pin',
      html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:24px;height:24px;border-radius:9999px;background:${markerColor};opacity:0.28;"></span>
        <span style="width:14px;height:14px;border-radius:9999px;background:${markerColor};border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(15,23,42,0.45);"></span>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const popupHtml = `
      <div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.45;min-width:170px;">
        <div style="font-weight:700;color:#0f172a;margin-bottom:2px;">${settings.workerName.replace(/</g, '&lt;')}</div>
        <div style="color:#475569;margin-bottom:4px;">${(settings.siteLocation || 'Field Zone').replace(/</g, '&lt;')}</div>
        <div><strong>Heat Index:</strong> ${currentReading ? `${currentReading.heatIndex.toFixed(1)} °C` : 'Awaiting sensor'}</div>
        <div><strong>GPS:</strong> ${gpsPosition.latitude.toFixed(5)}, ${gpsPosition.longitude.toFixed(5)}</div>
        <div><strong>Accuracy:</strong> ±${gpsPosition.accuracyM.toFixed(0)} m</div>
      </div>
    `;

    if (workerMarkerRef.current) {
      workerMarkerRef.current.setLatLng(latLng).setIcon(icon).setPopupContent(popupHtml);
    } else {
      workerMarkerRef.current = L.marker(latLng, { icon }).addTo(map).bindPopup(popupHtml);
    }

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current
        .setLatLng(latLng)
        .setRadius(Math.max(5, gpsPosition.accuracyM))
        .setStyle({ color: markerColor, fillColor: markerColor });
    } else {
      accuracyCircleRef.current = L.circle(latLng, {
        radius: Math.max(5, gpsPosition.accuracyM),
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
    }

    if (!hasCenteredOnLiveRef.current) {
      map.setView(latLng, 17, { animate: true });
      hasCenteredOnLiveRef.current = true;
    }
  }, [gpsPosition, markerColor, currentReading, settings.workerName, settings.siteLocation]);

  // Render geotagged telemetry breadcrumb trail
  useEffect(() => {
    const group = trailGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (geotaggedReadings.length === 0) return;

    const chronological = [...geotaggedReadings].reverse();
    const coords = chronological.map((r) => [r.latitude as number, r.longitude as number] as [number, number]);

    if (coords.length >= 2) {
      L.polyline(coords, {
        color: '#0B1F3A',
        weight: 3,
        opacity: 0.65,
        dashArray: '6 5',
      }).addTo(group);
    }

    chronological.forEach((r) => {
      const rRisk = classifyHeatRisk(r.heatIndex, settings);
      L.circleMarker([r.latitude as number, r.longitude as number], {
        radius: 5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: rRisk.accentColor,
        fillOpacity: 0.9,
      })
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:12px;">
            <div style="font-weight:700;">${rRisk.label} (${r.heatIndex.toFixed(1)} °C)</div>
            <div>Temp ${r.temperature.toFixed(1)}°C · RH ${r.humidity.toFixed(0)}%</div>
            <div>${r.activityLabel} · ${formatShortTime(r.recordedAtIso)}</div>
          </div>`
        )
        .addTo(group);
    });
  }, [geotaggedReadings, settings]);

  // Pan map if parent focuses a specific historical geotagged reading
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoords) return;
    map.setView([focusCoords.latitude, focusCoords.longitude], 17, { animate: true });
  }, [focusCoords]);

  const handleCenterOnMe = () => {
    const map = mapRef.current;
    if (!map || !gpsPosition) return;
    map.setView([gpsPosition.latitude, gpsPosition.longitude], 17, { animate: true });
  };

  const googleMapsUrl = gpsPosition
    ? buildGoogleMapsPlaceUrl(gpsPosition.latitude, gpsPosition.longitude)
    : null;

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      {/* Map Header Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <MapPin
            className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${
              gpsState === 'active' ? 'text-teal-600' : 'text-slate-500'
            }`}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 flex flex-wrap items-center gap-2">
              <span>
                {gpsState === 'active' && gpsPosition
                  ? 'Live Device GPS Active'
                  : gpsState === 'locating'
                  ? 'Acquiring GPS Satellite / Network Fix...'
                  : gpsState === 'denied'
                  ? 'Location Permission Denied'
                  : 'GPS Location Ready (Free OpenStreetMap View)'}
              </span>
              {risk && gpsPosition && (
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${risk.badgeClasses}`}>
                  {risk.label}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5 truncate">
              {gpsPosition
                ? `${gpsPosition.latitude.toFixed(6)}, ${gpsPosition.longitude.toFixed(6)} · ±${gpsPosition.accuracyM.toFixed(0)}m · Updated ${formatShortTime(gpsPosition.updatedAtIso)}`
                : 'Enable Live GPS to pinpoint worker coordinates and geotag readings'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={gpsTrackingEnabled ? stopGpsTracking : startGpsTracking}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[38px] ${
              gpsTrackingEnabled
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'bg-[#0B1F3A] hover:bg-slate-800 text-white'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>{gpsTrackingEnabled ? 'Pause Live GPS' : 'Enable Live GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => void refreshGpsOnce()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 min-h-[38px]"
            title="Request single GPS fix"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${gpsState === 'locating' ? 'animate-spin' : ''}`} />
            {!compact && <span>Refresh Fix</span>}
          </button>

          {gpsPosition && (
            <button
              type="button"
              onClick={handleCenterOnMe}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 min-h-[38px]"
              title="Center map on current GPS location"
            >
              <Crosshair className="w-3.5 h-3.5" />
              {!compact && <span>Center</span>}
            </button>
          )}

          <button
            type="button"
            onClick={() => setBaseLayer((prev) => (prev === 'street' ? 'satellite' : 'street'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 min-h-[38px]"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{baseLayer === 'street' ? 'Satellite' : 'Street Map'}</span>
          </button>

          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-xs font-semibold text-teal-800 min-h-[38px]"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {gpsError && (
        <div className="px-4 py-2.5 bg-orange-50 border-b border-orange-200 text-xs text-orange-950">
          {gpsError}
        </div>
      )}

      {/* Map Viewport */}
      <div className={`relative w-full ${heightClass} bg-slate-100`}>
        <div ref={containerRef} className="w-full h-full z-0" />

        {!gpsPosition && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[400] flex justify-center">
            <div className="pointer-events-auto max-w-md w-full bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3.5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-700">
                <strong className="text-slate-900 block">No live GPS fix acquired yet</strong>
                Click Enable Live GPS to share your device coordinates with this map and SOS alerts.
              </div>
              <button
                type="button"
                onClick={startGpsTracking}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shrink-0"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Locate Me</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
