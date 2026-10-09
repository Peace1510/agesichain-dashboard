"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { cn, fmtTimestamp, fmt } from "@/lib/utils";
import type { TelemetryReading } from "@/lib/store";
import { arrheniusRateConstant, computeViabilityDecay, V_THRESHOLD } from "@/lib/kinetics";
import { Thermometer, ShieldAlert, Activity, ZoomIn } from "lucide-react";

interface TelemetryChartsProps {
  readings: TelemetryReading[];
  className?: string;
}

interface ChartPoint {
  index: number;
  timeStr: string;
  timestamp: number;
  temperature: number;
  humidity: number;
  viabilityPct: number;
  kRate: number;
}

export default function TelemetryCharts({ readings, className }: TelemetryChartsProps) {
  const [activeTab, setActiveTab] = useState<"both" | "temperature" | "viability">("both");

  // Compute chronological series with kinetics decay
  const data: ChartPoint[] = useMemo(() => {
    if (!readings || readings.length === 0) return [];

    const sorted = [...readings].sort((a, b) => a.timestamp - b.timestamp);
    const points: ChartPoint[] = [];

    let currentV = 1.0;

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const { rate_constant_per_hour: k } = arrheniusRateConstant({
        temperature_celsius: r.temperature,
      });

      if (i > 0) {
        const step = computeViabilityDecay({
          viability_prev: Math.max(0, Math.min(1, currentV)),
          timestamp_prev_unix_s: sorted[i - 1].timestamp,
          timestamp_current_unix_s: r.timestamp,
          temperature_celsius: r.temperature,
        });
        currentV = step.viability_new;
      }

      points.push({
        index: i + 1,
        timeStr: fmtTimestamp(r.timestamp),
        timestamp: r.timestamp,
        temperature: Number(r.temperature.toFixed(2)),
        humidity: Number(r.humidity.toFixed(1)),
        viabilityPct: Number((currentV * 100).toFixed(2)),
        kRate: Number(k.toFixed(6)),
      });
    }

    return points;
  }, [readings]);

  // Compute temp min/max for scale bounds
  const tempDomain = useMemo(() => {
    if (data.length === 0) return [0, 25];
    const temps = data.map((d) => d.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    return [Math.max(-5, Math.floor(min - 2)), Math.ceil(max + 3)];
  }, [data]);

  return (
    <div className={cn("glass rounded-2xl p-6 flex flex-col gap-6", className)}>
      {/* Header with selector tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100 tracking-tight">
            Kinetic Telemetry Visualizer
          </h2>
          <span className="text-xs text-slate-500 mono">({data.length} data points)</span>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("both")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "both"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Combined View
          </button>
          <button
            onClick={() => setActiveTab("temperature")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "temperature"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Temperature (°C)
          </button>
          <button
            onClick={() => setActiveTab("viability")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "viability"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Viability (%)
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Activity className="h-8 w-8 text-slate-600 animate-pulse" />
          <p className="text-sm">Waiting for incoming telemetry stream...</p>
          <span className="text-xs text-slate-600">
            Click &apos;Trigger Heat Spike&apos; or connect ESP32 hardware
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 1. TEMPERATURE CHART */}
          {(activeTab === "both" || activeTab === "temperature") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Thermometer className="h-4 w-4 text-amber-400" />
                  Thermal Profile (°C) vs WHO Cold Chain Envelope [2.0°C – 8.0°C]
                </span>
                <span className="text-[11px] text-slate-500 mono">
                  Latest: {data[data.length - 1].temperature.toFixed(2)} °C
                </span>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} />

                    <XAxis
                      dataKey="timeStr"
                      tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={tempDomain}
                      tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                      unit="°C"
                    />

                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload as ChartPoint;
                        const isExcursion = pt.temperature > 8.0 || pt.temperature < 2.0;
                        return (
                          <div className="glass p-3 rounded-xl border border-slate-700 text-xs shadow-2xl">
                            <p className="mono font-semibold text-slate-400 mb-1">{pt.timeStr}</p>
                            <p className="font-bold text-amber-300 text-sm">
                              Temp: {pt.temperature} °C
                            </p>
                            <p className="text-slate-400 text-[11px]">Humidity: {pt.humidity}%</p>
                            <p className="text-slate-400 text-[11px] mono">
                              k: {pt.kRate} hr⁻¹
                            </p>
                            {isExcursion && (
                              <p className="text-red-400 font-semibold mt-1 text-[11px]">
                                ⚠ Thermal Excursion Detected
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />

                    {/* WHO Safe Zone [2°C – 8°C] Shading */}
                    <ReferenceArea
                      y1={2.0}
                      y2={8.0}
                      fill="#10b981"
                      fillOpacity={0.07}
                      stroke="#10b981"
                      strokeOpacity={0.2}
                      strokeDasharray="2 2"
                    />

                    {/* Excursion Limit Line */}
                    <ReferenceLine
                      y={8.0}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      label={{
                        value: "Max Safe (+8°C)",
                        position: "insideTopRight",
                        fill: "#ef4444",
                        fontSize: 9,
                        fontFamily: "JetBrains Mono",
                      }}
                    />
                    <ReferenceLine
                      y={2.0}
                      stroke="#06b6d4"
                      strokeDasharray="3 3"
                      label={{
                        value: "Min Safe (+2°C)",
                        position: "insideBottomRight",
                        fill: "#06b6d4",
                        fontSize: 9,
                        fontFamily: "JetBrains Mono",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#tempGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 2. VIABILITY DECAY CHART */}
          {(activeTab === "both" || activeTab === "viability") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <ShieldAlert className="h-4 w-4 text-emerald-400" />
                  Arrhenius Viability Decay Curve (Critical Threshold: 80.00%)
                </span>
                <span className="text-[11px] text-slate-500 mono">
                  Latest: {data[data.length - 1].viabilityPct.toFixed(2)} %
                </span>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="viabilityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} />

                    <XAxis
                      dataKey="timeStr"
                      tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[70, 100]}
                      tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#334155" }}
                      tickLine={false}
                      unit="%"
                    />

                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload as ChartPoint;
                        const isUnder = pt.viabilityPct < V_THRESHOLD * 100;
                        return (
                          <div className="glass p-3 rounded-xl border border-slate-700 text-xs shadow-2xl">
                            <p className="mono font-semibold text-slate-400 mb-1">{pt.timeStr}</p>
                            <p
                              className={cn(
                                "font-bold text-sm",
                                isUnder ? "text-red-400" : "text-emerald-300"
                              )}
                            >
                              Viability: {pt.viabilityPct}%
                            </p>
                            <p className="text-slate-400 text-[11px] mono">
                              Margin to Threshold: {(pt.viabilityPct - 80).toFixed(2)} pp
                            </p>
                          </div>
                        );
                      }}
                    />

                    {/* Critical Threshold Line */}
                    <ReferenceLine
                      y={80.0}
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={{
                        value: "Critical Threshold (80%)",
                        position: "insideTopLeft",
                        fill: "#ef4444",
                        fontSize: 10,
                        fontFamily: "JetBrains Mono",
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="viabilityPct"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#viabilityGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
