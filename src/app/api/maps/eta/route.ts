import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const OLA_KEY =
    process.env.OLA_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ??
    "";

  const originLat = req.nextUrl.searchParams.get("originLat");
  const originLng = req.nextUrl.searchParams.get("originLng");
  const destLat = req.nextUrl.searchParams.get("destLat");
  const destLng = req.nextUrl.searchParams.get("destLng");

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  try {
    const url = new URL("https://api.olamaps.io/routing/v1/distanceMatrix");
    url.searchParams.set("origins", `${originLat},${originLng}`);
    url.searchParams.set("destinations", `${destLat},${destLng}`);
    url.searchParams.set("api_key", OLA_KEY);

    const res = await fetch(url.toString(), {
      headers: { "X-Request-Id": crypto.randomUUID() },
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`Ola Distance Matrix: ${res.status}`);
    const data = await res.json();

    // rows[0].elements[0].duration.value is seconds
    const durationSec: number =
      data?.rows?.[0]?.elements?.[0]?.duration?.value ?? null;
    const distanceM: number =
      data?.rows?.[0]?.elements?.[0]?.distance?.value ?? null;

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
