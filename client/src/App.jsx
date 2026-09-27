import React from 'react';
import StatusBoard from './components/StatusBoard.jsx';
import Heatmap from './components/Heatmap.jsx';
import SpeedTest from './components/SpeedTest.jsx';
import P2PCache from './components/P2PCache.jsx';
import PersonalInsights from './components/PersonalInsights.jsx';

export default function App() {
  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">CampusPulse</h1>
        <p className="text-slate-400 text-sm">Real-time campus network health, crowdsourced by students.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <StatusBoard />
        <PersonalInsights />
      </div>

      <SpeedTest />
      <Heatmap />
      <P2PCache />
    </div>
  );
}
