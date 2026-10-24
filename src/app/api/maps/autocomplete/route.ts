import { NextRequest, NextResponse } from "next/server";

const OLA_KEY = process.env.OLA_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  if (!input || input.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const url = new URL("https://api.olamaps.io/places/v1/autocomplete");
    url.searchParams.set("input", input.trim());
    url.searchParams.set("api_key", OLA_KEY);

    const res = await fetch(url.toString(), {
      headers: { "X-Request-Id": crypto.randomUUID() },
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`Ola Autocomplete: ${res.status}`);
    const data = await res.json();

    const predictions = (data.predictions ?? []).map((p: Record<string, unknown>) => ({
      place_id: p.place_id,
      description: p.description,
    }));

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error("[maps/autocomplete]", err);
    return NextResponse.json({ predictions: [] });
  }
}
