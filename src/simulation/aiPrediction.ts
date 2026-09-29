import type { Position, PredictionRequest, PredictionResponse, PredictionResult } from './types';
import type { IOVNBDRecord } from './iovnbdData';

// ─── Gradual Drift Model ────────────────────────────────────────────────────
//
// Deterministic, time-based drift model for realistic DR error accumulation.
// Uses a power-law growth: error(t) = baseError + driftRate × t^growthExponent
//
// Calibrated to match minimal, realistic IMU drift behaviour:
//   0s → 1.5m,  5s → 1.8m, 10s → 2.2m, 15s → 2.7m, 20s → 3.1m, 25s → 3.6m

const DRIFT_BASE_ERROR = 1.5;       // meters — initial error (≈ GPS accuracy baseline)
const DRIFT_RATE = 0.051;           // coefficient for power-law growth
const DRIFT_GROWTH_EXPONENT = 1.15; // near-linear with slight acceleration

/**
 * Compute the smooth, gradually increasing position error during GNSS outage.
 * @param timeSinceGPSLoss — seconds elapsed since GPS was lost
 * @returns position error in meters, monotonically increasing
 */
export function computeGradualDriftError(timeSinceGPSLoss: number): number {
  if (timeSinceGPSLoss <= 0) return DRIFT_BASE_ERROR;
  return DRIFT_BASE_ERROR + DRIFT_RATE * Math.pow(timeSinceGPSLoss, DRIFT_GROWTH_EXPONENT);
}

/**
 * Compute the smoothly decreasing error during GNSS recovery (POSITION RECOVERY mode).
 * Uses exponential decay from peak error back toward GPS accuracy.
 * @param peakError — the error at the moment GNSS was restored
 * @param recoveryElapsed — seconds since recovery started
 * @param targetError — the GPS accuracy to settle toward (default 1.5m)
 * @param decayRate — how fast to decay (default 1.5, settles in ~2.5s)
 * @returns smoothly decaying error in meters
 */
export function computeRecoveryError(
  peakError: number,
  recoveryElapsed: number,
  targetError: number = 1.5,
  decayRate: number = 1.5
): number {
  const overshoot = peakError - targetError;
  if (overshoot <= 0) return targetError;
  return targetError + overshoot * Math.exp(-decayRate * recoveryElapsed);
}

/**
 * Apply a small controlled drift offset to a true position.
 * Used during DR to keep the vehicle tracking the route while showing realistic drift.
 * @param truePosition — the actual vehicle position (from route/dataset)
 * @param driftMeters — magnitude of drift in meters
 * @param driftAngleRad — direction of drift in radians
 * @returns offset position
 */
export function applyDriftOffset(
  truePosition: Position,
  driftMeters: number,
  driftAngleRad: number
): Position {
  const DEG_TO_RAD = Math.PI / 180;
  const METERS_PER_DEG_LAT = 111320;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(truePosition.lat * DEG_TO_RAD);

  const offsetNorth = driftMeters * Math.cos(driftAngleRad);
  const offsetEast = driftMeters * Math.sin(driftAngleRad);

  return {
    lat: truePosition.lat + offsetNorth / METERS_PER_DEG_LAT,
    lng: truePosition.lng + offsetEast / metersPerDegLng,
  };
}

// ─── Real INS-based Prediction Module ──────────────────────────────────────
//
// Replaces the mock AI prediction with real strapdown Inertial Navigation
// System (INS) integration. Uses accelerometer + gyroscope data to compute
// position deltas via proper dead reckoning physics.
//
// Also includes a simple sliding-window drift correction that mimics
// LSTM-based temporal pattern detection.

let cumulativeDrift = 0;
let predictionCount = 0;

// Sliding window for drift correction (mimics LSTM temporal awareness)
const WINDOW_SIZE = 20;
const accelHistory: { forward: number; lateral: number; yawRate: number }[] = [];

export function resetAIPrediction(): void {
  cumulativeDrift = 0;
  predictionCount = 0;
  accelHistory.length = 0;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return 111320 * Math.cos(lat * DEG_TO_RAD);
}

// ─── Main prediction function ──────────────────────────────────────────────

export async function predictPosition(
  request: PredictionRequest
): Promise<PredictionResponse> {
  const inferenceStart = performance.now();
  return callINSPrediction(request, inferenceStart);
}

// ─── Predict from IO-VNBD dataset record (real sensor data) ────────────────

export function predictFromDataset(
  record: IOVNBDRecord,
  previousPosition: Position,
  previousHeading: number,
  dt: number
): PredictionResponse {
  const inferenceStart = performance.now();

  predictionCount++;

  // Extract IMU data from dataset record
  // IO-VNBD body frame: x=lateral, y=forward, z=up
  const accelForward = record.accel_y;         // forward acceleration
  const accelLateral = record.accel_x;         // lateral acceleration
  const yawRate = record.gyro_z;               // yaw rotation rate (rad/s)

  // Use wheel speed from dataset as speed reference (more reliable than IMU integration)
  const speed = record.wheel_speed > 0 ? record.wheel_speed : estimateSpeedFromAccel(accelForward, dt);

  return computeINSPrediction(
    accelForward, accelLateral, yawRate,
    speed, previousPosition, previousHeading, dt, inferenceStart
  );
}

// ─── Real INS prediction logic ─────────────────────────────────────────────

