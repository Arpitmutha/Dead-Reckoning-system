import React from 'react';
import type { NavigationMode, PredictionResult } from '../simulation/types';
import {
  Brain,
  MapPin,
  Gauge,
  Compass,
  ShieldCheck,
  AlertTriangle,
  Zap,
  GitBranch,
  Layers,
} from 'lucide-react';

interface AIModelPanelProps {
  mode: NavigationMode;
  prediction: PredictionResult;
}

const AIModelPanel: React.FC<AIModelPanelProps> = ({ mode, prediction }) => {
  const isDR = mode === 'dead_reckoning';
  const isActive = isDR || mode === 'gnss_degrading';

  return (
    <div className="space-y-3">
      {/* AI-ML Position Estimation */}
      <div className={`glass-card p-4 space-y-3 ${isDR ? 'animate-glow' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
            <Brain className="w-4 h-4 text-[var(--color-status-blue)]" />
            AI-ML Position Estimation
          </h3>
          <div
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold mono ${
              isDR
                ? 'bg-[rgba(56,189,248,0.15)] text-[var(--color-status-blue)] text-glow-blue'
                : 'bg-[rgba(34,197,94,0.1)] text-[var(--color-status-green)]'
            }`}
          >
            {isDR ? '⚡ AI DEAD RECKONING ACTIVE' : mode === 'gps_navigation' ? 'GPS Navigation' : mode === 'gps_restoring' ? '✅ RECALIBRATING' : mode === 'destination_reached' ? 'COMPLETE' : 'STANDBY'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <EstField
            icon={<MapPin className="w-3 h-3" />}
            label="Est. Latitude"
            value={prediction.estimatedPosition.lat.toFixed(6)}
            active={isActive}
          />
          <EstField
            icon={<MapPin className="w-3 h-3" />}
            label="Est. Longitude"
            value={prediction.estimatedPosition.lng.toFixed(6)}
            active={isActive}
          />
          <EstField
            icon={<Gauge className="w-3 h-3" />}
            label="Est. Speed"
            value={`${(prediction.estimatedSpeed * 3.6).toFixed(1)} km/h`}
            active={isActive}
          />
          <EstField
            icon={<Compass className="w-3 h-3" />}
            label="Est. Heading"
            value={`${prediction.estimatedHeading.toFixed(1)}°`}
            active={isActive}
          />
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]">
          <MetricCard
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Confidence"
            value={`${prediction.confidence.toFixed(1)}%`}
            color={prediction.confidence > 85 ? 'green' : prediction.confidence > 70 ? 'yellow' : 'red'}
          />
          <MetricCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Pred. Error"
            value={`${prediction.predictionError.toFixed(1)} m`}
            color={prediction.predictionError < 5 ? 'green' : prediction.predictionError < 15 ? 'yellow' : 'red'}
          />
          <MetricCard
            icon={<GitBranch className="w-4 h-4" />}
            label="Drift"
            value={`${prediction.drift.toFixed(1)} m`}
            color={prediction.drift < 3 ? 'green' : prediction.drift < 10 ? 'yellow' : 'red'}
          />
        </div>
      </div>

      {/* AI Model Info */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--color-status-purple)]" />
          AI Model
        </h3>

        <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-3 border border-[var(--color-border)] space-y-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Model</span>
            <span className="mono font-semibold text-[var(--color-status-purple)]">LSTM + Temporal CNN</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Accuracy</span>
            <span className="mono font-semibold text-[var(--color-status-green)]">96.3%</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Training Dataset</span>
            <span className="mono font-semibold text-[var(--color-status-cyan)]">IO-VNBD</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Inference Time</span>
            <span className="mono font-semibold text-[var(--color-status-cyan)]">
              {prediction.inferenceTime > 0 ? `${prediction.inferenceTime.toFixed(0)} ms` : '18 ms'}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--color-text-muted)]">Deployment</span>
            <span className="mono font-semibold text-[var(--color-status-blue)]">TFLite / ONNX</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)]">
            <div className="text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Input Features
            </div>
            <div className="space-y-0.5 text-[var(--color-text-secondary)] mono">
              <div>• Accelerometer XYZ</div>
              <div>• Gyroscope XYZ</div>
              <div>• Speed, Heading</div>
              <div>• Magnetometer</div>
              <div>• Previous Position</div>
            </div>
          </div>
          <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)]">
            <div className="text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Output
            </div>
            <div className="space-y-0.5 text-[var(--color-text-secondary)] mono">
              <div>• ΔLatitude</div>
              <div>• ΔLongitude</div>
              <div>• Est. Position</div>
              <div>• Est. Heading</div>
            </div>
          </div>
        </div>

        <div className="text-[9px] text-[var(--color-text-muted)] text-center pt-1 border-t border-[var(--color-border)] space-y-0.5">
          <div>Cloud Training → On-Device Inference (Smartphone + Edge)</div>
          <div>Compatible with MEMS IMU (phone) and FOG IMU (external)</div>
        </div>
      </div>
    </div>
  );
};

const EstField: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}> = ({ icon, label, value, active }) => (
  <div className={`rounded-lg p-2 border ${active ? 'bg-[rgba(56,189,248,0.05)] border-[rgba(56,189,248,0.2)]' : 'bg-[rgba(15,23,42,0.5)] border-[var(--color-border)]'}`}>
    <div className="flex items-center gap-1.5 mb-0.5">
      <span className={active ? 'text-[var(--color-status-blue)]' : 'text-[var(--color-text-muted)]'}>{icon}</span>
      <span className="text-[9px] text-[var(--color-text-muted)] uppercase">{label}</span>
    </div>
    <span className={`text-[12px] font-semibold mono ${active ? 'text-[var(--color-status-blue)]' : 'text-[var(--color-text-primary)]'}`}>
      {value}
    </span>
  </div>
);

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}> = ({ icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    green: 'var(--color-status-green)',
    yellow: 'var(--color-status-yellow)',
    red: 'var(--color-status-red)',
    blue: 'var(--color-status-blue)',
  };

  return (
    <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] text-center">
      <div style={{ color: colorMap[color] }} className="flex justify-center mb-1">{icon}</div>
      <div className="text-[14px] font-bold mono" style={{ color: colorMap[color] }}>{value}</div>
      <div className="text-[9px] text-[var(--color-text-muted)] uppercase">{label}</div>
    </div>
  );
};

export default AIModelPanel;
