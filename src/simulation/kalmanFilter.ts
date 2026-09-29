// ─── Extended Kalman Filter for GNSS/INS Fusion ─────────────────────────────
//
// A real EKF implementation for vehicle navigation.
// State vector: [lat, lng, vel_north, vel_east, heading]
// Prediction: strapdown INS integration from accelerometer + gyroscope
// Update: GPS position/velocity measurements when available
//
// This replaces the simulated fusion weights with actual Kalman mathematics.

import type { Position } from './types';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return 111320 * Math.cos(lat * DEG_TO_RAD);
}

// ─── Matrix helpers (5x5 for our state) ─────────────────────────────────────
// Using flat arrays for performance in a browser environment

type Vec5 = [number, number, number, number, number];
type Mat5 = [Vec5, Vec5, Vec5, Vec5, Vec5];

function mat5Identity(): Mat5 {
  return [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
  ];
}

function mat5Zero(): Mat5 {
  return [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ];
}

function mat5Add(A: Mat5, B: Mat5): Mat5 {
  const R = mat5Zero();
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      R[i][j] = A[i][j] + B[i][j];
  return R;
}

function mat5Mul(A: Mat5, B: Mat5): Mat5 {
  const R = mat5Zero();
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      for (let k = 0; k < 5; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
}

function mat5Transpose(A: Mat5): Mat5 {
  const R = mat5Zero();
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      R[i][j] = A[j][i];
  return R;
}

function mat5Scale(A: Mat5, s: number): Mat5 {
  const R = mat5Zero();
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      R[i][j] = A[i][j] * s;
  return R;
}

// Simplified 5x5 matrix inverse using Gauss-Jordan elimination
function mat5Inverse(M: Mat5): Mat5 {
  // Create augmented matrix [M | I]
  const aug: number[][] = [];
  for (let i = 0; i < 5; i++) {
    aug.push([...M[i], ...(i === 0 ? [1,0,0,0,0] : i === 1 ? [0,1,0,0,0] : i === 2 ? [0,0,1,0,0] : i === 3 ? [0,0,0,1,0] : [0,0,0,0,1])]);
  }

  for (let col = 0; col < 5; col++) {
    // Find pivot
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < 5; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    // Swap rows
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }
    // Scale pivot row
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) {
      // Singular-ish matrix; return identity as fallback
      return mat5Identity();
    }
    for (let j = 0; j < 10; j++) {
      aug[col][j] /= pivot;
    }
    // Eliminate
    for (let row = 0; row < 5; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 10; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse
  const inv = mat5Zero();
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 5; j++)
      inv[i][j] = aug[i][j + 5];
  return inv;
}

// ─── EKF State ──────────────────────────────────────────────────────────────

export interface EKFState {
  // State vector x = [lat, lng, vel_north, vel_east, heading_rad]
  x: Vec5;
  // Covariance matrix P (5x5)
  P: Mat5;
  // Innovation from last update
  innovation: Vec5;
  // Kalman gains (diagonal summary)
  kalmanGains: Vec5;
  // Is GPS being used in the update?
  gpsActive: boolean;
  // Confidence derived from trace(P)
  confidence: number;
}

// ─── Process Noise Q ────────────────────────────────────────────────────────

function getProcessNoise(dt: number): Mat5 {
  // Process noise — kept tight to prevent excessive drift during prediction-only
  // Position noise: very small (integrated from velocity error)
  // Velocity noise: small (MEMS accelerometer noise ~0.02 m/s² RMS)
  // Heading noise: small (MEMS gyroscope drift ~0.01 rad/s RMS)
  const posNoise = 1e-14 * dt;
  const velNoise = 0.02 * dt;   // tight velocity uncertainty
  const hdgNoise = 0.002 * dt;  // tight heading uncertainty

  const Q = mat5Zero();
  Q[0][0] = posNoise;
  Q[1][1] = posNoise;
  Q[2][2] = velNoise;
  Q[3][3] = velNoise;
  Q[4][4] = hdgNoise;
  return Q;
}

// ─── Measurement Noise R ────────────────────────────────────────────────────

function getMeasurementNoise(gpsAccuracy: number, satellites: number): Mat5 {
  // GPS noise depends on reported accuracy and satellite count
  const posNoiseMeters = Math.max(2, gpsAccuracy);
  const posNoiseDeg = posNoiseMeters / METERS_PER_DEG_LAT;
  const velNoise = Math.max(0.5, gpsAccuracy * 0.3);

  // Fewer satellites → more noise
  const satFactor = Math.max(1, 20 / Math.max(satellites, 1));

  const R = mat5Zero();
  R[0][0] = (posNoiseDeg * satFactor) ** 2;
  R[1][1] = (posNoiseDeg * satFactor) ** 2;
  R[2][2] = (velNoise * satFactor) ** 2;
  R[3][3] = (velNoise * satFactor) ** 2;
  R[4][4] = (5 * DEG_TO_RAD * satFactor) ** 2; // heading noise from GPS bearing
  return R;
}

// ─── EKF Class ──────────────────────────────────────────────────────────────

export class ExtendedKalmanFilter {
  private state: EKFState;

