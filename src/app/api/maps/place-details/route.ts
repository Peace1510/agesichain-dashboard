import { NextRequest, NextResponse } from "next/server";
import { fetchOlaMaps } from "@/lib/olamaps";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("place_id");
  if (!placeId) {
    return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
  }

  try {
    const res = await fetchOlaMaps(
      "/places/v1/details",
      { place_id: placeId },
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[maps/place-details] HTTP ${res.status}:`, errText);
      throw new Error(`Ola Place Details: ${res.status}`);
    }

    const data = await res.json();
    const loc = data?.result?.geometry?.location;
    if (!loc) throw new Error("No geometry in response");

    return NextResponse.json({
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: data?.result?.formatted_address ?? "",
    });
  } catch (err) {
    console.error("[maps/place-details]", err);
    return NextResponse.json({ error: "Place details lookup failed" }, { status: 500 });
  }
}
