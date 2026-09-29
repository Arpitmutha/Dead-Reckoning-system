// ─── Core Position ──────────────────────────────────────────────────────────

export interface Position {
  lat: number;
  lng: number;
}

// ─── Route & Waypoints ──────────────────────────────────────────────────────

export type ZoneType = 'normal' | 'tunnel_entry' | 'tunnel' | 'tunnel_exit';

export interface Waypoint extends Position {
  zone: ZoneType;
  heading: number; // degrees 0-360
  speedLimit?: number; // km/h
  label?: string;
}

export type EnvironmentType =
  | 'normal_road'
  | 'underground_tunnel'
  | 'urban_canyon'
  | 'multi_level_parking'
  | 'dense_forest';

// ─── GNSS ───────────────────────────────────────────────────────────────────

export interface GNSSState {
  connected: boolean;
  accuracy: number; // meters
  satellites: number;
  signalStrength: number; // 0-100
  position: Position | null;
  lastGPSPosition: Position | null;
  timeSinceGPSLoss: number; // seconds
}

// ─── IMU Sensors ────────────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface IMUReading {
  accelerometer: Vector3;
  gyroscope: Vector3;
  speed: number; // m/s
  heading: number; // degrees
  acceleration: number; // m/s²
  distanceTravelled: number; // meters
  orientation: number; // degrees
}

// ─── AI/ML Prediction ──────────────────────────────────────────────────────

export interface PredictionResult {
  estimatedPosition: Position;
  estimatedSpeed: number;
  estimatedHeading: number;
  confidence: number; // 0-100
  predictionError: number; // meters
  drift: number; // meters
  inferenceTime: number; // ms
}

// ─── Navigation Mode ────────────────────────────────────────────────────────

export type NavigationMode =
  | 'idle'
  | 'gps_navigation'
  | 'gnss_degrading'
  | 'dead_reckoning'
  | 'gps_restoring'
  | 'destination_reached';

// ─── System Events ──────────────────────────────────────────────────────────

export type EventSeverity = 'info' | 'warning' | 'success' | 'error';

export interface SystemEvent {
  id: string;
  timestamp: Date;
  message: string;
  severity: EventSeverity;
}

// ─── Trajectory Points ──────────────────────────────────────────────────────

export interface TrajectoryPoint extends Position {
  timestamp: number;
  source: 'gps' | 'dead_reckoning' | 'ai_predicted';
}

// ─── Error Data Point (for graphs) ─────────────────────────────────────────

export interface ErrorDataPoint {
  time: number; // seconds since nav start
  positionError: number; // meters
  gpsLat?: number;
  gpsLng?: number;
  drLat?: number;
  drLng?: number;
}

// ─── Phone Calibration & Alignment ──────────────────────────────────────────

export type MountType = 'dashboard' | 'holder' | 'pocket' | 'detecting';

export interface CalibrationState {
  pitch: number;        // degrees — tilt forward/backward
  roll: number;         // degrees — tilt left/right
  yaw: number;          // degrees — rotation relative to vehicle heading
  mountType: MountType;
  isCalibrated: boolean;
  calibrationProgress: number; // 0-100
  alignmentQuality: number;   // 0-100
  vehicleAxisOffset: number;  // degrees offset from vehicle heading
}

// ─── AI Vibration Filter ────────────────────────────────────────────────────

export type DetectedMotionEvent = 'engine_vibration' | 'pothole' | 'bump' | 'braking' | 'phone_shift' | 'idle';

export interface VibrationFilterState {
  rawAccelMagnitude: number;      // raw accelerometer magnitude (m/s²)
  filteredAccelMagnitude: number;  // after noise removal (m/s²)
  estimatedVelocity: number;       // AI-estimated vehicle speed (m/s)
  snr: number;                     // signal-to-noise ratio (dB)
  detectedEvents: DetectedMotionEvent[];
  filterActive: boolean;
  highPassCutoff: number;          // Hz
  lowPassCutoff: number;           // Hz
  kalmanGain: number;              // 0-1
  rawSignalHistory: number[];      // last N samples for waveform display
  filteredSignalHistory: number[]; // last N samples for waveform display
}

