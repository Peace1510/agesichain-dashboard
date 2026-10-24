import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession, endActiveSession, getStore, setActiveSession } from "@/lib/store";
import type { VaccineTierType } from "@/lib/vaccineTiers";

/**
 * GET /api/sessions/active
 * Retrieve current active transit session.
 */
export async function GET(): Promise<NextResponse> {
  try {
    let active = getActiveSession();

    // If store memory is cold (e.g. after server restart), check DB for currently ACTIVE session
    if (!active) {
      const dbActive = await prisma.transitSession.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
      });

      if (dbActive) {
        active = {
          id: dbActive.id,
          sessionCode: dbActive.sessionCode,
          vaccineName: dbActive.vaccineName,
          vaccineTier: dbActive.vaccineTier as VaccineTierType,
          minTemp: dbActive.minTemp,
          maxTemp: dbActive.maxTemp,
          targetTemp: dbActive.targetTemp,
          transportEquip: dbActive.transportEquip,
          batchNumber: dbActive.batchNumber,
          origin: dbActive.origin,
          destination: dbActive.destination,
          destinationLat: dbActive.destinationLat,
          destinationLng: dbActive.destinationLng,
          etaHours: dbActive.etaHours,
          startedAt: dbActive.startedAt.toISOString(),
          totalReadings: dbActive.totalReadings,
          excursionCount: dbActive.excursionCount,
          minRecordedTemp: dbActive.minRecordedTemp,
          maxRecordedTemp: dbActive.maxRecordedTemp,
        };
        setActiveSession(active);
      }
    }

    return NextResponse.json({
      success: true,
      activeSession: active,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch active session";
    console.error("[API/sessions/active GET error]:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/sessions/active
 * End and finalize the current active session.
 * Computes audit metrics and permanently updates the session record in PostgreSQL.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const active = getActiveSession();
    const dbActive =
      active ||
      (await prisma.transitSession.findFirst({
        where: { status: "ACTIVE" },
      }));

    if (!dbActive) {
      return NextResponse.json(
        { success: false, error: "No active transit session to terminate." },
        { status: 404 }
      );
    }

    const store = getStore();
    const snapshot = store.currentSnapshot;

    // Fetch aggregate statistics from telemetry logs in DB
    const aggregates = await prisma.telemetryLog.aggregate({
      where: { sessionId: dbActive.id },
      _count: { id: true },
      _avg: { temperature: true },
      _min: { temperature: true },
      _max: { temperature: true },
    });

    const excursionCountDb = await prisma.telemetryLog.count({
      where: { sessionId: dbActive.id, isExcursion: true },
    });

    const totalCount = aggregates._count.id || active?.totalReadings || 0;
    const avgTemp =
      aggregates._avg.temperature ??
      (active?.sumTemp && active?.totalReadings
        ? active.sumTemp / active.totalReadings
        : null);

    const minTemp = aggregates._min.temperature ?? active?.minRecordedTemp ?? null;
    const maxTemp = aggregates._max.temperature ?? active?.maxRecordedTemp ?? null;
    const excursionCount = excursionCountDb || active?.excursionCount || 0;
    const finalViability = snapshot?.cumulative_viability ?? 1.0;
    const finalStatus = snapshot?.evaluation?.status ?? "NOMINAL";

    const ended = await prisma.transitSession.update({
      where: { id: dbActive.id },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        totalReadings: totalCount,
        avgTemperature: avgTemp !== null ? Number(avgTemp.toFixed(2)) : null,
        minRecordedTemp: minTemp !== null ? Number(minTemp.toFixed(2)) : null,
        maxRecordedTemp: maxTemp !== null ? Number(maxTemp.toFixed(2)) : null,
        excursionCount,
        finalViability: Number(finalViability.toFixed(4)),
        finalStatus,
      },
    });

    // Clear active session from in-memory runtime store
    endActiveSession();

    return NextResponse.json({
      success: true,
      message: "Transit session concluded and archived successfully.",
      summary: ended,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to conclude session";
    console.error("[API/sessions/active POST error]:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
