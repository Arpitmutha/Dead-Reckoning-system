import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { NavigationState, NavigationMode, EnvironmentType } from './simulation/types';
import { DeadReckoningEngine, createInitialState } from './simulation/deadReckoning';

import Dashboard from './components/Dashboard';
import NavigationMap from './components/NavigationMap';

const App: React.FC = () => {
  const [state, setState] = useState<NavigationState>(createInitialState());
  const [previousMode, setPreviousMode] = useState<NavigationMode>('idle');
  const engineRef = useRef<DeadReckoningEngine | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new DeadReckoningEngine((newState) => {
      setState((prev) => {
        if (prev.mode !== newState.mode) {
          setPreviousMode(prev.mode);
        }
        return newState;
      });
    });
    engineRef.current = engine;
    return () => { engine.destroy(); };
  }, []);

  // Callbacks — core logic unchanged
  const handleStart = useCallback(() => engineRef.current?.start(), []);
  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    setPreviousMode('idle');
  }, []);
  const handleGPSLoss = useCallback(() => engineRef.current?.simulateGPSLoss(), []);
  const handleGPSRestore = useCallback(() => engineRef.current?.restoreGPS(), []);
  const handleRunDemo = useCallback(() => {
    setPreviousMode('idle');
    engineRef.current?.runDemo();
  }, []);

  // Dashboard returns composable pieces: Header, RightPanel, Timeline, Buttons
  const dashboard = Dashboard({
    state,
    onStart: handleStart,
    onReset: handleReset,
    onGPSLoss: handleGPSLoss,
    onGPSRestore: handleGPSRestore,
    onRunDemo: handleRunDemo,
  });

  return (
    <div className="h-screen bg-[var(--color-bg-primary)] flex flex-col p-3 gap-2 overflow-hidden">
      {/* ── TOP HEADER ────────────────────────────────────────────────── */}
      {dashboard.Header}

      {/* ── MAIN CONTENT: MAP (left) + STATUS PANELS (right) ──────── */}
      <div className="flex-1 flex gap-2.5 min-h-0">
        {/* LEFT — Map + Timeline + Buttons stacked */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex-1 relative min-h-0">
            <NavigationMap state={state} />
          </div>
          {dashboard.Timeline}
          {dashboard.Buttons}
        </div>

        {/* RIGHT — Status Cards (wider, fills full height) */}
        <div className="w-[420px] shrink-0">
          {dashboard.RightPanel}
        </div>
      </div>
    </div>
  );
};

export default App;
