import React, { useEffect, useState } from 'react';
import type { NavigationMode } from '../simulation/types';
import { AlertTriangle, CheckCircle, Brain, Wifi } from 'lucide-react';

interface AlertBannerProps {
  mode: NavigationMode;
  previousMode: NavigationMode;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ mode, previousMode }) => {
  const [visible, setVisible] = useState(false);
  const [bannerType, setBannerType] = useState<'warning' | 'success' | null>(null);

  useEffect(() => {
    if (mode === 'dead_reckoning' && previousMode !== 'dead_reckoning') {
      setBannerType('warning');
      setVisible(true);
    } else if (mode === 'gps_restoring' && previousMode === 'dead_reckoning') {
      setBannerType('success');
      setVisible(true);
      // Auto-dismiss success after 5 seconds
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [mode, previousMode]);

  if (!visible || !bannerType) return null;

  if (bannerType === 'warning') {
    return (
      <div className="alert-banner alert-banner-warning rounded-xl p-4 flex items-center gap-4">
        <div className="bg-[rgba(234,179,8,0.2)] rounded-lg p-2.5">
          <AlertTriangle className="w-6 h-6 text-[var(--color-status-yellow)]" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-bold text-[var(--color-status-yellow)] flex items-center gap-2">
            ⚠️ GNSS SIGNAL LOST
          </div>
          <div className="text-[12px] font-semibold text-[var(--color-status-blue)] flex items-center gap-1.5 mt-0.5">
            <Brain className="w-3.5 h-3.5" />
            AI-ML Dead Reckoning Activated
          </div>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            Navigation continues using IMU sensors and AI-based position estimation.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg px-2"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="alert-banner alert-banner-success rounded-xl p-4 flex items-center gap-4">
      <div className="bg-[rgba(34,197,94,0.2)] rounded-lg p-2.5">
        <CheckCircle className="w-6 h-6 text-[var(--color-status-green)]" />
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-bold text-[var(--color-status-green)] flex items-center gap-2">
          ✅ GNSS SIGNAL RESTORED
        </div>
        <div className="text-[12px] font-semibold text-[var(--color-status-cyan)] flex items-center gap-1.5 mt-0.5">
          <Wifi className="w-3.5 h-3.5" />
          Position Recalibration Completed
        </div>
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
          GPS position locked. Navigation resumed with corrected position.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg px-2"
      >
        ×
      </button>
    </div>
  );
};

export default AlertBanner;
