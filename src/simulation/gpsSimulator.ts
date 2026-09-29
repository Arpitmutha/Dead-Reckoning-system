import type { GNSSState, Position, ZoneType } from './types';
import type { IOVNBDRecord } from './iovnbdData';

// ─── Gaussian noise helper ──────────────────────────────────────────────────

function gaussianNoise(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Initial GNSS State ────────────────────────────────────────────────────

export function createInitialGNSS(): GNSSState {
  return {
    connected: false,
    accuracy: 0,
    satellites: 0,
    signalStrength: 0,
    position: null,
    lastGPSPosition: null,
    timeSinceGPSLoss: 0,
  };
}

// ─── Update GNSS based on zone and manual overrides ─────────────────────────

export function updateGNSS(
  current: GNSSState,
  truePosition: Position,
  zone: ZoneType,
  dt: number,
  forceGPSLoss: boolean,
  forceGPSRestore: boolean
): GNSSState {
  const next = { ...current };

  // Determine target signal based on zone
  let targetSignal = 95;
  let targetSatellites = 18;
  let targetAccuracy = 3.5;

  if (forceGPSLoss || zone === 'tunnel') {
    targetSignal = 0;
    targetSatellites = 0;
    targetAccuracy = 999;
  } else if (zone === 'tunnel_entry') {
    targetSignal = 25;
    targetSatellites = 4;
    targetAccuracy = 25;
  } else if (zone === 'tunnel_exit') {
    targetSignal = 60;
    targetSatellites = 10;
    targetAccuracy = 12;
  }

  if (forceGPSRestore && zone !== 'tunnel') {
    targetSignal = 92;
    targetSatellites = 18;
    targetAccuracy = 4.2;
  }

  // Smooth interpolation toward target
  const lerpRate = 0.15;
  next.signalStrength = lerp(current.signalStrength, targetSignal, lerpRate);
  next.satellites = Math.round(lerp(current.satellites, targetSatellites, lerpRate));
  next.accuracy = lerp(current.accuracy, targetAccuracy, lerpRate);

  // Add noise to accuracy
  next.accuracy = Math.max(1, next.accuracy + gaussianNoise(0, 0.3));

  // Determine connected state
  const wasConnected = current.connected;
  next.connected = next.signalStrength > 15 && next.satellites >= 3;

  if (next.connected) {
    // Add GPS noise to true position
    const noiseFactor = next.accuracy / 111320; // meters to degrees (approx)
    next.position = {
      lat: truePosition.lat + gaussianNoise(0, noiseFactor * 0.3),
      lng: truePosition.lng + gaussianNoise(0, noiseFactor * 0.3),
    };
    next.lastGPSPosition = { ...next.position };
    next.timeSinceGPSLoss = 0;
  } else {
    next.position = null;
    next.timeSinceGPSLoss = wasConnected ? dt : current.timeSinceGPSLoss + dt;
  }

  // Clamp
  next.signalStrength = clamp(next.signalStrength, 0, 100);
  next.satellites = clamp(next.satellites, 0, 24);
  next.accuracy = clamp(next.accuracy, 1, 999);

  return next;
}

// ─── Update GNSS from IO-VNBD dataset record ───────────────────────────────

export function updateGNSSFromDataset(
  current: GNSSState,
  record: IOVNBDRecord,
  dt: number
): GNSSState {
  const next = { ...current };
  const hasGPS = !isNaN(record.gps_lat) && !isNaN(record.gps_lng);

  if (hasGPS) {
    next.connected = true;
    next.position = {
      lat: record.gps_lat,
      lng: record.gps_lng,
    };
    next.lastGPSPosition = { ...next.position };
    next.accuracy = !isNaN(record.gps_accuracy) ? record.gps_accuracy : 5;
    next.satellites = record.gps_satellites > 0 ? record.gps_satellites : 12;
    next.signalStrength = Math.min(100, next.satellites * 5.5);
    next.timeSinceGPSLoss = 0;
  } else {
    next.connected = false;
    next.position = null;
    next.accuracy = 999;
    next.satellites = record.gps_satellites || 0;
    next.signalStrength = Math.max(0, next.satellites * 3);
    next.timeSinceGPSLoss = current.connected ? dt : current.timeSinceGPSLoss + dt;
  }

  return next;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
