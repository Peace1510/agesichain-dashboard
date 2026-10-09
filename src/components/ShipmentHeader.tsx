"use client";

import { cn, fmtTimestamp } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import type { ShipmentStatus } from "@/lib/kinetics";
import type { ShipmentMeta } from "@/lib/store";
import {
  ShieldCheck,
  MapPin,
  Truck,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  ThermometerSnowflake,
} from "lucide-react";

interface ShipmentHeaderProps {
  meta: ShipmentMeta;
  status: ShipmentStatus;
  lastUpdated: number | null;
  etaHours: number;
  isConnected: boolean;
  onRefresh: () => void;
  className?: string;
}

export default function ShipmentHeader({
  meta,
  status,
  lastUpdated,
  etaHours,
  isConnected,
  onRefresh,
  className,
}: ShipmentHeaderProps) {
  return (
    <header className={cn("glass rounded-2xl p-6 relative overflow-hidden", className)}>
      {/* Top accent gradient line */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-violet-500 opacity-80" />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Brand + Shipment Identification */}
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 text-cyan-400 glow-accent">
            <ThermometerSnowflake className="h-6 w-6" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2.5 py-0.5 rounded-full mono">
                AGESICHAIN IoT
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                {meta.name}
              </h1>
              {meta.id !== "—" && (
                <span className="mono text-xs font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                  {meta.id}
                </span>
              )}
            </div>

            {/* Route path */}
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {meta.origin !== "—" && (
                <>
                  <span className="flex items-center gap-1 text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-slate-400">Origin:</span> {meta.origin}
                  </span>
                  <span className="text-slate-600">➔</span>
                </>
              )}
              {meta.destination !== "—" && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Truck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-slate-400">Destination:</span> {meta.destination}
                </span>
              )}
              {meta.destination !== "—" && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-slate-300 mono">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span>ETA:</span> {etaHours.toFixed(1)} hrs
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Connection Status, Overall Status Badge & Refresh */}
        <div className="flex flex-wrap items-center gap-4 lg:self-center">
          {/* Live telemetry heartbeat */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-slate-500" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400 leading-tight">
                Telemetric Feed
              </span>
              <span className={cn("mono text-[11px] font-medium", isConnected ? "text-emerald-300" : "text-slate-500")}>
                {isConnected && lastUpdated
                  ? `Live (${fmtTimestamp(lastUpdated)})`
                  : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Master Status Badge */}
          <StatusBadge status={status} size="lg" />

          {/* Manual refresh button */}
          <button
            onClick={onRefresh}
            title="Poll telemetry now"
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-cyan-300 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
