import { NextRequest, NextResponse } from "next/server";

export interface GeocodePlace {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  type?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json(
      { success: false, error: "Search query must be at least 2 characters.", results: [] },
      { status: 400 }
    );
  }

  const results: GeocodePlace[] = [];

  // 1. Try Photon Geocoding API first (fast, typo-tolerant, global + India support)
  try {
    const photonRes = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`,
      {
        headers: { "User-Agent": "Agesichain-ColdChain-Monitor/1.0" },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (photonRes.ok) {
      const data = await photonRes.json();
      if (Array.isArray(data.features) && data.features.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.features.forEach((f: any, idx: number) => {
          const props = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          if (coords.length >= 2) {
            const lng = Number(coords[0]);
            const lat = Number(coords[1]);
            const name = props.name || props.street || query;
            const parts = [
              props.city || props.town || props.village,
              props.state,
              props.country,
            ].filter(Boolean);
            const label = parts.length > 0 ? `${name}, ${parts.join(", ")}` : name;

            results.push({
              id: `photon-${idx}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
              name,
              label,
              lat,
              lng,
              type: props.osm_value || props.type || "place",
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("Photon geocoding error, falling back to Nominatim:", err);
  }

  // 2. Fallback to OpenStreetMap Nominatim if Photon had no matches
  if (results.length === 0) {
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`,
        {
          headers: {
            "User-Agent": "Agesichain-ColdChain-Monitor/1.0 (contact: coldchain@agesichain.tech)",
            "Accept-Language": "en",
          },
          signal: AbortSignal.timeout(4000),
        }
      );

      if (nomRes.ok) {
        const data = await nomRes.json();
        if (Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.forEach((item: any, idx: number) => {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (!isNaN(lat) && !isNaN(lng)) {
              results.push({
                id: `nom-${idx}-${lat.toFixed(4)}-${lng.toFixed(4)}`,
                name: item.name || item.display_name.split(",")[0],
                label: item.display_name,
                lat,
                lng,
                type: item.type || "place",
              });
            }
          });
        }
      }
    } catch (err) {
      console.warn("Nominatim geocoding error:", err);
    }
  }

  return NextResponse.json({
    success: true,
    query,
    count: results.length,
    results,
  });
}
