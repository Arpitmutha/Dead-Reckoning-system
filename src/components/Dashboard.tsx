import React from 'react';
import type { NavigationState } from '../simulation/types';
import {
  Satellite,
  Navigation,
  Brain,
  MapPin,
  Activity,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Wifi,
  WifiOff,
  Play,
  RotateCcw,
  Zap,
  Shield,
  CheckCircle2,
  Crosshair,
  Gauge,
  Compass,
  Radio,
} from 'lucide-react';

interface DashboardProps {
  state: NavigationState;
  onStart: () => void;
  onReset: () => void;
  onGPSLoss: () => void;
  onGPSRestore: () => void;
  onRunDemo: () => void;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function getModeInfo(mode: string) {
  switch (mode) {
    case 'gps_navigation':
      return { label: 'GPS NAVIGATION', color: '#22c55e', bg: 'rgba(34,197,94,0.10)' };
    case 'gnss_degrading':
      return { label: 'GPS DEGRADING', color: '#eab308', bg: 'rgba(234,179,8,0.10)' };
    case 'dead_reckoning':
      return { label: 'AI DEAD RECKONING', color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' };
    case 'gps_restoring':
      return { label: 'POSITION RECOVERY', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' };
    case 'destination_reached':
      return { label: 'DESTINATION REACHED', color: '#22c55e', bg: 'rgba(34,197,94,0.10)' };
    default:
      return { label: 'IDLE', color: '#64748b', bg: 'rgba(100,116,139,0.10)' };
  }
}

/* ── Panel Card Shell ──────────────────────────────────────────────────── */
const PanelCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  statusLabel?: string;
  statusColor?: string;
  children: React.ReactNode;
  glow?: boolean;
  glowColor?: string;
}> = ({ title, icon, statusLabel, statusColor, children, glow, glowColor }) => (
  <div
    className="glass-card overflow-hidden"
    style={{
      boxShadow: glow ? `0 0 18px ${glowColor || '#38bdf8'}25, inset 0 1px 0 ${glowColor || '#38bdf8'}15` : undefined,
    }}
  >
    {/* Header row */}
    <div
      className="flex items-center justify-between px-3 py-1.5"
      style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-status-blue)]">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">
          {title}
        </span>
      </div>
      {statusLabel && (
        <span
          className="text-[9px] font-bold uppercase tracking-wider mono flex items-center gap-1"
          style={{ color: statusColor || '#22c55e' }}
        >
          <span
            className="w-[5px] h-[5px] rounded-full inline-block shrink-0"
            style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
          {statusLabel}
        </span>
      )}
    </div>
    {/* Body */}
    <div className="px-3 py-2">{children}</div>
  </div>
);

