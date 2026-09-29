import React from 'react';
import type { VibrationFilterState } from '../simulation/types';
import { Activity, Gauge, Filter, Waves, ShieldAlert, Zap } from 'lucide-react';

interface VibrationFilterPanelProps {
  vibrationFilter: VibrationFilterState;
  isRunning: boolean;
}

const VibrationFilterPanel: React.FC<VibrationFilterPanelProps> = ({ vibrationFilter, isRunning }) => {
  const {
    rawAccelMagnitude,
    filteredAccelMagnitude,
    estimatedVelocity,
    snr,
    detectedEvents,
    filterActive,
    highPassCutoff,
    lowPassCutoff,
    kalmanGain,
    rawSignalHistory,
    filteredSignalHistory,
  } = vibrationFilter;

  const eventLabels: Record<string, { label: string; color: string; icon: string }> = {
    engine_vibration: { label: 'Engine Vibration', color: 'var(--color-status-yellow)', icon: '⚙️' },
    pothole: { label: 'Pothole Detected', color: 'var(--color-status-red)', icon: '🕳️' },
    bump: { label: 'Road Bump', color: 'var(--color-status-yellow)', icon: '⬆️' },
    braking: { label: 'Hard Braking', color: 'var(--color-status-red)', icon: '🛑' },
    phone_shift: { label: 'Phone Shift', color: 'var(--color-status-purple)', icon: '📱' },
    idle: { label: 'Idle', color: 'var(--color-text-muted)', icon: '⏸️' },
  };

  // Mini waveform renderer
  const renderWaveform = (data: number[], color: string, opacity: number) => {
    if (data.length < 2) return null;
    const width = 100;
    const height = 36;
    const min = Math.min(...data) - 0.2;
    const max = Math.max(...data) + 0.2;
    const range = max - min || 1;

    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--color-status-cyan)]" />
          AI Vibration Filter
        </h3>
        <div
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold mono ${
            filterActive
              ? 'bg-[rgba(34,197,94,0.12)] text-[var(--color-status-green)]'
              : 'bg-[rgba(100,116,139,0.15)] text-[var(--color-text-muted)]'
          }`}
        >
          {filterActive ? '🔊 ACTIVE' : 'STANDBY'}
        </div>
      </div>

      {/* Signal Waveform */}
      <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)]">
        <div className="flex justify-between mb-1">
          <span className="text-[9px] text-[var(--color-text-muted)] uppercase flex items-center gap-1">
            <Waves className="w-3 h-3" />
            Accelerometer Signal
          </span>
          <div className="flex gap-2 text-[9px]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[var(--color-status-red)] rounded inline-block" /> Raw
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-[var(--color-status-green)] rounded inline-block" /> Filtered
            </span>
          </div>
        </div>
        <svg viewBox="0 0 100 36" className="w-full h-[52px]" preserveAspectRatio="none">
          {renderWaveform(rawSignalHistory, 'var(--color-status-red)', 0.4)}
          {renderWaveform(filteredSignalHistory, 'var(--color-status-green)', 0.9)}
        </svg>
      </div>

      {/* Signal Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MetricBox
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Raw"
          value={`${rawAccelMagnitude.toFixed(2)} m/s²`}
          color="var(--color-status-red)"
        />
        <MetricBox
          icon={<Filter className="w-3.5 h-3.5" />}
          label="Filtered"
          value={`${filteredAccelMagnitude.toFixed(2)} m/s²`}
          color="var(--color-status-green)"
        />
        <MetricBox
          icon={<Gauge className="w-3.5 h-3.5" />}
          label="Est. Speed"
          value={`${(estimatedVelocity * 3.6).toFixed(1)} km/h`}
          color="var(--color-status-blue)"
        />
      </div>

      {/* Filter Parameters */}
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-1.5 border border-[var(--color-border)] text-center">
          <div className="text-[var(--color-text-muted)]">HP Cutoff</div>
          <div className="font-semibold mono text-[var(--color-status-cyan)]">{highPassCutoff} Hz</div>
        </div>
        <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-1.5 border border-[var(--color-border)] text-center">
          <div className="text-[var(--color-text-muted)]">LP Cutoff</div>
          <div className="font-semibold mono text-[var(--color-status-cyan)]">{lowPassCutoff} Hz</div>
        </div>
        <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-1.5 border border-[var(--color-border)] text-center">
          <div className="text-[var(--color-text-muted)]">Kalman Gain</div>
          <div className="font-semibold mono text-[var(--color-status-purple)]">{kalmanGain.toFixed(2)}</div>
        </div>
      </div>

      {/* SNR Bar */}
      <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)]">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-[var(--color-text-muted)] flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Signal-to-Noise Ratio
          </span>
          <span className="mono font-semibold text-[var(--color-status-green)]">{snr.toFixed(1)} dB</span>
        </div>
        <div className="h-1 bg-[rgba(15,23,42,0.8)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (snr / 35) * 100)}%`,
              background: snr > 20 ? 'var(--color-status-green)' : snr > 10 ? 'var(--color-status-yellow)' : 'var(--color-status-red)',
            }}
          />
        </div>
      </div>

      {/* Detected Events */}
      <div className="space-y-1">
        <span className="text-[9px] text-[var(--color-text-muted)] uppercase flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          Detected Non-Navigation Events
        </span>
        <div className="flex flex-wrap gap-1">
          {detectedEvents.map((evt, i) => {
            const info = eventLabels[evt] || { label: evt, color: 'var(--color-text-muted)', icon: '•' };
            return (
              <span
                key={`${evt}-${i}`}
                className="text-[10px] px-2 py-0.5 rounded-full border font-medium mono"
                style={{
                  color: info.color,
                  borderColor: `${info.color}33`,
                  background: `${info.color}0D`,
                }}
              >
                {info.icon} {info.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MetricBox: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
    <div className="flex justify-center mb-0.5" style={{ color }}>{icon}</div>
    <div className="text-[12px] font-bold mono" style={{ color }}>{value}</div>
    <div className="text-[9px] text-[var(--color-text-muted)] uppercase">{label}</div>
  </div>
);

export default VibrationFilterPanel;
