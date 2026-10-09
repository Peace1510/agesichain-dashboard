"use client";

import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/lib/kinetics";

interface StatusBadgeProps {
  status: ShipmentStatus;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const CONFIG: Record<
  ShipmentStatus,
  { label: string; dot: string; badge: string; glow: string }
> = {
  NOMINAL: {
    label: "NOMINAL",
    dot:   "bg-emerald-400 text-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-300 border-emerald-500/30",
    glow:  "glow-nominal",
  },
  WARNING: {
    label: "WARNING",
    dot:   "bg-amber-400 text-amber-400",
    badge: "bg-amber-400/10 text-amber-300 border-amber-500/30",
    glow:  "glow-warning",
  },
  CRITICAL: {
    label: "CRITICAL",
    dot:   "bg-red-400 text-red-400",
    badge: "bg-red-400/10 text-red-300 border-red-500/30",
    glow:  "glow-critical",
  },
};

const SIZE = {
  sm: { badge: "px-2 py-0.5 text-[10px]", dot: "w-1.5 h-1.5" },
  md: { badge: "px-3 py-1   text-xs",     dot: "w-2 h-2"     },
  lg: { badge: "px-4 py-1.5 text-sm",     dot: "w-2.5 h-2.5" },
};

export default function StatusBadge({
  status,
  className,
  size = "md",
}: StatusBadgeProps) {
  const cfg  = CONFIG[status];
  const szBadge = SIZE[size].badge;
  const szDot   = SIZE[size].dot;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-widest",
        cfg.badge,
        cfg.glow,
        szBadge,
        className
      )}
    >
      {/* Animated pulse dot */}
      <span className={cn("status-dot flex-shrink-0", szDot, cfg.dot)} />
      {cfg.label}
    </span>
  );
}
