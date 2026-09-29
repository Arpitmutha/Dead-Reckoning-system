import React from 'react';
import type { IMUReading } from '../simulation/types';
import { Cpu, Gauge, Compass, Ruler, RotateCcw } from 'lucide-react';

interface IMUPanelProps {
  imu: IMUReading;
  isRunning: boolean;
}

const IMUPanel: React.FC<IMUPanelProps> = ({ imu, isRunning }) => {
  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
        <Cpu className="w-4 h-4 text-[var(--color-status-cyan)]" />
        IMU Sensor Data
        {isRunning && (
          <span className="ml-auto flex items-center gap-1">
            <span className="status-dot green" />
            <span className="text-[9px] text-[var(--color-status-green)]">LIVE</span>
          </span>
        )}
      </h3>

      {/* Accelerometer */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-cyan)]" />
          Accelerometer (m/s²)
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <SensorValue label="X" value={imu.accelerometer.x} />
          <SensorValue label="Y" value={imu.accelerometer.y} />
          <SensorValue label="Z" value={imu.accelerometer.z} />
        </div>
      </div>

      {/* Gyroscope */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-purple)]" />
          Gyroscope (rad/s)
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <SensorValue label="X" value={imu.gyroscope.x} />
          <SensorValue label="Y" value={imu.gyroscope.y} />
          <SensorValue label="Z" value={imu.gyroscope.z} />
        </div>
      </div>

      {/* Derived values */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[var(--color-border)]">
        <DerivedField icon={<Gauge className="w-3 h-3" />} label="Speed" value={`${(imu.speed * 3.6).toFixed(1)} km/h`} />
        <DerivedField icon={<Compass className="w-3 h-3" />} label="Heading" value={`${imu.heading.toFixed(1)}°`} />
        <DerivedField icon={<RotateCcw className="w-3 h-3" />} label="Acceleration" value={`${imu.acceleration.toFixed(2)} m/s²`} />
        <DerivedField icon={<Ruler className="w-3 h-3" />} label="Distance" value={`${imu.distanceTravelled.toFixed(0)} m`} />
      </div>
    </div>
  );
};

const SensorValue: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-[rgba(15,23,42,0.6)] rounded px-2 py-1.5 text-center border border-[var(--color-border)]">
    <span className="text-[9px] text-[var(--color-text-muted)] block">{label}</span>
    <span className="text-[12px] mono font-semibold text-[var(--color-text-primary)]">
      {value.toFixed(3)}
    </span>
  </div>
);

const DerivedField: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-[rgba(15,23,42,0.5)] rounded-lg p-2 border border-[var(--color-border)] flex items-center gap-2">
    <span className="text-[var(--color-status-cyan)]">{icon}</span>
    <div>
      <span className="text-[9px] text-[var(--color-text-muted)] block uppercase">{label}</span>
      <span className="text-[12px] mono font-semibold text-[var(--color-text-primary)]">{value}</span>
    </div>
  </div>
);

export default IMUPanel;
