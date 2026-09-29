import type { Waypoint } from './types';

// ─── Demo Route: CBS (Central Bus Stand) → Mumbai-Agra Highway Underpass → Trimbakeshwar Road, Nashik ─────────
// A realistic Nashik route that passes through an underpass/tunnel segment.

export const DEMO_ROUTE: Waypoint[] = [
  // ── Start: CBS Nashik (Central Bus Stand) ──
  { lat: 19.9975, lng: 73.7898, zone: 'normal', heading: 310, label: 'Start — CBS Nashik' },
  { lat: 19.9982, lng: 73.7885, zone: 'normal', heading: 312 },
  { lat: 19.9990, lng: 73.7870, zone: 'normal', heading: 315 },
  { lat: 19.9998, lng: 73.7855, zone: 'normal', heading: 318 },
  { lat: 20.0006, lng: 73.7840, zone: 'normal', heading: 320 },

  // ── Heading north-west along Gangapur Road ──
  { lat: 20.0015, lng: 73.7825, zone: 'normal', heading: 322 },
  { lat: 20.0024, lng: 73.7810, zone: 'normal', heading: 325 },
  { lat: 20.0033, lng: 73.7795, zone: 'normal', heading: 328 },
  { lat: 20.0042, lng: 73.7780, zone: 'normal', heading: 330 },
  { lat: 20.0050, lng: 73.7765, zone: 'normal', heading: 332 },

  // ── Approaching Mumbai-Agra Highway Underpass ──
  { lat: 20.0058, lng: 73.7750, zone: 'normal', heading: 330 },
  { lat: 20.0066, lng: 73.7735, zone: 'normal', heading: 328 },
  { lat: 20.0074, lng: 73.7720, zone: 'normal', heading: 325 },

  // ── Tunnel / Underpass Entry ──
  { lat: 20.0082, lng: 73.7705, zone: 'tunnel_entry', heading: 322, label: 'Underpass Entry' },
  { lat: 20.0088, lng: 73.7692, zone: 'tunnel_entry', heading: 320 },

  // ── Inside Underpass (15 waypoints for dramatic GPS-loss phase) ──
  { lat: 20.0094, lng: 73.7680, zone: 'tunnel', heading: 318 },
  { lat: 20.0100, lng: 73.7668, zone: 'tunnel', heading: 315 },
  { lat: 20.0106, lng: 73.7656, zone: 'tunnel', heading: 312 },
  { lat: 20.0112, lng: 73.7644, zone: 'tunnel', heading: 310 },
  { lat: 20.0118, lng: 73.7632, zone: 'tunnel', heading: 308 },
  { lat: 20.0124, lng: 73.7620, zone: 'tunnel', heading: 305 },
  { lat: 20.0130, lng: 73.7608, zone: 'tunnel', heading: 302 },
  { lat: 20.0136, lng: 73.7596, zone: 'tunnel', heading: 300 },
  { lat: 20.0142, lng: 73.7584, zone: 'tunnel', heading: 298 },
  { lat: 20.0148, lng: 73.7572, zone: 'tunnel', heading: 295 },
  { lat: 20.0153, lng: 73.7560, zone: 'tunnel', heading: 292 },
  { lat: 20.0158, lng: 73.7548, zone: 'tunnel', heading: 290 },
  { lat: 20.0163, lng: 73.7536, zone: 'tunnel', heading: 288 },
  { lat: 20.0168, lng: 73.7524, zone: 'tunnel', heading: 285 },
  { lat: 20.0173, lng: 73.7512, zone: 'tunnel', heading: 282 },

  // ── Underpass Exit ──
  { lat: 20.0178, lng: 73.7500, zone: 'tunnel_exit', heading: 280, label: 'Underpass Exit' },
  { lat: 20.0182, lng: 73.7488, zone: 'tunnel_exit', heading: 278 },

  // ── Post-underpass: heading toward Trimbakeshwar Road ──
  { lat: 20.0186, lng: 73.7476, zone: 'normal', heading: 275 },
  { lat: 20.0190, lng: 73.7464, zone: 'normal', heading: 272 },
  { lat: 20.0194, lng: 73.7452, zone: 'normal', heading: 270 },
  { lat: 20.0198, lng: 73.7440, zone: 'normal', heading: 268 },
  { lat: 20.0202, lng: 73.7428, zone: 'normal', heading: 265 },

  // ── Destination: Trimbakeshwar Road ──
  { lat: 20.0206, lng: 73.7416, zone: 'normal', heading: 262 },
  { lat: 20.0210, lng: 73.7404, zone: 'normal', heading: 260 },
  { lat: 20.0214, lng: 73.7392, zone: 'normal', heading: 258, label: 'Destination — Trimbakeshwar Road' },
];

// ── Tunnel/Underpass bounding box (for map overlay) ──
export const TUNNEL_BOUNDS = {
  north: 20.0180,
  south: 20.0080,
  east: 73.7710,
  west: 73.7485,
};

// ── Helper: total route distance in meters (approx) ──
export function getRouteDistance(): number {
  let total = 0;
  for (let i = 1; i < DEMO_ROUTE.length; i++) {
    total += haversineDistance(DEMO_ROUTE[i - 1], DEMO_ROUTE[i]);
  }
  return total;
}

// ── Haversine distance between two lat/lng points ──
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ── Interpolate between two waypoints ──
export function interpolatePosition(
  a: Waypoint,
  b: Waypoint,
  t: number // 0-1
): { lat: number; lng: number; heading: number } {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    heading: a.heading + (b.heading - a.heading) * t,
  };
}
