import React from 'react';
import type { MapMatchingState, NavigationMode } from '../simulation/types';
import { Map, Route, ShieldCheck, Layers, Navigation, Database, GitFork } from 'lucide-react';

interface MapMatchingPanelProps {
  mapMatching: MapMatchingState;
  mode: NavigationMode;
}

const MapMatchingPanel: React.FC<MapMatchingPanelProps> = ({ mapMatching, mode }) => {
  const {
    isActive,
    snapCorrectionMeters,
    hmmConfidence,
    matchedRoadName,
    nhcLateralConstrained,
    nhcVerticalConstrained,
    roadHeadingConstraint,
    osmDataLoaded,
    candidateRoads,
  } = mapMatching;

  const isDR = mode === 'dead_reckoning';

  return (
    <div className={`glass-card p-4 space-y-3 ${isDR ? 'animate-glow' : ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Map className="w-4 h-4 text-[var(--color-status-green)]" />
          Map-Matching + NHC
        </h3>
        <div
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold mono ${
            isActive
              ? 'bg-[rgba(56,189,248,0.12)] text-[var(--color-status-blue)] text-glow-blue'
              : 'bg-[rgba(34,197,94,0.1)] text-[var(--color-status-green)]'
          }`}
        >
          {isActive ? '🗺️ CONSTRAINING' : 'PASSIVE'}
        </div>
      </div>

      {/* Matched Road */}
      <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2.5 border border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-[var(--color-status-green)]" />
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Matched Road</div>
            <div className="text-[13px] font-semibold text-[var(--color-text-primary)]">{matchedRoadName}</div>
          </div>
          <div className="ml-auto text-[10px] mono text-[var(--color-text-muted)]">
            {candidateRoads} candidates
          </div>
        </div>
      </div>

      {/* NHC Constraints */}
      <div className="space-y-1.5">
        <span className="text-[9px] text-[var(--color-text-muted)] uppercase flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Non-Holonomic Constraints (NHC)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <NHCBadge
            label="No Lateral Slide"
            sublabel="Vehicle cannot slide sideways"
            active={nhcLateralConstrained}
          />
          <NHCBadge
            label="No Vertical Flight"
            sublabel="Vehicle stays on road plane"
            active={nhcVerticalConstrained}
          />
        </div>
      </div>

      {/* Map-Matching Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <MatchMetric
          icon={<GitFork className="w-3.5 h-3.5" />}
          label="Snap Correction"
          value={`${snapCorrectionMeters.toFixed(2)} m`}
          color={snapCorrectionMeters < 2 ? 'var(--color-status-green)' : snapCorrectionMeters < 5 ? 'var(--color-status-yellow)' : 'var(--color-status-red)'}
        />
        <MatchMetric
          icon={<Layers className="w-3.5 h-3.5" />}
          label="HMM Confidence"
          value={`${hmmConfidence.toFixed(0)}%`}
          color={hmmConfidence > 85 ? 'var(--color-status-green)' : hmmConfidence > 70 ? 'var(--color-status-yellow)' : 'var(--color-status-red)'}
        />
        <MatchMetric
          icon={<Navigation className="w-3.5 h-3.5" />}
          label="Road Heading"
          value={`${roadHeadingConstraint.toFixed(0)}°`}
          color="var(--color-status-cyan)"
        />
      </div>

      {/* OSM Data Status */}
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[var(--color-border)]">
        <span className="text-[var(--color-text-muted)] flex items-center gap-1">
          <Database className="w-3 h-3" />
          Offline OSM Data
        </span>
        <span className={`mono font-semibold ${osmDataLoaded ? 'text-[var(--color-status-green)]' : 'text-[var(--color-status-red)]'}`}>
          {osmDataLoaded ? '✅ Loaded (Nashik Region)' : '❌ Not Available'}
        </span>
      </div>

      <div className="text-[9px] text-[var(--color-text-muted)] text-center">
        UKF + Hidden Markov Model Map-Matching • OpenStreetMap
      </div>
    </div>
  );
};

const NHCBadge: React.FC<{
  label: string;
  sublabel: string;
  active: boolean;
}> = ({ label, sublabel, active }) => (
  <div
    className="rounded-lg p-2 border text-center"
    style={{
      borderColor: active ? 'rgba(34,197,94,0.3)' : 'var(--color-border)',
      background: active ? 'rgba(34,197,94,0.06)' : 'rgba(15,23,42,0.5)',
    }}
  >
    <div className="text-[11px] font-semibold" style={{ color: active ? 'var(--color-status-green)' : 'var(--color-text-muted)' }}>
      {active ? '✓' : '○'} {label}
    </div>
    <div className="text-[8px] text-[var(--color-text-muted)]">{sublabel}</div>
  </div>
);

const MatchMetric: React.FC<{
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

export default MapMatchingPanel;