// ─── Map-Matching & Non-Holonomic Constraints ───────────────────────────────

export interface MapMatchingState {
  isActive: boolean;
  snapCorrectionMeters: number;     // how far DR was snapped to road
  hmmConfidence: number;            // 0-100 Hidden Markov Model confidence
  matchedRoadName: string;          // current road matched
  nhcLateralConstrained: boolean;   // no-lateral-slide active
  nhcVerticalConstrained: boolean;  // no-vertical-flight active
  roadHeadingConstraint: number;    // road direction for heading correction (degrees)
  osmDataLoaded: boolean;           // offline OSM data availability
  candidateRoads: number;           // number of candidate road segments
}

// ─── GNSS+INS Fusion Engine ─────────────────────────────────────────────────

export interface FusionWeights {
  gnssWeight: number;      // 0-1 weight given to GNSS
  insWeight: number;       // 0-1 weight given to INS
  aiCorrectionWeight: number; // 0-1 weight given to AI correction
  fusionMethod: 'ekf' | 'ukf' | 'ai_hybrid';
  innovationSequence: number; // Kalman innovation (residual)
  fusionConfidence: number;   // 0-100
  stateVector: number[];      // [lat, lng, vN, vE, heading] simplified
}

// ─── Performance Benchmarks (SIH Metrics) ───────────────────────────────────

export interface PerformanceMetrics {
  driftPercent: number;           // drift as % of distance travelled
  driftMeters: number;            // absolute drift in meters
  distanceInDeniedZone: number;   // meters travelled without GNSS
  totalDistanceTravelled: number; // total meters
  positionUpdateRateHz: number;   // current update rate
  transitionLatencyMs: number;    // GPS→DR switch time in ms
  driftPer50m: number;            // meters drift per 50m
  driftPer1km: number;            // meters drift per 1km
  processingTimeMs: number;       // per-tick processing time
  benchmarkCompliance: {
    driftUnder10Percent: boolean;
    driftUnder5mPer50m: boolean;
    driftUnder100mPer1km: boolean;
    updateRate10Hz: boolean;
    seamlessTransition: boolean;
  };
}

// ─── Full Navigation State Snapshot ─────────────────────────────────────────

export interface NavigationState {
  mode: NavigationMode;
  environment: EnvironmentType;
  simulationSpeed: number;
  currentWaypointIndex: number;
  progress: number; // 0-100

  gnss: GNSSState;
  imu: IMUReading;
  prediction: PredictionResult;

  // New SIH subsystems
  calibration: CalibrationState;
  vibrationFilter: VibrationFilterState;
  mapMatching: MapMatchingState;
  fusionWeights: FusionWeights;
  performance: PerformanceMetrics;

  currentPosition: Position;
  gpsTrajectory: TrajectoryPoint[];
  drTrajectory: TrajectoryPoint[];
  aiTrajectory: TrajectoryPoint[];

  events: SystemEvent[];
  errorHistory: ErrorDataPoint[];

  isRunning: boolean;
  elapsedTime: number; // seconds
}

// ─── Simulation Config ──────────────────────────────────────────────────────

export interface SimulationConfig {
  speed: number; // multiplier 0.5–5
  environment: EnvironmentType;
  tickInterval: number; // ms
}

// ─── AI Prediction API shape (for future backend swap) ──────────────────────

export interface PredictionRequest {
  accelerometer: Vector3;
  gyroscope: Vector3;
  speed: number;
  heading: number;
  previousPosition: Position;
  previousHeading: number;
  timeDelta: number;
}

export interface PredictionResponse {
  deltaLat: number;
  deltaLng: number;
  estimatedPosition: Position;
  estimatedHeading: number;
  confidence: number;
  inferenceTimeMs: number;
}
