import React from 'react';
import type { GNSSState, NavigationMode } from '../simulation/types';
import { Satellite, Signal, MapPin, Clock, AlertTriangle } from 'lucide-react';

interface GNSSStatusProps {
  gnss: GNSSState;
  mode: NavigationMode;
}

const GNSSStatus: React.FC<GNSSStatusProps> = ({ gnss, mode }) => {
  const isConnected = gnss.connected;
  const isDegrading = mode === 'gnss_degrading';

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
          <Satellite className="w-4 h-4" />
          GNSS Status
        </h3>
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold mono ${
            isConnected
              ? 'bg-[rgba(34,197,94,0.15)] text-[var(--color-status-green)]'
              : isDegrading
                ? 'bg-[rgba(234,179,8,0.15)] text-[var(--color-status-yellow)]'
                : 'bg-[rgba(239,68,68,0.15)] text-[var(--color-status-red)]'
          }`}
        >
          <span className={`status-dot ${isConnected ? 'green' : isDegrading ? 'yellow' : 'red'}`} />
          {isConnected ? 'CONNECTED' : isDegrading ? 'DEGRADING' : 'SIGNAL LOST'}
        </div>
      </div>

      {isConnected ? (
        <div className="grid grid-cols-2 gap-2">
          <DataField icon={<Signal className="w-3 h-3" />} label="GPS Accuracy" value={`${gnss.accuracy.toFixed(1)} m`} color="green" />
          <DataField icon={<Satellite className="w-3 h-3" />} label="Satellites" value={`${gnss.satellites}`} color="green" />
          <DataField icon={<Signal className="w-3 h-3" />} label="Signal Strength" value={`${gnss.signalStrength.toFixed(0)}%`} color="green" />
          <DataField icon={<MapPin className="w-3 h-3" />} label="Latitude" value={gnss.position?.lat.toFixed(6) || '—'} color="green" />
          <DataField icon={<MapPin className="w-3 h-3" />} label="Longitude" value={gnss.position?.lng.toFixed(6) || '—'} color="green" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <DataField icon={<Satellite className="w-3 h-3" />} label="Satellites" value={`${gnss.satellites}`} color="red" />
            <DataField icon={<Signal className="w-3 h-3" />} label="Signal Strength" value={`${gnss.signalStrength.toFixed(0)}%`} color="red" />
            <DataField icon={<MapPin className="w-3 h-3" />} label="Last GPS Lat" value={gnss.lastGPSPosition?.lat.toFixed(6) || '—'} color="yellow" />
            <DataField icon={<MapPin className="w-3 h-3" />} label="Last GPS Lng" value={gnss.lastGPSPosition?.lng.toFixed(6) || '—'} color="yellow" />
            <DataField icon={<Clock className="w-3 h-3" />} label="Time Since Loss" value={`${gnss.timeSinceGPSLoss.toFixed(1)}s`} color="red" />
          </div>

          {/* Warning banner */}
          <div className="flex items-start gap-2 bg-[rgba(234,179,8,0.08)] border border-[rgba(234,179,8,0.2)] rounded-lg p-2.5 mt-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-status-yellow)] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--color-status-yellow)]">
              GNSS unavailable. Switching to AI-ML Dead Reckoning.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

interface DataFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

const DataField: React.FC<DataFieldProps> = ({ icon, label, value, color }) => {
  const colorMap: Record<string, string> = {
    green: 'var(--color-status-green)',
    yellow: 'var(--color-status-yellow)',
    red: 'var(--color-status-red)',
    blue: 'var(--color-status-blue)',
    cyan: 'var(--color-status-cyan)',
  };

  return (
    <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)]">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[var(--color-text-muted)]">{icon}</span>
        <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-[13px] font-semibold mono" style={{ color: colorMap[color] || colorMap.green }}>
        {value}
      </span>
    </div>
  );
};

export default GNSSStatus;
