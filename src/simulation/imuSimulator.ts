import type { IMUReading, Vector3 } from './types';
import type { IOVNBDRecord } from './iovnbdData';

// ─── Gaussian noise helper ──────────────────────────────────────────────────

function gaussianNoise(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Initial IMU State ─────────────────────────────────────────────────────

export function createInitialIMU(): IMUReading {
  return {
    accelerometer: { x: 0, y: 0, z: 9.81 },
    gyroscope: { x: 0, y: 0, z: 0 },
    speed: 0,
    heading: 0,
    acceleration: 0,
    distanceTravelled: 0,
    orientation: 0,
  };
}

// ─── Update IMU based on vehicle motion ─────────────────────────────────────

export function updateIMU(
  current: IMUReading,
  targetSpeed: number, // m/s
  targetHeading: number, // degrees
  dt: number, // seconds
  isMoving: boolean
): IMUReading {
  if (!isMoving) {
    return {
      ...current,
      accelerometer: addNoise3({ x: 0, y: 0, z: 9.81 }, 0.02),
      gyroscope: addNoise3({ x: 0, y: 0, z: 0 }, 0.005),
      speed: 0,
      acceleration: 0,
    };
  }

  // Speed approaches target with smoothing
  const speedDiff = targetSpeed - current.speed;
  const acceleration = speedDiff * 0.3; // smooth approach
  const newSpeed = current.speed + acceleration * dt;

  // Heading approaches target
  let headingDiff = targetHeading - current.heading;
  // Normalize to [-180, 180]
  while (headingDiff > 180) headingDiff -= 360;
  while (headingDiff < -180) headingDiff += 360;
  const turnRate = headingDiff * 0.2; // degrees per second smoothed
  const newHeading = normalizeAngle(current.heading + turnRate * dt);

  // Distance
  const newDistance = current.distanceTravelled + newSpeed * dt;

  // Accelerometer: forward acceleration + gravity + lateral (turn)
  const lateralAccel = (turnRate * Math.PI / 180) * newSpeed;
  const accel: Vector3 = {
    x: lateralAccel + gaussianNoise(0, 0.05),
    y: acceleration + gaussianNoise(0, 0.08),
    z: 9.81 + gaussianNoise(0, 0.03),
  };

  // Gyroscope: rotation rates
  const gyro: Vector3 = {
    x: gaussianNoise(0, 0.01), // pitch rate
    y: gaussianNoise(0, 0.01), // roll rate
    z: (turnRate * Math.PI / 180) + gaussianNoise(0, 0.005), // yaw rate
  };

  return {
    accelerometer: accel,
    gyroscope: gyro,
    speed: Math.max(0, newSpeed),
    heading: newHeading,
    acceleration,
    distanceTravelled: newDistance,
    orientation: newHeading,
  };
}

// ─── Update IMU from IO-VNBD dataset record ────────────────────────────────

export function updateIMUFromDataset(
  current: IMUReading,
  record: IOVNBDRecord,
  dt: number
): IMUReading {
  const accelerometer: Vector3 = {
    x: record.accel_x,
    y: record.accel_y,
    z: record.accel_z,
  };

  const gyroscope: Vector3 = {
    x: record.gyro_x,
    y: record.gyro_y,
    z: record.gyro_z,
  };

  // Speed from wheel encoder (more reliable than IMU integration)
  const speed = record.wheel_speed > 0 ? record.wheel_speed : current.speed;

  // Heading from gyroscope integration
  const yawRateDeg = record.gyro_z * (180 / Math.PI); // rad/s → deg/s
  const newHeading = normalizeAngle(current.heading + yawRateDeg * dt);

  // Forward acceleration from accelerometer Y axis
  const acceleration = record.accel_y;

  // Distance integration
  const newDistance = current.distanceTravelled + speed * dt;

  return {
    accelerometer,
    gyroscope,
    speed,
    heading: !isNaN(record.true_heading) ? record.true_heading : newHeading,
    acceleration,
    distanceTravelled: newDistance,
    orientation: newHeading,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function addNoise3(v: Vector3, sigma: number): Vector3 {
  return {
    x: v.x + gaussianNoise(0, sigma),
    y: v.y + gaussianNoise(0, sigma),
    z: v.z + gaussianNoise(0, sigma),
  };
}

function normalizeAngle(deg: number): number {
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return deg;
}
