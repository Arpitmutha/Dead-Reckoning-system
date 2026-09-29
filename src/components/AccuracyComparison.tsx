import React from 'react';
import { BarChart3, CheckCircle, XCircle, AlertTriangle, Database } from 'lucide-react';

const AccuracyComparison: React.FC = () => {
  const metrics = [
    {
      label: 'Position Accuracy',
      gps: '4–10 m',
      aidr: '3–15 m',
      gpsGood: true,
      aidrGood: true,
    },
    {
      label: 'Availability (Tunnel/Underpass)',
      gps: '0%',
      aidr: '>90%',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'GPS Dependency',
      gps: '100%',
      aidr: '0% (during DR)',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Drift per 50m GNSS-denied',
      gps: 'N/A (no nav)',
      aidr: '<5 m',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Drift per 1km at 60km/h',
      gps: 'N/A (no nav)',
      aidr: '<100 m',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Drift % of Distance',
      gps: 'N/A',
      aidr: '<10%',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Position Update Rate',
      gps: '1 Hz',
      aidr: '10Hz / 200Hz',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'GPS↔DR Transition',
      gps: 'Freeze/Jump',
      aidr: '<50 ms Seamless',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Map-Matching (NHC)',
      gps: 'None',
      aidr: 'HMM + OSM',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Vibration Filtering',
      gps: 'None',
      aidr: 'AI + Kalman',
      gpsGood: false,
      aidrGood: true,
    },
    {
      label: 'Navigation Continuity',
      gps: 'Interrupted',
      aidr: 'Seamless',
      gpsGood: false,
      aidrGood: true,
    },
  ];

  return (
    <div className="glass-card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-[var(--color-status-cyan)]" />
        Navigation Performance: GPS vs AI-IDR System
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left py-2 px-2 text-[var(--color-text-muted)] font-medium uppercase tracking-wider text-[10px]">
                Metric
              </th>
              <th className="text-center py-2 px-2 text-[var(--color-status-green)] font-semibold">
                GPS Only
              </th>
              <th className="text-center py-2 px-2 text-[var(--color-status-blue)] font-semibold">
                AI-IDR (Our Solution)
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, i) => (
              <tr
                key={m.label}
                className={`border-b border-[var(--color-border)] ${
                  i % 2 === 0 ? 'bg-[rgba(15,23,42,0.3)]' : ''
                }`}
              >
                <td className="py-2 px-2 text-[var(--color-text-primary)] font-medium">
                  {m.label}
                </td>
                <td className="py-2 px-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 mono">
                    {m.gpsGood ? (
                      <CheckCircle className="w-3 h-3 text-[var(--color-status-green)]" />
                    ) : (
                      <XCircle className="w-3 h-3 text-[var(--color-status-red)]" />
                    )}
                    <span className={m.gpsGood ? 'text-[var(--color-status-green)]' : 'text-[var(--color-status-red)]'}>
                      {m.gps}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 mono">
                    {m.aidrGood ? (
                      <CheckCircle className="w-3 h-3 text-[var(--color-status-green)]" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-[var(--color-status-yellow)]" />
                    )}
                    <span className={m.aidrGood ? 'text-[var(--color-status-blue)]' : 'text-[var(--color-status-yellow)]'}>
                      {m.aidr}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          Training Dataset: IO-VNBD (Inertial & Odometry Benchmark)
        </div>
        <span>SIH Performance Benchmarks</span>
      </div>
    </div>
  );
};

export default AccuracyComparison;
