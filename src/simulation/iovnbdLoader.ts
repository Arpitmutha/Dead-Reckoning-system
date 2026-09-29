// ─── IO-VNBD Dataset Loader & Playback Iterator ─────────────────────────────
//
// Parses IO-VNBD CSV files and provides a playback interface for the
// dead reckoning engine. Handles both synthetic and real IO-VNBD datasets.

import type { IOVNBDRecord } from './iovnbdData';
import { IOVNBD_CSV_HEADERS } from './iovnbdData';

// ─── CSV Parser ─────────────────────────────────────────────────────────────

export function parseIOVNBDCSV(csvText: string): IOVNBDRecord[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase().replace(/\s+/g, '');
  const headers = headerLine.split(',');

  // Build column index map — supports both our format and original IO-VNBD
  const colIndex = new Map<string, number>();
  const COLUMN_ALIASES: Record<string, string[]> = {
    timestamp: ['timestamp', 'time', 'time_s', 'elapsed'],
    accel_x: ['accel_x', 'acc_x', 'accelerometer_x', 'linear_acceleration_x'],
    accel_y: ['accel_y', 'acc_y', 'accelerometer_y', 'linear_acceleration_y'],
    accel_z: ['accel_z', 'acc_z', 'accelerometer_z', 'linear_acceleration_z'],
    gyro_x: ['gyro_x', 'gyr_x', 'gyroscope_x', 'angular_velocity_x'],
    gyro_y: ['gyro_y', 'gyr_y', 'gyroscope_y', 'angular_velocity_y'],
    gyro_z: ['gyro_z', 'gyr_z', 'gyroscope_z', 'angular_velocity_z'],
    mag_x: ['mag_x', 'magnetometer_x', 'magnetic_field_x'],
    mag_y: ['mag_y', 'magnetometer_y', 'magnetic_field_y'],
    mag_z: ['mag_z', 'magnetometer_z', 'magnetic_field_z'],
    gps_lat: ['gps_lat', 'latitude', 'lat', 'gps_latitude'],
    gps_lng: ['gps_lng', 'longitude', 'lng', 'lon', 'gps_longitude'],
    gps_alt: ['gps_alt', 'altitude', 'alt', 'gps_altitude'],
    gps_speed: ['gps_speed', 'speed', 'velocity'],
    gps_bearing: ['gps_bearing', 'bearing', 'course', 'heading'],
    gps_accuracy: ['gps_accuracy', 'accuracy', 'horizontal_accuracy'],
    gps_satellites: ['gps_satellites', 'satellites', 'num_satellites', 'sat_count'],
    wheel_speed: ['wheel_speed', 'obd_speed', 'vehicle_speed'],
    odometry_distance: ['odometry_distance', 'distance', 'cumulative_distance'],
  };

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) {
        colIndex.set(canonical, idx);
        break;
      }
    }
  }

  // Parse data rows
  const records: IOVNBDRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 3) continue; // skip malformed lines

    const getCol = (name: string, fallback: number = 0): number => {
      const idx = colIndex.get(name);
      if (idx === undefined || idx >= cols.length) return fallback;
      const val = parseFloat(cols[idx]);
      return val; // NaN is valid (means GPS unavailable)
    };

    // Determine zone from GPS availability
    const lat = getCol('gps_lat', NaN);
    const hasGPS = !isNaN(lat);
    let zone: IOVNBDRecord['zone'] = 'normal';
    if (!hasGPS) {
      // Look at neighbors to determine if entry, tunnel, or exit
      zone = 'tunnel'; // default if no GPS
    }

    records.push({
      timestamp: getCol('timestamp'),
      accel_x: getCol('accel_x'),
      accel_y: getCol('accel_y'),
      accel_z: getCol('accel_z', 9.81),
      gyro_x: getCol('gyro_x'),
      gyro_y: getCol('gyro_y'),
      gyro_z: getCol('gyro_z'),
      mag_x: getCol('mag_x'),
      mag_y: getCol('mag_y'),
      mag_z: getCol('mag_z'),
      gps_lat: lat,
      gps_lng: getCol('gps_lng', NaN),
      gps_alt: getCol('gps_alt', NaN),
      gps_speed: getCol('gps_speed', NaN),
      gps_bearing: getCol('gps_bearing', NaN),
      gps_accuracy: getCol('gps_accuracy', NaN),
      gps_satellites: getCol('gps_satellites', 0),
      wheel_speed: getCol('wheel_speed', 0),
      odometry_distance: getCol('odometry_distance', 0),
      zone,
      // Ground truth not available from real CSV — use GPS as approximation when available
      true_lat: hasGPS ? lat : NaN,
      true_lng: hasGPS ? getCol('gps_lng', NaN) : NaN,
      true_heading: hasGPS ? getCol('gps_bearing', 0) : NaN,
    });
  }

  // Post-process: detect tunnel entry/exit zones
  classifyTunnelZones(records);

  return records;
}

