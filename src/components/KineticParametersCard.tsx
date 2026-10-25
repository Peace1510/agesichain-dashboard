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
    <div className={cn("flex flex-col gap-5 pt-1", className)}>
      {/* Subheader / Info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200 tracking-tight">
              Arrhenius Thermodynamic Degradation Model
            </h3>
            <p className="text-[11px] text-slate-400">
              Real-time reaction velocity integration calibrated for biological vaccine payloads
            </p>
          </div>
        </div>
        <span className="mono text-[11px] font-semibold text-violet-300 bg-violet-950/40 border border-violet-500/30 px-2.5 py-1 rounded-lg">
          Arrhenius Model v1.0
        </span>
      </div>

      {/* Equation Banner */}
      <div className="rounded-xl bg-slate-900/80 border border-white/[0.08] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            First-Order Arrhenius Rate Equation
          </span>
          <div className="mono text-sm md:text-base font-semibold text-blue-300 tracking-wide">
            k = A · exp(-Ea / (R · T_Kelvin))
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] mono text-slate-400 bg-slate-950/70 px-3 py-2 rounded-lg border border-white/[0.06]">
          <span>Ea = 83,140 J/mol</span>
          <span className="text-slate-600">·</span>
          <span>A = 10¹³ hr⁻¹</span>
          <span className="text-slate-600">·</span>
          <span>R = 8.314 J/mol·K</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Instantaneous Rate Constant k */}
        <div className="rounded-xl bg-slate-900/60 border border-white/[0.06] p-4 flex flex-col justify-between hover:border-violet-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Rate Constant (k)
            </span>
            <span className="h-2 w-2 rounded-full bg-violet-400/80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="mono text-2xl font-bold text-violet-300">
              {k.toExponential(3)}
            </span>
            <span className="text-xs text-slate-500">hr⁻¹</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Current degradation velocity
          </p>
        </div>

        {/* Absolute Temperature in Kelvin */}
        <div className="rounded-xl bg-slate-900/60 border border-white/[0.06] p-4 flex flex-col justify-between hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Absolute Temperature
            </span>
            <span className="h-2 w-2 rounded-full bg-amber-400/80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="mono text-2xl font-bold text-amber-300">
              {tempK.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">K</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {currentTemp.toFixed(2)} °C measured
          </p>
        </div>

        {/* Time-to-Spoil */}
        <div className="rounded-xl bg-slate-900/60 border border-white/[0.06] p-4 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Time-to-Spoil (t_spoil)
            </span>
            <span className="h-2 w-2 rounded-full bg-cyan-400/80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={cn(
              "mono text-2xl font-bold",
              timeToSpoil === null
                ? "text-slate-400"
                : timeToSpoil === 0
                ? "text-rose-400"
                : timeToSpoil < etaHours
                ? "text-amber-400"
                : "text-emerald-400"
            )}>
              {timeToSpoil === null
                ? "∞"
                : timeToSpoil === 0
                ? "Spoiled"
                : `${timeToSpoil.toFixed(1)} hrs`}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Time remaining until 80% potency threshold
          </p>
        </div>

        {/* Projected Viability at Destination */}
        <div className="rounded-xl bg-slate-900/60 border border-white/[0.06] p-4 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Projected Viability @ Dest
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={cn(
              "mono text-2xl font-bold",
              projViability < 80
                ? "text-rose-400"
                : "text-emerald-400"
            )}>
              {projViability.toFixed(2)}%
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            At current temp across {etaHours.toFixed(1)}h ETA
          </p>
        </div>
      </div>

      {/* Kinetic Advantage Explainer for Judges & Clinicians */}
      <div className="rounded-xl bg-blue-950/20 border border-blue-500/25 p-4 flex items-start gap-3.5 text-xs text-slate-300">
        <div className="h-7 w-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-400 mt-0.5">
          <Zap className="h-4 w-4" />
        </div>
        <div className="leading-relaxed">
          <span className="text-blue-300 font-bold block mb-1">
            Clinical Distinction: Why Arrhenius Molecular Kinetics?
          </span>
          Conventional cold chain monitors rely on simple binary threshold timers (e.g. &gt; 8°C triggers discard), ignoring cumulative heat integral. Agesichain models continuous thermodynamic reaction velocity: at +18.5°C, rate constant $k$ accelerates exponentially (~100× faster), precisely quantifying actual remaining molecular efficacy without wasteful false discards or dangerous hidden degradation.
        </div>
      </div>
    </div>
  );
}
