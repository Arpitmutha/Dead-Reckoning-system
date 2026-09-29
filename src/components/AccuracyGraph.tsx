import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { ErrorDataPoint } from '../simulation/types';
import { TrendingUp } from 'lucide-react';

interface AccuracyGraphProps {
  errorHistory: ErrorDataPoint[];
}

const AccuracyGraph: React.FC<AccuracyGraphProps> = ({ errorHistory }) => {
  // Downsample for performance if too many points
  const data = errorHistory.length > 100
    ? errorHistory.filter((_, i) => i % 2 === 0)
    : errorHistory;

  return (
    <div className="space-y-4">
      {/* Position Error vs Time */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[var(--color-status-yellow)]" />
          Position Error vs Time
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5, style: { fontSize: 10, fill: '#64748b' } }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                label={{ value: 'Error (m)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#64748b' } }}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.95)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e2e8f0',
                }}
              />
              <Area
                type="monotone"
                dataKey="positionError"
                stroke="#eab308"
                strokeWidth={2}
                fill="url(#errorGradient)"
                name="Position Error"
                dot={false}
                animationDuration={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GPS vs AI-DR Position */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[var(--color-status-blue)]" />
          GPS vs AI-DR Position (Latitude)
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.08)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={{ stroke: '#334155' }}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v: number) => v.toFixed(4)}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.95)',
                  border: '1px solid rgba(56,189,248,0.2)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e2e8f0',
                }}
                formatter={((value: unknown) => Number(value).toFixed(6)) as never}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey="gpsLat"
                stroke="#22c55e"
                strokeWidth={2}
                name="GPS/Actual"
                dot={false}
                animationDuration={0}
              />
              <Line
                type="monotone"
                dataKey="drLat"
                stroke="#38bdf8"
                strokeWidth={2}
                name="AI-DR Estimated"
                dot={false}
                strokeDasharray="5 3"
                animationDuration={0}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AccuracyGraph;
