import React from 'react';
import type { PerformanceMetrics, NavigationMode } from '../simulation/types';
import { Gauge, TrendingDown, Clock, Zap, Target, CheckCircle2, XCircle, Route } from 'lucide-react';

interface PerformanceBenchmarkProps {
  performance: PerformanceMetrics;
  mode: NavigationMode;
}

const PerformanceBenchmark: React.FC<PerformanceBenchmarkProps> = ({ performance, mode }) => {
  const {
    driftPercent,
    driftMeters,
    distanceInDeniedZone,
    totalDistanceTravelled,
    positionUpdateRateHz,
    transitionLatencyMs,
    driftPer50m,
    driftPer1km,
    processingTimeMs,
    benchmarkCompliance,
  } = performance;

  const isDR = mode === 'dead_reckoning';
  const allPassing = Object.values(benchmarkCompliance).every(Boolean);

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Gauge className="w-4 h-4 text-[var(--color-status-cyan)]" />
          SIH Performance Benchmarks
        </h3>
        <div
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold mono ${
            allPassing
              ? 'bg-[rgba(34,197,94,0.12)] text-[var(--color-status-green)]'
              : 'bg-[rgba(234,179,8,0.12)] text-[var(--color-status-yellow)]'
          }`}
        >
          {allPassing ? '✅ ALL BENCHMARKS PASSING' : '⚠️ MONITORING'}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigMetric
          icon={<TrendingDown className="w-5 h-5" />}
          label="Drift %"
          value={`${driftPercent.toFixed(2)}%`}
          sublabel="Target: < 10%"
          color={driftPercent < 10 ? 'var(--color-status-green)' : 'var(--color-status-red)'}
          progress={Math.min(100, (driftPercent / 10) * 100)}
          inverted
        />
        <BigMetric
          icon={<Target className="w-5 h-5" />}
          label="Drift / 50m"
          value={`${driftPer50m.toFixed(2)} m`}
          sublabel="Target: < 5m"
          color={driftPer50m < 5 ? 'var(--color-status-green)' : 'var(--color-status-red)'}
          progress={Math.min(100, (driftPer50m / 5) * 100)}
          inverted
        />
        <BigMetric
          icon={<Route className="w-5 h-5" />}
          label="Drift / 1km"
          value={`${driftPer1km.toFixed(1)} m`}
          sublabel="Target: < 100m"
          color={driftPer1km < 100 ? 'var(--color-status-green)' : 'var(--color-status-red)'}
          progress={Math.min(100, (driftPer1km / 100) * 100)}
          inverted
        />
        <BigMetric
          icon={<Zap className="w-5 h-5" />}
          label="Update Rate"
          value={`${positionUpdateRateHz.toFixed(0)} Hz`}
          sublabel="Target: ≥ 10Hz"
          color={positionUpdateRateHz >= 10 ? 'var(--color-status-green)' : 'var(--color-status-red)'}
          progress={Math.min(100, (positionUpdateRateHz / 20) * 100)}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SecondaryMetric
          icon={<TrendingDown className="w-3.5 h-3.5" />}
          label="Abs. Drift"
          value={`${driftMeters.toFixed(1)} m`}
          color="var(--color-status-blue)"
        />
        <SecondaryMetric
          icon={<Route className="w-3.5 h-3.5" />}
          label="GNSS-Denied Dist."
          value={`${distanceInDeniedZone.toFixed(0)} m`}
          color="var(--color-status-yellow)"
        />
        <SecondaryMetric
          icon={<Route className="w-3.5 h-3.5" />}
          label="Total Distance"
          value={`${totalDistanceTravelled.toFixed(0)} m`}
          color="var(--color-status-cyan)"
        />
        <SecondaryMetric
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Switch Latency"
          value={`${transitionLatencyMs.toFixed(0)} ms`}
          color={transitionLatencyMs < 100 ? 'var(--color-status-green)' : 'var(--color-status-yellow)'}
        />
        <SecondaryMetric
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Processing"
          value={`${processingTimeMs.toFixed(1)} ms`}
          color="var(--color-status-purple)"
        />
      </div>

      {/* Benchmark Compliance Checklist */}
      <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-3 border border-[var(--color-border)]">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-2 font-semibold">
          SIH Benchmark Compliance
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
          <ComplianceItem label="Drift < 10% of distance" passing={benchmarkCompliance.driftUnder10Percent} />
          <ComplianceItem label="< 5m drift over 50m GNSS-denied" passing={benchmarkCompliance.driftUnder5mPer50m} />
          <ComplianceItem label="< 100m drift over 1km at 60km/h" passing={benchmarkCompliance.driftUnder100mPer1km} />
          <ComplianceItem label="Position update ≥ 10Hz (mobile)" passing={benchmarkCompliance.updateRate10Hz} />
          <ComplianceItem label="Seamless GPS↔DR transition" passing={benchmarkCompliance.seamlessTransition} />
        </div>
      </div>

      {/* Deployment Info */}
      <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)]">
        <span>Mobile: 10Hz (Smartphone IMU) • Edge: 200Hz (FOG-based IMU)</span>
        <span>Dataset: IO-VNBD (Inertial & Odometry Benchmark)</span>
      </div>
    </div>
  );
};

const BigMetric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  color: string;
  progress: number;
  inverted?: boolean;
}> = ({ icon, label, value, sublabel, color, progress, inverted }) => (
  <div className="bg-[rgba(15,23,42,0.5)] rounded-xl p-3 border border-[var(--color-border)] space-y-2">
    <div className="flex items-center gap-2" style={{ color }}>
      {icon}
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase font-medium">{label}</span>
    </div>
    <div className="text-[20px] font-bold mono" style={{ color }}>{value}</div>
    <div className="h-1.5 bg-[rgba(15,23,42,0.8)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, progress)}%`,
          background: inverted
            ? progress < 70 ? 'var(--color-status-green)' : progress < 90 ? 'var(--color-status-yellow)' : 'var(--color-status-red)'
            : color,
        }}
      />
    </div>
    <div className="text-[9px] text-[var(--color-text-muted)]">{sublabel}</div>
  </div>
);

const SecondaryMetric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
    <div className="flex justify-center mb-0.5" style={{ color }}>{icon}</div>
    <div className="text-[13px] font-bold mono" style={{ color }}>{value}</div>
    <div className="text-[8px] text-[var(--color-text-muted)] uppercase">{label}</div>
  </div>
);

const ComplianceItem: React.FC<{ label: string; passing: boolean }> = ({ label, passing }) => (
  <div className="flex items-center gap-1.5 text-[10px]">
    {passing ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-status-green)] flex-shrink-0" />
    ) : (
      <XCircle className="w-3.5 h-3.5 text-[var(--color-status-red)] flex-shrink-0" />
    )}
    <span className={passing ? 'text-[var(--color-status-green)]' : 'text-[var(--color-status-red)]'}>
      {label}
    </span>
  </div>
);

export default PerformanceBenchmark;
