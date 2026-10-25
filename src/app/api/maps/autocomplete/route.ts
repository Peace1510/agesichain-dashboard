import { NextRequest, NextResponse } from "next/server";
import { fetchOlaMaps } from "@/lib/olamaps";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  if (!input || input.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const res = await fetchOlaMaps(
      "/places/v1/autocomplete",
      { input: input.trim() },
      { next: { revalidate: 0 } }
    );

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
