import { NextRequest, NextResponse } from "next/server";

// Haversine formula for spherical distance in kilometers
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const fromLat = parseFloat(searchParams.get("fromLat") || "");
  const fromLng = parseFloat(searchParams.get("fromLng") || "");
  const toLat = parseFloat(searchParams.get("toLat") || "");
  const toLng = parseFloat(searchParams.get("toLng") || "");

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid coordinates. Required: fromLat, fromLng, toLat, toLng.",
      },
      { status: 400 }
    );
  }

  // 1. Query OSRM Driving Engine for real-world road route & driving duration
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(osrmUrl, {
      headers: { "User-Agent": "Agesichain-ColdChain-Monitor/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Number((route.distance / 1000).toFixed(1));
        const durationSeconds = Number(route.duration);
        const durationHours = Number((durationSeconds / 3600).toFixed(2));
        const durationMinutes = Math.round(durationSeconds / 60);

        let formattedEta = "";
        const hrs = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;
        if (hrs > 0) {
          formattedEta = `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min${mins !== 1 ? "s" : ""}`;
        } else {
          formattedEta = `${mins} min${mins !== 1 ? "s" : ""}`;
        }

        return NextResponse.json({
          success: true,
          provider: "osrm",
          distance_km: distanceKm,
          duration_hours: durationHours,
          duration_minutes: durationMinutes,
          formatted_eta: formattedEta,
          geometry: route.geometry,
        });
      }
    }
  } catch (err) {
    console.warn("OSRM routing request failed, computing geometric road estimation:", err);
  }

  // 2. Fallback: Accurate Haversine distance with road-circuit factor (1.28x) & typical transport speed (52 km/h)
  const directDistance = haversineDistanceKm(fromLat, fromLng, toLat, toLng);
  const estimatedRoadKm = Number((directDistance * 1.28).toFixed(1));
  const avgSpeedKmh = 52.0;
  const estimatedHours = Number((estimatedRoadKm / avgSpeedKmh).toFixed(2));
  const estimatedMins = Math.round(estimatedHours * 60);

  const hrs = Math.floor(estimatedMins / 60);
  const mins = estimatedMins % 60;
  const formattedEta = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  return NextResponse.json({
    success: true,
    provider: "haversine_fallback",
    distance_km: estimatedRoadKm,
    duration_hours: estimatedHours,
    duration_minutes: estimatedMins,
    formatted_eta: formattedEta,
    geometry: {
      type: "LineString",
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
    },
  });
}
