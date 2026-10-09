/**
 * @file app/api/telemetry/route.ts
 * @description Next.js 14 App Router route handler for live telemetry ingestion
 *              from the ESP32 hardware node.
 *
 * Endpoints
 * ─────────
 *   POST  /api/telemetry        – Ingest one sensor payload, returns buzzer command.
 *   GET   /api/telemetry        – Poll current snapshot + full reading history.
 *   PATCH /api/telemetry        – Update ETA or shipment metadata.
 *
 * Buzzer Protocol
 * ───────────────
 *   Every POST response includes a `buzzer_active` boolean field.
 *   The ESP32 reads this on every cycle and activates / deactivates its
 *   buzzer pin accordingly. The dashboard can silence it via
 *   POST /api/buzzer { "action": "silence" }.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  addReading,
  getStore,
  resetStore,
  setEta,
  setShipmentMeta,
  type TelemetryReading,
} from "@/lib/store";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a valid ESP32 JSON payload. */
interface RawPayload {
  device_id?: unknown;
  timestamp?: unknown;
  temperature?: unknown;
  humidity?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  speed_kmh?: unknown;
}

/** A structured validation error. */
interface ValidationError {
  field: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce and validate a raw JSON payload into a {@link TelemetryReading}.
 *
 * - `device_id` and `timestamp` are hard-required.
 * - All numeric sensor fields fall back gracefully so a single bad sensor
 *   reading does not block the entire ingestion pipeline.
 */
function validatePayload(raw: RawPayload): {
  reading: TelemetryReading | null;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // ── Required: device_id ────────────────────────────────────────────────────
  const device_id =
    typeof raw.device_id === "string" && raw.device_id.trim().length > 0
      ? raw.device_id.trim()
      : null;
  if (!device_id) {
    errors.push({ field: "device_id", message: "Must be a non-empty string." });
  }

  // ── Timestamp (use provided valid epoch, or fallback to server time) ──────
  let timestamp = Number(raw.timestamp);
  if (!raw.timestamp || isNaN(timestamp) || timestamp < 1700000000) {
    timestamp = Math.floor(Date.now() / 1000);
  }

  // ── Optional numerics — fall back gracefully on NaN ────────────────────────
  function safeNum(
    value: unknown,
    fallback: number,
    field: string,
    min?: number,
    max?: number
  ): number {
    const n = Number(value);
    if (value === undefined || value === null || isNaN(n)) {
      errors.push({
        field,
        message: `Missing or NaN — using fallback value ${fallback}.`,
      });
      return fallback;
    }
    if (min !== undefined && n < min) {
      errors.push({ field, message: `Value ${n} is below minimum ${min}.` });
      return fallback;
    }
    if (max !== undefined && n > max) {
      errors.push({ field, message: `Value ${n} exceeds maximum ${max}.` });
      return fallback;
    }
    return n;
  }

  const temperature = safeNum(raw.temperature, 25.0, "temperature", -80, 100);
  const humidity    = safeNum(raw.humidity,    50.0, "humidity",    0,   100);
  const latitude    = safeNum(raw.latitude,     0.0, "latitude",   -90,   90);
  const longitude   = safeNum(raw.longitude,    0.0, "longitude", -180,  180);
  const speed_kmh   = safeNum(raw.speed_kmh,    0.0, "speed_kmh",   0,  300);

  if (!device_id) {
    return { reading: null, errors };
  }

  const reading: TelemetryReading = {
    device_id,
    timestamp,
    temperature,
    humidity,
    latitude,
    longitude,
    speed_kmh,
  };

  return { reading, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/telemetry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ingest a single telemetry payload from the ESP32.
 *
 * Happy-path response (HTTP 200):
 * ```json
 * {
 *   "success": true,
 *   "snapshot": { ... },
 *   "buzzer_active": false,
 *   "warnings": []
 * }
 * ```
 *
 * The ESP32 MUST read `buzzer_active` on every response and drive its
 * physical buzzer pin HIGH when it is true, LOW when false.
 *
 * Validation failure (HTTP 422):
 * ```json
 * { "success": false, "errors": [ { "field": "...", "message": "..." } ] }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: RawPayload;
  try {
    raw = (await request.json()) as RawPayload;
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "Invalid JSON." }] },
      { status: 400 }
    );
  }

  const { reading, errors: hardErrors } = validatePayload(raw);

  if (!reading) {
    return NextResponse.json(
      { success: false, errors: hardErrors },
      { status: 422 }
    );
  }

  const warnings = hardErrors;

  addReading(reading);
  const store = getStore();

  return NextResponse.json(
    {
      success: true,
      snapshot: store.currentSnapshot,
      // This boolean is the command the ESP32 waits for on every cycle.
      buzzer_active: store.buzzerActive,
      warnings,
    },
    { status: 200 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/telemetry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return the full dashboard state for the UI polling loop.
 *
 * Response (HTTP 200):
 * ```json
 * {
 *   "snapshot": { ... } | null,
 *   "history":  [ ... ],
 *   "meta":     { "id": "...", "name": "...", ... },
 *   "eta_hours": 2.5,
 *   "buzzer_active": false,
 *   "is_connected": true
 * }
 * ```
 */
export async function GET(): Promise<NextResponse> {
  const store = getStore();

  // Consider the device connected if a reading arrived in the last 5 seconds
  const lastTs = store.readings.length > 0
    ? store.readings[store.readings.length - 1]!.timestamp
    : 0;
  const nowS = Math.floor(Date.now() / 1000);
  const is_connected = (nowS - lastTs) <= 5;

  const body = {
    snapshot:     store.currentSnapshot,
    history:      store.readings,
    meta:         store.shipmentMeta,
    eta_hours:    store.destinationEtaHours,
    buzzer_active: store.buzzerActive,
    is_connected,
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/telemetry  (update ETA and/or shipment metadata)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update ETA and/or shipment metadata.
 *
 * Accepted body fields (all optional):
 * ```json
 * {
 *   "eta_hours": 3.0,
 *   "meta": { "id": "...", "name": "...", "origin": "...", "destination": "..." }
 * }
 * ```
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    if (typeof body.eta_hours === "number") {
      const hours = Number(body.eta_hours);
      if (isNaN(hours) || hours < 0) {
        return NextResponse.json(
          { success: false, error: "ETA must be a non-negative number." },
          { status: 400 }
        );
      }
      setEta(hours);
    }

    if (body.meta && typeof body.meta === "object") {
      setShipmentMeta(body.meta);
    }

    const store = getStore();
    return NextResponse.json({
      success:   true,
      eta_hours: store.destinationEtaHours,
      meta:      store.shipmentMeta,
      snapshot:  store.currentSnapshot,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/telemetry  (reset session / clear reading history)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wipe all readings and reset the store to initial state.
 * Useful when starting a new shipment run or resetting hardware tests.
 */
export async function DELETE(): Promise<NextResponse> {
  resetStore();
  const store = getStore();
  return NextResponse.json({
    success: true,
    message: "Store reset successfully.",
    snapshot: store.currentSnapshot,
    history: store.readings,
    meta: store.shipmentMeta,
  });
}
