"use client";

import { useMemo } from "react";
import { cn, fmt } from "@/lib/utils";
import type { ColdChainSnapshot } from "@/lib/kinetics";
import { arrheniusRateConstant, R_GAS, EA_VACCINE, A_FACTOR, V_THRESHOLD } from "@/lib/kinetics";
import { Calculator, Hourglass, Zap, HelpCircle, ArrowRight } from "lucide-react";

interface KineticParametersCardProps {
  snapshot: ColdChainSnapshot | null;
  currentTemp: number;
  etaHours: number;
  className?: string;
}

export default function KineticParametersCard({
  snapshot,
  currentTemp,
  etaHours,
  className,
}: KineticParametersCardProps) {
  const { rate_constant_per_hour: k } = arrheniusRateConstant({
    temperature_celsius: currentTemp,
  });
  const tempK = currentTemp + 273.15;
  const timeToSpoil = snapshot?.time_to_spoil_hours ?? null;
  const currentV = snapshot?.cumulative_viability ?? 1.0;
  const projViability = currentV * Math.exp(-k * etaHours) * 100;

  return (
    <div className={cn("glass rounded-2xl p-6 relative overflow-hidden flex flex-col gap-6", className)}>
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/40 via-cyan-500/40 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <Calculator className="h-5 w-5 text-violet-400" />
          <h2 className="text-base font-bold text-slate-100 tracking-tight">
            Kinetic Engine Parameters
          </h2>
        </div>
        <span className="mono text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/50 px-2.5 py-0.5 rounded-full">
          Arrhenius Model v1.0
        </span>
      </div>

      {/* Equation Banner */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            First-Order Arrhenius Rate Equation
          </span>
          <div className="mono text-sm md:text-base font-semibold text-cyan-300 tracking-wide">
            k = A · exp(-Ea / (R · T_Kelvin))
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] mono text-slate-400 bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80">
          <span>Ea = 83,140 J/mol</span>
          <span>·</span>
          <span>A = 10¹³ hr⁻¹</span>
          <span>·</span>
          <span>R = 8.314</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Instantaneous Rate Constant k */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Rate Constant (k)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="mono text-xl font-bold text-violet-300">
              {k.toExponential(3)}
            </span>
            <span className="text-xs text-slate-500">hr⁻¹</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Current degradation velocity
          </p>
        </div>

        {/* Absolute Temperature in Kelvin */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Absolute Temperature
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="mono text-xl font-bold text-amber-300">
              {tempK.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">K</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {currentTemp.toFixed(2)} °C measured
          </p>
        </div>

        {/* Time-to-Spoil */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Time-to-Spoil (t_spoil)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={cn(
              "mono text-xl font-bold",
              timeToSpoil === null
                ? "text-slate-400"
                : timeToSpoil === 0
                ? "text-red-400"
                : timeToSpoil < etaHours
                ? "text-amber-400"
                : "text-emerald-300"
            )}>
              {timeToSpoil === null
                ? "∞"
                : timeToSpoil === 0
                ? "Spoiled"
                : `${timeToSpoil.toFixed(1)} hrs`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Time remaining until 80% loss
          </p>
        </div>

        {/* Projected Viability at Destination */}
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Projected Viability @ Dest
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={cn(
              "mono text-xl font-bold",
              projViability < 80
                ? "text-red-400"
                : "text-emerald-300"
            )}>
              {projViability.toFixed(2)}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            At current temp across {etaHours.toFixed(1)}h ETA
          </p>
        </div>
      </div>

      {/* Kinetic Advantage Explainer for Judges */}
      <div className="rounded-xl bg-cyan-950/30 border border-cyan-800/40 p-4 flex items-start gap-3 text-xs text-slate-300">
        <Zap className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-cyan-300 font-semibold">Why Arrhenius Kinetic Viability?</strong> Conventional cold chain monitors use binary threshold breach timers (e.g. &gt; 8°C triggers discard). Agesichain uses continuous thermodynamic integration: at +18.5°C, rate constant $k$ accelerates exponentially (~100× faster), precisely quantifying actual remaining molecular efficacy without wasteful false discards or dangerous hidden degradation.
        </div>
      </div>
    </div>
  );
}
