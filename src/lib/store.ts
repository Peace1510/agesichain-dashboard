/**
 * @file lib/store.ts
 * @description Singleton in-memory state store for the Cold Chain Dashboard with
 *              PostgreSQL session management and telemetry archival integration.
 */

import {
  type TemperatureReading,
  type ColdChainSnapshot,
  computeColdChainSnapshot,
  V_BASELINE,
  V_THRESHOLD,
} from "@/lib/kinetics";
import { prisma } from "@/lib/prisma";

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

/** Active transit session data stored in runtime memory. */
export interface ActiveSessionInfo {
  id: string;
  sessionCode: string;
  vaccineName: string;
  vaccineTier: "STANDARD_REFRIGERATED" | "FROZEN" | "ULTRA_COLD";
  minTemp: number;
  maxTemp: number;
  targetTemp?: number | null;
  transportEquip?: string | null;
  batchNumber?: string | null;
  origin: string;
  destination: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  etaHours: number;
  startedAt: string;
  totalReadings: number;
  excursionCount: number;
  minRecordedTemp?: number | null;
  maxRecordedTemp?: number | null;
  sumTemp?: number;
}

/** Full shape of the singleton store. */
export interface StoreState {
  readings: TelemetryReading[];
  currentSnapshot: ColdChainSnapshot | null;
  destinationEtaHours: number;
  shipmentMeta: ShipmentMeta;
  buzzerActive: boolean;
  buzzerSilenced: boolean;
  buzzerManualOverride?: boolean | null;
  activeSession: ActiveSessionInfo | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum number of raw readings retained in FIFO buffer. */
const MAX_READINGS = 600; // ~10 minutes at 1 reading/second

/** Default ETA when the store is first initialised [hr] */
const DEFAULT_ETA_HOURS = 2.5;

/** Time-to-spoil threshold that triggers the buzzer alert [hr] */
export const BUZZER_ALERT_THRESHOLD_HOURS = 1.0;

/** Default shipment metadata */
const DEFAULT_META: ShipmentMeta = {
  id: "—",
  name: "No Active Session",
  origin: "—",
  destination: "—",
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
    activeSession: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function toKineticsReadings(readings: TelemetryReading[]): TemperatureReading[] {
  return [...readings]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((r) => ({
      timestamp_unix_s: r.timestamp,
      temperature_celsius: r.temperature,
    }));
}

function recomputeSnapshot(): void {
  if (_state.readings.length === 0) return;

  const kineticsReadings = toKineticsReadings(_state.readings);
  const session = _state.activeSession;

  const options = session
    ? {
        min_temp_celsius: session.minTemp,
        max_temp_celsius: session.maxTemp,
        freeze_limit_celsius: session.vaccineTier === "STANDARD_REFRIGERATED" ? 0.0 : undefined,
      }
    : undefined;

  _state.currentSnapshot = computeColdChainSnapshot(
    kineticsReadings,
    _state.destinationEtaHours,
    options
  );

  const latest = _state.readings[_state.readings.length - 1];
  const currentTemp = latest?.temperature ?? 4.0;

  const minAllowed = session ? session.minTemp : 2.0;
  const maxAllowed = session ? session.maxTemp : 8.0;

  // Thermal excursion: outside the allowed temperature range
  const isThermalExcursion = currentTemp > maxAllowed || currentTemp < minAllowed;

  // Spoilage risk: time-to-spoil is shorter than transit ETA, or under threshold window
  const tts = _state.currentSnapshot.time_to_spoil_hours;
  const isSpoilRisk = tts <= _state.destinationEtaHours || tts <= BUZZER_ALERT_THRESHOLD_HOURS;

  // Status check: non-nominal
  const isStatusAlert = _state.currentSnapshot.evaluation.status !== "NOMINAL";

  const isAlarmTriggered = isThermalExcursion || isSpoilRisk || isStatusAlert;

  if (!isAlarmTriggered) {
    _state.buzzerSilenced = false;
    _state.buzzerActive = false;
  } else {
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
 * - Appends to FIFO queue
 * - Recomputes kinetic snapshot
 * - If session is active, updates session stats and persists log to PostgreSQL
 */
export function addReading(reading: TelemetryReading): void {
  if (_state.readings.length >= MAX_READINGS) {
    _state.readings.shift();
  }
  _state.readings.push(reading);
  recomputeSnapshot();

  // If an active session is running, track stats and archive to database
  if (_state.activeSession) {
    const s = _state.activeSession;
    s.totalReadings += 1;
    s.sumTemp = (s.sumTemp ?? 0) + reading.temperature;

    if (s.minRecordedTemp === undefined || s.minRecordedTemp === null || reading.temperature < s.minRecordedTemp) {
      s.minRecordedTemp = reading.temperature;
    }
    if (s.maxRecordedTemp === undefined || s.maxRecordedTemp === null || reading.temperature > s.maxRecordedTemp) {
      s.maxRecordedTemp = reading.temperature;
    }

    const isExcursion = reading.temperature < s.minTemp || reading.temperature > s.maxTemp;
    if (isExcursion) {
      s.excursionCount += 1;
    }

    // Asynchronously insert log into database without blocking the response
    prisma.telemetryLog
      .create({
        data: {
          sessionId: s.id,
          deviceId: reading.device_id,
          timestamp: new Date(reading.timestamp * 1000),
          temperature: reading.temperature,
          humidity: reading.humidity,
          latitude: reading.latitude,
          longitude: reading.longitude,
          speedKmh: reading.speed_kmh,
          viability: _state.currentSnapshot?.cumulative_viability ?? null,
          isExcursion,
        },
      })
      .catch((err) => {
        // Silently catch to prevent telemetry interruption if DB connection is intermittent
        console.warn("[Store] Database telemetry log insert failed:", err?.message);
      });
  }
}

/** Return current in-memory store state. */
export function getStore(): Readonly<StoreState> {
  return _state;
}

/** Reset in-memory store to clean initial state. */
export function resetStore(): void {
  _state = createInitialState();
}

/** Get active transit session info. */
export function getActiveSession(): ActiveSessionInfo | null {
  return _state.activeSession;
}

/** Set active transit session in memory and configure shipment meta. */
export function setActiveSession(session: ActiveSessionInfo): void {
  _state.activeSession = { ...session };
  _state.readings = []; // Reset readings for the new voyage
  _state.currentSnapshot = null;
  _state.destinationEtaHours = session.etaHours;
  _state.shipmentMeta = {
    id: session.sessionCode,
    name: session.vaccineName,
    origin: session.origin,
    destination: session.destination,
    destinationLat: session.destinationLat ?? undefined,
    destinationLng: session.destinationLng ?? undefined,
  };
  _state.buzzerSilenced = false;
  _state.buzzerActive = false;
  _state.buzzerManualOverride = null;
}

/** End the active transit session and clear from store. */
export function endActiveSession(): ActiveSessionInfo | null {
  const current = _state.activeSession;
  _state.activeSession = null;
  _state.shipmentMeta = { ...DEFAULT_META };
  return current;
}

/** Update remaining transit ETA. */
export function setEta(hours: number): void {
  if (hours < 0) {
    throw new RangeError(`ETA must be >= 0. Got ${hours} hr.`);
  }
  _state.destinationEtaHours = hours;
  if (_state.activeSession) {
    _state.activeSession.etaHours = hours;
  }
  recomputeSnapshot();
}

/** Update shipment metadata. */
export function setShipmentMeta(meta: Partial<ShipmentMeta>): void {
  _state.shipmentMeta = { ..._state.shipmentMeta, ...meta };
  recomputeSnapshot();
}

/** Silence buzzer. */
export function silenceBuzzer(): void {
  _state.buzzerActive = false;
  _state.buzzerSilenced = true;
  _state.buzzerManualOverride = null;
}

/** Re-arm buzzer. */
export function rearmBuzzer(): void {
  _state.buzzerSilenced = false;
  _state.buzzerManualOverride = null;
  recomputeSnapshot();
}

/** Test buzzer. */
export function testBuzzer(): void {
  _state.buzzerManualOverride = true;
  _state.buzzerActive = true;
}

/** Clear test override. */
export function clearManualOverride(): void {
  _state.buzzerManualOverride = null;
  recomputeSnapshot();
}

export { V_BASELINE, V_THRESHOLD };
