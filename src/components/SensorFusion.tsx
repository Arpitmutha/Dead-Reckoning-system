import React from 'react';
import type { NavigationMode, FusionWeights } from '../simulation/types';
import { ArrowDown, ArrowRight, Cpu, Satellite, Brain, MapPin, Merge, Zap, ShieldCheck } from 'lucide-react';

interface SensorFusionProps {
  mode: NavigationMode;
  fusionWeights: FusionWeights;
}

const SensorFusion: React.FC<SensorFusionProps> = ({ mode, fusionWeights }) => {
  const isDR = mode === 'dead_reckoning';
  const isRestoring = mode === 'gps_restoring';
  const isGPS = mode === 'gps_navigation';

  const {
    gnssWeight,
    insWeight,
    aiCorrectionWeight,
    fusionMethod,
    innovationSequence,
    fusionConfidence,
  } = fusionWeights;

  const methodLabels: Record<string, { label: string; color: string }> = {
    ekf: { label: 'Extended Kalman Filter (EKF)', color: 'var(--color-status-green)' },
    ukf: { label: 'Unscented Kalman Filter (UKF)', color: 'var(--color-status-yellow)' },
    ai_hybrid: { label: 'AI Hybrid Fusion', color: 'var(--color-status-blue)' },
  };

  const method = methodLabels[fusionMethod] || methodLabels.ekf;

  const fusionLabel = isDR
    ? 'INS + AI/ML → Dead Reckoning'
    : isRestoring
      ? 'GNSS + AI → Position Correction'
      : 'GNSS + INS → Sensor Fusion';

  return (
    <div className={`glass-card p-4 space-y-3 ${isDR ? 'animate-glow' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Merge className="w-4 h-4 text-[var(--color-status-cyan)]" />
          GNSS+INS Fusion Engine
        </h3>
        <div
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold mono`}
          style={{ color: method.color, background: `${method.color}15`, border: `1px solid ${method.color}33` }}
        >
          {fusionMethod.toUpperCase()}
        </div>
      </div>

      {/* Current fusion mode */}
      <div
        className="rounded-lg p-2.5 text-center text-[12px] font-semibold mono border"
        style={{
          color: method.color,
          borderColor: `${method.color}33`,
          background: `${method.color}0D`,
        }}
      >
        {fusionLabel}
      </div>

      {/* Fusion Algorithm Label */}
      <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase mb-0.5">Active Algorithm</div>
        <div className="text-[12px] font-semibold mono" style={{ color: method.color }}>
          {method.label}
        </div>
      </div>

      {/* Weight Bars */}
      <div className="space-y-2">
        <WeightBar
          icon={<Satellite className="w-3.5 h-3.5" />}
          label="GNSS Weight"
          value={gnssWeight}
          color="var(--color-status-green)"
          disabled={isDR}
        />
        <WeightBar
          icon={<Cpu className="w-3.5 h-3.5" />}
          label="INS Weight"
          value={insWeight}
          color="var(--color-status-cyan)"
        />
        <WeightBar
          icon={<Brain className="w-3.5 h-3.5" />}
          label="AI Correction"
          value={aiCorrectionWeight}
          color="var(--color-status-purple)"
          highlight={isDR}
        />
      </div>

      {/* Fusion Metrics */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-border)]">
        <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
          <div className="flex justify-center mb-0.5">
            <ShieldCheck className="w-4 h-4" style={{ color: fusionConfidence > 80 ? 'var(--color-status-green)' : 'var(--color-status-yellow)' }} />
          </div>
          <div
            className="text-[14px] font-bold mono"
            style={{ color: fusionConfidence > 80 ? 'var(--color-status-green)' : 'var(--color-status-yellow)' }}
          >
            {fusionConfidence.toFixed(1)}%
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase">Fusion Confidence</div>
        </div>
        <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
          <div className="flex justify-center mb-0.5">
            <Zap className="w-4 h-4 text-[var(--color-status-cyan)]" />
          </div>
          <div className="text-[14px] font-bold mono text-[var(--color-status-cyan)]">
            {innovationSequence.toFixed(2)}
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase">Innovation (Residual)</div>
        </div>
      </div>

      {/* Data Flow (compact) */}
      <div className="flex items-center justify-center gap-1 py-1">
        <FlowChip icon={<Satellite className="w-3 h-3" />} label="GNSS" active={isGPS || isRestoring} color="green" crossed={isDR} />
        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
        <FlowChip icon={<Cpu className="w-3 h-3" />} label="IMU" active={true} color="cyan" />
        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
        <FlowChip icon={<Brain className="w-3 h-3" />} label="AI" active={isDR} color="blue" />
        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)]" />
        <FlowChip icon={<MapPin className="w-3 h-3" />} label="Pos" active={true} color={isDR ? 'blue' : 'green'} />
      </div>
    </div>
  );
};

const WeightBar: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  disabled?: boolean;
  highlight?: boolean;
}> = ({ icon, label, value, color, disabled, highlight }) => (
  <div className={`flex items-center gap-2 ${disabled ? 'opacity-35' : ''}`}>
    <span style={{ color }} className="flex-shrink-0">{icon}</span>
    <span className="text-[10px] text-[var(--color-text-muted)] w-20 flex-shrink-0">{label}</span>
    <div className="flex-1 h-2 bg-[rgba(15,23,42,0.8)] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${highlight ? 'animate-pulse' : ''}`}
        style={{
          width: `${value * 100}%`,
          background: color,
          boxShadow: highlight ? `0 0 8px ${color}` : 'none',
        }}
      />
    </div>
    <span className="text-[11px] mono font-semibold w-10 text-right" style={{ color }}>
      {(value * 100).toFixed(0)}%
    </span>
  </div>
);

const FlowChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  color: string;
  crossed?: boolean;
}> = ({ icon, label, active, color, crossed }) => {
  const colorMap: Record<string, string> = {
    green: 'var(--color-status-green)',
    blue: 'var(--color-status-blue)',
    cyan: 'var(--color-status-cyan)',
  };
  const c = colorMap[color] || 'var(--color-text-muted)';

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border"
      style={{
        borderColor: active ? `${c}44` : 'var(--color-border)',
        background: active ? `${c}0D` : 'transparent',
        color: active ? c : 'var(--color-text-muted)',
        opacity: crossed ? 0.3 : 1,
        textDecoration: crossed ? 'line-through' : 'none',
      }}
    >
      {icon}
      {label}
    </div>
  );
};

export default SensorFusion;
