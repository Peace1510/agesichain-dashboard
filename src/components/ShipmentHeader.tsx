"use client";

import { cn, fmtTimestamp } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import UserNav from "@/components/UserNav";
import type { ShipmentStatus } from "@/lib/kinetics";
import type { ShipmentMeta, ActiveSessionInfo } from "@/lib/store";
import {
  MapPin,
  Truck,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  ThermometerSnowflake,
  Archive,
  History,
  AlertTriangle,
  PlusCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface ShipmentHeaderProps {
  meta: ShipmentMeta;
  status: ShipmentStatus;
  lastUpdated: number | null;
  etaHours: number;
  isConnected: boolean;
  activeSession?: ActiveSessionInfo | null;
  onRefresh: () => void;
  onEndSession?: () => void;
  onOpenHistory?: () => void;
  onOpenCreateSession?: () => void;
  className?: string;
}

export default function ShipmentHeader({
  meta,
  status,
  lastUpdated,
  etaHours,
  isConnected,
  activeSession,
  onRefresh,
  onEndSession,
  onOpenHistory,
  onOpenCreateSession,
  className,
}: ShipmentHeaderProps) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "VIEWER";
  const isAdmin = role === "ADMIN";

  return (
    <header className={cn("glass rounded-2xl p-5 sm:p-6 relative overflow-hidden border border-white/[0.07] shadow-lg", className)}>
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-neutral-700 via-emerald-500/40 to-neutral-700 opacity-80" />

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        {/* Left: Brand + Shipment Identification */}
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-neutral-800 border border-neutral-700/80 flex items-center justify-center flex-shrink-0 text-neutral-200 shadow-sm">
            <ThermometerSnowflake className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-300 bg-neutral-800/90 border border-neutral-700/80 px-2.5 py-0.5 rounded-md mono">
                AGESICHAIN IoT
              </span>
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
                {meta.name}
              </h1>
              {activeSession && (
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 mono">
                  {activeSession.vaccineTier.replace("_", " ")}
                </span>
              )}
              {meta.id !== "—" && (
                <span className="mono text-[11px] font-semibold text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                  {meta.id}
                </span>
              )}
            </div>

            {/* Route path */}
            <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
                <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                <span>{meta.origin !== "—" ? meta.origin.split(",")[0] : "Cold Hub, Pune"}</span>
              </span>
              <span className="text-neutral-600">➔</span>
              <span className="flex items-center gap-1.5 text-neutral-200 font-medium">
                <Truck className="h-3.5 w-3.5 text-emerald-400" />
                <span>{meta.destination !== "—" ? meta.destination.split(",")[0] : "District Hospital, Mumbai"}</span>
              </span>
              <span className="text-neutral-600">·</span>
              <span className="flex items-center gap-1 text-neutral-300 mono bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
                <Clock className="h-3 w-3 text-amber-400" />
                <span>{etaHours.toFixed(1)}h ETA</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions, Status & User */}
        <div className="flex flex-wrap items-center gap-2.5 xl:self-center">
          {/* Live telemetry heartbeat */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
            {isConnected ? (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-neutral-600" />
            )}
            <span className={cn("text-xs font-medium mono", isConnected ? "text-emerald-300" : "text-neutral-400")}>
              {isConnected ? "Live 1s" : "Offline"}
            </span>
          </div>

          {/* Master Status Badge */}
          <StatusBadge status={status} size="md" />

          {/* History shortcut */}
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              title="Shipment History & Audits"
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <History className="h-3.5 w-3.5 text-neutral-400" />
              <span>History</span>
            </button>
          )}

          {/* Launch New Session Button - ONLY FOR ADMIN */}
          {isAdmin && onOpenCreateSession && !activeSession && (
            <button
              onClick={onOpenCreateSession}
              title="Configure and Launch New Transit Session"
              className="px-3.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Launch Session</span>
            </button>
          )}

          {/* End Session Button - ONLY FOR ADMIN */}
          {isAdmin && onEndSession && activeSession && (
            <button
              onClick={onEndSession}
              title="Conclude Active Transit Session"
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition-all cursor-pointer active:scale-95"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>End Session</span>
            </button>
          )}

          {/* Manual refresh button */}
          <button
            onClick={onRefresh}
            title="Poll telemetry now"
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* User profile & Sign Out */}
          <UserNav />
        </div>
      </div>
    </header>
  );
}
