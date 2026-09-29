import React from 'react';
import type { CalibrationState } from '../simulation/types';
import { Smartphone, RotateCw, CheckCircle2, Compass, ArrowUpDown, ArrowLeftRight } from 'lucide-react';

interface CalibrationPanelProps {
  calibration: CalibrationState;
  isRunning: boolean;
}

const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ calibration, isRunning }) => {
  const { pitch, roll, yaw, mountType, isCalibrated, calibrationProgress, alignmentQuality, vehicleAxisOffset } = calibration;

  const mountLabels: Record<string, string> = {
    dashboard: '📱 Dashboard Mount',
    holder: '📱 Mobile Holder',
    pocket: '📱 Pocket',
    detecting: '🔍 Auto-Detecting…',
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[var(--color-status-purple)]" />
          Phone Calibration Engine
        </h3>
        <div
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold mono ${
            isCalibrated
              ? 'bg-[rgba(34,197,94,0.12)] text-[var(--color-status-green)]'
              : 'bg-[rgba(234,179,8,0.12)] text-[var(--color-status-yellow)]'
          }`}
        >
          {isCalibrated ? '✅ CALIBRATED' : isRunning ? '⏳ CALIBRATING' : 'STANDBY'}
        </div>
      </div>

      {/* Calibration Progress */}
      {!isCalibrated && isRunning && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-[var(--color-text-muted)]">Calibration Progress</span>
            <span className="mono text-[var(--color-status-yellow)]">{calibrationProgress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-[rgba(15,23,42,0.8)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${calibrationProgress}%`,
                background: 'linear-gradient(90deg, #eab308, #f59e0b)',
              }}
            />
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)] flex items-center gap-1">
            <RotateCw className="w-3 h-3 animate-spin" />
            Determining phone orientation relative to vehicle…
          </div>
        </div>
      )}

      {/* Mount Type */}
      <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2.5 border border-[var(--color-border)] flex items-center justify-between">
        <span className="text-[11px] text-[var(--color-text-muted)]">Mount Type</span>
        <span className="text-[11px] font-semibold mono text-[var(--color-status-purple)]">
          {mountLabels[mountType]}
        </span>
      </div>

      {/* Pitch / Roll / Yaw */}
      <div className="grid grid-cols-3 gap-2">
        <OrientationCard
          icon={<ArrowUpDown className="w-3.5 h-3.5" />}
          label="Pitch"
          value={pitch}
          color="var(--color-status-cyan)"
          active={isCalibrated}
        />
        <OrientationCard
          icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
          label="Roll"
          value={roll}
          color="var(--color-status-blue)"
          active={isCalibrated}
        />
        <OrientationCard
          icon={<Compass className="w-3.5 h-3.5" />}
          label="Yaw"
          value={yaw}
          color="var(--color-status-purple)"
          active={isCalibrated}
        />
      </div>

      {/* Alignment Quality + Axis Offset */}
      {isCalibrated && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
            <div className="flex justify-center mb-1">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-status-green)]" />
            </div>
            <div className="text-[14px] font-bold mono text-[var(--color-status-green)]">
              {alignmentQuality.toFixed(1)}%
            </div>
            <div className="text-[9px] text-[var(--color-text-muted)] uppercase">Alignment Quality</div>
          </div>
          <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
            <div className="flex justify-center mb-1">
              <Compass className="w-4 h-4 text-[var(--color-status-cyan)]" />
            </div>
            <div className="text-[14px] font-bold mono text-[var(--color-status-cyan)]">
              {vehicleAxisOffset.toFixed(1)}°
            </div>
            <div className="text-[9px] text-[var(--color-text-muted)] uppercase">Axis Offset</div>
          </div>
        </div>
      )}
    </div>
  );
};

const OrientationCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  active: boolean;
}> = ({ icon, label, value, color, active }) => (
  <div
    className="rounded-lg p-2 border text-center"
    style={{
      borderColor: active ? `${color}33` : 'var(--color-border)',
      background: active ? `${color}0A` : 'rgba(15,23,42,0.5)',
    }}
  >
    <div className="flex justify-center mb-0.5" style={{ color: active ? color : 'var(--color-text-muted)' }}>
      {icon}
    </div>
    <div className="text-[13px] font-bold mono" style={{ color: active ? color : 'var(--color-text-muted)' }}>
      {active ? `${value.toFixed(1)}°` : '—'}
    </div>
    <div className="text-[9px] text-[var(--color-text-muted)] uppercase">{label}</div>
  </div>
);

export default CalibrationPanel;
