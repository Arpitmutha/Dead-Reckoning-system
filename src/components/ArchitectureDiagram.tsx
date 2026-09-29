import React from 'react';
import type { NavigationMode } from '../simulation/types';
import {
  Satellite,
  Cpu,
  Brain,
  MapPin,
  ArrowDown,
  ArrowRight,
  Layers,
  Wifi,
  WifiOff,
  RefreshCw,
  Smartphone,
  Activity,
  Map,
  Merge,
  Cloud,
  MonitorSmartphone,
} from 'lucide-react';

interface ArchitectureDiagramProps {
  mode: NavigationMode;
}

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = ({ mode }) => {
  const isDR = mode === 'dead_reckoning';

  return (
    <div className="glass-card p-4 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
        <Layers className="w-4 h-4 text-[var(--color-status-purple)]" />
        IDR System Architecture — SIH Solution Pipeline
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Main Processing Pipeline */}
        <div className="bg-[rgba(15,23,42,0.5)] rounded-xl p-4 border border-[var(--color-border)] space-y-1.5">
          <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] text-center mb-2 uppercase tracking-wider">
            On-Device Processing Pipeline
          </div>

          {/* Sensors */}
          <div className="flex gap-2">
            <PipeNode icon={<Cpu />} label="Accelerometer" color="cyan" active={true} small />
            <PipeNode icon={<Cpu />} label="Gyroscope" color="cyan" active={true} small />
            <PipeNode icon={<Cpu />} label="Magnetometer" color="cyan" active={true} small />
          </div>
          <PipeArrow />

          {/* Calibration */}
          <PipeNode icon={<Smartphone />} label="Phone Calibration Engine" sublabel="Pitch / Roll / Yaw Alignment" color="purple" active={true} />
          <PipeArrow />

          {/* Vibration Filter */}
          <PipeNode icon={<Activity />} label="AI Vibration Filter" sublabel="Noise Removal + Speed Estimation" color="yellow" active={true} />
          <PipeArrow />

          {/* Dead Reckoning */}
          <PipeNode icon={<Brain />} label="AI-ML Dead Reckoning" sublabel="LSTM + IMU Integration" color="blue" active={isDR} large />
          <PipeArrow />

          {/* Map Matching */}
          <PipeNode icon={<Map />} label="Map-Matching + NHC" sublabel="HMM + OpenStreetMap + Constraints" color="green" active={isDR} />
          <PipeArrow />

          {/* Fusion */}
          <PipeNode icon={<Merge />} label="GNSS+INS Fusion Engine" sublabel="EKF / UKF / AI Hybrid" color="cyan" active={true} large />
          <PipeArrow />

          {/* Output */}
          <PipeNode icon={<MapPin />} label="Position Output" sublabel="10Hz Mobile / 200Hz Edge" color="green" active={true} large />
        </div>

        {/* Right Side: Mode Cards + Training Info */}
        <div className="space-y-3">
          {/* Navigation Modes */}
          <ModeCard
            icon={<Wifi className="w-5 h-5" />}
            title="GNSS Available"
            description="GNSS + INS + AI Fusion"
            subtitle="Full sensor fusion with EKF, GNSS as primary"
            active={mode === 'gps_navigation'}
            color="green"
          />

          <ModeCard
            icon={<WifiOff className="w-5 h-5" />}
            title="GNSS Denied"
            description="IMU + AI → Dead Reckoning"
            subtitle="AI-ML model + Map-Matching + NHC constraints"
            active={mode === 'dead_reckoning' || mode === 'gnss_degrading'}
            color="blue"
          />

          <ModeCard
            icon={<RefreshCw className="w-5 h-5" />}
            title="GNSS Restored"
            description="Seamless Recalibration"
            subtitle="Drift correction via GNSS+INS fusion realignment"
            active={mode === 'gps_restoring'}
            color="cyan"
          />

          {/* Training vs Inference */}
          <div className="bg-[rgba(15,23,42,0.5)] rounded-xl p-3 border border-[var(--color-border)] space-y-2">
            <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-center">
              Deployment Architecture
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-2 border border-[rgba(167,139,250,0.2)] bg-[rgba(167,139,250,0.06)] text-center">
                <Cloud className="w-4 h-4 text-[var(--color-status-purple)] mx-auto mb-1" />
                <div className="text-[10px] font-semibold text-[var(--color-status-purple)]">Cloud / Desktop</div>
                <div className="text-[8px] text-[var(--color-text-muted)]">Model Training</div>
                <div className="text-[8px] text-[var(--color-text-muted)]">IO-VNBD Dataset</div>
              </div>
              <div className="rounded-lg p-2 border border-[rgba(56,189,248,0.2)] bg-[rgba(56,189,248,0.06)] text-center">
                <MonitorSmartphone className="w-4 h-4 text-[var(--color-status-blue)] mx-auto mb-1" />
                <div className="text-[10px] font-semibold text-[var(--color-status-blue)]">On-Device</div>
                <div className="text-[8px] text-[var(--color-text-muted)]">Real-time Inference</div>
                <div className="text-[8px] text-[var(--color-text-muted)]">TFLite / ONNX Runtime</div>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-[var(--color-text-muted)] text-center pt-1 border-t border-[var(--color-border)]">
            Works with Smartphone MEMS IMU + External FOG IMU
          </div>
        </div>
      </div>
    </div>
  );
};

