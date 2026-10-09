"use client";

import { useState } from "react";
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
  Building,
  Navigation,
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
}

export default function DestinationConfigCard({
  meta,
  etaHours,
  timeToSpoil,
  onUpdateRoute,
  loading,
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

  // Viability buffer calculation
  const bufferHours = timeToSpoil !== null ? timeToSpoil - eta : null;
  const isBufferSafe = bufferHours !== null && bufferHours > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateRoute(Number(eta), {
      name,
      origin,
      destination,
      destinationLat: Number(destLat),
      destinationLng: Number(destLng),
    });
    setSavedSuccess(true);
    setIsEditing(false);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const applyPreset = (presetOrigin: string, presetDest: string, presetEta: number, pLat: number, pLng: number) => {
    setOrigin(presetOrigin);
    setDestination(presetDest);
    setEta(presetEta);
    setDestLat(pLat);
    setDestLng(pLng);
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
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Saved!
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Configure delivery destination, coordinates, and transit ETA
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-cyan-300 font-medium transition-all cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isEditing ? "Cancel" : "Configure"}</span>
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
                  <Clock className="h-3 w-3 text-amber-400" /> Transit ETA
                </span>
                <p className="mt-1 text-xs font-mono font-bold text-amber-300">
                  {etaHours.toFixed(1)} hrs
                </p>
              </div>
            </div>

            {/* Kinetic Explanation Banner */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-cyan-200">
                  How Time-to-Spoil ($T_{`\\text{spoil}`}$) connects to your Destination:
                </span>{" "}
                <span className="text-slate-300">
                  Time-to-Spoil is the chemical shelf-life ({timeToSpoil !== null ? timeToSpoil.toFixed(1) + " hrs" : "calculating..."}) under current heat decay. The <strong>Viability Buffer</strong> is{" "}
                  <code className="text-cyan-300 mono bg-slate-900 px-1 py-0.5 rounded">
                    T_spoil ({timeToSpoil !== null ? timeToSpoil.toFixed(1) : "—"}h) - ETA ({etaHours.toFixed(1)}h) = {bufferHours !== null ? (bufferHours > 0 ? "+" + bufferHours.toFixed(1) : bufferHours.toFixed(1)) + " hrs" : "—"}
                  </code>.{" "}
                  {bufferHours !== null && (
                    <strong className={isBufferSafe ? "text-emerald-400" : "text-red-400"}>
                      {isBufferSafe
                        ? "Shipment will arrive before spoilage threshold."
                        : "WARNING: Shipment will spoil before reaching destination!"}
                    </strong>
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset("Serum Institute, Pune", "KEM Hospital, Pune", 1.2, 18.5284, 73.8743)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
              >
                🏥 Pune Local (1.2h)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Cold Hub, Pune", "District Hospital, Mumbai", 3.5, 18.9822, 72.8335)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
              >
                🚚 Pune ➔ Mumbai (3.5h)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("Vaccine Depot, Pune", "AIIMS Nagpur", 9.0, 21.1458, 79.0882)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 cursor-pointer"
              >
                ✈️ Pune ➔ Nagpur (9.0h)
              </button>
            </div>

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
                  <span className="mono text-cyan-400 font-bold">{eta} hrs</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="48"
                  value={eta}
                  onChange={(e) => setEta(parseFloat(e.target.value) || 1)}
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
                  step="0.0001"
                  value={destLat}
                  onChange={(e) => setDestLat(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase">
                  Destination Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={destLng}
                  onChange={(e) => setDestLng(parseFloat(e.target.value) || 0)}
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
                disabled={loading}
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
