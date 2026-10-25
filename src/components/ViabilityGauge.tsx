"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/lib/kinetics";

interface ViabilityGaugeProps {
  /** Viability fraction  [0.0 – 1.0] */
  viability: number;
  status:    ShipmentStatus;
  className?: string;
}

const STATUS_COLORS: Record<ShipmentStatus, { stroke: string; text: string; glow: string }> = {
  NOMINAL:  { stroke: "#10b981", text: "text-emerald-400", glow: "drop-shadow(0 0 12px rgba(16,185,129,0.6))"  },
  WARNING:  { stroke: "#f59e0b", text: "text-amber-400",   glow: "drop-shadow(0 0 12px rgba(245,158,11,0.6))"  },
  CRITICAL: { stroke: "#ef4444", text: "text-red-400",     glow: "drop-shadow(0 0 12px rgba(239,68,68,0.6))"   },
};

/** Radius of the arc (SVG units). */
const R = 70;
/** Total circumference. */
const CIRC = 2 * Math.PI * R;
/**
 * Arc spans 270° (from 135° to 405°, i.e. bottom-left → bottom-right).
 * We represent this as a fraction of the full circumference.
 */
const ARC_FRACTION = 0.75;
const ARC_LEN = CIRC * ARC_FRACTION;

/** Pre-computed tick marks with fixed coordinate precision to prevent SSR hydration differences. */
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((t) => {
  const angleDeg = 135 + t * 270;
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    t,
    x1: Number((80 + (R - 6) * Math.cos(angleRad)).toFixed(2)),
    y1: Number((80 + (R - 6) * Math.sin(angleRad)).toFixed(2)),
    x2: Number((80 + (R + 6) * Math.cos(angleRad)).toFixed(2)),
    y2: Number((80 + (R + 6) * Math.sin(angleRad)).toFixed(2)),
  };
});

export default function ViabilityGauge({
  viability,
  status,
  className,
}: ViabilityGaugeProps) {
  /** Clamp viability to [0, 1] for display. */
  const clamped = Math.max(0, Math.min(1, viability));

  /**
   * The visual color of the viability gauge strictly reflects actual biological potency:
   *  >= 90%: NOMINAL (emerald green)
   *  80% - 90%: WARNING (amber - approaching critical threshold)
   *  < 80%: CRITICAL (red - potency breach)
   */
  const viabilityTier: ShipmentStatus =
    clamped < 0.80 ? "CRITICAL" : clamped < 0.90 ? "WARNING" : "NOMINAL";

  const cfg = STATUS_COLORS[viabilityTier];

  /** How much of the arc is "filled". */
  const filledLen = useMemo(() => clamped * ARC_LEN, [clamped]);

  /** The dash offset makes the stroke appear to fill from the start of the arc. */
  const dashOffset = useMemo(
    () => Number((CIRC * ARC_FRACTION - filledLen).toFixed(2)),
    [filledLen]
  );

  const pct = (clamped * 100).toFixed(2);

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className="relative">
        <svg
          width="190"
          height="190"
          viewBox="0 0 160 160"
          className="overflow-visible"
          style={{ filter: cfg.glow }}
          suppressHydrationWarning
        >
          {/* ── Track arc (background) ─────────────────────────────────────── */}
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LEN.toFixed(2)} ${(CIRC - ARC_LEN).toFixed(2)}`}
            strokeDashoffset={0}
            transform="rotate(135 80 80)"
          />

          {/* ── Value arc (foreground) ─────────────────────────────────────── */}
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={cfg.stroke}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LEN.toFixed(2)} ${(CIRC - ARC_LEN).toFixed(2)}`}
            strokeDashoffset={dashOffset}
            transform="rotate(135 80 80)"
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
          />

          {/* ── Tick marks at 20% intervals ─────────────────────────────────── */}
          {TICKS.map((tick) => (
            <line
              key={tick.t}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          ))}

          {/* ── Center text ────────────────────────────────────────────────── */}
          <text
            x="80" y="74"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="27"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="800"
            style={{ transition: "fill 0.4s ease" }}
          >
            {pct}%
          </text>
          <text
            x="80" y="92"
            textAnchor="middle"
            fill={cfg.stroke}
            fontSize="9"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
            letterSpacing="2.5"
          >
            POTENCY
          </text>

          {/* ── Scale labels ────────────────────────────────────────────────── */}
          <text x="18" y="146" textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="'JetBrains Mono'">0%</text>
          <text x="142" y="146" textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="'JetBrains Mono'">100%</text>
          <text x="80"  y="20"  textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="'JetBrains Mono'">50%</text>
        </svg>
      </div>

      {/* Threshold marker label */}
      <div className="flex items-center gap-2 text-[11px] font-mono px-3 py-1 rounded-full bg-slate-900/80 border border-white/[0.06] text-slate-400">
        <span>Min: <span className="text-rose-400 font-semibold">80%</span></span>
        <span className="text-slate-600">·</span>
        <span>Margin: <span className={cn("font-bold", cfg.text)}>{((clamped - 0.8) * 100).toFixed(2)} pp</span></span>
      </div>
    </div>
  );
}