// ─── Classify tunnel entry/exit zones ───────────────────────────────────────

function classifyTunnelZones(records: IOVNBDRecord[]): void {
  const ENTRY_WINDOW = 5; // samples before GPS loss
  const EXIT_WINDOW = 5;  // samples after GPS returns

  for (let i = 0; i < records.length; i++) {
    if (records[i].zone !== 'tunnel') continue;

    // Check if this is near the start of a tunnel section
    if (i > 0 && records[i - 1].zone === 'normal') {
      // Mark preceding samples as tunnel_entry
      for (let j = Math.max(0, i - ENTRY_WINDOW); j < i; j++) {
        records[j].zone = 'tunnel_entry';
      }
    }

    // Check if this is near the end of a tunnel section
    if (i < records.length - 1 && records[i + 1].zone === 'normal') {
      // Mark following samples as tunnel_exit
      for (let j = i + 1; j < Math.min(records.length, i + 1 + EXIT_WINDOW); j++) {
        records[j].zone = 'tunnel_exit';
      }
    }
  }
}

// ─── Dataset Playback Controller ────────────────────────────────────────────

export class IOVNBDPlayer {
  private records: IOVNBDRecord[];
  private index: number = 0;
  private _isComplete: boolean = false;

  constructor(records: IOVNBDRecord[]) {
    this.records = records;
  }

  /** Get the next record, advancing the playback cursor */
  getNextRecord(): IOVNBDRecord | null {
    if (this.index >= this.records.length) {
      this._isComplete = true;
      return null;
    }
    return this.records[this.index++];
  }

  /** Peek at the current record without advancing */
  peekRecord(): IOVNBDRecord | null {
    if (this.index >= this.records.length) return null;
    return this.records[this.index];
  }

  /** Reset playback to the beginning */
  reset(): void {
    this.index = 0;
    this._isComplete = false;
  }

  /** Seek to a specific record index */
  seekTo(index: number): void {
    this.index = Math.max(0, Math.min(index, this.records.length - 1));
    this._isComplete = false;
  }

  /** Check if playback is complete */
  get isComplete(): boolean {
    return this._isComplete;
  }

  /** Get current playback position */
  get currentIndex(): number {
    return this.index;
  }

  /** Get total number of records */
  get totalRecords(): number {
    return this.records.length;
  }

  /** Get the sample rate (inferred from timestamps) */
  get sampleRateHz(): number {
    if (this.records.length < 2) return 10;
    const dtAvg = (this.records[this.records.length - 1].timestamp - this.records[0].timestamp) /
      (this.records.length - 1);
    return Math.round(1 / dtAvg);
  }

  /** Get total duration in seconds */
  get durationSeconds(): number {
    if (this.records.length === 0) return 0;
    return this.records[this.records.length - 1].timestamp - this.records[0].timestamp;
  }

  /** Get all records (for batch processing) */
  getAllRecords(): IOVNBDRecord[] {
    return this.records;
  }
}
