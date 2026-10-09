"use client";

import { useEffect, useRef, useState } from "react";
import type { TelemetryReading } from "@/lib/store";
import { MapPin, Navigation, Satellite } from "lucide-react";

interface LiveMapProps {
  readings: TelemetryReading[];
  isConnected: boolean;
}

/**
 * LiveMap — renders a Krutrim (Ola Maps) interactive map showing the
 * real-time position of the vaccine transport container.
 *
 * The map is initialised once on mount. On every subsequent render where
 * the latest GPS coordinate has changed, we smoothly move the marker to
 * the new position without re-creating the map instance.
 *
 * The SDK is loaded via dynamic import inside useEffect to prevent
 * Next.js SSR from attempting to run browser-only WebGL code on the server.
 */
export default function LiveMap({ readings, isConnected }: LiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pathSourceRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Coordinates from the latest reading
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const lat = latestReading?.latitude ?? null;
  const lng = latestReading?.longitude ?? null;
  const speed = latestReading?.speed_kmh ?? 0;

  // Collect the last 60 points for the trail path
  const trailReadings = readings.slice(-60);

  const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";

  // ── Initialise map (runs once after mount) ───────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // already initialised
    if (!apiKey || apiKey === "YOUR_KRUTRIM_API_KEY_HERE") {
      setMapError("Krutrim Maps API key is not configured. Add it to .env.local.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { OlaMaps } = await import("olamaps-web-sdk");

        if (cancelled || !mapContainerRef.current) return;

        const olaMaps = new OlaMaps({ apiKey });

        // Default center: India — will be updated as soon as first coords arrive
        const initialCenter: [number, number] =
          lat !== null && lng !== null ? [lng, lat] : [78.9629, 20.5937];

        const mapInit = olaMaps.init({
          style:
            "https://api.olamaps.io/tiles/vector/v1/styles/default-dark-standard/style.json",
          container: mapContainerRef.current,
          center: initialCenter,
          zoom: lat !== null ? 15 : 4,
          attributionControl: false,
        });

        // init() may return the map directly or a Promise — handle both
        const map = mapInit instanceof Promise ? await mapInit : mapInit;
        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;

          // ── Path trail source & layer ──────────────────────────────────
          map.addSource("trail", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          map.addLayer({
            id: "trail-line",
            type: "line",
            source: "trail",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#22d3ee",
              "line-width": 3,
              "line-opacity": 0.7,
            },
          });

          pathSourceRef.current = map.getSource("trail");
          setMapLoaded(true);
        });

        // ── Add marker ─────────────────────────────────────────────────
        if (lat !== null && lng !== null) {
          const marker = olaMaps
            .addMarker({
              color: "#22d3ee",
              draggable: false,
            })
            .setLngLat([lng, lat])
            .addTo(map);

          markerRef.current = marker;
          prevCoordsRef.current = { lat, lng };
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Map init error:", err);
          setMapError("Failed to load Krutrim Maps. Check your API key and network.");
        }
      }
    })();

    return () => {
      cancelled = true;
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        pathSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // only re-init if API key changes

  // ── Update marker & trail on every new coordinate ───────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (lat === null || lng === null) return;

    const prev = prevCoordsRef.current;
    if (prev && prev.lat === lat && prev.lng === lng) return; // no change

    // Move or create marker
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      // First coordinate arrived after map loaded
      (async () => {
        try {
          const { OlaMaps } = await import("olamaps-web-sdk");
          const olaMaps = new OlaMaps({ apiKey });
          const marker = olaMaps
            .addMarker({ color: "#22d3ee", draggable: false })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);
          markerRef.current = marker;
        } catch {
          // silent
        }
      })();
    }

    // Smoothly pan to new location
    mapRef.current.panTo([lng, lat], { duration: 800 });

    // Update trail path
    if (pathSourceRef.current && trailReadings.length >= 2) {
      const coords = trailReadings
        .filter((r) => r.latitude !== 0 || r.longitude !== 0)
        .map((r) => [r.longitude, r.latitude]);

      pathSourceRef.current.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
            properties: {},
          },
        ],
      });
    }

    prevCoordsRef.current = { lat, lng };
  }, [lat, lng, mapLoaded, trailReadings, apiKey]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="glass rounded-2xl overflow-hidden relative flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <MapPin className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100 tracking-tight">
            Live Container Location
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Speed badge */}
          {isConnected && lat !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs mono">
              <Navigation className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-300">
                {speed > 0.5 ? (
                  <><span className="text-emerald-300 font-bold">{speed.toFixed(1)}</span> km/h</>
                ) : (
                  <span className="text-amber-300 font-semibold">Stationary</span>
                )}
              </span>
            </div>
          )}

          {/* Coordinate display */}
          {lat !== null && lng !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] mono text-slate-400">
              <Satellite className="h-3 w-3 text-violet-400" />
              <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
            </div>
          )}

          {/* Connection dot */}
          <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
        </div>
      </div>

      {/* Map container */}
      <div className="relative" style={{ height: "420px" }}>
        {/* Error state */}
        {mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 z-10 p-6 text-center">
            <MapPin className="h-10 w-10 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">Map Unavailable</p>
            <p className="text-xs text-slate-500 max-w-xs">{mapError}</p>
          </div>
        )}

        {/* No data yet */}
        {!mapError && lat === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/60 z-10">
            <div className="h-12 w-12 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
            <p className="text-sm text-slate-400">Waiting for GPS coordinates...</p>
          </div>
        )}

        {/* The actual map div — Ola Maps renders into this */}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Footer info bar */}
      <div className="px-5 py-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>Krutrim Maps · Real-time GPS tracking · 1s update</span>
        <span className="mono">
          {readings.length > 0
            ? `Trail: last ${Math.min(trailReadings.length, 60)} points`
            : "No trail data"}
        </span>
      </div>
    </div>
  );
}
