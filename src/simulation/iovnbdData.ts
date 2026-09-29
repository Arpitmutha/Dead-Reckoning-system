// ─── IO-VNBD Dataset Format Types & Synthetic Data Generator ────────────────
//
// Matches the IO-VNBD (Inertial and Odometry Vehicle Navigation Benchmark Dataset)
// CSV format: ~24 smartphone columns at 10Hz sampling rate.
//
// Reference: Onyekpe et al., "IO-VNBD: Inertial and Odometry Benchmark Dataset
// for Ground Vehicle Positioning", https://github.com/onyekpeu/IO-VNBD

import { DEMO_ROUTE, haversineDistance } from './demoRoute';

// ─── IO-VNBD Record (one row of the CSV) ────────────────────────────────────

export interface IOVNBDRecord {
  timestamp: number;          // seconds since start
  // Accelerometer (m/s²) — body frame
  accel_x: number;
  accel_y: number;
  accel_z: number;
  // Gyroscope (rad/s) — body frame
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  // Magnetometer (µT) — body frame
  mag_x: number;
  mag_y: number;
  mag_z: number;
  // GPS (NaN when unavailable)
  gps_lat: number;
  gps_lng: number;
  gps_alt: number;
  gps_speed: number;          // m/s
  gps_bearing: number;        // degrees
  gps_accuracy: number;       // meters (NaN when unavailable)
  gps_satellites: number;     // integer
  // Odometry
  wheel_speed: number;        // m/s from wheel encoder
  odometry_distance: number;  // cumulative meters
  // Zone metadata (not in original IO-VNBD, added for our simulation)
  zone: 'normal' | 'tunnel_entry' | 'tunnel' | 'tunnel_exit';
  // Ground truth position (for error calculation)
  true_lat: number;
  true_lng: number;
  true_heading: number;       // degrees
}

// ─── Gaussian noise ─────────────────────────────────────────────────────────

