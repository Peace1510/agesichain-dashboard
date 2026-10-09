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
  cyan:    { icon: "text-cyan-400",    bar: "from-cyan-500/30 to-transparent",    val: "text-cyan-300"    },
  emerald: { icon: "text-emerald-400", bar: "from-emerald-500/30 to-transparent", val: "text-emerald-300" },
  amber:   { icon: "text-amber-400",   bar: "from-amber-500/30 to-transparent",   val: "text-amber-300"   },
  red:     { icon: "text-red-400",     bar: "from-red-500/30 to-transparent",     val: "text-red-300"     },
  violet:  { icon: "text-violet-400",  bar: "from-violet-500/30 to-transparent",  val: "text-violet-300"  },
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
  const a = ACCENT_MAP[accent];

  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
        className
      )}
    >
      {/* Gradient bleed from top */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          a.bar
        )}
      />

      {/* Header row */}
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {icon && (
          <span className={cn("opacity-80", a.icon)}>
            {icon}
          </span>
        )}
      </div>

      {/* Main value */}
      <div className="mt-2 flex items-end gap-1.5">
        <span
          className={cn(
            "fade-up mono text-3xl font-bold leading-none tracking-tight",
            a.val
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="mb-0.5 text-sm font-medium text-slate-500">{unit}</span>
        )}
      </div>

      {/* Sub-value */}
      {subValue && (
        <p className="mt-1.5 text-[11px] text-slate-500">{subValue}</p>
      )}
    </div>
  );
}
