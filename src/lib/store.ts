/**
 * @file lib/store.ts
 * @description Singleton in-memory state store for the Cold Chain Dashboard.
 *
 * In Next.js App Router (Node.js runtime), module-level variables persist for
 * the lifetime of the server process, giving us a lightweight in-process store
 * that survives across multiple requests without an external database.
 *
 * Architecture note:
 *   - This module is imported by API route handlers.
 *   - All mutations are synchronous to avoid race conditions on single-threaded Node.js.
 *   - For production use, replace with Redis / a time-series DB.
 */

import {
  type TemperatureReading,
  type ColdChainSnapshot,
  computeColdChainSnapshot,
  V_BASELINE,
  V_THRESHOLD,
} from "@/lib/kinetics";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Raw telemetry payload emitted by the ESP32 sensor node. */
export interface TelemetryReading {
  /** Hardware device identifier */
  device_id: string;
  /** Unix timestamp at the moment of measurement  [s] */
  timestamp: number;
  /** Measured temperature  [°C] */
  temperature: number;
  /** Relative humidity  [%] */
  humidity: number;
  /** GPS latitude  [decimal degrees] */
  latitude: number;
  /** GPS longitude  [decimal degrees] */
  longitude: number;
  /** Vehicle speed at time of reading  [km/h] */
  speed_kmh: number;
}

/** Persistent metadata describing the current shipment. */
export interface ShipmentMeta {
  id: string;
  name: string;
  origin: string;
  destination: string;
  destinationLat?: number;
  destinationLng?: number;
  routeDistanceKm?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routeGeometry?: any;
}

