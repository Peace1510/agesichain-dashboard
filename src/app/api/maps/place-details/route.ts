import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const OLA_KEY =
    process.env.OLA_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ??
    "";

  const placeId = req.nextUrl.searchParams.get("place_id");
  if (!placeId) {
    return NextResponse.json({ error: "Missing place_id" }, { status: 400 });
  }

  try {
    const url = new URL("https://api.olamaps.io/places/v1/details");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("api_key", OLA_KEY);

    const res = await fetch(url.toString(), {
      headers: { "X-Request-Id": crypto.randomUUID() },
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Ola Place Details: ${res.status}`);
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
