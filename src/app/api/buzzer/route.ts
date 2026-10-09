/**
 * @file app/api/buzzer/route.ts
 * @description API endpoint to control the ESP32 buzzer state from the dashboard.
 *
 * The ESP32 checks `buzzer_active` in every POST /api/telemetry response.
 * This endpoint lets the dashboard operator override that state.
 *
 * Endpoints
 * ─────────
 *   POST /api/buzzer   – Silence or re-arm the buzzer.
 *
 * Accepted body:
 * ```json
 * { "action": "silence" | "rearm" }
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import {
  silenceBuzzer,
  rearmBuzzer,
  testBuzzer,
  clearManualOverride,
  getStore,
} from "@/lib/store";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (body.action === "silence") {
    silenceBuzzer();
  } else if (body.action === "rearm") {
    rearmBuzzer();
  } else if (body.action === "test") {
    testBuzzer();
  } else if (body.action === "stop_test") {
    clearManualOverride();
  } else {
    return NextResponse.json(
      {
        success: false,
        error: 'action must be "silence", "rearm", "test", or "stop_test".',
      },
      { status: 422 }
    );
  }

  const store = getStore();
  return NextResponse.json({
    success: true,
    action: body.action,
    buzzer_active: store.buzzerActive,
    buzzer_silenced: store.buzzerSilenced,
  });
}

export async function GET(): Promise<NextResponse> {
  const store = getStore();
  return NextResponse.json({
    buzzer_active:   store.buzzerActive,
    buzzer_silenced: store.buzzerSilenced,
  });
}