/** Full shape of the singleton store. */
export interface StoreState {
  /**
   * Circular FIFO queue of the last MAX_READINGS raw telemetry points.
   * Oldest entry is evicted when the queue exceeds MAX_READINGS.
   */
  readings: TelemetryReading[];
  /**
   * Latest kinetic snapshot — recomputed on every `addReading` call.
   * Null only before the first reading arrives.
   */
  currentSnapshot: ColdChainSnapshot | null;
  /** Remaining transit time to the delivery destination  [hr] */
  destinationEtaHours: number;
  /** Static metadata about the active shipment */
  shipmentMeta: ShipmentMeta;
  /**
   * Buzzer state — when true, the server will tell the ESP32 to activate
   * the physical buzzer on its next data exchange.
   */
  buzzerActive: boolean;
  /**
   * Whether the buzzer was manually silenced by the dashboard operator.
   * If true, the server will NOT re-activate it even if conditions warrant it,
   * until conditions return to nominal or the operator re-arms it.
   */
  buzzerSilenced: boolean;
  /**
   * Manual override test mode (null = normal auto logic, true = test on, false = test off).
   */
  buzzerManualOverride?: boolean | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of raw readings retained in memory. */
const MAX_READINGS = 600; // ~10 minutes at 1 reading/second

/** Default ETA when the store is first initialised  [hr] */
const DEFAULT_ETA_HOURS = 2.5;

/**
 * Time-to-spoil threshold that triggers the buzzer alert  [hr]
 * If the vaccine is projected to become unviable within this window,
 * the server will command the ESP32 to activate its buzzer.
 */
export const BUZZER_ALERT_THRESHOLD_HOURS = 1.0; // 1 hour alert window

/** Default shipment metadata — to be updated via the API when a shipment starts. */
const DEFAULT_META: ShipmentMeta = {
  id: "COV-902",
  name: "Active Vaccine Transit",
  origin: "Cold Hub, Pune",
  destination: "District Hospital, Mumbai",
  destinationLat: 18.9822,
  destinationLng: 72.8335,
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON STATE
// ─────────────────────────────────────────────────────────────────────────────

let _state: StoreState = createInitialState();

/** Build a clean initial state object. */
function createInitialState(): StoreState {
  return {
    readings: [],
    currentSnapshot: null,
    destinationEtaHours: DEFAULT_ETA_HOURS,
    shipmentMeta: { ...DEFAULT_META },
    buzzerActive: false,
    buzzerSilenced: false,
    buzzerManualOverride: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Project all stored telemetry readings into the {@link TemperatureReading}
 * shape expected by `lib/kinetics.ts`.
 */
function toKineticsReadings(readings: TelemetryReading[]): TemperatureReading[] {
  return [...readings]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      timestamp_unix_s: r.timestamp,
      temperature_celsius: r.temperature,
    }));
}

/**
 * Recompute and persist the kinetic snapshot from the current readings array.
 * Also evaluates the buzzer alert threshold after each recomputation.
 */
function recomputeSnapshot(): void {
  if (_state.readings.length === 0) return;

  const kineticsReadings = toKineticsReadings(_state.readings);
  _state.currentSnapshot = computeColdChainSnapshot(
    kineticsReadings,
    _state.destinationEtaHours
  );

  const latest = _state.readings[_state.readings.length - 1];
  const currentTemp = latest?.temperature ?? 4.0;

  // Thermal excursion: outside WHO 2°C – 8°C cold chain envelope
  const isThermalExcursion = currentTemp > 8.0 || currentTemp < 2.0;

  // Spoilage risk: time-to-spoil is shorter than transit ETA, or under threshold window
  const tts = _state.currentSnapshot.time_to_spoil_hours;
  const isSpoilRisk = tts <= _state.destinationEtaHours || tts <= BUZZER_ALERT_THRESHOLD_HOURS;

  // Status check: any non-nominal status is an alert
  const isStatusAlert = _state.currentSnapshot.evaluation.status !== "NOMINAL";

  const isAlarmTriggered = isThermalExcursion || isSpoilRisk || isStatusAlert;

  if (!isAlarmTriggered) {
    // If all safe & nominal, auto-reset the silence latch and silence buzzer
    _state.buzzerSilenced = false;
    _state.buzzerActive = false;
  } else {
    // Breach is active: sound buzzer unless manually silenced by operator
    if (!_state.buzzerSilenced) {
      _state.buzzerActive = true;
    } else {
      _state.buzzerActive = false;
    }
  }

  // Operator manual override takes absolute precedence if set
  if (_state.buzzerManualOverride === true) {
    _state.buzzerActive = true;
  } else if (_state.buzzerManualOverride === false) {
    _state.buzzerActive = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a new telemetry reading to the store.
 *
 * - Appends the reading to the FIFO queue (evicts oldest if queue is full).
 * - Immediately recomputes the kinetic snapshot.
 *
 * @param reading  Validated telemetry payload from the ESP32.
 */
export function addReading(reading: TelemetryReading): void {
  if (_state.readings.length >= MAX_READINGS) {
    _state.readings.shift();
  }
  _state.readings.push(reading);
  recomputeSnapshot();
}

/**
 * Return a shallow copy of the current store state.
 */
export function getStore(): Readonly<StoreState> {
  return _state;
}

/**
 * Wipe all readings and reset the store to its initial state.
 */
export function resetStore(): void {
  _state = createInitialState();
}

/**
 * Update the remaining ETA and immediately recompute the snapshot.
 *
 * @param hours  New ETA  [hr]  Must be >= 0.
 */
export function setEta(hours: number): void {
  if (hours < 0) {
    throw new RangeError(`ETA must be >= 0. Got ${hours} hr.`);
  }
  _state.destinationEtaHours = hours;
  recomputeSnapshot();
}

/**
 * Update shipment metadata (name, origin, destination, id, coordinates).
 */
export function setShipmentMeta(meta: Partial<ShipmentMeta>): void {
  _state.shipmentMeta = { ..._state.shipmentMeta, ...meta };
  recomputeSnapshot();
}

/**
 * Silence the buzzer from the dashboard.
 * Sets buzzerActive to false and buzzerSilenced to true so it won't
 * re-trigger until manual re-arm or conditions return to safe.
 */
export function silenceBuzzer(): void {
  _state.buzzerActive = false;
  _state.buzzerSilenced = true;
  _state.buzzerManualOverride = null;
}

/**
 * Re-arm the buzzer (clears the silenced flag so future or existing
 * threshold breaches immediately trigger it again).
 */
export function rearmBuzzer(): void {
  _state.buzzerSilenced = false;
  _state.buzzerManualOverride = null;
  recomputeSnapshot();
}

/**
 * Test buzzer manually from the dashboard.
 */
export function testBuzzer(): void {
  _state.buzzerManualOverride = true;
  _state.buzzerActive = true;
}

/**
 * Clear manual test override.
 */
export function clearManualOverride(): void {
  _state.buzzerManualOverride = null;
  recomputeSnapshot();
}

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS FOR CONVENIENCE
// ─────────────────────────────────────────────────────────────────────────────

export { V_BASELINE, V_THRESHOLD };
