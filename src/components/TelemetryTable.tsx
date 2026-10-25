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
    <div className={cn("flex flex-col gap-4 pt-1", className)}>
      {/* Subheader */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-neutral-800/70">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-300">
            <Table className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-neutral-200 tracking-tight">
              Ingested Telemetry Stream
            </h3>
            <p className="text-[11px] text-neutral-400">
              Raw sensor packets received via ESP32 hardware radio or simulation pipeline
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px] font-semibold text-neutral-300 bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-lg">
            {readings.length} Packets Received
          </span>
        </div>
      </div>

      {readings.length === 0 ? (
        <div className="py-12 text-center text-neutral-400 text-xs rounded-xl bg-neutral-900/40 border border-neutral-800">
          No telemetry logged yet. Data packets will populate automatically upon arrival.
        </div>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-neutral-800 bg-[#121316] shadow-inner">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-[10px] uppercase font-bold tracking-wider text-neutral-400 sticky top-0 bg-[#17181c] backdrop-blur z-10">
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
            <tbody className="divide-y divide-neutral-800/50">
              {reversed.map((r, i) => {
                const isSafe = r.temperature >= 2.0 && r.temperature <= 8.0;
                const { rate_constant_per_hour: k } = arrheniusRateConstant({
                  temperature_celsius: r.temperature,
                });

                return (
                  <tr
                    key={`${r.timestamp}-${i}`}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 mono text-slate-300">
                      {fmtTimestamp(r.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 mono text-slate-400 text-[11px]">
                      {r.device_id}
                    </td>
                    <td className="py-2.5 px-3 mono font-semibold">
                      <span
                        className={cn(
                          isSafe ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {r.temperature.toFixed(2)} °C
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isSafe ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          SAFE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/40 animate-pulse">
                          EXCURSION
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 mono text-slate-400">
                      {r.humidity.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 mono text-[11px] text-slate-400">
                      {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 mono text-slate-400">
                      {r.speed_kmh.toFixed(1)} km/h
                    </td>
                    <td className="py-2.5 px-3 mono text-[11px] text-violet-300">
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