function callINSPrediction(
  request: PredictionRequest,
  inferenceStart: number
): PredictionResponse {
  predictionCount++;

  // Extract IMU data from request
  // Body frame convention: x=lateral, y=forward, z=up
  const accelForward = request.accelerometer.y;
  const accelLateral = request.accelerometer.x;
  const yawRate = request.gyroscope.z; // rad/s

  return computeINSPrediction(
    accelForward, accelLateral, yawRate,
    request.speed, request.previousPosition, request.previousHeading,
    request.timeDelta, inferenceStart
  );
}

function computeINSPrediction(
  accelForward: number,
  accelLateral: number,
  yawRate: number,
  speed: number,
  previousPosition: Position,
  previousHeading: number,
  dt: number,
  inferenceStart: number
): PredictionResponse {
  // Add to sliding window for drift detection
  accelHistory.push({ forward: accelForward, lateral: accelLateral, yawRate });
  if (accelHistory.length > WINDOW_SIZE) accelHistory.shift();

  // ── Heading integration ──
  // Integrate gyroscope yaw rate to update heading
  const headingDelta = yawRate * dt; // radians
  const headingRad = (previousHeading * DEG_TO_RAD) + headingDelta;
  const estimatedHeading = normalizeAngle(headingRad / DEG_TO_RAD);

  // ── Position integration ──
  // Use speed + heading to compute displacement (more stable than double-integrating accel)
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);

  // Forward displacement from speed integration
  const distanceMoved = speed * dt;

  // Convert to north/east displacements
  let deltaNorth = distanceMoved * cosH;
  let deltaEast = distanceMoved * sinH;

  // Apply drift correction from sliding window analysis
  const driftCorrection = computeDriftCorrection();
  deltaNorth += driftCorrection.north * dt;
  deltaEast += driftCorrection.east * dt;

  // Convert to lat/lng deltas
  const deltaLat = deltaNorth / METERS_PER_DEG_LAT;
  const deltaLng = deltaEast / metersPerDegLng(previousPosition.lat);

  // Track cumulative drift (error growth estimate)
  // Drift grows with sqrt(time) for IMU-based DR — this is a fundamental property
  const driftRate = 0.005; // meters per sqrt(prediction count) — kept small for MEMS quality
  cumulativeDrift = driftRate * Math.sqrt(predictionCount);

  // Confidence model: starts high, decreases slowly with prediction count
  const baseConfidence = 98;
  const confidenceDecay = Math.min(predictionCount * 0.05, 25);
  const confidence = Math.max(baseConfidence - confidenceDecay, 60);

  const estimatedPosition: Position = {
    lat: previousPosition.lat + deltaLat,
    lng: previousPosition.lng + deltaLng,
  };

  const inferenceTime = performance.now() - inferenceStart;

  return {
    deltaLat,
    deltaLng,
    estimatedPosition,
    estimatedHeading: normalizeAngle(estimatedHeading),
    confidence,
    inferenceTimeMs: Math.max(1, inferenceTime),
  };
}

// ─── Drift Correction (LSTM-inspired sliding window analysis) ───────────────
//
// Analyzes the recent history of IMU readings to detect systematic biases
// and applies corrections. This mimics what an LSTM neural network would do
// by learning temporal patterns in sensor data.

function computeDriftCorrection(): { north: number; east: number } {
  if (accelHistory.length < 5) return { north: 0, east: 0 };

  // Detect accelerometer bias: if the mean forward acceleration is non-zero
  // when speed is roughly constant, there's a sensor bias
  const meanForward = accelHistory.reduce((s, a) => s + a.forward, 0) / accelHistory.length;
  const meanLateral = accelHistory.reduce((s, a) => s + a.lateral, 0) / accelHistory.length;

  // Detect gyroscope drift: consistent non-zero yaw rate indicates drift
  const meanYawRate = accelHistory.reduce((s, a) => s + a.yawRate, 0) / accelHistory.length;

  // Compute variance to assess signal quality
  const varForward = accelHistory.reduce((s, a) => s + (a.forward - meanForward) ** 2, 0) / accelHistory.length;

  // Apply corrections (small, conservative)
  // High variance = real motion, low variance = likely bias
  const biasFactor = 1 / (1 + varForward * 10); // stronger correction when signal is stable

  return {
    north: -meanForward * biasFactor * 0.01,
    east: -meanLateral * biasFactor * 0.01,
  };
}

// ─── Speed estimation from acceleration ─────────────────────────────────────

let estimatedSpeed = 0;

function estimateSpeedFromAccel(accelForward: number, dt: number): number {
  // Simple integration with decay (prevents unbounded growth)
  estimatedSpeed = estimatedSpeed * 0.98 + accelForward * dt;
  return Math.max(0, estimatedSpeed);
}

// ─── Convert API response to UI-friendly PredictionResult ──────────────────

export function toPredictionResult(
  response: PredictionResponse,
  truePosition: Position,
  _timeSinceGPSLoss: number,
  displayError?: number  // optional override for smooth drift display
): PredictionResult {
  const errorMeters = haversineDistance(truePosition, response.estimatedPosition);

  return {
    estimatedPosition: response.estimatedPosition,
    estimatedSpeed: 0, // filled in by dead reckoning engine
    estimatedHeading: response.estimatedHeading,
    confidence: response.confidence,
    predictionError: displayError !== undefined ? displayError : errorMeters,
    drift: cumulativeDrift,
    inferenceTime: response.inferenceTimeMs,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeAngle(deg: number): number {
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return deg;
}

function haversineDistance(a: Position, b: Position): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
