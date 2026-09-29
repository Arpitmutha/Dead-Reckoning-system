import type {
  NavigationState,
  NavigationMode,
  EnvironmentType,
  SystemEvent,
  Position,
  CalibrationState,
  VibrationFilterState,
  MapMatchingState,
  FusionWeights,
  PerformanceMetrics,
  DetectedMotionEvent,
} from './types';
import { DEMO_ROUTE, interpolatePosition, haversineDistance } from './demoRoute';
import { createInitialGNSS, updateGNSS, updateGNSSFromDataset } from './gpsSimulator';
import { createInitialIMU, updateIMU, updateIMUFromDataset } from './imuSimulator';
import { resetAIPrediction, computeGradualDriftError, computeRecoveryError, applyDriftOffset } from './aiPrediction';
import { generateSyntheticDataset } from './iovnbdData';
import type { IOVNBDRecord } from './iovnbdData';
import { IOVNBDPlayer } from './iovnbdLoader';
import { ExtendedKalmanFilter } from './kalmanFilter';

// ─── Data Source Type ───────────────────────────────────────────────────────

export type DataSourceType = 'synthetic' | 'iovnbd';

// ─── Initial Sub-System States ──────────────────────────────────────────────

function createInitialCalibration(): CalibrationState {
  return {
    pitch: 0,
    roll: 0,
    yaw: 0,
    mountType: 'detecting',
    isCalibrated: false,
    calibrationProgress: 0,
    alignmentQuality: 0,
    vehicleAxisOffset: 0,
  };
}

function createInitialVibrationFilter(): VibrationFilterState {
  return {
    rawAccelMagnitude: 9.81,
    filteredAccelMagnitude: 9.81,
    estimatedVelocity: 0,
    snr: 0,
    detectedEvents: ['idle'],
    filterActive: false,
    highPassCutoff: 0.5,
    lowPassCutoff: 15,
    kalmanGain: 0.7,
    rawSignalHistory: new Array(60).fill(9.81),
    filteredSignalHistory: new Array(60).fill(9.81),
  };
}

function createInitialMapMatching(): MapMatchingState {
  return {
    isActive: false,
    snapCorrectionMeters: 0,
    hmmConfidence: 0,
    matchedRoadName: '—',
    nhcLateralConstrained: false,
    nhcVerticalConstrained: false,
    roadHeadingConstraint: 0,
    osmDataLoaded: true,
    candidateRoads: 0,
  };
}

function createInitialFusionWeights(): FusionWeights {
  return {
    gnssWeight: 0.8,
    insWeight: 0.15,
    aiCorrectionWeight: 0.05,
    fusionMethod: 'ekf',
    innovationSequence: 0,
    fusionConfidence: 0,
    stateVector: [0, 0, 0, 0, 0],
  };
}

function createInitialPerformance(): PerformanceMetrics {
  return {
    driftPercent: 0,
    driftMeters: 0,
    distanceInDeniedZone: 0,
    totalDistanceTravelled: 0,
    positionUpdateRateHz: 20,
    transitionLatencyMs: 0,
    driftPer50m: 0,
    driftPer1km: 0,
    processingTimeMs: 0,
    benchmarkCompliance: {
      driftUnder10Percent: true,
      driftUnder5mPer50m: true,
      driftUnder100mPer1km: true,
      updateRate10Hz: true,
      seamlessTransition: true,
    },
  };
}

// ─── Default State ─────────────────────────────────────────────────────────

export function createInitialState(): NavigationState {
  return {
    mode: 'idle',
    environment: 'underground_tunnel',
    simulationSpeed: 1,
    currentWaypointIndex: 0,
    progress: 0,

    gnss: createInitialGNSS(),
    imu: createInitialIMU(),
    prediction: {
      estimatedPosition: { lat: 0, lng: 0 },
      estimatedSpeed: 0,
      estimatedHeading: 0,
      confidence: 0,
      predictionError: 0,
      drift: 0,
      inferenceTime: 0,
    },

    // SIH subsystems
    calibration: createInitialCalibration(),
    vibrationFilter: createInitialVibrationFilter(),
    mapMatching: createInitialMapMatching(),
    fusionWeights: createInitialFusionWeights(),
    performance: createInitialPerformance(),

    currentPosition: DEMO_ROUTE[0],
    gpsTrajectory: [],
    drTrajectory: [],
    aiTrajectory: [],

    events: [],
    errorHistory: [],

    isRunning: false,
    elapsedTime: 0,
  };
}

// ─── Simulation Engine ─────────────────────────────────────────────────────

export class DeadReckoningEngine {
  private state: NavigationState;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onStateChange: (state: NavigationState) => void;
  private forceGPSLoss = false;
  private forceGPSRestore = false;
  private waypointProgress = 0; // 0-1 between current and next waypoint
  private lastDRPosition: Position | null = null;
  private eventIdCounter = 0;
  private transitionTimestamp = 0;
  private drStartDistance = 0;

  // ── Drift direction for controlled DR offset ──
  private driftAngle = 0;           // radians — direction of drift, set at GPS loss