function gaussianNoise(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stddev * Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// ─── Generate synthetic IO-VNBD dataset ─────────────────────────────────────
//
// Creates realistic sensor data along the demo route:
// - Accelerometer: gravity + forward accel + lateral forces during turns
// - Gyroscope: yaw rate from heading changes, small pitch/roll noise
// - GPS: available in normal zones, degraded in tunnel_entry/exit, NaN in tunnel
// - Odometry: integrated wheel speed

export function generateSyntheticDataset(): IOVNBDRecord[] {
  const records: IOVNBDRecord[] = [];
  const SAMPLE_RATE = 10; // Hz (IO-VNBD standard)
  const dt = 1 / SAMPLE_RATE;

  // Vehicle parameters
  const BASE_SPEED = 8.33; // ~30 km/h — typical urban speed
  let currentSpeed = 0;
  let cumulativeDistance = 0;
  let timestamp = 0;

  // Walk through the demo route waypoints
  const route = DEMO_ROUTE;
  const totalSegments = route.length - 1;

  // Calculate how many samples per segment (~proportional to segment distance)
  const segmentDistances = [];
  let totalDist = 0;
  for (let i = 0; i < totalSegments; i++) {
    const d = haversineDistance(route[i], route[i + 1]);
    segmentDistances.push(d);
    totalDist += d;
  }

  // Target ~600 records total (60 seconds)
  const TARGET_RECORDS = 600;

  for (let seg = 0; seg < totalSegments; seg++) {
    const wp0 = route[seg];
    const wp1 = route[seg + 1];
    const segDist = segmentDistances[seg];

    // Number of samples for this segment (proportional to distance)
    const segSamples = Math.max(3, Math.round((segDist / totalDist) * TARGET_RECORDS));

    // Heading change across this segment
    let headingDiff = wp1.heading - wp0.heading;
    while (headingDiff > 180) headingDiff -= 360;
    while (headingDiff < -180) headingDiff += 360;
    const yawRatePerSample = (headingDiff * Math.PI / 180) / (segSamples * dt);

    for (let s = 0; s < segSamples; s++) {
      const t = s / segSamples; // 0→1 within segment
      const tNext = (s + 1) / segSamples;

      // Interpolated true position
      const trueLat = wp0.lat + (wp1.lat - wp0.lat) * t;
      const trueLng = wp0.lng + (wp1.lng - wp0.lng) * t;
      const trueHeading = wp0.heading + headingDiff * t;
      const headingRad = (trueHeading * Math.PI) / 180;

      // Zone
      const zone = wp0.zone;

      // Target speed varies slightly
      const targetSpeed = BASE_SPEED * (zone === 'tunnel' ? 0.8 : zone === 'tunnel_entry' ? 0.9 : 1.0);
      const speedError = gaussianNoise(0, 0.3);
      const prevSpeed = currentSpeed;
      currentSpeed = currentSpeed + (targetSpeed - currentSpeed) * 0.3 + speedError * dt;
      currentSpeed = Math.max(0, currentSpeed);

      const forwardAccel = (currentSpeed - prevSpeed) / dt;
      const lateralAccel = yawRatePerSample * currentSpeed; // centripetal

      // ── Accelerometer (body frame) ──
      // x: lateral (right positive), y: forward, z: up (gravity)
      const accel_x = lateralAccel + gaussianNoise(0, 0.05);
      const accel_y = forwardAccel + gaussianNoise(0, 0.08);
      const accel_z = 9.81 + gaussianNoise(0, 0.03); // gravity + vibration

      // ── Gyroscope (body frame, rad/s) ──
      const gyro_x = gaussianNoise(0, 0.01);  // pitch rate
      const gyro_y = gaussianNoise(0, 0.01);  // roll rate
      const gyro_z = yawRatePerSample + gaussianNoise(0, 0.005); // yaw rate

      // ── Magnetometer (µT, simulated) ──
      // Earth's field ~50µT, decomposed by heading
      const magFieldStrength = 48;
      const mag_x = magFieldStrength * Math.sin(headingRad) + gaussianNoise(0, 1.5);
      const mag_y = magFieldStrength * Math.cos(headingRad) + gaussianNoise(0, 1.5);
      const mag_z = -25 + gaussianNoise(0, 1.0); // vertical component

      // ── GPS ──
      let gps_lat: number;
      let gps_lng: number;
      let gps_alt: number;
      let gps_speed: number;
      let gps_bearing: number;
      let gps_accuracy: number;
      let gps_satellites: number;

      if (zone === 'tunnel') {
        // Complete GPS denial inside tunnel
        gps_lat = NaN;
        gps_lng = NaN;
        gps_alt = NaN;
        gps_speed = NaN;
        gps_bearing = NaN;
        gps_accuracy = NaN;
        gps_satellites = 0;
      } else if (zone === 'tunnel_entry') {
        // Degrading GPS
        const degradeFactor = t; // gets worse as we go deeper
        if (Math.random() < degradeFactor * 0.7) {
          gps_lat = NaN;
          gps_lng = NaN;
          gps_alt = NaN;
          gps_speed = NaN;
          gps_bearing = NaN;
          gps_accuracy = NaN;
          gps_satellites = Math.floor(4 - degradeFactor * 3);
        } else {
          const gpsNoise = (15 + degradeFactor * 20) / 111320; // meters → degrees
          gps_lat = trueLat + gaussianNoise(0, gpsNoise);
          gps_lng = trueLng + gaussianNoise(0, gpsNoise);
          gps_alt = 550 + gaussianNoise(0, 5);
          gps_speed = currentSpeed + gaussianNoise(0, 1.5);
          gps_bearing = trueHeading + gaussianNoise(0, 8);
          gps_accuracy = 15 + degradeFactor * 25;
          gps_satellites = Math.floor(8 - degradeFactor * 5);
        }
      } else if (zone === 'tunnel_exit') {
        // Recovering GPS
        const recoverFactor = t;
        if (Math.random() < (1 - recoverFactor) * 0.4) {
          gps_lat = NaN;
          gps_lng = NaN;
          gps_alt = NaN;
          gps_speed = NaN;
          gps_bearing = NaN;
          gps_accuracy = NaN;
          gps_satellites = Math.floor(3 + recoverFactor * 8);
        } else {
          const gpsNoise = (20 - recoverFactor * 15) / 111320;
          gps_lat = trueLat + gaussianNoise(0, gpsNoise);
          gps_lng = trueLng + gaussianNoise(0, gpsNoise);
          gps_alt = 550 + gaussianNoise(0, 3);
          gps_speed = currentSpeed + gaussianNoise(0, 1.0);
          gps_bearing = trueHeading + gaussianNoise(0, 5);
          gps_accuracy = 20 - recoverFactor * 15;
          gps_satellites = Math.floor(5 + recoverFactor * 10);
        }
      } else {
        // Normal — good GPS with typical noise
        const gpsNoise = 3.5 / 111320; // ~3.5m accuracy in degrees
        gps_lat = trueLat + gaussianNoise(0, gpsNoise);
        gps_lng = trueLng + gaussianNoise(0, gpsNoise);
        gps_alt = 550 + gaussianNoise(0, 2);
        gps_speed = currentSpeed + gaussianNoise(0, 0.3);
        gps_bearing = trueHeading + gaussianNoise(0, 2);
        gps_accuracy = 3.5 + gaussianNoise(0, 0.8);
        gps_satellites = Math.floor(14 + Math.random() * 6);
      }

      // ── Odometry ──
      const stepDist = currentSpeed * dt;
      cumulativeDistance += stepDist;

      records.push({
        timestamp,
        accel_x, accel_y, accel_z,
        gyro_x, gyro_y, gyro_z,
        mag_x, mag_y, mag_z,
        gps_lat, gps_lng, gps_alt,
        gps_speed, gps_bearing, gps_accuracy, gps_satellites,
        wheel_speed: currentSpeed + gaussianNoise(0, 0.1),
        odometry_distance: cumulativeDistance,
        zone,
        true_lat: trueLat,
        true_lng: trueLng,
        true_heading: trueHeading,
      });

      timestamp += dt;
    }
  }

  return records;
}

// ─── CSV Column headers (IO-VNBD compatible) ────────────────────────────────

export const IOVNBD_CSV_HEADERS = [
  'timestamp',
  'accel_x', 'accel_y', 'accel_z',
  'gyro_x', 'gyro_y', 'gyro_z',
  'mag_x', 'mag_y', 'mag_z',
  'gps_lat', 'gps_lng', 'gps_alt',
  'gps_speed', 'gps_bearing', 'gps_accuracy', 'gps_satellites',
  'wheel_speed', 'odometry_distance',
] as const;

// ─── Export dataset as CSV text (for download/debug) ────────────────────────

export function datasetToCSV(records: IOVNBDRecord[]): string {
  const headers = [...IOVNBD_CSV_HEADERS];
  const rows = records.map(r =>
    headers.map(h => {
      const val = r[h as keyof IOVNBDRecord];
      return typeof val === 'number' && isNaN(val) ? '' : val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
