import React, { useRef, useEffect } from 'react';
import type { SystemEvent } from '../simulation/types';
import { Clock, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface EventTimelineProps {
  events: SystemEvent[];
}

const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const getIcon = (severity: SystemEvent['severity']) => {
    switch (severity) {
      case 'info':
        return <Info className="w-3 h-3 text-[var(--color-status-blue)]" />;
      case 'warning':
        return <AlertTriangle className="w-3 h-3 text-[var(--color-status-yellow)]" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-[var(--color-status-green)]" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-[var(--color-status-red)]" />;
    }
  };

  const getColor = (severity: SystemEvent['severity']) => {
    switch (severity) {
      case 'info': return 'var(--color-status-blue)';
      case 'warning': return 'var(--color-status-yellow)';
      case 'success': return 'var(--color-status-green)';
      case 'error': return 'var(--color-status-red)';
    }
  };

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-[var(--color-status-blue)]" />
        System Events
      </h3>

      <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {events.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] text-[11px] py-4">
            No events yet. Start navigation to see system events.
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgba(15,23,42,0.5)] transition-colors animate-slideUp"
            >
              <div className="mt-0.5 flex-shrink-0">{getIcon(event.severity)}</div>
              <div className="flex-1 min-w-0">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: getColor(event.severity) }}
                >
                  {event.message}
                </span>
              </div>
              <span className="text-[9px] mono text-[var(--color-text-muted)] flex-shrink-0">
                {event.timestamp.toLocaleTimeString('en-US', {
                  hour12: false,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventTimeline;
