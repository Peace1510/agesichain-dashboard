import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setActiveSession, getActiveSession } from "@/lib/store";
import { auth } from "@/auth";
import { getVaccineTierConfig, type VaccineTierType } from "@/lib/vaccineTiers";

/**
 * GET /api/sessions
 * List all past / recorded transit sessions with filtering.
 * Query params:
 *   - q: search query by vaccine name or session code
 *   - tier: filter by vaccineTier (STANDARD_REFRIGERATED, FROZEN, ULTRA_COLD)
 *   - status: filter by status (ACTIVE, COMPLETED, TERMINATED)
 *   - limit: pagination limit (default: 50)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (q) {
      where.OR = [
        { vaccineName: { contains: q, mode: "insensitive" } },
        { sessionCode: { contains: q, mode: "insensitive" } },
        { batchNumber: { contains: q, mode: "insensitive" } },
        { origin: { contains: q, mode: "insensitive" } },
        { destination: { contains: q, mode: "insensitive" } },
      ];
    }

    if (tier) {
      where.vaccineTier = tier;
    }

    if (status) {
      where.status = status;
    }

    const sessions = await prisma.transitSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        _count: {
          select: { telemetryLogs: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      sessions,
      total: sessions.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch sessions";
    console.error("[API/sessions GET error]:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/sessions
 * Initialize and start a new active transit session.
 * Enforces strictly ONE active session at a time.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionAuth = await auth();
    const userId = sessionAuth?.user?.id;

    const body = await request.json();
    const {
      vaccineName,
      vaccineTier,
      minTemp,
      maxTemp,
      targetTemp,
      transportEquip,
      batchNumber,
      origin,
      destination,
      destinationLat,
      destinationLng,
      etaHours,
    } = body;

    // Validate required fields
    if (!vaccineName || !vaccineTier) {
      return NextResponse.json(
        { success: false, error: "Vaccine name and classification tier are required." },
        { status: 400 }
      );
    }

    // Check if an active session already exists in DB or memory
    const existingActive =
      getActiveSession() ??
      (await prisma.transitSession.findFirst({
        where: { status: "ACTIVE" },
      }));

    if (existingActive) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An active transit session is already running. Please complete or end the current session before launching a new one.",
          activeSession: existingActive,
        },
        { status: 409 }
      );
    }

    const tierConfig = getVaccineTierConfig(vaccineTier as VaccineTierType);

    // Apply defaults from tier if not explicitly specified
    const finalMinTemp = typeof minTemp === "number" ? minTemp : tierConfig.minTemp;
    const finalMaxTemp = typeof maxTemp === "number" ? maxTemp : tierConfig.maxTemp;
    const finalTargetTemp = typeof targetTemp === "number" ? targetTemp : tierConfig.targetTemp;
    const finalOrigin = (origin || "Cold Hub, Central Depot").trim();
    const finalDestination = (destination || "District Hospital Hub").trim();
    const finalEta = typeof etaHours === "number" && etaHours > 0 ? etaHours : 2.5;

    // Generate unique human-readable session code (e.g. SESS-8K2M)
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sessionCode = `SESS-${randomSuffix}`;

    const created = await prisma.transitSession.create({
      data: {
        sessionCode,
        vaccineName: vaccineName.trim(),
        vaccineTier,
        minTemp: finalMinTemp,
        maxTemp: finalMaxTemp,
        targetTemp: finalTargetTemp,
        transportEquip: transportEquip?.trim() || tierConfig.equipmentOptions[0],
        batchNumber: batchNumber?.trim() || `BAT-${new Date().getFullYear()}-${randomSuffix}`,
        origin: finalOrigin,
        destination: finalDestination,
        destinationLat: typeof destinationLat === "number" ? destinationLat : 18.9822,
        destinationLng: typeof destinationLng === "number" ? destinationLng : 72.8335,
        etaHours: finalEta,
        status: "ACTIVE",
        startedAt: new Date(),
        createdById: userId,
      },
    });

    // Populate in-memory store
    setActiveSession({
      id: created.id,
      sessionCode: created.sessionCode,
      vaccineName: created.vaccineName,
      vaccineTier: created.vaccineTier as VaccineTierType,
      minTemp: created.minTemp,
      maxTemp: created.maxTemp,
      targetTemp: created.targetTemp,
      transportEquip: created.transportEquip,
      batchNumber: created.batchNumber,
      origin: created.origin,
      destination: created.destination,
      destinationLat: created.destinationLat,
      destinationLng: created.destinationLng,
      etaHours: created.etaHours,
      startedAt: created.startedAt.toISOString(),
      totalReadings: 0,
      excursionCount: 0,
    });

    return NextResponse.json({
      success: true,
      session: created,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create session";
    console.error("[API/sessions POST error]:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