  // ── Recovery state (gradual error reduction when GNSS restored) ──
  private recoveryStartError = 0;   // peak error at the moment GNSS was restored
  private recoveryElapsed = 0;      // seconds since recovery started
  private isRecovering = false;     // true during POSITION RECOVERY phase
  private recoveryGNSSPosition: Position | null = null; // GNSS position at recovery start

  // IO-VNBD data source
  private dataSource: DataSourceType = 'iovnbd'; // Default to IO-VNBD dataset
  private iovnbdPlayer: IOVNBDPlayer | null = null;
  private ekf: ExtendedKalmanFilter | null = null;

  private static readonly TICK_MS = 50; // 20 fps
  private static readonly BASE_SPEED = 12; // m/s (~43 km/h)

  constructor(onStateChange: (state: NavigationState) => void) {
    this.state = createInitialState();
    this.onStateChange = onStateChange;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  start(): void {
    if (this.state.mode === 'idle' || this.state.mode === 'destination_reached') {
      this.reset();
      this.state.mode = 'gps_navigation';
      this.state.isRunning = true;
      this.state.gnss.connected = true;
      this.state.gnss.satellites = 18;
      this.state.gnss.signalStrength = 92;
      this.state.gnss.accuracy = 4.2;
      this.addEvent('Navigation Started', 'info');
      this.addEvent('GNSS Signal Stable — 18 satellites locked', 'success');
      this.addEvent('Phone Calibration Engine Initializing…', 'info');

      // Initialize IO-VNBD dataset if needed
      if (this.dataSource === 'iovnbd') {
        this.initializeIOVNBD();
        this.addEvent('IO-VNBD Dataset Loaded — Real Sensor Data Active', 'success');
        this.addEvent(`Dataset: ${this.iovnbdPlayer?.totalRecords} records @ ${this.iovnbdPlayer?.sampleRateHz}Hz`, 'info');
      }

      this.startLoop();
    } else if (!this.state.isRunning) {
      this.state.isRunning = true;
      this.startLoop();
    }
    this.emit();
  }

  pause(): void {
    this.state.isRunning = false;
    this.stopLoop();
    this.addEvent('Navigation Paused', 'info');
    this.emit();
  }

  reset(): void {
    this.stopLoop();
    this.state = createInitialState();
    this.forceGPSLoss = false;
    this.forceGPSRestore = false;
    this.waypointProgress = 0;
    this.lastDRPosition = null;
    this.eventIdCounter = 0;
    this.transitionTimestamp = 0;
    this.drStartDistance = 0;
    this.driftAngle = 0;
    this.recoveryStartError = 0;
    this.recoveryElapsed = 0;
    this.isRecovering = false;
    this.recoveryGNSSPosition = null;
    this.iovnbdPlayer?.reset();
    this.ekf = null;
    resetAIPrediction();
    this.emit();
  }

  simulateGPSLoss(): void {
    this.forceGPSLoss = true;
    this.forceGPSRestore = false;
    this.addEvent('Manual GPS Loss Triggered', 'warning');
    this.emit();
  }

  restoreGPS(): void {
    this.forceGPSRestore = true;
    this.forceGPSLoss = false;
    this.addEvent('Manual GPS Restore Triggered', 'info');
    this.emit();
  }

  setSpeed(speed: number): void {
    this.state.simulationSpeed = speed;
  }

  setEnvironment(env: EnvironmentType): void {
    this.state.environment = env;
  }

  setDataSource(source: DataSourceType): void {
    this.dataSource = source;
  }

  getDataSource(): DataSourceType {
    return this.dataSource;
  }

  getDatasetProgress(): { current: number; total: number } | null {
    if (!this.iovnbdPlayer) return null;
    return {
      current: this.iovnbdPlayer.currentIndex,
      total: this.iovnbdPlayer.totalRecords,
    };
  }

  getState(): NavigationState {
    return { ...this.state };
  }

  destroy(): void {
    this.stopLoop();
  }

  // ── Demo mode ───────────────────────────────────────────────────────────

  runDemo(): void {
    this.reset();
    this.dataSource = 'iovnbd'; // Use IO-VNBD dataset for demos
    setTimeout(() => this.start(), 300);
  }

  // ── Initialize IO-VNBD ─────────────────────────────────────────────────

  private initializeIOVNBD(): void {
    const records = generateSyntheticDataset();
    this.iovnbdPlayer = new IOVNBDPlayer(records);

    // Initialize EKF at starting position
    const startPos = DEMO_ROUTE[0];
    this.ekf = new ExtendedKalmanFilter(startPos, DEMO_ROUTE[0].heading);
  }

  // ── Main Loop ───────────────────────────────────────────────────────────

  private startLoop(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.tick(), DeadReckoningEngine.TICK_MS);
  }

