"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Activity,
  Archive,
  Thermometer,
  ShieldAlert,
  X,
} from "lucide-react";
import type { ActiveSessionInfo } from "@/lib/store";
import type { ColdChainSnapshot } from "@/lib/kinetics";

interface EndSessionModalProps {
  session: ActiveSessionInfo;
  snapshot: ColdChainSnapshot | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EndSessionModal({
  session,
  snapshot,
  isOpen,
  onClose,
  onSuccess,
}: EndSessionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentViability = snapshot ? snapshot.cumulative_viability * 100 : 100;
  const status = snapshot?.evaluation?.status ?? "NOMINAL";

  const handleEnd = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions/active", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to conclude session.");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end session.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Archive className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Conclude Transit Session
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Session Code: <span className="text-neutral-200 font-bold">{session.sessionCode}</span>
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-neutral-300 mb-5 leading-relaxed">
          Ending this session will finalize all telemetry logging, compute cumulative kinetic viability,
          and permanently store this shipment’s complete audit history in PostgreSQL.
        </p>

        {/* Audit Preview Card */}
        <div className="p-4 rounded-2xl bg-[#141518] border border-neutral-800 space-y-3 mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Vaccine / Payload:</span>
            <span className="font-semibold text-neutral-200">{session.vaccineName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Classification Tier:</span>
            <span className="font-mono text-neutral-200 font-medium">{session.vaccineTier}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Allowed Envelope:</span>
            <span className="font-mono text-neutral-300">{session.minTemp}°C to {session.maxTemp}°C</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Readings Recorded:</span>
            <span className="font-mono text-emerald-400 font-bold">{session.totalReadings} points</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-400">Thermal Excursions:</span>
            <span className={`font-mono font-bold ${session.excursionCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {session.excursionCount} events
            </span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-neutral-800 pt-2.5">
            <span className="text-neutral-400">Final Potency Viability:</span>
            <span className={`font-mono font-bold ${currentViability < 80 ? "text-rose-400" : "text-emerald-400"}`}>
              {currentViability.toFixed(2)}%
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEnd}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-950/50 hover:shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Archiving Session...</span>
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" />
                <span>Conclude & Archive Session</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