  constructor(initialPosition: Position, initialHeading: number = 0) {
    const headingRad = initialHeading * DEG_TO_RAD;

    this.state = {
      x: [initialPosition.lat, initialPosition.lng, 0, 0, headingRad],
      P: [
        [1e-8, 0, 0, 0, 0],     // initial position uncertainty: small
        [0, 1e-8, 0, 0, 0],
        [0, 0, 1, 0, 0],         // initial velocity uncertainty: 1 m/s
        [0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0.1],       // initial heading uncertainty: ~18°
      ],
      innovation: [0, 0, 0, 0, 0],
      kalmanGains: [0, 0, 0, 0, 0],
      gpsActive: false,
      confidence: 95,
    };
  }

  // ── Prediction Step ─────────────────────────────────────────────────────
  // Uses IMU data to predict the next state.
  // IMPORTANT: accelForward/accelLateral should be *dynamic* acceleration only
  // (gravity removed). This method also removes residual gravity bias.
  predict(
    accelForward: number,  // forward acceleration in m/s² (body frame Y)
    accelLateral: number,  // lateral acceleration in m/s² (body frame X)
    yawRate: number,       // rad/s from gyroscope z-axis
    dt: number             // time step in seconds
  ): void {
    const [lat, lng, vN, vE, heading] = this.state.x;

    // Remove gravity bias from forward accel.
    // In a dashboard-mounted phone, accel_y (forward) includes a gravity
    // component from tilt (~-1.5 to +1.5 m/s²). We treat small values as noise.
    // Only significant dynamic acceleration (braking/accelerating) should move
    // the velocity estimate.
    const ACCEL_DEADBAND = 1.0; // m/s² — ignore below this threshold
    const cleanForward = Math.abs(accelForward) > ACCEL_DEADBAND
      ? accelForward * 0.3 // scale down to prevent overshoot
      : 0;
    const cleanLateral = Math.abs(accelLateral) > ACCEL_DEADBAND
      ? accelLateral * 0.2
      : 0;

    // Rotate body-frame accelerations to navigation frame
    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const aN = cleanForward * cosH - cleanLateral * sinH;
    const aE = cleanForward * sinH + cleanLateral * cosH;

    // Integrate: velocity += acceleration * dt
    // Apply velocity damping to prevent unbounded growth from integration errors
    const VELOCITY_DAMPING = 0.995; // slight drag per step
    const newVN = (vN + aN * dt) * VELOCITY_DAMPING;
    const newVE = (vE + aE * dt) * VELOCITY_DAMPING;

    // Clamp velocity to reasonable vehicle range (0–40 m/s = 0–144 km/h)
    const MAX_SPEED = 40;
    const speed = Math.sqrt(newVN * newVN + newVE * newVE);
    const clampedVN = speed > MAX_SPEED ? newVN * (MAX_SPEED / speed) : newVN;
    const clampedVE = speed > MAX_SPEED ? newVE * (MAX_SPEED / speed) : newVE;

    // Integrate: position += velocity * dt (convert m/s to degrees)
    const newLat = lat + (clampedVN * dt) / METERS_PER_DEG_LAT;
    const newLng = lng + (clampedVE * dt) / metersPerDegLng(lat);

    // Integrate heading
    let newHeading = heading + yawRate * dt;
    while (newHeading > Math.PI) newHeading -= 2 * Math.PI;
    while (newHeading < -Math.PI) newHeading += 2 * Math.PI;

    // Update state
    this.state.x = [newLat, newLng, clampedVN, clampedVE, newHeading];

    // Jacobian of the state transition (linearized)
    const F = mat5Identity();
    F[0][2] = dt / METERS_PER_DEG_LAT;
    F[1][3] = dt / metersPerDegLng(lat);
    F[2][4] = (-cleanForward * sinH - cleanLateral * cosH) * dt;
    F[3][4] = (cleanForward * cosH - cleanLateral * sinH) * dt;

    // P = F * P * F^T + Q
    const Q = getProcessNoise(dt);
    const FP = mat5Mul(F, this.state.P);
    const FPFt = mat5Mul(FP, mat5Transpose(F));
    this.state.P = mat5Add(FPFt, Q);

    this.updateConfidence();
    this.state.gpsActive = false;
  }

