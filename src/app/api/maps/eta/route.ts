import { NextRequest, NextResponse } from "next/server";
import { fetchOlaMaps } from "@/lib/olamaps";

export async function GET(req: NextRequest) {
  const originLat = req.nextUrl.searchParams.get("originLat");
  const originLng = req.nextUrl.searchParams.get("originLng");
  const destLat = req.nextUrl.searchParams.get("destLat");
  const destLng = req.nextUrl.searchParams.get("destLng");

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  try {
    const res = await fetchOlaMaps(
      "/routing/v1/distanceMatrix",
      {
        origins: `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
      },
      { next: { revalidate: 0 } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[maps/eta] HTTP ${res.status}:`, errText);
      throw new Error(`Ola Distance Matrix: ${res.status}`);
    }

    const data = await res.json();

    // Ola Maps returns duration in seconds and distance in meters
    const rawDuration = data?.rows?.[0]?.elements?.[0]?.duration;
    const durationSec: number | null =
      typeof rawDuration === "number"
        ? rawDuration
        : (rawDuration?.value ?? null);

    const rawDistance = data?.rows?.[0]?.elements?.[0]?.distance;
    const distanceM: number | null =
      typeof rawDistance === "number"
        ? rawDistance
        : (rawDistance?.value ?? null);

    if (durationSec === null) throw new Error("No duration in response");

    return NextResponse.json({
      durationHours: Math.round((durationSec / 3600) * 10) / 10,
      distanceKm: distanceM ? Math.round(distanceM / 100) / 10 : null,
    });
  } catch (err) {
    console.error("[maps/eta]", err);
    return NextResponse.json({ error: "ETA lookup failed" }, { status: 500 });
  }
}
