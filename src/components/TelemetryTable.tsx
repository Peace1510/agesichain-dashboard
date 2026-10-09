"use client";

import { useMemo } from "react";
import { cn, fmtTimestamp, fmt } from "@/lib/utils";
import type { TelemetryReading } from "@/lib/store";
import { arrheniusRateConstant } from "@/lib/kinetics";
import { Table, MapPin, Gauge, Droplets, Thermometer, Radio } from "lucide-react";

interface TelemetryTableProps {
  readings: TelemetryReading[];
  className?: string;
}

export default function TelemetryTable({ readings, className }: TelemetryTableProps) {
  // Show most recent readings first
  const reversed = useMemo(() => {
    return [...readings].sort((a, b) => b.timestamp - a.timestamp);
  }, [readings]);

  return (
    <div className={cn("glass rounded-2xl p-6 relative overflow-hidden flex flex-col gap-4", className)}>
      {/* Top accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-500/30 via-slate-600/30 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <Table className="h-5 w-5 text-cyan-400" />
          <h2 className="text-base font-bold text-slate-100 tracking-tight">
            Telemetry Ingestion Log
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 mono">
          {readings.length} Packets Received
        </span>
      </div>

      {readings.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          No telemetry logged yet. Data packets will populate automatically upon arrival.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-500 sticky top-0 bg-slate-950/90 backdrop-blur z-10">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Device ID</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Humidity</th>
                <th className="py-2.5 px-3">GPS Location</th>
                <th className="py-2.5 px-3">Speed</th>
                <th className="py-2.5 px-3">k (hr⁻¹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {reversed.map((r, i) => {
                const isSafe = r.temperature >= 2.0 && r.temperature <= 8.0;
                const { rate_constant_per_hour: k } = arrheniusRateConstant({
                  temperature_celsius: r.temperature,
                });

                return (
                  <tr
                    key={`${r.timestamp}-${i}`}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2 px-3 mono text-slate-300">
                      {fmtTimestamp(r.timestamp)}
                    </td>
                    <td className="py-2 px-3 mono text-slate-400 text-[11px]">
                      {r.device_id}
                    </td>
                    <td className="py-2 px-3 mono font-semibold">
                      <span
                        className={cn(
                          isSafe ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {r.temperature.toFixed(2)} °C
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {isSafe ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                          SAFE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-800/60 animate-pulse">
                          EXCURSION
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 mono text-slate-400">
                      {r.humidity.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 mono text-[11px] text-slate-400">
                      {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 mono text-slate-400">
                      {r.speed_kmh.toFixed(1)} km/h
                    </td>
                    <td className="py-2 px-3 mono text-[11px] text-violet-300">
                      {k.toExponential(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
