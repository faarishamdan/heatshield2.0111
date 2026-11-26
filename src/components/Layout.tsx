import React, { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  Bluetooth,
  BluetoothConnected,
  Bot,
  FileBarChart2,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  Radio,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { AppScreen } from '../types/heatshield';

const NAV_ITEMS: Array<{
  id: AppScreen;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'live', label: 'Live Sensor Monitor', shortLabel: 'Live', icon: Radio },
  { id: 'map', label: 'GPS Site Map', shortLabel: 'GPS', icon: MapPin },
  { id: 'history', label: 'Heat-Exposure History', shortLabel: 'History', icon: History },
  { id: 'ai', label: 'AI Safety Assistant', shortLabel: 'AI Aid', icon: Bot },
  { id: 'sos', label: 'Emergency SOS', shortLabel: 'SOS', icon: AlertOctagon },
  { id: 'reports', label: 'Reports & Export', shortLabel: 'Reports', icon: FileBarChart2 },
  { id: 'settings', label: 'Settings & Docs', shortLabel: 'Settings', icon: Settings },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    activeScreen,
    setActiveScreen,
    bleState,
    serialState,
    demoActive,
    currentReading,
    connectBle,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeItem = NAV_ITEMS.find((item) => item.id === activeScreen) ?? NAV_ITEMS[0];

  const sourceStatusLabel =
    bleState === 'connected'
      ? 'Live BLE Hardware'
      : serialState === 'connected'
      ? 'Live Serial Hardware'
      : demoActive
      ? 'Demonstration Replay'
      : 'Sensor Unpaired';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#0B1F3A] text-slate-100 border-r border-slate-800 z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-display font-bold text-base tracking-tight text-white block truncate">
              HEATSHIELD AI
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;
            const isSos = item.id === 'sos';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap ${
                  isActive
                    ? isSos
                      ? 'bg-red-600 text-white'
                      : 'bg-teal-600 text-white'
                    : isSos
                    ? 'text-orange-300 hover:bg-red-950/60 hover:text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2.5">
          <div className="text-xs text-slate-300 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Telemetry</span>
              <span className="font-medium text-white truncate">{sourceStatusLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Storage</span>
              <span className="text-teal-300 font-medium">Saved on Device</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar (3-zone contract, <=56px height on mobile) */}
        <header className="sticky top-0 z-20 h-14 md:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-semibold text-base md:text-lg text-slate-900 truncate">
              {activeItem.label}
            </h1>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-600 whitespace-nowrap">
            {bleState === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-teal-700">
                <BluetoothConnected className="w-4 h-4" />
                ESP32 Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Bluetooth className="w-4 h-4" />
                {sourceStatusLabel}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {currentReading
                ? `HI ${currentReading.heatIndex.toFixed(1)}°C (${
                    currentReading.source === 'live_ble' || currentReading.source === 'live_serial'
                      ? 'Live'
                      : 'Demo'
                  })`
                : 'Awaiting Reading'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {bleState !== 'connected' && activeScreen !== 'sos' && (
              <button
                type="button"
                onClick={() => {
                  if (activeScreen === 'live') {
                    void connectBle();
                  } else {
                    setActiveScreen('live');
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap min-h-[40px]"
              >
                <Activity className="w-3.5 h-3.5 text-teal-600" />
                <span>Pair ESP32</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveScreen('sos')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap min-h-[40px]"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 px-4 sm:px-6 md:px-8 py-5 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb Zone, <= 60px height) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 h-14"
        aria-label="Mobile navigation"
      >
        {[
          NAV_ITEMS[0],
          NAV_ITEMS[1],
          NAV_ITEMS[2],
          NAV_ITEMS[5],
          NAV_ITEMS[7],
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          const isSos = item.id === 'sos';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveScreen(item.id)}
              className={`flex flex-col items-center justify-center min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive
                  ? isSos
                    ? 'text-red-600'
                    : 'text-teal-700'
                  : isSos
                  ? 'text-red-600/80'
                  : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="mt-0.5 leading-none">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Full Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0B1F3A] text-white flex flex-col h-full p-4 z-50">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <span className="font-display font-bold text-base">HEATSHIELD AI</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveScreen(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium min-h-[44px] ${
                      isActive ? 'bg-teal-600 text-white' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-white/10 text-xs text-slate-300 flex items-center justify-between">
              <span className="text-slate-400">Storage</span>
              <span className="text-teal-300 font-medium">Saved on Device</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
