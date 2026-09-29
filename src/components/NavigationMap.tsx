import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import type { NavigationState } from '../simulation/types';
import { DEMO_ROUTE, TUNNEL_BOUNDS } from '../simulation/demoRoute';

interface NavigationMapProps {
  state: NavigationState;
}

// ── Vehicle icon ──
const createVehicleIcon = (heading: number, isDR: boolean) => {
  const color = isDR ? '#38bdf8' : '#22c55e';
  const glow = isDR ? 'rgba(56,189,248,0.3)' : 'rgba(34,197,94,0.3)';
  return L.divIcon({
    html: `
      <div style="
        width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        position: relative;
      ">
        <div style="
          position: absolute; inset: -6px;
          border-radius: 50%;
          background: ${glow};
          animation: pulse-ring 2s ease-out infinite;
        "></div>
        <div style="
          width: 20px; height: 20px;
          background: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 12px ${color};
          transform: rotate(${heading}deg);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 0; height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-bottom: 8px solid white;
            margin-top: -2px;
          "></div>
        </div>
      </div>
    `,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const startIcon = L.divIcon({
  html: `<div style="
    width: 16px; height: 16px;
    background: #22c55e;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(34,197,94,0.5);
  "></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const destIcon = L.divIcon({
  html: `<div style="
    width: 16px; height: 16px;
    background: #ef4444;
    border: 2px solid white;
    border-radius: 4px;
    box-shadow: 0 0 10px rgba(239,68,68,0.5);
  "></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// ── Map center follower ──
const MapFollower: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      map.setView(position, 14);
      initialized.current = true;
    } else {
      map.panTo(position, { animate: true, duration: 0.3 });
    }
  }, [position, map]);

  return null;
};

const NavigationMap: React.FC<NavigationMapProps> = ({ state }) => {
  // Route line
  const routeCoords = DEMO_ROUTE.map(wp => [wp.lat, wp.lng] as [number, number]);

  // GPS trajectory
  const gpsCoords = state.gpsTrajectory.map(p => [p.lat, p.lng] as [number, number]);

  // DR trajectory
  const drCoords = state.drTrajectory.map(p => [p.lat, p.lng] as [number, number]);

  // Vehicle position
  const vehiclePos: [number, number] = [state.currentPosition.lat, state.currentPosition.lng];
  const isDR = state.mode === 'dead_reckoning' || state.mode === 'gnss_degrading';
  const heading = state.imu.heading;

  // Tunnel zone bounds
  const tunnelBounds: L.LatLngBoundsExpression = [
    [TUNNEL_BOUNDS.south, TUNNEL_BOUNDS.west],
    [TUNNEL_BOUNDS.north, TUNNEL_BOUNDS.east],
  ];

  const startPos: [number, number] = [DEMO_ROUTE[0].lat, DEMO_ROUTE[0].lng];
  const endPos: [number, number] = [
    DEMO_ROUTE[DEMO_ROUTE.length - 1].lat,
    DEMO_ROUTE[DEMO_ROUTE.length - 1].lng,
  ];

  return (
    <div className="glass-card overflow-hidden h-full" style={{ minHeight: '400px' }}>
      <MapContainer
        center={vehiclePos}
        zoom={14}
        className="w-full h-full"
        style={{ minHeight: '400px', borderRadius: '12px' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFollower position={vehiclePos} />

        {/* Tunnel zone overlay */}
        <Rectangle
          bounds={tunnelBounds}
          pathOptions={{
            color: '#eab308',
            weight: 1,
            fillColor: '#eab308',
            fillOpacity: 0.08,
            dashArray: '5, 5',
          }}
        />

        {/* Planned route */}
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: '#475569',
            weight: 3,
            opacity: 0.5,
            dashArray: '8, 4',
          }}
        />

        {/* GPS trajectory */}
        {gpsCoords.length > 1 && (
          <Polyline
            positions={gpsCoords}
            pathOptions={{
              color: '#22c55e',
              weight: 3,
              opacity: 0.9,
            }}
          />
        )}

        {/* DR trajectory */}
        {drCoords.length > 1 && (
          <Polyline
            positions={drCoords}
            pathOptions={{
              color: '#38bdf8',
              weight: 3,
              opacity: 0.9,
              dashArray: '6, 4',
            }}
          />
        )}

        {/* Start marker */}
        <Marker position={startPos} icon={startIcon}>
          <Popup>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>Start — CBS Nashik</span>
          </Popup>
        </Marker>

        {/* Destination marker */}
        <Marker position={endPos} icon={destIcon}>
          <Popup>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>Destination — Trimbakeshwar Road</span>
          </Popup>
        </Marker>

        {/* Vehicle marker */}
        <Marker
          position={vehiclePos}
          icon={createVehicleIcon(heading, isDR)}
        />
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 z-[1000] glass-card px-3 py-2 text-[11px] flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-[#22c55e] rounded" />
          <span className="text-[var(--color-text-secondary)]">GPS Track</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 rounded" style={{ background: '#38bdf8', borderTop: '1px dashed #38bdf8' }} />
          <span className="text-[var(--color-text-secondary)]">Dead Reckoning</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 rounded" style={{ background: '#eab308', opacity: 0.5, borderTop: '1px dashed #eab308' }} />
          <span className="text-[var(--color-text-secondary)]">Tunnel Zone</span>
        </div>
      </div>
    </div>
  );
};

export default NavigationMap;
