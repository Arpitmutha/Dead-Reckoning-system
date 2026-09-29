import React from 'react';
import type { NavigationState } from '../simulation/types';
import {
  Satellite,
  Cpu,
  Brain,
  Target,
  Radio,
} from 'lucide-react';

interface HeaderProps {
  state: NavigationState;
}

const Header: React.FC<HeaderProps> = ({ state }) => {
  const gnssColor = state.gnss.connected ? 'green' : state.gnss.signalStrength > 15 ? 'yellow' : 'red';
  const gnssLabel = state.gnss.connected ? 'CONNECTED' : state.gnss.signalStrength > 15 ? 'DEGRADED' : 'LOST';

  const imuColor = state.isRunning ? 'green' : state.mode === 'idle' ? 'yellow' : 'green';
  const imuLabel = state.isRunning ? 'ACTIVE' : 'STANDBY';

  const aiColor = state.mode === 'dead_reckoning' ? 'blue' : state.isRunning ? 'green' : 'yellow';
  const aiLabel = state.mode === 'dead_reckoning' ? 'DR ACTIVE' : state.isRunning ? 'READY' : 'STANDBY';

  const accuracy = state.gnss.connected
    ? `${state.gnss.accuracy.toFixed(1)}m`
    : state.mode === 'dead_reckoning'
      ? `${state.prediction.predictionError.toFixed(1)}m`
      : '—';

  const accuracyColor = state.gnss.connected
    ? state.gnss.accuracy < 10 ? 'green' : 'yellow'
    : state.mode === 'dead_reckoning'
      ? state.prediction.predictionError < 10 ? 'blue' : 'yellow'
      : 'yellow';

  return (
    <header className="glass-card px-6 py-3 flex items-center justify-between flex-wrap gap-3">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
          <Target className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide gradient-text">TrackSync</h1>
          <p className="text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">
            Intelligent Dead Reckoning with GNSS+INS Fusion
          </p>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-5 flex-wrap">
        <StatusPill icon={<Satellite className="w-3.5 h-3.5" />} label="GNSS" value={gnssLabel} color={gnssColor} />
        <StatusPill icon={<Cpu className="w-3.5 h-3.5" />} label="IMU" value={imuLabel} color={imuColor} />
        <StatusPill icon={<Brain className="w-3.5 h-3.5" />} label="AI Model" value={aiLabel} color={aiColor} />
        <StatusPill icon={<Target className="w-3.5 h-3.5" />} label="Accuracy" value={accuracy} color={accuracyColor} />
        <StatusPill icon={<Radio className="w-3.5 h-3.5" />} label="Update Rate" value="20 Hz" color="green" />
      </div>

    </header>
  );
};

interface StatusPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    green: 'var(--color-status-green)',
    yellow: 'var(--color-status-yellow)',
    red: 'var(--color-status-red)',
    blue: 'var(--color-status-blue)',
  };

  return (
    <div className="flex items-center gap-2 bg-[rgba(15,23,42,0.6)] rounded-lg px-3 py-1.5 border border-[var(--color-border)]">
      <span style={{ color: colorMap[color] }}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-semibold mono" style={{ color: colorMap[color] }}>{value}</span>
      </div>
      <span className={`status-dot ${color}`} />
    </div>
  );
};

export default Header;
