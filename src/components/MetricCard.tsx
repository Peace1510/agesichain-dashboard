"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MetricCardProps {
  label:     string;
  value:     string | number;
  unit?:     string;
  subValue?: string;
  icon?:     ReactNode;
  accent?:   "cyan" | "emerald" | "amber" | "red" | "violet";
  trend?:    "up" | "down" | "flat";
  className?: string;
}

const ACCENT_MAP = {
  cyan: {
    iconBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    val: "text-slate-100",
    topLine: "from-blue-500/40 via-blue-500/10 to-transparent",
    sub: "text-slate-400",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    val: "text-emerald-300",
    topLine: "from-emerald-500/40 via-emerald-500/10 to-transparent",
    sub: "text-emerald-400/80",
  },
  amber: {
    iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    val: "text-amber-300",
    topLine: "from-amber-500/40 via-amber-500/10 to-transparent",
    sub: "text-amber-400/80",
  },
  red: {
    iconBg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    val: "text-rose-300",
    topLine: "from-rose-500/40 via-rose-500/10 to-transparent",
    sub: "text-rose-400/80",
  },
  violet: {
    iconBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    val: "text-slate-100",
    topLine: "from-indigo-500/40 via-indigo-500/10 to-transparent",
    sub: "text-slate-400",
  },
};

export default function MetricCard({
  label,
  value,
  unit,
  subValue,
  icon,
  accent = "cyan",
  className,
}: MetricCardProps) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.cyan;

  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-4.5 border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 flex flex-col justify-between group",
        className
      )}
    >
      {/* Subtle top accent line */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          a.topLine
        )}
      />

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
          {label}
        </span>
        {icon && (
          <div className={cn("h-7 w-7 rounded-lg border flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105", a.iconBg)}>
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={cn(
            "fade-up mono text-2xl lg:text-[26px] font-bold leading-none tracking-tight",
            a.val
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-400 mono">{unit}</span>
        )}
      </div>

      {/* Sub-value / status badge */}
      {subValue && (
        <p className={cn("mt-2 text-[11px] font-medium truncate", a.sub)}>
          {subValue}
        </p>
      )}
    </div>
  );
}
