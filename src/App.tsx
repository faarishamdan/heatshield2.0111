import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppLayout } from './components/Layout';
import { DashboardScreen } from './screens/DashboardScreen';
import { LiveMonitorScreen } from './screens/LiveMonitorScreen';
import { GpsMapScreen } from './screens/GpsMapScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AiAssistantScreen } from './screens/AiAssistantScreen';
import { SosEmergencyScreen } from './screens/SosEmergencyScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

function ScreenRouter() {
  const { activeScreen } = useApp();

  return (
    <AppLayout>
      {(activeScreen === 'dashboard' || activeScreen === 'welcome') && <DashboardScreen />}
      {activeScreen === 'live' && <LiveMonitorScreen />}
      {activeScreen === 'map' && <GpsMapScreen />}
      {activeScreen === 'history' && <HistoryScreen />}
      {activeScreen === 'ai' && <AiAssistantScreen />}
      {activeScreen === 'sos' && <SosEmergencyScreen />}
      {activeScreen === 'reports' && <ReportsScreen />}
      {activeScreen === 'settings' && <SettingsScreen />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ScreenRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}
