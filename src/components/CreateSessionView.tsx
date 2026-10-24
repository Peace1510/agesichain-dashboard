"use client";

import React, { useState, useEffect } from "react";
import {
  ThermometerSnowflake,
  Shield,
  Truck,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  History,
  CheckCircle2,
  Box,
  Layers,
  Flame,
  Info,
} from "lucide-react";
import {
  VACCINE_TIERS,
  type VaccineTierType,
  type VaccineTierConfig,
} from "@/lib/vaccineTiers";

interface CreateSessionViewProps {
  onSessionCreated: () => void;
  onOpenHistory: () => void;
}

export default function CreateSessionView({
  onSessionCreated,
  onOpenHistory,
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
  const [destination, setDestination] = useState("District General Hospital, Mumbai");
  const [etaHours, setEtaHours] = useState<number>(2.5);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & History Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass rounded-3xl border border-white/10">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 glow-accent flex-shrink-0">
            <ThermometerSnowflake className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-[10px] font-mono uppercase font-bold text-cyan-300 mb-1">
              Fleet Command Ready
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Launch Cold-Chain Transit Session
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Select vaccine classification tier, configure thermal tolerances, and initialize IoT telemetry.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 text-xs font-semibold shadow-md transition-all cursor-pointer group flex-shrink-0"
        >
          <History className="h-4 w-4 text-cyan-400 group-hover:rotate-[-20deg] transition-transform" />
          <span>View Session History & Audits</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <form onSubmit={handleSubmit} className="glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl space-y-8">
        {/* SECTION 1: Vaccine Classification Tier Selector */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                1. Select Vaccine Temperature Classification Tier
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Each tier enforces international WHO / CDC temperature thresholds and Arrhenius degradation parameters.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(VACCINE_TIERS) as VaccineTierType[]).map((tierKey) => {
              const tier = VACCINE_TIERS[tierKey];
              const isSelected = selectedTier === tierKey;
              return (
                <div
                  key={tierKey}
                  onClick={() => handleSelectTier(tierKey)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? `bg-slate-900/90 border-cyan-400 glow-accent ring-1 ring-cyan-400/50`
                      : `bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40`
                  }`}
                >
                  {/* Top Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        tierKey === "STANDARD_REFRIGERATED"
                          ? "bg-cyan-950/90 text-cyan-300 border border-cyan-800/60"
                          : tierKey === "FROZEN"
                          ? "bg-blue-950/90 text-blue-300 border border-blue-800/60"
                          : "bg-purple-950/90 text-purple-300 border border-purple-800/60"
                      }`}>
                        {tier.badge}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-white mb-1.5">
                      {tier.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                      {tier.description}
                    </p>
                  </div>

                  {/* Examples footer */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                      Common Payloads:
                    </span>
                    <p className="text-[10px] text-slate-300 line-clamp-2">
                      {tier.examples.join(", ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: Payload & Route Details */}
        <div>
          <label className="text-xs font-mono uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2 mb-4">
            <Box className="h-4 w-4 text-emerald-400" />
            2. Shipment Payload & Transport Hardware Details
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Vaccine Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Vaccine / Medicine Name *
              </label>
              <input
                type="text"
                required
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="e.g. DPT Vaccine, Oral Polio (OPV)"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Batch / Lot Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Batch / Lot Number
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="BAT-2026-902A"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Transport Equipment */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Transport Equipment
              </label>
              <select
                value={transportEquip}
                onChange={(e) => setTransportEquip(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {activeTierConfig.equipmentOptions.map((eq) => (
                  <option key={eq} value={eq} className="bg-slate-900 text-slate-100">
                    {eq}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Allowed Temp */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Min Allowed Temp (°C)</span>
                <span className="text-[10px] text-cyan-400 font-mono">Tier Recommended: {activeTierConfig.minTemp}°C</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={minTemp}
                onChange={(e) => setMinTemp(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Maximum Allowed Temp */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Max Allowed Temp (°C)</span>
                <span className="text-[10px] text-cyan-400 font-mono">Tier Recommended: {activeTierConfig.maxTemp}°C</span>
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={maxTemp}
                onChange={(e) => setMaxTemp(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* ETA in Hours */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Transit ETA (Hours) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="72"
                required
                value={etaHours}
                onChange={(e) => setEtaHours(parseFloat(e.target.value) || 2.5)}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Origin Location */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-cyan-400" /> Origin Facility
              </label>
              <input
                type="text"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Cold Hub, Central Depot"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Destination Location */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Truck className="h-3 w-3 text-emerald-400" /> Destination Hospital / Clinic
              </label>
              <input
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. District General Hospital, Mumbai"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Quick Presets Bar */}
        <div className="pt-2">
          <span className="text-[11px] font-mono text-slate-400 block mb-2">
            QUICK PRESETS:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleApplyPreset(
                  "DPT / Pentavalent Vaccine",
                  "STANDARD_REFRIGERATED",
                  "Ice-lined refrigerator (ILR) van"
                )
              }
              className="px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-700/50 text-xs text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              +2°C to +8°C Standard DPT
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
              className="px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-blue-950/40 border border-slate-800 hover:border-blue-700/50 text-xs text-slate-300 hover:text-blue-300 transition-colors cursor-pointer"
            >
              -25°C to -15°C Frozen OPV
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
              className="px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-700/50 text-xs text-slate-300 hover:text-purple-300 transition-colors cursor-pointer"
            >
              -80°C to -60°C mRNA ULT
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="h-4 w-4 text-cyan-400 flex-shrink-0" />
            Once launched, incoming ESP32 sensor telemetry will automatically link to this session until concluded.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 hover:from-cyan-400 to-blue-600 hover:to-blue-500 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-950/60 hover:shadow-cyan-500/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