const PipeNode: React.FC<{
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  color: string;
  active: boolean;
  large?: boolean;
  small?: boolean;
}> = ({ icon, label, sublabel, color, active, large, small }) => {
  const colorMap: Record<string, string> = {
    green: 'var(--color-status-green)',
    yellow: 'var(--color-status-yellow)',
    red: 'var(--color-status-red)',
    blue: 'var(--color-status-blue)',
    cyan: 'var(--color-status-cyan)',
    purple: 'var(--color-status-purple)',
  };

  const c = colorMap[color];

  return (
    <div
      className={`rounded-lg border text-center transition-all duration-300 ${
        large ? 'p-2.5' : small ? 'p-1.5' : 'p-2'
      } ${active ? 'animate-glow' : ''}`}
      style={{
        borderColor: active ? `${c}44` : 'var(--color-border)',
        background: active ? `${c}10` : 'rgba(15,23,42,0.3)',
      }}
    >
      <div className="flex items-center justify-center gap-1.5">
        {icon && (
          <span
            className={small ? 'w-3 h-3' : 'w-4 h-4'}
            style={{ color: active ? c : 'var(--color-text-muted)' }}
          >
            {icon}
          </span>
        )}
        <span
          className={`font-medium ${small ? 'text-[9px]' : 'text-[11px]'}`}
          style={{ color: active ? c : 'var(--color-text-muted)' }}
        >
          {label}
        </span>
      </div>
      {sublabel && (
        <span className="text-[8px] text-[var(--color-text-muted)]">{sublabel}</span>
      )}
    </div>
  );
};

const PipeArrow: React.FC = () => (
  <div className="flex justify-center">
    <ArrowDown className="w-3 h-3 text-[var(--color-text-muted)]" />
  </div>
);

const ModeCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  subtitle: string;
  active: boolean;
  color: string;
}> = ({ icon, title, description, subtitle, active, color }) => {
  const colorMap: Record<string, string> = {
    green: 'var(--color-status-green)',
    blue: 'var(--color-status-blue)',
    cyan: 'var(--color-status-cyan)',
  };

  const c = colorMap[color];

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-300 ${
        active ? 'scale-[1.02]' : 'opacity-50'
      }`}
      style={{
        borderColor: active ? `${c}44` : 'var(--color-border)',
        background: active ? `${c}0D` : 'rgba(15,23,42,0.3)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="rounded-lg p-2"
          style={{ background: `${c}15`, color: c }}
        >
          {icon}
        </div>
        <div>
          <div className="text-[12px] font-semibold" style={{ color: active ? c : 'var(--color-text-muted)' }}>
            {title}
          </div>
          <div className="text-[11px] mono font-medium" style={{ color: active ? c : 'var(--color-text-muted)' }}>
            {description}
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)]">{subtitle}</div>
        </div>
        {active && <span className={`status-dot ${color === 'blue' ? 'blue' : color} ml-auto`} />}
      </div>
    </div>
  );
};

export default ArchitectureDiagram;
