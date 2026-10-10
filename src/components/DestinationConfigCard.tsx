"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ShipmentMeta } from "@/lib/store";
import {
  MapPin,
  Truck,
  Clock,
  Send,
  Sliders,
  CheckCircle,
  AlertCircle,
  Info,
  Building2,
  Navigation,
  Search,
  Route,
  Loader2,
  X,
  Compass,
  RotateCcw,
} from "lucide-react";

interface DestinationConfigCardProps {
  meta: ShipmentMeta;
  etaHours: number;
  timeToSpoil: number | null;
  onUpdateRoute: (
    etaHours: number,
    meta: Partial<ShipmentMeta>
  ) => Promise<void>;
  loading: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
}

interface PlaceResult {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  type?: string;
}

interface LiveRouteInfo {
  distanceKm: number;
  durationHours: number;
  durationMinutes: number;
  formattedEta: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry?: any;
  provider?: string;
}

export default function DestinationConfigCard({
  meta,
  etaHours,
  timeToSpoil,
  onUpdateRoute,
  loading,
  currentLat,
  currentLng,
}: DestinationConfigCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(meta.name || "Vaccine Cold Chain Run");
  const [origin, setOrigin] = useState(meta.origin !== "—" ? meta.origin : "Cold Hub, Pune");
  const [destination, setDestination] = useState(
    meta.destination !== "—" ? meta.destination : "District Hospital, Mumbai"
  );
  const [eta, setEta] = useState<number>(etaHours || 2.5);
  const [destLat, setDestLat] = useState<number>(meta.destinationLat || 18.9822);
  const [destLng, setDestLng] = useState<number>(meta.destinationLng || 72.8335);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Search & Routing state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<LiveRouteInfo | null>(
    meta.routeDistanceKm
      ? {
          distanceKm: meta.routeDistanceKm,
          durationHours: etaHours,
          durationMinutes: Math.round(etaHours * 60),
          formattedEta: `${Math.floor(etaHours)}h ${Math.round(etaHours * 60) % 60}m`,
          geometry: meta.routeGeometry,
        }
      : null
  );

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fallback origin coordinates if GPS not yet streaming
  const effectiveOriginLat = currentLat ?? 18.5204; // Pune default
  const effectiveOriginLng = currentLng ?? 73.8567;

  // Viability buffer calculation
  const bufferHours = timeToSpoil !== null ? timeToSpoil - eta : null;
  const isBufferSafe = bufferHours !== null && bufferHours > 0;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate live road driving route and traffic ETA via /api/routing
  const calculateLiveRoute = useCallback(
    async (targetLat: number, targetLng: number, targetDestName?: string) => {
      setCalculatingRoute(true);
      try {
        const url = `/api/routing?fromLat=${effectiveOriginLat}&fromLng=${effectiveOriginLng}&toLat=${targetLat}&toLng=${targetLng}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.success) {
          const info: LiveRouteInfo = {
            distanceKm: data.distance_km,
            durationHours: data.duration_hours,
            durationMinutes: data.duration_minutes,
            formattedEta: data.formatted_eta,
            geometry: data.geometry,
            provider: data.provider,
          };
          setRouteInfo(info);
          setEta(data.duration_hours);
          if (targetDestName) setDestination(targetDestName);
        }
      } catch (err) {
        console.warn("Live route calculation error:", err);
      } finally {
        setCalculatingRoute(false);
      }
    },
    [effectiveOriginLat, effectiveOriginLng]
  );

  // Perform geocode search
  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          setSearchResults(data.results);
          setShowDropdown(data.results.length > 0);
        }
      }
    } catch (err) {
      console.warn("Geocoding search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on input change
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 350);
  };

  // Select place from search dropdown
  const handleSelectPlace = (place: PlaceResult) => {
    setDestination(place.name);
    setSearchQuery(place.name);
    setDestLat(place.lat);
    setDestLng(place.lng);
    setShowDropdown(false);

    // Immediately trigger live road route & ETA calculation
    calculateLiveRoute(place.lat, place.lng, place.name);
  };

  // Apply quick preset with automatic live road recalculation
  const applyPreset = (
    presetOrigin: string,
    presetDest: string,
    fallbackEta: number,
    pLat: number,
    pLng: number
  ) => {
    setOrigin(presetOrigin);
    setDestination(presetDest);
    setSearchQuery(presetDest);
    setDestLat(pLat);
    setDestLng(pLng);

    // Calculate real road distance and traffic ETA from current container position
    calculateLiveRoute(pLat, pLng, presetDest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateRoute(Number(eta), {
      name,
      origin,
      destination,
      destinationLat: Number(destLat),
      destinationLng: Number(destLng),
      routeDistanceKm: routeInfo?.distanceKm,
      routeGeometry: routeInfo?.geometry,
    });
    setSavedSuccess(true);
    setIsEditing(false);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="glass rounded-2xl p-5 border border-slate-800/80 bg-slate-900/40 relative overflow-hidden flex flex-col justify-between">
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-blue-500" />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Shipment Destination & Route Planner
                {savedSuccess && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                    <CheckCircle className="h-3 w-3" /> Saved!
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Google Maps-style place search & Real-Time Road Traffic ETA
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-cyan-300 font-medium transition-all cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isEditing ? "Cancel" : "Configure & Search"}</span>
          </button>
        </div>

        {/* View Mode or Edit Form */}
        {!isEditing ? (
          <div className="mt-4 flex flex-col gap-3">
            {/* Route Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Origin */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-cyan-400" /> Origin Point
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-200 truncate">
                  {meta.origin !== "—" ? meta.origin : "Not specified"}
                </p>
              </div>

              {/* Destination */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Truck className="h-3 w-3 text-emerald-400" /> Target Destination
                </span>
                <p className="mt-1 text-xs font-semibold text-emerald-300 truncate">
                  {meta.destination !== "—" ? meta.destination : "Click Configure to set"}
                </p>
              </div>

              {/* Transit ETA */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-400" /> Live Road ETA
                </span>
                <p className="mt-1 text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
                  <span>
                    {etaHours < 1
                      ? `${Math.round(etaHours * 60)} mins (${etaHours.toFixed(2)}h)`
                      : `${etaHours.toFixed(1)} hrs`}
                  </span>
                  {meta.routeDistanceKm && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({meta.routeDistanceKm} km)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Kinetic Explanation Banner */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-cyan-200">
                  Real-Time Viability Buffer:
                </span>{" "}
                <span className="text-slate-300">
                  Chemical shelf-life ({timeToSpoil !== null ? timeToSpoil.toFixed(1) + " hrs" : "calculating..."}) vs. Driving ETA ({etaHours.toFixed(1)} hrs). Buffer:{" "}
                  <code className="text-cyan-300 mono bg-slate-900 px-1 py-0.5 rounded">
                    TTS - ETA = {bufferHours !== null ? (bufferHours > 0 ? "+" + bufferHours.toFixed(1) : bufferHours.toFixed(1)) + " hrs" : "—"}
                  </code>.{" "}
                  {bufferHours !== null && (
                    <strong className={isBufferSafe ? "text-emerald-400" : "text-red-400"}>
                      {isBufferSafe
                        ? "Shipment will arrive with safe potency buffer remaining."
                        : "WARNING: Shipment will spoil before reaching destination!"}
                    </strong>
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {/* 1. GOOGLE MAPS PLACE SEARCH INPUT */}
            <div className="relative" ref={searchContainerRef}>
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Search className="h-3.5 w-3.5 text-cyan-400" />
                <span>Search Destination (Google Maps Search)</span>
              </label>

              <div className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      performSearch(searchQuery);
                    }
                  }}
                  placeholder="Search any hospital, city, or address (e.g. Lilavati Hospital Mumbai, AIIMS Delhi)..."
                  className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-inner"
                />

                <Search className="absolute left-3 h-4 w-4 text-slate-500 pointer-events-none" />

                <div className="absolute right-2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                        setShowDropdown(false);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => performSearch(searchQuery)}
                    disabled={isSearching}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-[11px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSearching ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Search"
                    )}
                  </button>
                </div>
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden divide-y divide-slate-800/60 max-h-60 overflow-y-auto backdrop-blur-xl">
                  {searchResults.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => handleSelectPlace(place)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/60 transition-colors flex items-start gap-2.5 group cursor-pointer"
                    >
                      <div className="mt-0.5 p-1 rounded-lg bg-slate-800 group-hover:bg-cyan-950 text-slate-400 group-hover:text-cyan-400 border border-slate-700/50 transition-colors flex-shrink-0">
                        {place.type === "hospital" ? (
                          <Building2 className="h-3.5 w-3.5" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                          {place.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {place.label}
                        </div>
                        <div className="text-[10px] mono text-slate-500 mt-0.5">
                          {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Presets with Automatic Routing */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("Serum Institute, Pune", "KEM Hospital, Pune", 1.2, 18.5284, 73.8743)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-all cursor-pointer hover:border-cyan-500/50"
              >
                🏥 Pune Local
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Cold Hub, Pune", "District Hospital, Mumbai", 3.5, 18.9822, 72.8335)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-all cursor-pointer hover:border-cyan-500/50"
              >
                🚚 Pune ➔ Mumbai
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Vaccine Depot, Pune", "AIIMS Nagpur", 9.0, 21.1458, 79.0882)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-all cursor-pointer hover:border-cyan-500/50"
              >
                ✈️ Pune ➔ Nagpur
              </button>
            </div>

            {/* 2. REAL-TIME ROUTING & TRAFFIC ETA STATUS CARD */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Real-Time Traffic Driving Route</span>
                </span>

                <button
                  type="button"
                  onClick={() => calculateLiveRoute(destLat, destLng, destination)}
                  disabled={calculatingRoute}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`h-3 w-3 ${calculatingRoute ? "animate-spin" : ""}`} />
                  <span>Recalculate</span>
                </button>
              </div>

              {calculatingRoute ? (
                <div className="py-2 flex items-center gap-2 text-xs text-cyan-300">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  <span>Calculating real-time road distance and traffic ETA...</span>
                </div>
              ) : routeInfo ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[9px] uppercase font-bold text-slate-500">
                      Driving Distance
                    </span>
                    <p className="mono text-sm font-bold text-emerald-400">
                      {routeInfo.distanceKm} km
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[9px] uppercase font-bold text-slate-500">
                      Live Driving Time
                    </span>
                    <p className="mono text-sm font-bold text-amber-300">
                      {routeInfo.formattedEta}
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500">
                      Applied ETA
                    </span>
                    <p className="mono text-sm font-bold text-cyan-300">
                      {eta < 1
                        ? `${Math.round(eta * 60)} mins (${eta.toFixed(2)}h)`
                        : `${eta.toFixed(1)} hrs`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">
                  Select a destination or click Recalculate to generate live highway ETA from current container position.
                </div>
              )}
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Shipment Name */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Cargo / Vaccine Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Covishield Batch #AG-902"
                  required
                />
              </div>

              {/* Transit ETA (Hours) */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
                  <span>Transit ETA (Hours)</span>
                  <span className="mono text-cyan-400 font-bold">
                    {eta < 1
                      ? `${Math.round(eta * 60)} mins (${eta.toFixed(2)}h)`
                      : `${eta.toFixed(1)} hrs`}
                  </span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  max="168"
                  value={eta}
                  onChange={(e) => setEta(parseFloat(e.target.value) || 0.1)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Origin Facility */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Origin Facility
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Serum Institute, Pune"
                  required
                />
              </div>

              {/* Destination Facility */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Destination Hospital / Hub
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. District Hospital, Mumbai"
                  required
                />
              </div>

              {/* Destination Coordinates */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Destination Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={destLat}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDestLat(val);
                    calculateLiveRoute(val, destLng);
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Destination Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  value={destLng}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setDestLng(val);
                    calculateLiveRoute(destLat, val);
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || calculatingRoute}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Save Route & Update Dashboard</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
