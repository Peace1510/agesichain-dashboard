import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Read key inside handler — module-level const misses runtime env injection in standalone builds
  const OLA_KEY =
    process.env.OLA_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ??
    "";

  const input = req.nextUrl.searchParams.get("input");
  if (!input || input.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (!OLA_KEY) {
    console.error("[maps/autocomplete] OLA_MAPS_API_KEY is not set");
    return NextResponse.json({ predictions: [], _error: "API key not configured" });
  }

  try {
    const url = new URL("https://api.olamaps.io/places/v1/autocomplete");
    url.searchParams.set("input", input.trim());
    url.searchParams.set("api_key", OLA_KEY);

    const res = await fetch(url.toString(), {
      headers: {
        "X-Request-Id": crypto.randomUUID(),
        "Origin": "https://ageischain.kirmadaa.tech",
        "Referer": "https://ageischain.kirmadaa.tech/",
      },
      next: { revalidate: 0 },
    });

    const rawText = await res.text();

    if (!res.ok) {
      console.error(`[maps/autocomplete] HTTP ${res.status}:`, rawText);
      return NextResponse.json({
        predictions: [],
        _error: `Ola Maps ${res.status}`,
        _detail: rawText.slice(0, 300),
      });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[maps/autocomplete] Non-JSON response:", rawText.slice(0, 300));
      return NextResponse.json({ predictions: [], _error: "Non-JSON response", _detail: rawText.slice(0, 200) });
    }

    const predictions = ((data.predictions as Record<string, unknown>[] | undefined) ?? []).map((p) => ({
      place_id: p.place_id,
      description: p.description,
    }));

    return NextResponse.json({ predictions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[maps/autocomplete] fetch error:", msg);
    return NextResponse.json({ predictions: [], _error: msg });
  }
}