/* ── Labeled Metric ────────────────────────────────────────────────────── */
const Val: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  color?: string;
  unit?: string;
  big?: boolean;
}> = ({ icon, label, value, color = 'var(--color-text-primary)', unit, big }) => (
  <div>
    <div className="flex items-center gap-1 mb-0.5">
      {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
      <span className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">{label}</span>
    </div>
    <span className={`font-bold mono ${big ? 'text-[22px]' : 'text-[15px]'}`} style={{ color }}>{value}</span>
    {unit && <span className="text-[10px] text-[var(--color-text-muted)] ml-1">{unit}</span>}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════
   RIGHT PANEL — all status cards
   ══════════════════════════════════════════════════════════════════════ */
const RightPanel: React.FC<{ state: NavigationState }> = ({ state }) => {
  const { gnss, prediction, mode, imu } = state;
  const modeInfo = getModeInfo(mode);
  const isDR = mode === 'dead_reckoning';
  const isRestoring = mode === 'gps_restoring';
  const posError = isRestoring ? prediction.predictionError : (gnss.connected ? gnss.accuracy : prediction.predictionError);
  const speed = (imu.speed * 3.6);

  let errorTrend: 'up' | 'down' | 'stable' | 'recovering' = 'stable';
  if (isRestoring) {
    errorTrend = 'recovering';
  } else if (state.errorHistory.length >= 5) {
    const r = state.errorHistory.slice(-5);
    const d = r[r.length - 1].positionError - r[0].positionError;
    if (d > 0.3) errorTrend = 'up';
    else if (d < -0.3) errorTrend = 'down';
  }

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto pr-0.5">

      {/* ─ GPS STATUS ──────────────────────────────────────────────────── */}
      <PanelCard
        title="GPS Status"
        icon={<Satellite className="w-3.5 h-3.5" />}
        statusLabel={gnss.connected ? 'CONNECTED' : 'SIGNAL LOST'}
        statusColor={gnss.connected ? '#22c55e' : '#ef4444'}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <Val icon={<Satellite className="w-3 h-3" />} label="Satellites" value={gnss.satellites.toString()} color={gnss.connected ? '#22c55e' : '#ef4444'} />
          <Val icon={<Radio className="w-3 h-3" />} label="Signal Strength" value={`${gnss.signalStrength.toFixed(0)}%`} color={gnss.connected ? '#22c55e' : '#ef4444'} />
        </div>
        {!gnss.connected && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.12)]">
            <AlertTriangle className="w-3.5 h-3.5 text-[#eab308] shrink-0" />
            <span className="text-[10px] text-[#eab308]">GPS unavailable. Switching to AI-ML Dead Reckoning.</span>
          </div>
        )}
      </PanelCard>

      {/* ─ NAVIGATION MODE + AI ─────────────────────────────────────── */}
      <PanelCard
        title="Navigation Mode"
        icon={<Navigation className="w-3.5 h-3.5" />}
        statusLabel={modeInfo.label}
        statusColor={modeInfo.color}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] block mb-1">Mode</span>
            <div className="px-2 py-1.5 rounded text-center" style={{ background: modeInfo.bg, border: `1px solid ${modeInfo.color}25` }}>
              <span className="text-[11px] font-bold mono" style={{ color: modeInfo.color }}>{modeInfo.label}</span>
            </div>
          </div>
          <div>
            <span className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] block mb-1">AI Engine</span>
            <div className="px-2 py-1.5 rounded text-center" style={{ background: isDR ? 'rgba(56,189,248,0.08)' : 'rgba(234,179,8,0.06)', border: `1px solid ${isDR ? '#38bdf8' : '#eab308'}25` }}>
              <span className="text-[11px] font-bold mono" style={{ color: isDR ? '#38bdf8' : '#eab308' }}>{isDR ? 'ACTIVE' : 'STANDBY'}</span>
            </div>
          </div>
        </div>
      </PanelCard>

      {/* ─ CURRENT POSITION ─────────────────────────────────────────── */}
      <PanelCard
        title="Current Position"
        icon={<MapPin className="w-3.5 h-3.5" />}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Val icon={<MapPin className="w-3 h-3" />} label="Latitude" value={`${state.currentPosition.lat.toFixed(4)}°`} />
          <Val icon={<MapPin className="w-3 h-3" />} label="Longitude" value={`${state.currentPosition.lng.toFixed(4)}°`} />
          <Val icon={<Gauge className="w-3 h-3" />} label="Speed" value={speed.toFixed(1)} unit="km/h" />
          <Val icon={<Compass className="w-3 h-3" />} label="Heading" value={`${imu.heading.toFixed(1)}°`} />
        </div>
      </PanelCard>

      {/* ─ POSITION ERROR ───────────────────────────────────────────── */}
      <PanelCard
        title="Position Error"
        icon={<AlertTriangle className="w-3.5 h-3.5" />}
        statusLabel={errorTrend === 'recovering' ? 'RECOVERING' : errorTrend === 'up' ? 'INCREASING' : errorTrend === 'down' ? 'DECREASING' : 'STABLE'}
        statusColor={errorTrend === 'recovering' ? '#a78bfa' : errorTrend === 'up' ? '#ef4444' : errorTrend === 'down' ? '#22c55e' : '#64748b'}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[26px] font-bold mono" style={{ color: posError < 5 ? '#22c55e' : posError < 15 ? '#eab308' : '#ef4444' }}>
              {posError.toFixed(1)}
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">m</span>
          </div>
          {errorTrend === 'recovering' && <TrendingDown className="w-5 h-5 text-[#a78bfa] animate-pulse" />}
          {errorTrend === 'up' && <TrendingUp className="w-5 h-5 text-[#ef4444]" />}
          {errorTrend === 'down' && <TrendingDown className="w-5 h-5 text-[#22c55e]" />}
          {errorTrend === 'stable' && <Minus className="w-5 h-5 text-[var(--color-text-muted)]" />}
        </div>
        {isRestoring && (
          <div className="mt-2 px-2 py-1.5 rounded bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.12)]">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-[#a78bfa]" />
              <span className="text-[9px] font-bold text-[#a78bfa] uppercase tracking-wider">Correcting drift...</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[rgba(100,116,139,0.2)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(5, (1 - (posError / (gnss.accuracy + prediction.drift + 0.1))) * 100))}%`,
                  background: 'linear-gradient(90deg, #a78bfa, #22c55e)',
                }}
              />
            </div>
          </div>
        )}
      </PanelCard>

      {/* ─ IMU SENSOR STATUS ────────────────────────────────────────── */}
      <PanelCard
        title="IMU Sensor Status"
        icon={<Activity className="w-3.5 h-3.5" />}
        statusLabel={state.isRunning ? 'ACTIVE' : 'STANDBY'}
        statusColor={state.isRunning ? '#22c55e' : '#eab308'}
      >
        {['Accelerometer', 'Gyroscope', 'Magnetometer'].map((s) => (
          <div key={s} className="flex items-center justify-between py-1 border-b border-[var(--color-border)] last:border-0">
            <span className="text-[11px] text-[var(--color-text-secondary)]">{s}</span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#22c55e] mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          </div>
        ))}
      </PanelCard>

      {/* ─ AI PREDICTED POSITION ────────────────────────────────────── */}
      <PanelCard
        title="AI Predicted Position"
        icon={<Crosshair className="w-3.5 h-3.5" />}
        statusLabel={isDR ? 'AI PREDICTION ACTIVE' : isRestoring ? 'COMPARING' : state.performance.distanceInDeniedZone > 0 ? 'COMPLETED' : 'STANDBY'}
        statusColor={isDR ? '#22c55e' : isRestoring ? '#a78bfa' : state.performance.distanceInDeniedZone > 0 ? '#22c55e' : '#64748b'}
        glow={isDR || isRestoring}
        glowColor={isDR ? '#38bdf8' : '#a78bfa'}
      >
        {(isDR || isRestoring) ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Val icon={<MapPin className="w-3 h-3" />} label="Latitude" value={`${prediction.estimatedPosition.lat.toFixed(4)}°`} color="#38bdf8" />
              <Val icon={<MapPin className="w-3 h-3" />} label="Longitude" value={`${prediction.estimatedPosition.lng.toFixed(4)}°`} color="#38bdf8" />
              <Val icon={<Gauge className="w-3 h-3" />} label="Speed" value={(prediction.estimatedSpeed * 3.6).toFixed(1)} unit="km/h" color="#38bdf8" />
              <Val icon={<Compass className="w-3 h-3" />} label="Heading" value={`${prediction.estimatedHeading.toFixed(1)}°`} color="#38bdf8" />
            </div>
            {isDR && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.12)]">
                <span className="w-[6px] h-[6px] rounded-full shrink-0 animate-pulse" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                <span className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wider">AI Prediction Active</span>
              </div>
            )}
            {isRestoring && gnss.position && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-[var(--color-border)]">
                <Val label="GNSS Lat" value={`${gnss.position.lat.toFixed(4)}°`} color="#22c55e" />
                <Val label="GNSS Lng" value={`${gnss.position.lng.toFixed(4)}°`} color="#22c55e" />
              </div>
            )}
          </div>
        ) : state.performance.distanceInDeniedZone > 0 ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Val icon={<MapPin className="w-3 h-3" />} label="Last Predicted Lat" value={`${prediction.estimatedPosition.lat.toFixed(4)}°`} color="#22c55e" />
              <Val icon={<MapPin className="w-3 h-3" />} label="Last Predicted Lng" value={`${prediction.estimatedPosition.lng.toFixed(4)}°`} color="#22c55e" />
              <Val icon={<Gauge className="w-3 h-3" />} label="Speed" value={(prediction.estimatedSpeed * 3.6).toFixed(1)} unit="km/h" color="#22c55e" />
              <Val icon={<Compass className="w-3 h-3" />} label="Heading" value={`${prediction.estimatedHeading.toFixed(1)}°`} color="#22c55e" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.10)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#22c55e]" />
              <span className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wider">Prediction Completed — Position Corrected</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <Shield className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-[11px] text-[var(--color-text-muted)]">GPS active — AI prediction on standby</span>
          </div>
        )}
      </PanelCard>

      {/* ─ GPS OUTAGE ─────────────────────────────────────────────────── */}
      <PanelCard
        title="GPS Outage"
        icon={<Clock className="w-3.5 h-3.5" />}
        statusLabel={isDR ? 'ACTIVE' : isRestoring ? 'RECOVERING' : state.performance.distanceInDeniedZone > 0 ? 'COMPLETED' : 'INACTIVE'}
        statusColor={isDR ? '#ef4444' : isRestoring ? '#a78bfa' : state.performance.distanceInDeniedZone > 0 ? '#22c55e' : '#64748b'}
      >
        {isDR ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 items-center">
              <Val label="Status" value="ACTIVE" color="#ef4444" />
              <Val label="Duration" value={gnss.timeSinceGPSLoss.toFixed(0)} unit="sec" color="#ef4444" big />
              <div className="flex items-center justify-center gap-1 px-2 py-2 rounded text-[10px] font-bold bg-[rgba(56,189,248,0.10)] text-[#38bdf8] border border-[rgba(56,189,248,0.15)]">
                <Zap className="w-3 h-3" /> AI-DR
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[rgba(56,189,248,0.06)] border border-[rgba(56,189,248,0.10)]">
              <span className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Distance without GPS</span>
              <span className="text-[14px] font-bold mono text-[#38bdf8]">
                {state.performance.distanceInDeniedZone < 1000
                  ? `${state.performance.distanceInDeniedZone.toFixed(0)} m`
                  : `${(state.performance.distanceInDeniedZone / 1000).toFixed(2)} km`}
              </span>
            </div>
          </div>
        ) : isRestoring ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-[#a78bfa]" />
              <div>
                <span className="text-[13px] font-bold text-[#a78bfa] mono">POSITION RECOVERY</span>
                <p className="text-[10px] text-[var(--color-text-muted)]">Comparing AI prediction with GPS...</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Val label="Recovery Error" value={posError.toFixed(1)} unit="m" color="#a78bfa" />
              <Val label="Target" value={gnss.accuracy.toFixed(1)} unit="m" color="#22c55e" />
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[rgba(167,139,250,0.06)] border border-[rgba(167,139,250,0.10)]">
              <span className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Distance without GPS</span>
              <span className="text-[14px] font-bold mono text-[#a78bfa]">
                {state.performance.distanceInDeniedZone < 1000
                  ? `${state.performance.distanceInDeniedZone.toFixed(0)} m`
                  : `${(state.performance.distanceInDeniedZone / 1000).toFixed(2)} km`}
              </span>
            </div>
          </div>
        ) : state.performance.distanceInDeniedZone > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
              <div>
                <span className="text-[13px] font-bold text-[#22c55e] mono">OUTAGE COMPLETED</span>
                <p className="text-[10px] text-[var(--color-text-muted)]">GPS restored — navigation resumed</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.10)]">
              <span className="text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">Distance without GPS</span>
              <span className="text-[14px] font-bold mono text-[#22c55e]">
                {state.performance.distanceInDeniedZone < 1000
                  ? `${state.performance.distanceInDeniedZone.toFixed(0)} m`
                  : `${(state.performance.distanceInDeniedZone / 1000).toFixed(2)} km`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Val label="Drift" value={state.performance.driftMeters.toFixed(1)} unit="m" color="#22c55e" />
              <Val label="Drift %" value={state.performance.driftPercent.toFixed(1)} unit="%" color="#22c55e" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#22c55e]" />
            <span className="text-[11px] text-[var(--color-text-muted)]">No active outage</span>
          </div>
        )}
      </PanelCard>
    </div>
  );
};

/* ── System Timeline ───────────────────────────────────────────────────── */
const Timeline: React.FC<{ mode: string; gnss: NavigationState['gnss']; errorHistory: NavigationState['errorHistory'] }> = ({ mode, gnss, errorHistory }) => {
  const steps = [
    { label: 'GPS Available', icon: '✓', active: mode === 'gps_navigation', completed: mode !== 'idle' && mode !== 'gps_navigation' },
    { label: 'GPS Lost', icon: '⚠', active: mode === 'gnss_degrading' || mode === 'dead_reckoning', completed: mode === 'gps_restoring' || (mode === 'gps_navigation' && errorHistory.length > 20) },
    { label: 'AI-DR Activated', icon: '🧠', active: mode === 'dead_reckoning', completed: mode === 'gps_restoring' || (mode === 'gps_navigation' && errorHistory.length > 20) },
    { label: 'Nav Continued', icon: '🚗', active: mode === 'dead_reckoning', completed: mode === 'gps_restoring' || (mode === 'gps_navigation' && errorHistory.length > 20) },
    { label: 'GPS Restored', icon: '✓', active: mode === 'gps_restoring', completed: mode === 'gps_navigation' && errorHistory.length > 20 },
    { label: 'Pos Corrected', icon: '🎯', active: false, completed: mode === 'gps_navigation' && errorHistory.length > 20 && gnss.connected },
  ];

  return (
    <div className="glass-card px-3 py-2 flex items-center gap-0.5 overflow-x-auto">
      <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mr-1.5 shrink-0">Timeline</span>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const c = step.active ? '#38bdf8' : step.completed ? '#22c55e' : '#334155';
        const tc = step.active ? '#38bdf8' : step.completed ? '#22c55e' : '#64748b';
        return (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px]" style={{ background: step.active || step.completed ? c : 'rgba(51,65,85,0.5)', boxShadow: step.active ? `0 0 8px ${c}` : 'none', color: step.active || step.completed ? '#fff' : '#64748b' }}>
                {step.completed && !step.active ? '✓' : step.icon}
              </span>
              <span className="text-[8px] font-semibold whitespace-nowrap" style={{ color: tc }}>{step.label}</span>
            </div>
            {!isLast && <div className="w-3 h-[2px] rounded shrink-0 mx-0.5" style={{ background: step.completed ? '#22c55e' : step.active ? '#38bdf8' : '#1e293b' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT — returns composable pieces for App.tsx
   ══════════════════════════════════════════════════════════════════════ */
const Dashboard: React.FC<DashboardProps> = (props) => {
  const { state, onReset, onGPSLoss, onGPSRestore, onRunDemo } = props;
  const { gnss, mode, isRunning } = state;
  const isDR = mode === 'dead_reckoning';

  return {
    Header: (
      <header className="glass-card px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold tracking-wide gradient-text uppercase">TrackSync</h1>
            <p className="text-[9px] text-[var(--color-text-muted)] tracking-[0.15em] uppercase">Seamless Navigation During GPS Outages</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* IO-VNBD Data Source Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: '#a78bfa', boxShadow: '0 0 6px #a78bfa' }} />
            <span className="text-[9px] font-bold text-[#a78bfa] mono uppercase tracking-wider">IO-VNBD Dataset</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span className="text-[9px] font-bold text-[#22c55e] mono uppercase tracking-wider">System Online</span>
          </div>
        </div>
      </header>
    ),

    RightPanel: <RightPanel state={state} />,
    Timeline: <Timeline mode={mode} gnss={gnss} errorHistory={state.errorHistory} />,

    Buttons: (
      <div className="glass-card p-2 flex items-center gap-2 flex-wrap">
        {!isRunning && (mode === 'idle' || mode === 'destination_reached') && (
          <button onClick={onRunDemo} className="btn-demo flex items-center gap-2 text-[12px] px-4 py-2">
            <Play className="w-3.5 h-3.5" /> RUN DEMO
          </button>
        )}
        {isRunning && (
          <>
            <button onClick={onGPSLoss} disabled={!gnss.connected || isDR} className="btn-danger flex items-center gap-2 px-4 py-2 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed">
              <WifiOff className="w-3.5 h-3.5" /> SIMULATE GPS LOSS
            </button>
            <button onClick={onGPSRestore} disabled={gnss.connected || (!isDR && mode !== 'gnss_degrading')} className="btn-success flex items-center gap-2 px-4 py-2 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed">
              <Wifi className="w-3.5 h-3.5" /> RESTORE GPS
            </button>
          </>
        )}
        <button onClick={onReset} className="btn-secondary flex items-center gap-2 ml-auto text-[12px] px-3 py-2">
          <RotateCcw className="w-3.5 h-3.5" /> RESET
        </button>
      </div>
    ),
  };
};

export default Dashboard;