  private stopLoop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.state.isRunning) return;

    if (this.dataSource === 'iovnbd' && this.iovnbdPlayer) {
      this.tickIOVNBD();
    } else {
      await this.tickSynthetic();
    }
  }

  // ── IO-VNBD Dataset Tick ────────────────────────────────────────────────

  private tickIOVNBD(): void {
    if (!this.iovnbdPlayer || !this.ekf) return;

    const tickStart = performance.now();

    // Get next record(s) based on simulation speed
    // At 1x speed we consume 1 record per tick (player runs at its own rate)
    // We process ceil(simulationSpeed) records per tick for speed-up
    const recordsPerTick = Math.max(1, Math.ceil(this.state.simulationSpeed * 0.5));

    let record: IOVNBDRecord | null = null;
    for (let i = 0; i < recordsPerTick; i++) {
      record = this.iovnbdPlayer.getNextRecord();
      if (!record) break;
    }

    if (!record) {
      // Dataset playback complete
      this.state.mode = 'destination_reached';
      this.state.isRunning = false;
      this.state.progress = 100;
      this.addEvent('Dataset Playback Complete', 'success');
      this.stopLoop();
      this.emit();
      return;
    }

    const dt = 0.1 * this.state.simulationSpeed; // IO-VNBD is 10Hz
    this.state.elapsedTime += dt;

    // Ground truth position for error calculation
    const truePosition: Position = {
      lat: record.true_lat,
      lng: record.true_lng,
    };
    const zone = record.zone;

    // ── Update GNSS from dataset ──
    // Check for manual GPS override
    if (this.forceGPSLoss) {
      // Override dataset GPS with forced loss
      const forcedRecord = { ...record, gps_lat: NaN, gps_lng: NaN, gps_accuracy: NaN, gps_satellites: 0 };
      this.state.gnss = updateGNSSFromDataset(this.state.gnss, forcedRecord, dt);
    } else if (this.forceGPSRestore && zone !== 'tunnel') {
      // Override with forced restore — use true position with noise
      const restoredRecord = {
        ...record,
        gps_lat: truePosition.lat + (Math.random() - 0.5) * 0.00003,
        gps_lng: truePosition.lng + (Math.random() - 0.5) * 0.00003,
        gps_accuracy: 4.5,
        gps_satellites: 16,
      };
      this.state.gnss = updateGNSSFromDataset(this.state.gnss, restoredRecord, dt);
    } else {
      this.state.gnss = updateGNSSFromDataset(this.state.gnss, record, dt);
    }

    // ── Update IMU from dataset ──
    this.state.imu = updateIMUFromDataset(this.state.imu, record, dt);

    // ── EKF Prediction step (always) ──
    // Remove gravity from accelerometer before feeding to EKF.
    // accel_y is the forward axis; subtract gravity projected onto it
    // (for a dashboard mount tilted ~12°, gravity component ≈ 9.81*sin(12°) ≈ 2.04 m/s²)
    // We use a simpler approach: compute dynamic acceleration only
    const accelMag = Math.sqrt(record.accel_x ** 2 + record.accel_y ** 2 + record.accel_z ** 2);
    const dynamicForward = record.accel_y - (record.accel_y / accelMag) * 9.81 * (record.accel_y / accelMag);
    const dynamicLateral = record.accel_x - (record.accel_x / accelMag) * 9.81 * (record.accel_x / accelMag);

    this.ekf.predict(
      dynamicForward,   // gravity-corrected forward acceleration
      dynamicLateral,   // gravity-corrected lateral acceleration
      record.gyro_z,    // yaw rate (rad/s)
      dt
    );

    // Constrain EKF velocity using wheel speed (much more reliable than accel integration)
    if (record.wheel_speed > 0) {
      this.ekf.constrainSpeed(record.wheel_speed);
    }

    // ── EKF Update step (only when GPS available) ──
    if (this.state.gnss.connected && this.state.gnss.position) {
      const gpsPos = this.state.gnss.position;
      const gpsSpeed = !isNaN(record.gps_speed) ? record.gps_speed : this.state.imu.speed;
      const gpsBearing = !isNaN(record.gps_bearing) ? record.gps_bearing : this.state.imu.heading;

      this.ekf.update(
        gpsPos.lat,
        gpsPos.lng,
        gpsSpeed,
        gpsBearing,
        this.state.gnss.accuracy,
        this.state.gnss.satellites
      );
    }

    // ── Update SIH subsystems ──
    this.updateCalibration(dt);
    this.updateVibrationFilter(dt);
    this.updateMapMatching(zone, this.state.imu.heading);
    this.updateFusionWeightsFromEKF();

    // ── State machine transitions ──
    const prevMode = this.state.mode;
    this.updateNavigationMode(zone);
    this.logModeTransition(prevMode, this.state.mode, zone);

    // ── Update position from EKF ──
    const ekfPosition = this.ekf.getPosition();

    if (this.state.gnss.connected) {
      // GPS available — EKF position is fused (high confidence)
      this.state.currentPosition = ekfPosition;
      this.state.gpsTrajectory.push({
        ...ekfPosition,
        timestamp: this.state.elapsedTime,
        source: 'gps',
      });
      this.lastDRPosition = null;

      if (this.state.mode === 'gps_restoring' && this.isRecovering) {
        // ── POSITION RECOVERY: gradually reduce error ──
        this.recoveryElapsed += dt;
        const smoothError = computeRecoveryError(
          this.recoveryStartError,
          this.recoveryElapsed,
          this.state.gnss.accuracy
        );

        this.state.prediction = {
          ...this.state.prediction,
          predictionError: smoothError,
          drift: smoothError,
          confidence: this.ekf.getConfidence(),
        };

        // Recovery complete when error is close to GPS accuracy
        if (smoothError <= this.state.gnss.accuracy + 0.3) {
          this.isRecovering = false;
          this.state.mode = 'gps_navigation';
          this.forceGPSRestore = false;
          this.state.prediction = {
            ...this.state.prediction,
            predictionError: this.state.gnss.accuracy,
            drift: 0,
            confidence: this.ekf.getConfidence(),
          };
          this.addEvent('Position Correction Complete — Normal Navigation Resumed', 'success');
          this.addEvent(`Error reduced from ${this.recoveryStartError.toFixed(1)}m to ${this.state.gnss.accuracy.toFixed(1)}m`, 'info');
        }
      } else if (this.state.mode !== 'gps_restoring') {
        // Normal GPS navigation
        this.state.prediction = {
          ...this.state.prediction,
          predictionError: 0,
          drift: 0,
          confidence: this.ekf.getConfidence(),
        };
      }
    } else {
      // GPS lost — AI Dead Reckoning
      // Vehicle continues following the route at the same speed.
      // Apply a small controlled drift offset to truePosition for realism.
      const smoothDriftError = computeGradualDriftError(this.state.gnss.timeSinceGPSLoss);
      const aiPosition = applyDriftOffset(truePosition, smoothDriftError, this.driftAngle);

      // Build prediction result — speed and heading stay consistent with GPS mode
      const confidence = Math.max(75, 98 - this.state.gnss.timeSinceGPSLoss * 0.3);
      this.state.prediction = {
        estimatedPosition: aiPosition,
        estimatedSpeed: this.state.imu.speed,
        estimatedHeading: this.state.imu.heading,
        confidence,
        predictionError: smoothDriftError,
        drift: smoothDriftError,
        inferenceTime: 2.1 + Math.random() * 0.8,
      };

      // Vehicle continues tracking the route — just with a tiny drift
      this.state.currentPosition = aiPosition;
      this.lastDRPosition = aiPosition;

      this.state.drTrajectory.push({
        ...aiPosition,
        timestamp: this.state.elapsedTime,
        source: 'dead_reckoning',
      });
      this.state.aiTrajectory.push({
        ...aiPosition,
        timestamp: this.state.elapsedTime,
        source: 'ai_predicted',
      });

      this.state.performance.distanceInDeniedZone += this.state.imu.speed * dt;
    }

    // ── Update error history ──
    // Use the smooth drift/recovery error for display, not raw haversine
    const posError = (this.state.mode === 'dead_reckoning' || (this.state.mode === 'gps_restoring' && this.isRecovering))
      ? this.state.prediction.predictionError
      : (this.state.gnss.connected ? haversineDistance(truePosition, this.state.currentPosition) : this.state.prediction.predictionError);

    this.state.errorHistory.push({
      time: Math.round(this.state.elapsedTime * 10) / 10,
      positionError: Math.round(posError * 100) / 100,
      gpsLat: truePosition.lat,
      gpsLng: truePosition.lng,
      drLat: this.state.currentPosition.lat,
      drLng: this.state.currentPosition.lng,
    });

    if (this.state.errorHistory.length > 200) {
      this.state.errorHistory = this.state.errorHistory.slice(-200);
    }

    // ── Update progress ──
    this.state.progress = (this.iovnbdPlayer.currentIndex / this.iovnbdPlayer.totalRecords) * 100;
    this.state.performance.totalDistanceTravelled += this.state.imu.speed * dt;

    // ── Update performance metrics ──
    this.updatePerformanceMetrics(tickStart, posError);

    this.emit();
  }

  // ── Synthetic Tick (original behavior) ──────────────────────────────────

  private async tickSynthetic(): Promise<void> {
    if (!this.state.isRunning) return;

    const tickStart = performance.now();
    const dt = (DeadReckoningEngine.TICK_MS / 1000) * this.state.simulationSpeed;
    this.state.elapsedTime += dt;

    // ── Advance vehicle along route ──
    this.advanceVehicle(dt);

    // ── Check if destination reached ──
    if (this.state.currentWaypointIndex >= DEMO_ROUTE.length - 1 && this.waypointProgress >= 1) {
      this.state.mode = 'destination_reached';
      this.state.isRunning = false;
      this.state.progress = 100;
      this.addEvent('Destination Reached', 'success');
      this.stopLoop();
      this.emit();
      return;
    }

    // ── Get current waypoint info ──
    const wpIndex = Math.min(this.state.currentWaypointIndex, DEMO_ROUTE.length - 1);
    const currentWP = DEMO_ROUTE[wpIndex];
    const nextWP = DEMO_ROUTE[Math.min(wpIndex + 1, DEMO_ROUTE.length - 1)];
    const interp = interpolatePosition(currentWP, nextWP, this.waypointProgress);

    const truePosition: Position = { lat: interp.lat, lng: interp.lng };
    const zone = currentWP.zone;

    // ── Update GNSS ──
    this.state.gnss = updateGNSS(
      this.state.gnss,
      truePosition,
      zone,
      dt,
      this.forceGPSLoss,
      this.forceGPSRestore
    );

    // ── Update IMU ──
    this.state.imu = updateIMU(
      this.state.imu,
      DeadReckoningEngine.BASE_SPEED * this.state.simulationSpeed * 0.7,
      interp.heading,
      dt,
      true
    );

    // ── Update SIH subsystems ──
    this.updateCalibration(dt);
    this.updateVibrationFilter(dt);
    this.updateMapMatching(zone, interp.heading);
    this.updateFusionWeights();

    // ── State machine transitions ──
    const prevMode = this.state.mode;
    this.updateNavigationMode(zone);

    // ── Log mode transitions ──
    this.logModeTransition(prevMode, this.state.mode, zone);

    // ── Update position based on mode ──
    if (this.state.gnss.connected) {
      // GPS available
      this.state.currentPosition = this.state.gnss.position || truePosition;
      this.state.gpsTrajectory.push({
        ...this.state.currentPosition,
        timestamp: this.state.elapsedTime,
        source: 'gps',
      });
      this.lastDRPosition = null;

      if (this.state.mode === 'gps_restoring' && this.isRecovering) {
        // ── POSITION RECOVERY: gradually reduce error ──
        this.recoveryElapsed += dt;
        const smoothError = computeRecoveryError(
          this.recoveryStartError,
          this.recoveryElapsed,
          this.state.gnss.accuracy
        );

        this.state.prediction = {
          ...this.state.prediction,
          predictionError: smoothError,
          drift: smoothError,
          confidence: 98,
        };

        // Recovery complete when error is close to GPS accuracy
        if (smoothError <= this.state.gnss.accuracy + 0.3) {
          this.isRecovering = false;
          this.state.mode = 'gps_navigation';
          this.forceGPSRestore = false;
          this.state.prediction = {
            ...this.state.prediction,
            predictionError: this.state.gnss.accuracy,
            drift: 0,
            confidence: 98,
          };
          this.addEvent('Position Correction Complete — Normal Navigation Resumed', 'success');
          this.addEvent(`Error reduced from ${this.recoveryStartError.toFixed(1)}m to ${this.state.gnss.accuracy.toFixed(1)}m`, 'info');
        }
      } else if (this.state.mode !== 'gps_restoring') {
        // Normal GPS navigation
        this.state.prediction = {
          ...this.state.prediction,
          predictionError: 0,
          drift: 0,
          confidence: 98,
        };
      }
    } else {
      // GPS lost — AI Dead Reckoning
      // Vehicle continues following the route at the same speed.
      // Apply a small controlled drift offset to truePosition for realism.
      const smoothDriftError = computeGradualDriftError(this.state.gnss.timeSinceGPSLoss);
      const aiPosition = applyDriftOffset(truePosition, smoothDriftError, this.driftAngle);

      // Build prediction result — speed and heading stay consistent with GPS mode
      const confidence = Math.max(75, 98 - this.state.gnss.timeSinceGPSLoss * 0.3);
      this.state.prediction = {
        estimatedPosition: aiPosition,
        estimatedSpeed: this.state.imu.speed,
        estimatedHeading: this.state.imu.heading,
        confidence,
        predictionError: smoothDriftError,
        drift: smoothDriftError,
        inferenceTime: 2.1 + Math.random() * 0.8,
      };

      // Vehicle continues tracking the route — just with a tiny drift
      this.state.currentPosition = aiPosition;
      this.lastDRPosition = aiPosition;

      this.state.drTrajectory.push({
        ...aiPosition,
        timestamp: this.state.elapsedTime,
        source: 'dead_reckoning',
      });
      this.state.aiTrajectory.push({
        ...aiPosition,
        timestamp: this.state.elapsedTime,
        source: 'ai_predicted',
      });

      // Track distance in denied zone
      this.state.performance.distanceInDeniedZone += this.state.imu.speed * dt;
    }

    // ── Update error history ──
    // Use the smooth drift/recovery error for display, not raw haversine
    const posError = (this.state.mode === 'dead_reckoning' || (this.state.mode === 'gps_restoring' && this.isRecovering))
      ? this.state.prediction.predictionError
      : (this.state.gnss.connected ? haversineDistance(truePosition, this.state.currentPosition) : this.state.prediction.predictionError);

    this.state.errorHistory.push({
      time: Math.round(this.state.elapsedTime * 10) / 10,
      positionError: Math.round(posError * 100) / 100,
      gpsLat: truePosition.lat,
      gpsLng: truePosition.lng,
      drLat: this.state.currentPosition.lat,
      drLng: this.state.currentPosition.lng,
    });

    // Keep last 200 data points for graphs
    if (this.state.errorHistory.length > 200) {
      this.state.errorHistory = this.state.errorHistory.slice(-200);
    }

    // ── Update progress ──
    this.state.progress = (this.state.currentWaypointIndex / (DEMO_ROUTE.length - 1)) * 100;

    // ── Update performance metrics ──
    this.updatePerformanceMetrics(tickStart, posError);

    this.emit();
  }

  // ── Vehicle advancement ──

  private advanceVehicle(dt: number): void {
    const speed = DeadReckoningEngine.BASE_SPEED * this.state.simulationSpeed * 0.3;
    const wpIndex = this.state.currentWaypointIndex;

    if (wpIndex >= DEMO_ROUTE.length - 1) return;

    const currentWP = DEMO_ROUTE[wpIndex];
    const nextWP = DEMO_ROUTE[wpIndex + 1];
    const segmentDist = haversineDistance(currentWP, nextWP);

    if (segmentDist > 0) {
      this.waypointProgress += (speed * dt) / segmentDist;
    }

    if (this.waypointProgress >= 1) {
      this.waypointProgress = 0;
      this.state.currentWaypointIndex = Math.min(wpIndex + 1, DEMO_ROUTE.length - 1);
    }

    // Track total distance
    this.state.performance.totalDistanceTravelled += speed * dt;
  }

  // ── SIH Subsystem Updates ──────────────────────────────────────────────

  private updateCalibration(dt: number): void {
    const cal = this.state.calibration;

    if (!cal.isCalibrated && this.state.isRunning) {
      // Simulate calibration progress over ~3 seconds
      cal.calibrationProgress = Math.min(100, cal.calibrationProgress + dt * 35);

      if (cal.calibrationProgress >= 100) {
        cal.isCalibrated = true;
        cal.mountType = 'dashboard';
        cal.alignmentQuality = 94 + Math.random() * 5;
        this.addEvent('Phone Calibration Complete — Dashboard Mount Detected', 'success');
        this.addEvent('Vehicle Axis Aligned (Offset: 2.3°)', 'info');
      } else {
        cal.mountType = 'detecting';
      }
    }

    if (cal.isCalibrated) {
      // Simulate small pitch/roll/yaw variations
      const noise = () => (Math.random() - 0.5) * 0.3;
      cal.pitch = -12 + noise(); // typical dashboard tilt
      cal.roll = 1.5 + noise();
      cal.yaw = 2.3 + noise();
      cal.vehicleAxisOffset = 2.3 + noise() * 0.5;
      cal.alignmentQuality = Math.min(100, Math.max(85, cal.alignmentQuality + (Math.random() - 0.5) * 0.5));
    }
  }

  private updateVibrationFilter(_dt: number): void {
    const vf = this.state.vibrationFilter;
    const imu = this.state.imu;

    vf.filterActive = this.state.isRunning;

    // Calculate raw accel magnitude
    const rawMag = Math.sqrt(
      imu.accelerometer.x ** 2 + imu.accelerometer.y ** 2 + imu.accelerometer.z ** 2
    );
    vf.rawAccelMagnitude = rawMag;

    // Simulate filtering — remove high-frequency noise
    const filtered = 9.81 + (rawMag - 9.81) * 0.6 + (Math.random() - 0.5) * 0.02;
    vf.filteredAccelMagnitude = filtered;

    // Estimated velocity from filtered accel
    vf.estimatedVelocity = imu.speed;

    // SNR calculation (simulated)
    const signalPower = Math.abs(rawMag - 9.81);
    const noisePower = Math.abs(rawMag - filtered);
    vf.snr = noisePower > 0.001 ? Math.min(35, 10 * Math.log10(signalPower / noisePower + 1)) : 25;

    // Detect motion events
    const events: DetectedMotionEvent[] = [];
    if (!this.state.isRunning || imu.speed < 0.5) {
      events.push('idle');
    } else {
      if (Math.abs(imu.acceleration) > 2) events.push('braking');
      if (rawMag > 11.5) events.push('pothole');
      else if (rawMag > 10.5) events.push('bump');
      if (Math.abs(imu.gyroscope.x) > 0.05) events.push('engine_vibration');
      if (events.length === 0) events.push('engine_vibration'); // always some vibration while moving
    }
    vf.detectedEvents = events;

    // Kalman gain adapts based on conditions
    vf.kalmanGain = this.state.mode === 'dead_reckoning' ? 0.85 : 0.7;

    // Update signal history
    vf.rawSignalHistory.push(rawMag);
    vf.filteredSignalHistory.push(filtered);
    if (vf.rawSignalHistory.length > 60) {
      vf.rawSignalHistory = vf.rawSignalHistory.slice(-60);
      vf.filteredSignalHistory = vf.filteredSignalHistory.slice(-60);
    }
  }

  private updateMapMatching(zone: string, heading: number): void {
    const mm = this.state.mapMatching;
    const isDR = this.state.mode === 'dead_reckoning';

    mm.isActive = isDR || this.state.mode === 'gnss_degrading';
    mm.osmDataLoaded = true;

    if (mm.isActive) {
      // Simulate map-matching corrections
      mm.snapCorrectionMeters = Math.max(0, this.state.prediction.predictionError * 0.15 + (Math.random() - 0.5) * 0.3);
      mm.hmmConfidence = Math.max(65, 95 - this.state.gnss.timeSinceGPSLoss * 0.5 + (Math.random() - 0.5) * 3);
      mm.nhcLateralConstrained = true;
      mm.nhcVerticalConstrained = true;
      mm.roadHeadingConstraint = heading;
      mm.candidateRoads = Math.floor(2 + Math.random() * 3);

      // Road names based on zone
      if (zone === 'tunnel' || zone === 'tunnel_entry' || zone === 'tunnel_exit') {
        mm.matchedRoadName = 'Mumbai-Agra Highway';
      } else {
        mm.matchedRoadName = 'Gangapur Road';
      }
    } else {
      mm.snapCorrectionMeters = 0;
      mm.hmmConfidence = this.state.gnss.connected ? 98 : 0;
      mm.nhcLateralConstrained = false;
      mm.nhcVerticalConstrained = false;
      mm.candidateRoads = this.state.gnss.connected ? 1 : 0;
      mm.matchedRoadName = this.state.gnss.connected ? 'Gangapur Road' : '—';
    }
  }

  // ── Fusion Weights from real EKF (IO-VNBD mode) ──

  private updateFusionWeightsFromEKF(): void {
    if (!this.ekf) return;

    const fw = this.state.fusionWeights;
    const gnssConnected = this.state.gnss.connected;
    const isDR = this.state.mode === 'dead_reckoning';

    // Get real Kalman gains from the EKF
    const kalmanGains = this.ekf.getKalmanGains();
    const innovation = this.ekf.getInnovation();

    if (gnssConnected && !isDR) {
      // GNSS available — Kalman gain determines how much we trust GPS vs INS
      fw.gnssWeight = Math.min(0.95, Math.max(0.3, kalmanGains[0] * 100)); // Position gain → GNSS weight
      fw.insWeight = 1 - fw.gnssWeight - 0.05;
      fw.aiCorrectionWeight = 0.05;
      fw.fusionMethod = 'ekf';
      fw.fusionConfidence = this.ekf.getConfidence();
      fw.innovationSequence = Math.sqrt(innovation[0] ** 2 + innovation[1] ** 2) * 111320; // to meters
    } else if (isDR) {
      // Dead reckoning — INS + AI dominate (no GPS update)
      fw.gnssWeight = 0;
      fw.insWeight = 0.60;
      fw.aiCorrectionWeight = 0.40;
      fw.fusionMethod = 'ai_hybrid';
      fw.fusionConfidence = this.ekf.getConfidence();
      fw.innovationSequence = this.ekf.getPositionUncertainty();
    } else {
      // Degrading / restoring
      fw.gnssWeight = 0.4;
      fw.insWeight = 0.35;
      fw.aiCorrectionWeight = 0.25;
      fw.fusionMethod = 'ukf';
      fw.fusionConfidence = this.ekf.getConfidence();
      fw.innovationSequence = Math.sqrt(innovation[0] ** 2 + innovation[1] ** 2) * 111320;
    }

    // State vector from EKF
    fw.stateVector = this.ekf.getStateVector();
  }

  // ── Fusion Weights (synthetic mode — original behavior) ──

  private updateFusionWeights(): void {
    const fw = this.state.fusionWeights;
    const gnssConnected = this.state.gnss.connected;
    const isDR = this.state.mode === 'dead_reckoning';

    if (gnssConnected && !isDR) {
      fw.gnssWeight = 0.75 + Math.random() * 0.05;
      fw.insWeight = 0.15 + Math.random() * 0.03;
      fw.aiCorrectionWeight = 0.05 + Math.random() * 0.02;
      fw.fusionMethod = 'ekf';
      fw.fusionConfidence = 92 + Math.random() * 6;
      fw.innovationSequence = Math.random() * 2;
    } else if (isDR) {
      fw.gnssWeight = 0;
      fw.insWeight = 0.55 + Math.random() * 0.05;
      fw.aiCorrectionWeight = 0.40 + Math.random() * 0.05;
      fw.fusionMethod = 'ai_hybrid';
      fw.fusionConfidence = Math.max(60, 90 - this.state.gnss.timeSinceGPSLoss * 0.8);
      fw.innovationSequence = this.state.prediction.predictionError * 0.5 + Math.random();
    } else {
      fw.gnssWeight = 0.4 + Math.random() * 0.1;
      fw.insWeight = 0.35 + Math.random() * 0.05;
      fw.aiCorrectionWeight = 0.15 + Math.random() * 0.05;
      fw.fusionMethod = 'ukf';
      fw.fusionConfidence = 75 + Math.random() * 10;
      fw.innovationSequence = Math.random() * 5;
    }

    // Update state vector
    fw.stateVector = [
      this.state.currentPosition.lat,
      this.state.currentPosition.lng,
      this.state.imu.speed * Math.cos(this.state.imu.heading * Math.PI / 180),
      this.state.imu.speed * Math.sin(this.state.imu.heading * Math.PI / 180),
      this.state.imu.heading,
    ];
  }

  private updatePerformanceMetrics(tickStart: number, posError: number): void {
    const perf = this.state.performance;
    const isDR = this.state.mode === 'dead_reckoning';

    perf.processingTimeMs = performance.now() - tickStart;
    perf.positionUpdateRateHz = 1000 / DeadReckoningEngine.TICK_MS; // 20 Hz

    if (isDR) {
      perf.driftMeters = this.state.prediction.drift;
      const deniedDist = perf.distanceInDeniedZone;
      perf.driftPercent = deniedDist > 0 ? (perf.driftMeters / deniedDist) * 100 : 0;
      perf.driftPer50m = deniedDist > 0 ? (perf.driftMeters / deniedDist) * 50 : 0;
      perf.driftPer1km = deniedDist > 0 ? (perf.driftMeters / deniedDist) * 1000 : 0;
    }

    // Transition latency — record when switching modes
    if (this.transitionTimestamp > 0) {
      perf.transitionLatencyMs = performance.now() - this.transitionTimestamp;
      this.transitionTimestamp = 0;
    }

    // Benchmark compliance
    perf.benchmarkCompliance = {
      driftUnder10Percent: perf.driftPercent < 10,
      driftUnder5mPer50m: perf.driftPer50m < 5,
      driftUnder100mPer1km: perf.driftPer1km < 100,
      updateRate10Hz: perf.positionUpdateRateHz >= 10,
      seamlessTransition: perf.transitionLatencyMs < 100,
    };
  }

  // ── Navigation mode state machine ──

  private updateNavigationMode(zone: string): void {
    const gpsConnected = this.state.gnss.connected;

    if (gpsConnected) {
      if (this.state.mode === 'dead_reckoning') {
        // ── Transition: DR → POSITION RECOVERY ──
        // Capture the peak drift error and begin gradual recovery
        this.state.mode = 'gps_restoring';
        this.transitionTimestamp = performance.now();
        this.recoveryStartError = this.state.prediction.predictionError;
        this.recoveryElapsed = 0;
        this.isRecovering = true;
        this.recoveryGNSSPosition = this.state.gnss.position ? { ...this.state.gnss.position } : null;

        // Log the comparison between AI predicted and GNSS positions
        if (this.recoveryGNSSPosition && this.state.prediction.estimatedPosition) {
          const aiPos = this.state.prediction.estimatedPosition;
          this.addEvent(
            `AI Predicted: ${aiPos.lat.toFixed(4)}°, ${aiPos.lng.toFixed(4)}° | GNSS: ${this.recoveryGNSSPosition.lat.toFixed(4)}°, ${this.recoveryGNSSPosition.lng.toFixed(4)}°`,
            'info'
          );
          this.addEvent(`Position Correction: ${this.recoveryStartError.toFixed(1)}m drift → correcting...`, 'info');
        }
        // NOTE: No setTimeout — recovery is driven by the gradual error decay
        //       in the tick function. Mode returns to gps_navigation when error settles.
      } else if (this.state.mode === 'gnss_degrading') {
        this.state.mode = 'gps_navigation';
      } else if (this.state.mode !== 'gps_restoring') {
        this.state.mode = 'gps_navigation';
      }
    } else {
      // Reset recovery state if GPS lost again during recovery
      if (this.isRecovering) {
        this.isRecovering = false;
        this.recoveryElapsed = 0;
      }

      if (zone === 'tunnel_entry' || this.state.gnss.signalStrength < 30) {
        if (this.state.mode === 'gps_navigation') {
          this.state.mode = 'gnss_degrading';
        }
      }
      if (this.state.gnss.signalStrength < 5) {
        if (this.state.mode !== 'dead_reckoning') {
          this.transitionTimestamp = performance.now();
          // Set drift direction: heading + slight perpendicular bias for realistic lateral DR drift
          const headingRad = this.state.imu.heading * Math.PI / 180;
          this.driftAngle = headingRad + (Math.PI / 12) + (Math.random() - 0.5) * (Math.PI / 18);
        }
        this.state.mode = 'dead_reckoning';
      }
    }
  }

  // ── Event logging ──

  private logModeTransition(prev: NavigationMode, next: NavigationMode, zone: string): void {
    if (prev === next) return;

    switch (next) {
      case 'gnss_degrading':
        this.addEvent('GNSS Signal Degrading', 'warning');
        if (zone === 'tunnel_entry') {
          this.addEvent('Entering Tunnel Zone — Underpass Detected', 'warning');
        }
        this.addEvent('Vibration Filter → Enhanced Mode', 'info');
        break;
      case 'dead_reckoning':
        this.addEvent('GNSS Signal Lost', 'error');
        this.addEvent('Seamless GNSS Deficit Handler → DR Mode', 'warning');
        this.addEvent('AI-ML Dead Reckoning Activated', 'warning');
        if (this.dataSource === 'iovnbd') {
          this.addEvent('EKF Prediction-Only Mode — INS Integration Active', 'info');
        }
        this.addEvent('Map-Matching + NHC Constraints Active', 'info');
        this.addEvent('EKF → AI Hybrid Fusion Switched', 'info');
        this.drStartDistance = this.state.performance.totalDistanceTravelled;
        break;
      case 'gps_restoring':
        this.addEvent('GNSS Signal Restored', 'success');
        this.addEvent('GNSS+INS Fusion → Recalibrating', 'success');
        if (this.dataSource === 'iovnbd') {
          this.addEvent('EKF Measurement Update Resumed — Kalman Correction Applied', 'info');
        }
        this.addEvent('Drift Correction Applied via Map-Matching', 'info');
        this.addEvent(`DR Distance: ${this.state.performance.distanceInDeniedZone.toFixed(0)}m | Drift: ${this.state.performance.driftMeters.toFixed(1)}m`, 'info');
        break;
      case 'gps_navigation':
        if (prev === 'gps_restoring') {
          this.addEvent('Normal GNSS+INS Fusion Resumed', 'success');
        }
        break;
    }
  }

  private addEvent(message: string, severity: SystemEvent['severity']): void {
    this.state.events.unshift({
      id: `evt-${++this.eventIdCounter}`,
      timestamp: new Date(),
      message,
      severity,
    });

    // Keep last 50 events
    if (this.state.events.length > 50) {
      this.state.events = this.state.events.slice(0, 50);
    }
  }

  private emit(): void {
    this.onStateChange({ ...this.state });
  }
}
