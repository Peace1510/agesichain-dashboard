"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TelemetryReading, ShipmentMeta } from "@/lib/store";
import {
  MapPin,
  Navigation,
  Satellite,
  Layers,
  Crosshair,
  Compass,
  CheckCircle2,
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";

interface LiveMapProps {
  readings: TelemetryReading[];
  isConnected: boolean;
  destinationMeta?: ShipmentMeta;
}

type MapTheme = "dark" | "satellite" | "streets";

const MAP_STYLES: Record<MapTheme, { name: string; style: unknown }> = {
  dark: {
    name: "Dark Matter (Agesichain HD)",
    style: {
      version: 8,
      sources: {
        "esri-dark": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
        },
        "esri-dark-labels": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
        },
      },
      layers: [
        {
          id: "esri-dark-base",
          type: "raster",
          source: "esri-dark",
          minzoom: 0,
          maxzoom: 19,
        },
        {
          id: "esri-dark-ref",
          type: "raster",
          source: "esri-dark-labels",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  satellite: {
    name: "Satellite Imagery (Esri)",
    style: {
      version: 8,
      sources: {
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "&copy; Esri, Maxar, Earthstar Geographics",
        },
      },
      layers: [
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  streets: {
    name: "Standard Street (OSM)",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "osm-layer",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

export default function LiveMap({
  readings,
  isConnected,
  destinationMeta,
}: LiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pathSourceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plannedRouteSourceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>("dark");
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Latest coordinates from telemetry
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const lat = latestReading?.latitude ?? null;
  const lng = latestReading?.longitude ?? null;
  const speed = latestReading?.speed_kmh ?? 0;
  const temp = latestReading?.temperature ?? null;

  // Trail: last 60 readings
  const trailReadings = readings.slice(-60);

  // Recenter camera on the live container location
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;
    if (lat !== null && lng !== null) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1000,
        essential: true,
      });
    }
  }, [lat, lng]);

  // ── Initialise MapLibre Map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const { Map, NavigationControl } = await import("maplibre-gl");
        if (cancelled || !mapContainerRef.current) return;

        const initialCenter: [number, number] =
          lat !== null && lng !== null ? [lng, lat] : [73.8567, 18.5204]; // Pune default

        const map = new Map({
          container: mapContainerRef.current,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: MAP_STYLES[mapTheme].style as any,
          center: initialCenter,
          zoom: lat !== null ? 15 : 12,
          attributionControl: false,
        });

        map.addControl(
          new NavigationControl({ showCompass: true, showZoom: true }),
          "bottom-right"
        );

        map.on("load", () => {
          if (cancelled) return;

          // Trail GeoJSON line source
          map.addSource("trail", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          // Glow outer line
          map.addLayer({
            id: "trail-glow",
            type: "line",
            source: "trail",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#06b6d4",
              "line-width": 8,
              "line-opacity": 0.35,
              "line-blur": 3,
            },
          });

          // Core bright line
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
              "line-width": 3.5,
              "line-opacity": 0.95,
            },
          });

          pathSourceRef.current = map.getSource("trail");

          // Planned Highway Route GeoJSON line source
          map.addSource("planned-route", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          // Planned route glow line
          map.addLayer({
            id: "planned-route-glow",
            type: "line",
            source: "planned-route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#10b981",
              "line-width": 8,
              "line-opacity": 0.3,
              "line-blur": 3,
            },
          });

          // Planned route highway dash
          map.addLayer({
            id: "planned-route-line",
            type: "line",
            source: "planned-route",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#34d399",
              "line-width": 3,
              "line-opacity": 0.85,
              "line-dasharray": [2, 2],
            },
          });

          plannedRouteSourceRef.current = map.getSource("planned-route");
          setMapLoaded(true);
        });

        mapRef.current = map;
      } catch (err) {
        console.error("MapLibre init error:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        destMarkerRef.current = null;
        pathSourceRef.current = null;
        plannedRouteSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Switch Map Style Theme ──────────────────────────────────────────────
  const handleThemeChange = (newTheme: MapTheme) => {
    setMapTheme(newTheme);
    if (!mapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapRef.current.setStyle(MAP_STYLES[newTheme].style as any);
    mapRef.current.once("style.load", () => {
      // Re-add trail source and layer when style switches
      if (!mapRef.current.getSource("trail")) {
        mapRef.current.addSource("trail", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
        mapRef.current.addLayer({
          id: "trail-line",
          type: "line",
          source: "trail",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#22d3ee",
            "line-width": 3.5,
            "line-opacity": 0.95,
          },
        });
        pathSourceRef.current = mapRef.current.getSource("trail");
      }

      if (!mapRef.current.getSource("planned-route")) {
        mapRef.current.addSource("planned-route", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
        mapRef.current.addLayer({
          id: "planned-route-glow",
          type: "line",
          source: "planned-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#10b981",
            "line-width": 8,
            "line-opacity": 0.3,
            "line-blur": 3,
          },
        });
        mapRef.current.addLayer({
          id: "planned-route-line",
          type: "line",
          source: "planned-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#34d399",
            "line-width": 3,
            "line-opacity": 0.85,
            "line-dasharray": [2, 2],
          },
        });
        plannedRouteSourceRef.current = mapRef.current.getSource("planned-route");
      }
    });
  };

  // ── Update Container Marker & Trail on Telemetry Coordinate Changes ─────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    (async () => {
      const { Marker, Popup } = await import("maplibre-gl");

      // 1. Live Container Marker (Custom Glowing Radar Pulse)
      if (lat !== null && lng !== null) {
        const prev = prevCoordsRef.current;
        const hasMoved = !prev || prev.lat !== lat || prev.lng !== lng;

        if (!markerRef.current) {
          const el = document.createElement("div");
          el.className = "agesichain-container-marker cursor-pointer";
          el.innerHTML = `
            <div class="relative flex items-center justify-center w-10 h-10 -ml-5 -mt-5">
              <span class="absolute w-8 h-8 rounded-full bg-cyan-400/40 animate-ping"></span>
              <span class="absolute w-6 h-6 rounded-full bg-cyan-500/30 border border-cyan-400"></span>
              <span class="relative w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_#22d3ee]"></span>
            </div>
          `;

          const popup = new Popup({ offset: 15, closeButton: false }).setHTML(`
            <div style="font-family: monospace; font-size: 11px; padding: 4px; color: #e2e8f0; background: #0f172a; border-radius: 6px;">
              <div style="font-weight: bold; color: #22d3ee; margin-bottom: 2px;">📦 VACCINE SHIPMENT</div>
              <div>Coords: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
              <div>Temp: <b style="color: ${temp && (temp > 8 || temp < 2) ? "#f87171" : "#34d399"}">${temp !== null ? temp.toFixed(1) + "°C" : "—"}</b></div>
              <div>Speed: ${speed.toFixed(1)} km/h</div>
            </div>
          `);

          const marker = new Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(mapRef.current);

          markerRef.current = marker;
        } else {
          markerRef.current.setLngLat([lng, lat]);
        }

        // Pan camera smoothly on significant position update
        if (hasMoved) {
          mapRef.current.easeTo({
            center: [lng, lat],
            duration: 600,
          });
        }

        // Update Trail Path
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
      }

      // 2. Destination Marker (if coordinates are provided in metadata)
      const dLat = destinationMeta?.destinationLat;
      const dLng = destinationMeta?.destinationLng;
      if (dLat && dLng) {
        const distBadge = destinationMeta?.routeDistanceKm
          ? ` · ${destinationMeta.routeDistanceKm} km`
          : "";
        const badgeContent = `
          <div class="relative flex items-center justify-center -ml-3 -mt-6">
            <div class="px-2.5 py-1 bg-emerald-500 text-slate-950 font-black text-[10px] rounded-lg shadow-xl border border-white flex items-center gap-1 whitespace-nowrap">
              <span>🏁</span>
              <span>${destinationMeta.destination}${distBadge}</span>
            </div>
          </div>
        `;

        if (!destMarkerRef.current) {
          const destEl = document.createElement("div");
          destEl.innerHTML = badgeContent;
          const dMarker = new Marker({ element: destEl })
            .setLngLat([dLng, dLat])
            .addTo(mapRef.current);
          destMarkerRef.current = dMarker;
        } else {
          destMarkerRef.current.setLngLat([dLng, dLat]);
          const destEl = destMarkerRef.current.getElement();
          if (destEl) destEl.innerHTML = badgeContent;
        }
      }

      // 3. Update Planned Driving Highway Route
      if (plannedRouteSourceRef.current) {
        if (destinationMeta?.routeGeometry) {
          plannedRouteSourceRef.current.setData({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: destinationMeta.routeGeometry,
                properties: {},
              },
            ],
          });
        } else {
          plannedRouteSourceRef.current.setData({
            type: "FeatureCollection",
            features: [],
          });
        }
      }
    })();
  }, [lat, lng, speed, temp, mapLoaded, trailReadings, destinationMeta]);

  return (
    <div className="glass rounded-2xl overflow-hidden relative flex flex-col border border-white/[0.08] shadow-lg">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-slate-900/50 backdrop-blur-md gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Container Telemetry Map
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/70 text-blue-300 border border-blue-800/40 font-medium">
                Live GIS
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Active route tracking & Real-Time GPS breadcrumb trail
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Style Selector */}
          <div className="flex items-center rounded-xl bg-slate-950/70 border border-slate-800/90 p-0.5 text-xs">
            {(["dark", "satellite", "streets"] as MapTheme[]).map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] capitalize cursor-pointer ${
                  mapTheme === theme
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {theme}
              </button>
            ))}
          </div>

          {/* Recenter Button */}
          {lat !== null && lng !== null && (
            <button
              onClick={handleRecenter}
              title="Snap camera to container"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-blue-300 text-xs font-medium transition-all cursor-pointer"
            >
              <Crosshair className="h-3.5 w-3.5 text-blue-400" />
              <span>Center</span>
            </button>
          )}

          {/* Speed badge */}
          {isConnected && lat !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs mono">
              <Navigation className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-300">
                {speed > 0.5 ? (
                  <>
                    <span className="text-emerald-300 font-bold">
                      {speed.toFixed(1)}
                    </span>{" "}
                    km/h
                  </>
                ) : (
                  <span className="text-amber-300 font-semibold">Stationary</span>
                )}
              </span>
            </div>
          )}

          {/* Coordinate badge */}
          {lat !== null && lng !== null ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] mono text-slate-300">
              <Satellite className="h-3.5 w-3.5 text-indigo-400" />
              <span>
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] mono text-amber-400">
              <Compass className="h-3.5 w-3.5 animate-spin" />
              <span>Acquiring GPS...</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Map Canvas Container */}
      <div className="relative w-full" style={{ height: "420px" }}>
        {/* Waiting placeholder overlay if no GPS coordinates yet */}
        {lat === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 z-10 backdrop-blur-xs">
            <div className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
            <p className="text-sm font-semibold text-slate-300">
              Waiting for live GPS fix from ESP32...
            </p>
            <p className="text-xs text-slate-500">
              Neo-6M GPS satellite lock acquiring outdoors
            </p>
          </div>
        )}

        {/* Floating Quick Route Card */}
        {destinationMeta && destinationMeta.destination !== "—" && (
          <div className="absolute top-3 left-3 z-10 glass px-3.5 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950/80 text-xs flex items-center gap-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
              {destinationMeta.origin}
            </div>
            <span className="text-slate-500">➔</span>
            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {destinationMeta.destination}
            </div>
          </div>
        )}

        {/* The Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* 3. Footer Status Bar */}
      <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Agesichain Geospatial Engine · Active 1s GPS Ingestion
        </span>
        <span className="mono text-slate-400">
          {readings.length > 0
            ? `Active Trail: ${Math.min(trailReadings.length, 60)} coordinate points`
            : "No trail recorded yet"}
        </span>
      </div>
    </div>
  );
}
