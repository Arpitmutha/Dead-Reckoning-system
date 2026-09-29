import React from 'react';
import type { NavigationMode, EnvironmentType } from '../simulation/types';
import {
  Play,
  Pause,
  RotateCcw,
  WifiOff,
  Wifi,
  Rocket,
  ChevronRight,
  Gauge,
} from 'lucide-react';

interface SimulationControlsProps {
  mode: NavigationMode;
  isRunning: boolean;
  speed: number;
  environment: EnvironmentType;
  progress: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onGPSLoss: () => void;
  onGPSRestore: () => void;
  onSpeedChange: (speed: number) => void;
  onEnvironmentChange: (env: EnvironmentType) => void;
  onRunDemo: () => void;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({
  mode,
  isRunning,
  speed,
  environment,
  progress,
  onStart,
  onPause,
  onReset,
  onGPSLoss,
  onGPSRestore,
  onSpeedChange,
  onEnvironmentChange,
  onRunDemo,
}) => {
  const speedSteps = [0.5, 1, 2, 5];
  const speedIndex = speedSteps.indexOf(speed);

  const progressSteps = [
    { label: 'GPS Nav', active: mode === 'gps_navigation', completed: ['gnss_degrading', 'dead_reckoning', 'gps_restoring', 'destination_reached'].includes(mode) },
    { label: 'GNSS Loss', active: mode === 'gnss_degrading', completed: ['dead_reckoning', 'gps_restoring', 'destination_reached'].includes(mode) },
    { label: 'AI Dead Reckoning', active: mode === 'dead_reckoning', completed: ['gps_restoring', 'destination_reached'].includes(mode) },
    { label: 'GPS Recovery', active: mode === 'gps_restoring', completed: ['destination_reached'].includes(mode) },
    { label: 'Destination', active: mode === 'destination_reached', completed: false },
  ];

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[var(--color-status-blue)]" />
          Simulation Controls
        </h3>
        <button onClick={onRunDemo} className="btn-demo flex items-center gap-2" id="run-demo-btn">
          <Rocket className="w-4 h-4" />
          Run Demo
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={isRunning ? onPause : onStart}
          className={isRunning ? 'btn-secondary' : 'btn-primary'}
          id="start-pause-btn"
        >
          {isRunning ? <Pause className="w-3.5 h-3.5 inline mr-1.5" /> : <Play className="w-3.5 h-3.5 inline mr-1.5" />}
          {isRunning ? 'Pause' : 'Start'}
        </button>

        <button onClick={onReset} className="btn-secondary" id="reset-btn">
          <RotateCcw className="w-3.5 h-3.5 inline mr-1.5" />
          Reset
        </button>

        <button onClick={onGPSLoss} className="btn-danger" id="gps-loss-btn" disabled={!isRunning}>
          <WifiOff className="w-3.5 h-3.5 inline mr-1.5" />
          Simulate GPS Loss
        </button>

        <button onClick={onGPSRestore} className="btn-success" id="gps-restore-btn" disabled={!isRunning}>
          <Wifi className="w-3.5 h-3.5 inline mr-1.5" />
          Restore GPS
        </button>
      </div>

      {/* Speed slider */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[var(--color-text-muted)] uppercase w-24">Speed</span>
        <input
          type="range"
          min={0}
          max={3}
          value={speedIndex >= 0 ? speedIndex : 1}
          onChange={(e) => onSpeedChange(speedSteps[parseInt(e.target.value)])}
          className="flex-1 accent-[var(--color-status-blue)] h-1"
          id="speed-slider"
        />
        <span className="text-[12px] mono text-[var(--color-status-blue)] w-10 text-right font-semibold">
          {speed}x
        </span>
      </div>

      {/* Environment dropdown */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[var(--color-text-muted)] uppercase w-24">Environment</span>
        <select
          value={environment}
          onChange={(e) => onEnvironmentChange(e.target.value as EnvironmentType)}
          className="flex-1 bg-[rgba(15,23,42,0.8)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-[12px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-active)]"
          id="environment-select"
        >
          <option value="normal_road">Normal Road</option>
          <option value="underground_tunnel">Underground Tunnel</option>
          <option value="urban_canyon">Urban Canyon</option>
          <option value="multi_level_parking">Multi-Level Parking</option>
          <option value="dense_forest">Dense Forest</option>
        </select>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {progressSteps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div
              className={`progress-step text-[10px] px-2 py-1 rounded whitespace-nowrap ${
                step.active
                  ? 'active bg-[rgba(56,189,248,0.15)] border border-[var(--color-status-blue)]'
                  : step.completed
                    ? 'completed opacity-70'
                    : 'text-[var(--color-text-muted)]'
              }`}
            >
              {step.label}
            </div>
            {i < progressSteps.length - 1 && (
              <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] flex-shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[rgba(15,23,42,0.8)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: mode === 'dead_reckoning'
              ? 'linear-gradient(90deg, #38bdf8, #06b6d4)'
              : mode === 'destination_reached'
                ? 'linear-gradient(90deg, #22c55e, #10b981)'
                : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          }}
        />
      </div>
    </div>
  );
};

export default SimulationControls;
