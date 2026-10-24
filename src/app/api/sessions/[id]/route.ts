import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sessions/[id]
 * Fetch detailed metrics, summary, and telemetry log history for a specific session.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    const session = await prisma.transitSession.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        telemetryLogs: {
          orderBy: { timestamp: "asc" },
          take: 1000, // return up to 1000 detailed historical data points
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch session details";
    console.error("[API/sessions/[id] GET error]:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
