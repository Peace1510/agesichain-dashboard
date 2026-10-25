"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ThermometerSnowflake,
  Shield,
  Truck,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  History,
  CheckCircle2,
  Box,
  Layers,
  Flame,
  Info,
  Navigation,
  RefreshCw,
} from "lucide-react";
import PlaceAutocompleteInput, { type PlaceResult } from "@/components/PlaceAutocompleteInput";
import {
  VACCINE_TIERS,
  type VaccineTierType,
  type VaccineTierConfig,
} from "@/lib/vaccineTiers";

interface CreateSessionViewProps {
  onSessionCreated: () => void;
  onOpenHistory: () => void;
  onBack?: () => void;
}

export default function CreateSessionView({
  onSessionCreated,
  onOpenHistory,
  onBack,
}: CreateSessionViewProps) {

  const [selectedTier, setSelectedTier] = useState<VaccineTierType>("STANDARD_REFRIGERATED");
  const [vaccineName, setVaccineName] = useState("DPT Inactivated Vaccine");
  const [batchNumber, setBatchNumber] = useState("BAT-2026-0000");

  useEffect(() => {
    setBatchNumber(`BAT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);
  const [transportEquip, setTransportEquip] = useState(
    VACCINE_TIERS.STANDARD_REFRIGERATED.equipmentOptions[0]
  );
  const [minTemp, setMinTemp] = useState<number>(2.0);
  const [maxTemp, setMaxTemp] = useState<number>(8.0);
  const [origin, setOrigin] = useState("Central Vaccine Depot, Pune");
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState("District General Hospital, Mumbai");
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [etaHours, setEtaHours] = useState<number>(2.5);
  const [etaDistKm, setEtaDistKm] = useState<number | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate ETA when both coords are available
  const calculateEta = useCallback(async (
    oCoords: { lat: number; lng: number },
    dCoords: { lat: number; lng: number }
  ) => {
    setEtaLoading(true);
    try {
      const res = await fetch(
        `/api/maps/eta?originLat=${oCoords.lat}&originLng=${oCoords.lng}&destLat=${dCoords.lat}&destLng=${dCoords.lng}`
      );
      const data = await res.json();
      if (data.durationHours != null) {
        setEtaHours(data.durationHours);
        setEtaDistKm(data.distanceKm ?? null);
      }
    } catch {
      // keep manual value
    } finally {
      setEtaLoading(false);
    }
  }, []);

  const handleOriginSelected = useCallback((place: PlaceResult) => {
    setOrigin(place.description);
    const coords = place.lat ? { lat: place.lat, lng: place.lng } : null;
    setOriginCoords(coords);
    if (coords && destCoords) calculateEta(coords, destCoords);
  }, [destCoords, calculateEta]);

  const handleDestSelected = useCallback((place: PlaceResult) => {
    setDestination(place.description);
    const coords = place.lat ? { lat: place.lat, lng: place.lng } : null;
    setDestCoords(coords);
    if (originCoords && coords) calculateEta(originCoords, coords);
  }, [originCoords, calculateEta]);

  const handleSelectTier = (tier: VaccineTierType) => {
    setSelectedTier(tier);
    const cfg = VACCINE_TIERS[tier];
    setMinTemp(cfg.minTemp);
    setMaxTemp(cfg.maxTemp);
    setTransportEquip(cfg.equipmentOptions[0] || "");
    // Default popular vaccine for tier
    if (tier === "STANDARD_REFRIGERATED") {
      setVaccineName("DPT Inactivated Vaccine");
    } else if (tier === "FROZEN") {
      setVaccineName("Oral Polio Vaccine (OPV)");
    } else if (tier === "ULTRA_COLD") {
      setVaccineName("Pfizer-BioNTech Comirnaty mRNA");
    }
  };

  const handleApplyPreset = (presetName: string, tier: VaccineTierType, equipment: string) => {
    handleSelectTier(tier);
    setVaccineName(presetName);
    setTransportEquip(equipment);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaccineName: vaccineName.trim(),
          vaccineTier: selectedTier,
          minTemp,
          maxTemp,
          transportEquip,
          batchNumber,
          origin,
          destination,
          etaHours: Number(etaHours),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start session.");
      }

      onSessionCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error initializing session.");
      setLoading(false);
    }
  };

  const activeTierConfig: VaccineTierConfig = VACCINE_TIERS[selectedTier];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 glass rounded-2xl border border-white/[0.08] shadow-lg">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Return to Dashboard"
              className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] hover:border-blue-500/40 text-slate-300 hover:text-white transition-all cursor-pointer group flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
            <ThermometerSnowflake className="h-5 w-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-950/40 border border-blue-500/25 text-[10px] font-mono uppercase font-bold text-blue-300 mb-0.5">
              Transit Configuration
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Launch Cold-Chain Transit Session
            </h1>
            <p className="text-xs text-slate-400">
              Select vaccine classification tier, configure thermal tolerances, and initialize IoT telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] hover:border-blue-500/40 text-slate-200 text-xs font-semibold shadow transition-all cursor-pointer group flex-shrink-0"
          >
            <History className="h-4 w-4 text-blue-400 group-hover:rotate-[-20deg] transition-transform" />
            <span>Session History & Audits</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Vaccine Classification Tier Selector */}
        <div className="glass rounded-2xl p-5 sm:p-6 border border-white/[0.08] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-400" />
                1. Select Vaccine Temperature Classification Tier
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Calibrates WHO / CDC thermal tolerance envelope and Arrhenius rate kinetics.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {(Object.keys(VACCINE_TIERS) as VaccineTierType[]).map((tierKey) => {
              const tier = VACCINE_TIERS[tierKey];
              const isSelected = selectedTier === tierKey;
              return (
                <div
                  key={tierKey}
                  onClick={() => handleSelectTier(tierKey)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? `bg-blue-950/30 border-blue-500/60 shadow-md ring-1 ring-blue-500/30`
                      : `bg-slate-900/40 border-white/[0.06] hover:border-white/[0.15] hover:bg-slate-900/60`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        tierKey === "STANDARD_REFRIGERATED"
                          ? "bg-emerald-950/70 text-emerald-300 border border-emerald-500/30"
                          : tierKey === "FROZEN"
                          ? "bg-blue-950/70 text-blue-300 border border-blue-500/30"
                          : "bg-purple-950/70 text-purple-300 border border-purple-500/30"
                      }`}>
                        {tier.badge}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-blue-400" />
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1">
                      {tier.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-3 line-clamp-2">
                      {tier.description}
                    </p>
                  </div>

                  {/* Examples footer */}
                  <div className="pt-2.5 border-t border-white/[0.04]">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block mb-0.5">
                      Examples:
                    </span>
                    <p className="text-[10px] text-slate-300 line-clamp-1">
                      {tier.examples.join(", ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: Payload & Hardware Specifications */}
        <div className="glass rounded-2xl p-5 sm:p-6 border border-white/[0.08] shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Box className="h-4 w-4 text-emerald-400" />
                2. Shipment Payload & Transport Hardware Details
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Configure vaccine batch details, container hardware, and thermal limits.
              </p>
            </div>

            {/* Quick Presets Dropdown / Pills */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-400 mr-1">PRESETS:</span>
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    "DPT Inactivated Vaccine",
                    "STANDARD_REFRIGERATED",
                    "Ice-lined refrigerator (ILR) van"
                  )
                }
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-white/[0.06] text-[10px] text-slate-300 transition-colors cursor-pointer"
              >
                +2..+8°C DPT
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    "Oral Polio Vaccine (OPV)",
                    "FROZEN",
                    "Deep freezer transport vehicle (-20°C)"
                  )
                }
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-white/[0.06] text-[10px] text-slate-300 transition-colors cursor-pointer"
              >
                -20°C OPV
              </button>
              <button
                type="button"
                onClick={() =>
                  handleApplyPreset(
                    "Pfizer-BioNTech Comirnaty mRNA",
                    "ULTRA_COLD",
                    "Specialized thermal shipper with dry ice (UN1845)"
                  )
                }
                className="px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 border border-white/[0.06] text-[10px] text-slate-300 transition-colors cursor-pointer"
              >
                -80°C mRNA
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Vaccine Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Vaccine / Medicine Name *
              </label>
              <input
                type="text"
                required
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="e.g. DPT Inactivated Vaccine"
                className="w-full px-3 py-2 bg-slate-900/80 border border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Batch / Lot Number */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Batch / Lot Number
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="BAT-2026-902A"
                className="w-full px-3 py-2 bg-slate-900/80 border border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Transport Equipment */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Transport Equipment
              </label>
              <select
                value={transportEquip}
                onChange={(e) => setTransportEquip(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/80 border border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
              >
                {activeTierConfig.equipmentOptions.map((eq) => (
                  <option key={eq} value={eq} className="bg-slate-900 text-slate-100">
                    {eq}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Allowed Temp */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Min Allowed Temp (°C)</span>
                <span className="text-[10px] text-blue-400 font-mono">Rec: {activeTierConfig.minTemp}°C</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={minTemp}
                onChange={(e) => setMinTemp(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-900/80 border border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Maximum Allowed Temp */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Max Allowed Temp (°C)</span>
                <span className="text-[10px] text-blue-400 font-mono">Rec: {activeTierConfig.maxTemp}°C</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={maxTemp}
                onChange={(e) => setMaxTemp(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-900/80 border border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* ETA in Hours — auto-calculated */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-blue-400" />
                  Transit ETA (Hours)
                </span>
                {(originCoords && destCoords) && (
                  <button
                    type="button"
                    onClick={() => originCoords && destCoords && calculateEta(originCoords, destCoords)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    Recalculate
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="120"
                  required
                  value={etaHours}
                  onChange={(e) => setEtaHours(parseFloat(e.target.value) || 0.1)}
                  className={`w-full px-3 py-2 pr-9 bg-slate-900/80 border rounded-xl text-xs sm:text-sm text-slate-100 font-mono focus:outline-none transition-colors ${
                    etaLoading
                      ? "border-blue-500/60 animate-pulse"
                      : "border-white/[0.08] focus:border-blue-500"
                  }`}
                />
                {etaLoading ? (
                  <Navigation className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400 animate-spin" />
                ) : (
                  <Navigation className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                )}
              </div>
              {etaDistKm ? (
                <p className="text-[10px] text-emerald-400 font-mono">
                  ≈ {etaDistKm} km road distance (Ola Maps)
                </p>
              ) : (
                <p className="text-[10px] text-slate-500">
                  Select route below to auto-calculate
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Route Waypoints */}
        <div className="glass rounded-2xl p-5 sm:p-6 border border-white/[0.08] shadow-lg space-y-4">
          <div className="border-b border-white/[0.06] pb-3">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Truck className="h-4 w-4 text-cyan-400" />
              3. Route &amp; Transit Waypoints
            </label>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Specify origin depot and destination facility for route tracking and ETA projection.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Origin Location */}
            <div className="space-y-1">
              <PlaceAutocompleteInput
                id="session-origin"
                label="Origin Facility"
                icon={<MapPin className="h-3 w-3 text-cyan-400" />}
                value={origin}
                placeholder="e.g. Central Vaccine Depot, Pune"
                required
                onPlaceSelected={handleOriginSelected}
                onTextChange={setOrigin}
              />
            </div>

            {/* Destination Location */}
            <div className="space-y-1">
              <PlaceAutocompleteInput
                id="session-destination"
                label="Destination Hospital / Clinic"
                icon={<Truck className="h-3 w-3 text-emerald-400" />}
                value={destination}
                placeholder="e.g. District General Hospital, Mumbai"
                required
                onPlaceSelected={handleDestSelected}
                onTextChange={setDestination}
              />
            </div>
          </div>
        </div>

        {/* Action Button & Info */}
        <div className="glass rounded-2xl p-4 sm:p-5 border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400 flex-shrink-0" />
            <span>Once launched, incoming ESP32 sensor telemetry will automatically link to this session until concluded.</span>
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Initializing Fleet Session...</span>
              </>
            ) : (
              <>
                <span>Launch & Monitor Shipment</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