  // ── Update Step ─────────────────────────────────────────────────────────
  // Incorporates GPS measurement to correct the predicted state
  update(
    gpsLat: number,
    gpsLng: number,
    gpsSpeed: number,
    gpsBearing: number,
    gpsAccuracy: number,
    gpsSatellites: number
  ): void {
    // Measurement vector z = [lat, lng, vN, vE, heading]
    const bearingRad = gpsBearing * DEG_TO_RAD;
    const z: Vec5 = [
      gpsLat,
      gpsLng,
      gpsSpeed * Math.cos(bearingRad),
      gpsSpeed * Math.sin(bearingRad),
      bearingRad,
    ];

    // Measurement matrix H = Identity (we observe all states directly from GPS)
    const H = mat5Identity();

    // Innovation y = z - H*x
    const y: Vec5 = [
      z[0] - this.state.x[0],
      z[1] - this.state.x[1],
      z[2] - this.state.x[2],
      z[3] - this.state.x[3],
      normalizeAngleRad(z[4] - this.state.x[4]),
    ];
    this.state.innovation = y;

    // Innovation covariance S = H*P*H^T + R
    const R = getMeasurementNoise(gpsAccuracy, gpsSatellites);
    const HP = mat5Mul(H, this.state.P);
    const HPHt = mat5Mul(HP, mat5Transpose(H));
    const S = mat5Add(HPHt, R);

    // Kalman gain K = P * H^T * S^{-1}
    const Sinv = mat5Inverse(S);
    const PHt = mat5Mul(this.state.P, mat5Transpose(H));
    const K = mat5Mul(PHt, Sinv);

    // Store diagonal Kalman gains for display
    this.state.kalmanGains = [K[0][0], K[1][1], K[2][2], K[3][3], K[4][4]];

    // Update state: x = x + K * y
    for (let i = 0; i < 5; i++) {
      let correction = 0;
      for (let j = 0; j < 5; j++) {
        correction += K[i][j] * y[j];
      }
      this.state.x[i] += correction;
    }

    // Normalize heading
    this.state.x[4] = normalizeAngleRad(this.state.x[4]);

    // Update covariance: P = (I - K*H) * P
    const KH = mat5Mul(K, H);
    const IminusKH = mat5Add(mat5Identity(), mat5Scale(KH, -1));
    this.state.P = mat5Mul(IminusKH, this.state.P);

    this.state.gpsActive = true;
    this.updateConfidence();
  }

  // ── Speed Constraint ────────────────────────────────────────────────────
  // Overrides EKF velocity magnitude with a more reliable wheel speed measurement
  // while preserving the velocity direction from IMU heading integration.
  constrainSpeed(wheelSpeed: number): void {
    const vN = this.state.x[2];
    const vE = this.state.x[3];
    const currentSpeed = Math.sqrt(vN * vN + vE * vE);

    if (currentSpeed > 0.01) {
      // Scale velocity components to match wheel speed, preserving direction
      const scale = wheelSpeed / currentSpeed;
      // Blend: 70% wheel speed, 30% EKF velocity (smooth transition)
      const blendFactor = 0.7;
      this.state.x[2] = vN * (1 - blendFactor + blendFactor * scale);
      this.state.x[3] = vE * (1 - blendFactor + blendFactor * scale);
    } else {
      // No velocity direction — use heading to set velocity
      const heading = this.state.x[4];
      this.state.x[2] = wheelSpeed * Math.cos(heading);
      this.state.x[3] = wheelSpeed * Math.sin(heading);
    }
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  getPosition(): Position {
    return { lat: this.state.x[0], lng: this.state.x[1] };
  }

  getVelocity(): { north: number; east: number; speed: number } {
    const vN = this.state.x[2];
    const vE = this.state.x[3];
    return { north: vN, east: vE, speed: Math.sqrt(vN * vN + vE * vE) };
  }

  getHeadingDeg(): number {
    return normalizeAngleDeg(this.state.x[4] * RAD_TO_DEG);
  }

  getConfidence(): number {
    return this.state.confidence;
  }

  getInnovation(): Vec5 {
    return this.state.innovation;
  }

  getKalmanGains(): Vec5 {
    return this.state.kalmanGains;
  }

  isGPSActive(): boolean {
    return this.state.gpsActive;
  }

  getStateVector(): number[] {
    return [...this.state.x];
  }

  getCovarianceDiag(): number[] {
    return [
      this.state.P[0][0],
      this.state.P[1][1],
      this.state.P[2][2],
      this.state.P[3][3],
      this.state.P[4][4],
    ];
  }

  /** Position uncertainty in meters (from P diagonal) */
  getPositionUncertainty(): number {
    const latVar = this.state.P[0][0] * METERS_PER_DEG_LAT;
    const lngVar = this.state.P[1][1] * metersPerDegLng(this.state.x[0]);
    return Math.sqrt(latVar * latVar + lngVar * lngVar);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private updateConfidence(): void {
    // Confidence inversely proportional to position uncertainty
    const uncertainty = this.getPositionUncertainty();
    // Map: 0m → 99%, 10m → 90%, 50m → 70%, 200m → 40%
    this.state.confidence = Math.max(20, Math.min(99,
      100 / (1 + uncertainty * 0.01)
    ));
  }

  /** Reset the filter with a new known position */
  resetPosition(pos: Position, heading: number = 0): void {
    this.state.x = [pos.lat, pos.lng, 0, 0, heading * DEG_TO_RAD];
    this.state.P = [
      [1e-8, 0, 0, 0, 0],
      [0, 1e-8, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0.1],
    ];
    this.state.innovation = [0, 0, 0, 0, 0];
    this.state.kalmanGains = [0, 0, 0, 0, 0];
    this.state.confidence = 95;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeAngleRad(rad: number): number {
  while (rad > Math.PI) rad -= 2 * Math.PI;
  while (rad < -Math.PI) rad += 2 * Math.PI;
  return rad;
}

function normalizeAngleDeg(deg: number): number {
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return deg;
}
