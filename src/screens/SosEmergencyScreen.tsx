import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Check,
  Copy,
  ExternalLink,
  LocateFixed,
  MapPin,
  MessageSquareWarning,
  Phone,
  Settings,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { buildGoogleMapsPlaceUrl, formatDateTime } from '../utils/heatIndex';

export function SosEmergencyScreen() {
  const {
    settings,
    currentReading,
    setActiveScreen,
    gpsPosition,
    gpsState,
    gpsTrackingEnabled,
    startGpsTracking,
  } = useApp();
  const [customNote, setCustomNote] = useState(
    'Experiencing severe heat stress or require immediate site assistance.'
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const smsBody = useMemo(() => {
    const readingLine = currentReading
      ? `Latest Sensor (${currentReading.source}): Temp ${currentReading.temperature.toFixed(1)}C, RH ${currentReading.humidity.toFixed(0)}%, Heat Index ${currentReading.heatIndex.toFixed(1)}C, Motion ${currentReading.activityLabel} (${formatDateTime(currentReading.recordedAtIso)}).`
      : 'No live sensor reading attached.';

    const gpsLine = gpsPosition
      ? `Live GPS: ${gpsPosition.latitude.toFixed(6)}, ${gpsPosition.longitude.toFixed(6)} (±${gpsPosition.accuracyM.toFixed(0)}m)\nMap Link: ${buildGoogleMapsPlaceUrl(gpsPosition.latitude, gpsPosition.longitude)}`
      : 'Live GPS: Not attached (location permission not active).';

    return `HEATSHIELD SOS ALERT\nWorker: ${settings.workerName}\nSite: ${settings.siteLocation || 'Unspecified'}\nMessage: ${customNote.trim()}\n${gpsLine}\n${readingLine}`;
  }, [currentReading, customNote, gpsPosition, settings.siteLocation, settings.workerName]);

  const sanitizedPhone = settings.emergencyContactPhone.replace(/[^0-9+]/g, '');
  const smsHref = `sms:${sanitizedPhone}?body=${encodeURIComponent(smsBody)}`;

  const handleCopySms = async () => {
    try {
      await navigator.clipboard.writeText(smsBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Main SOS Trigger Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 space-y-6">
        <div className="space-y-2">
          <h2 className="font-display text-2xl font-bold text-slate-900">
            Emergency SOS Composer
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Pressing the SOS button prepares an emergency SMS draft with your worker profile and
            latest environmental telemetry, then lets you review or cancel before opening your
            phone&apos;s SMS app.
          </p>
        </div>

        {!sanitizedPhone && (
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-orange-950">
              <MessageSquareWarning className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
              <span>
                No emergency contact phone number is configured yet. You can still compose an SMS
                and pick a recipient in your phone&apos;s SMS app, or save a default contact now.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('settings')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-orange-300 text-xs font-semibold text-orange-900 hover:bg-orange-100 shrink-0 min-h-[40px]"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configure Contact</span>
            </button>
          </div>
        )}

        {/* Emergency Contact & GPS Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Worker Name</span>
            <span className="font-semibold text-slate-900 text-sm">{settings.workerName}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Designated Emergency Contact</span>
            <span className="font-semibold text-slate-900 text-sm inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-teal-700" />
              {settings.emergencyContactName || 'Unassigned'}
              {sanitizedPhone ? ` (${settings.emergencyContactPhone})` : ' (No phone saved)'}
            </span>
          </div>
          <div className="sm:col-span-2 pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 shrink-0 ${gpsPosition ? 'text-teal-700' : 'text-slate-400'}`} />
              <div>
                <span className="text-slate-500 block">Attached GPS Coordinates</span>
                <span className="font-mono font-semibold text-slate-900">
                  {gpsPosition
                    ? `${gpsPosition.latitude.toFixed(6)}, ${gpsPosition.longitude.toFixed(6)} (±${gpsPosition.accuracyM.toFixed(0)}m)`
                    : gpsState === 'locating'
                    ? 'Acquiring GPS fix...'
                    : 'No GPS coordinates attached yet'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!gpsTrackingEnabled && (
                <button
                  type="button"
                  onClick={startGpsTracking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-slate-800 text-white font-semibold"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Attach Live GPS</span>
                </button>
              )}
              {gpsPosition && (
                <a
                  href={buildGoogleMapsPlaceUrl(gpsPosition.latitude, gpsPosition.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 font-semibold hover:bg-teal-100"
                >
                  <span>Verify Pin</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Custom Message Field */}
        <div className="space-y-1.5">
          <label htmlFor="sos-note" className="block text-xs font-semibold text-slate-700">
            Emergency Message Text
          </label>
          <textarea
            id="sos-note"
            rows={3}
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>

        {/* Large Accessible SOS Button */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="w-full min-h-[104px] rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white flex flex-col items-center justify-center gap-2 transition-all shadow-sm px-6 py-5"
        >
          <AlertOctagon className="w-9 h-9" />
          <span className="font-display text-xl font-bold tracking-wide">
            PREPARE EMERGENCY SOS SMS
          </span>
          <span className="text-xs text-red-100">
            Opens confirmation before launching your phone&apos;s SMS composer
          </span>
        </button>

        <p className="text-xs text-slate-500 leading-relaxed">
          <strong>Important Disclosure:</strong> HEATSHIELD AI does <strong>not</strong> transmit
          emergency SMS messages automatically in the background. You must review and tap Send
          inside your device&apos;s SMS application, or call local emergency services directly if
          needed.
        </p>
      </div>

      {/* Cancelable Confirmation Modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-confirm-title"
        >
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5 text-red-700">
                <AlertOctagon className="w-6 h-6 shrink-0" />
                <h3 id="sos-confirm-title" className="font-display text-lg font-bold">
                  Confirm SMS Composer Launch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
                aria-label="Cancel SOS"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <div>
                <strong>Recipient:</strong>{' '}
                {sanitizedPhone
                  ? `${settings.emergencyContactName} (${settings.emergencyContactPhone})`
                  : 'Will choose recipient inside SMS app'}
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
                {smsBody}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCopySms()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-100 min-h-[44px]"
              >
                {copied ? <Check className="w-4 h-4 text-teal-700" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
              <a
                href={smsHref}
                onClick={() => setConfirmOpen(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold min-h-[44px]"
              >
                Open Phone SMS Composer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
