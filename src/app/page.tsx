"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ShipmentHeader from "@/components/ShipmentHeader";
import ViabilityGauge from "@/components/ViabilityGauge";
import MetricCard from "@/components/MetricCard";
import TelemetryCharts from "@/components/TelemetryCharts";
import KineticParametersCard from "@/components/KineticParametersCard";
import TelemetryTable from "@/components/TelemetryTable";
import LiveMap from "@/components/LiveMap";
import type { ColdChainSnapshot, ShipmentStatus } from "@/lib/kinetics";
import { arrheniusRateConstant } from "@/lib/kinetics";
import type { TelemetryReading, ShipmentMeta } from "@/lib/store";
import {
  Thermometer,
  Droplets,
  Gauge,
  Hourglass,
  TrendingDown,
  AlertOctagon,
  AlertTriangle,
  Cpu,
  BellOff,
  Bell,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function ColdChainDashboardPage() {
  const [snapshot, setSnapshot] = useState<ColdChainSnapshot | null>(null);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [meta, setMeta] = useState<ShipmentMeta>({
    id: "—",
    name: "Awaiting Device Connection",
    origin: "—",
    destination: "—",
  });
  const [etaHours, setEtaHours] = useState<number>(2.5);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [buzzerLoading, setBuzzerLoading] = useState<boolean>(false);

  const isMountedRef = useRef(true);

  // Poll telemetry endpoint every second for near-real-time updates
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch("/api/telemetry", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!isMountedRef.current) return;

      setSnapshot(data.snapshot);
      setReadings(data.history || []);
      if (data.meta) setMeta(data.meta);
      if (typeof data.eta_hours === "number") setEtaHours(data.eta_hours);
      if (typeof data.buzzer_active === "boolean") setBuzzerActive(data.buzzer_active);
      if (typeof data.is_connected === "boolean") setIsConnected(data.is_connected);
      setLastUpdated(Math.floor(Date.now() / 1000));
      setPollError(null);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Polling failed";
      setPollError(msg);
      setIsConnected(false);
    }
  }, []);

  // Silence or re-arm the buzzer from the dashboard
  const handleBuzzerControl = async (action: "silence" | "rearm") => {
    setBuzzerLoading(true);
    try {
      const res = await fetch("/api/buzzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.buzzer_active === "boolean") {
          setBuzzerActive(data.buzzer_active);
        }
      }
    } catch (err) {
      console.error("Buzzer control failed", err);
    } finally {
      setBuzzerLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchTelemetry();

    // 1-second polling for near-real-time tracking
    const interval = setInterval(fetchTelemetry, 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchTelemetry]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const status: ShipmentStatus = snapshot?.evaluation.status ?? "NOMINAL";
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const currentTemp = latestReading?.temperature ?? null;
  const currentViability = snapshot ? snapshot.cumulative_viability : 1.0;
  const humidity = latestReading?.humidity ?? null;

  const { rate_constant_per_hour: kRate } = arrheniusRateConstant({
    temperature_celsius: currentTemp ?? 4.0,
  });

  const timeToSpoil = snapshot?.time_to_spoil_hours ?? null;
  const projViability = currentTemp !== null
    ? currentViability * Math.exp(-kRate * etaHours) * 100
    : null;

  return (
    <div className="min-h-screen bg-[#04070f] text-slate-100 flex flex-col p-4 md:p-8 lg:p-10 max-w-[1500px] mx-auto w-full gap-6">
      {/* 1. HEADER */}
      <ShipmentHeader
        meta={meta}
        status={status}
        lastUpdated={lastUpdated}
        etaHours={etaHours}
        isConnected={isConnected}
        onRefresh={fetchTelemetry}
      />

      {/* 2. DEVICE DISCONNECTED BANNER */}
      {!isConnected && (
        <div className="glass rounded-2xl p-5 border border-slate-700/60 bg-slate-900/60 flex items-start gap-4 animate-in fade-in duration-300">
          <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-400">
            <WifiOff className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Waiting for ESP32 Connection
            </h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              No telemetry received in the last 5 seconds. Ensure the ESP32 is powered on, connected to the network, and configured to POST data to this server. Dashboard will update automatically when data arrives.
            </p>
            {pollError && (
              <p className="mt-2 text-xs text-red-400 mono">{pollError}</p>
            )}
          </div>
        </div>
      )}

      {/* 3. BUZZER ALERT BANNER */}
      {buzzerActive && (
        <div className="glass scan-line rounded-2xl p-5 border border-orange-500/50 bg-orange-950/30 flex items-start gap-4 glow-critical animate-in fade-in duration-300">
          <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center flex-shrink-0 text-orange-400">
            <Bell className="h-6 w-6 animate-bounce" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-orange-200 uppercase tracking-wider">
              ⚠ BUZZER ACTIVE — VACCINE DECAY ALERT (≤ 30 min to spoil)
            </h3>
            <p className="mt-1 text-xs text-orange-300/90 leading-relaxed">
              The ESP32 buzzer has been activated. Time-to-spoil has fallen within the 30-minute critical window. Take immediate action to restore cold chain conditions.
            </p>
          </div>
          <button
            onClick={() => handleBuzzerControl("silence")}
            disabled={buzzerLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-900/60 hover:bg-orange-800/60 border border-orange-700/50 hover:border-orange-500 text-orange-200 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <BellOff className="h-4 w-4" />
            Silence Buzzer
          </button>
        </div>
      )}

      {/* 4. CRITICAL / WARNING ALERT BANNERS */}
      {status === "CRITICAL" && isConnected && !buzzerActive && (
        <div className="glass scan-line rounded-2xl p-5 border border-red-500/40 bg-red-950/30 flex items-start gap-4 glow-critical animate-in fade-in duration-300">
          <div className="h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 text-red-400">
            <AlertOctagon className="h-6 w-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-200 uppercase tracking-wider">
              CRITICAL VIABILITY HAZARD — IMMEDIATE COLD CHAIN BREACH
            </h3>
            <p className="mt-1 text-xs text-red-300/90 leading-relaxed">
              Vaccine viability has dropped below the critical <span className="font-semibold underline">80.00%</span> potency threshold or projected delivery viability indicates permanent irreversible decay. Quarantine batch immediately.
            </p>
          </div>
        </div>
      )}

      {status === "WARNING" && isConnected && (
        <div className="glass rounded-2xl p-5 border border-amber-500/40 bg-amber-950/30 flex items-start gap-4 glow-warning animate-in fade-in duration-300">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-200 uppercase tracking-wider">
              THERMAL EXCURSION WARNING
            </h3>
            <p className="mt-1 text-xs text-amber-300/90 leading-relaxed">
              Ambient temperature is outside the recommended WHO 2.0°C – 8.0°C cold envelope, or remaining safe transit time is approaching the destination ETA. Inspect cooling unit.
            </p>
          </div>
        </div>
      )}

      {/* 5. HERO OVERVIEW: VIABILITY GAUGE + KPI CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Viability Radial Gauge */}
        <div className="lg:col-span-4 glass rounded-2xl p-6 flex flex-col items-center justify-between relative overflow-hidden">
          <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Kinetic Potency State
            </span>
            <span className="text-[10px] mono text-slate-500">Real-Time Arc</span>
          </div>

          <div className="py-4 my-auto">
            <ViabilityGauge viability={currentViability} status={status} />
          </div>

          <div className="w-full pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Baseline: 100.00%</span>
            <span className="mono">
              Status: <strong className={status === "CRITICAL" ? "text-red-400" : status === "WARNING" ? "text-amber-400" : "text-emerald-400"}>{status}</strong>
            </span>
          </div>
        </div>

        {/* Right: Key Metrics Grid */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* 1. Core Temperature */}
          <MetricCard
            label="Chamber Temperature"
            value={currentTemp !== null ? currentTemp.toFixed(2) : "—"}
            unit={currentTemp !== null ? "°C" : ""}
            subValue={
              currentTemp === null
                ? "No data yet"
                : currentTemp >= 2 && currentTemp <= 8
                ? "Optimal (WHO 2°C – 8°C)"
                : currentTemp >= 25
                ? "CRITICAL HEAT EXCURSION"
                : currentTemp > 8
                ? "Excursion (Above +8°C)"
                : "Freeze Risk (Below +2°C)"
            }
            icon={<Thermometer className="h-5 w-5" />}
            accent={
              currentTemp === null
                ? "cyan"
                : currentTemp >= 2 && currentTemp <= 8
                ? "emerald"
                : currentTemp >= 25 || currentTemp <= 0
                ? "red"
                : "amber"
            }
          />

          {/* 2. Relative Humidity */}
          <MetricCard
            label="Relative Humidity"
            value={humidity !== null ? humidity.toFixed(1) : "—"}
            unit={humidity !== null ? "%" : ""}
            subValue={humidity !== null ? "DHT / SHT Sensor" : "No data yet"}
            icon={<Droplets className="h-5 w-5" />}
            accent="cyan"
          />

          {/* 3. Arrhenius Rate Constant */}
          <MetricCard
            label="Arrhenius Constant (k)"
            value={currentTemp !== null ? kRate.toExponential(2) : "—"}
            unit={currentTemp !== null ? "hr⁻¹" : ""}
            subValue="Molecular decay rate"
            icon={<Gauge className="h-5 w-5" />}
            accent="violet"
          />

          {/* 4. Projected Delivery Viability */}
          <MetricCard
            label="Viability @ Destination"
            value={projViability !== null ? projViability.toFixed(2) : "—"}
            unit={projViability !== null ? "%" : ""}
            subValue={
              projViability !== null
                ? `Projected across ${etaHours.toFixed(1)}h ETA`
                : "Awaiting first reading"
            }
            icon={<TrendingDown className="h-5 w-5" />}
            accent={
              projViability === null
                ? "cyan"
                : projViability < 80
                ? "red"
                : projViability < 85
                ? "amber"
                : "emerald"
            }
          />

          {/* 5. Time-To-Spoil */}
          <MetricCard
            label="Time-to-Spoil (t_spoil)"
            value={
              timeToSpoil === null
                ? "—"
                : timeToSpoil === 0
                ? "0.0"
                : timeToSpoil.toFixed(1)
            }
            unit={timeToSpoil === null ? "" : "hrs"}
            subValue={
              timeToSpoil === null
                ? "Awaiting first reading"
                : timeToSpoil <= 0.5
                ? "⚠ CRITICAL — Buzzer Active"
                : timeToSpoil < etaHours
                ? "⚠ Spoilage before delivery!"
                : "Safe delivery window"
            }
            icon={<Hourglass className="h-5 w-5" />}
            accent={
              timeToSpoil !== null && timeToSpoil <= 0.5
                ? "red"
                : timeToSpoil !== null && timeToSpoil < etaHours
                ? "amber"
                : "cyan"
            }
          />

          {/* 6. ESP32 Connection Node */}
          <MetricCard
            label="ESP32 Telemetry Node"
            value={latestReading ? latestReading.device_id : "—"}
            unit=""
            subValue={
              isConnected
                ? `${readings.length} packets · Live`
                : "Disconnected"
            }
            icon={
              isConnected
                ? <Wifi className="h-5 w-5" />
                : <Cpu className="h-5 w-5" />
            }
            accent={isConnected ? "emerald" : "cyan"}
          />
        </div>
      </div>

      {/* 6. REAL-TIME CHARTS */}
      <TelemetryCharts readings={readings} />

      {/* 7. LIVE GPS MAP */}
      <LiveMap readings={readings} isConnected={isConnected} />

      {/* 8. KINETIC ENGINE MATHEMATICS */}
      <KineticParametersCard
        snapshot={snapshot}
        currentTemp={currentTemp ?? 4.0}
        etaHours={etaHours}
      />

      {/* 9. TELEMETRY LOG TABLE */}
      <TelemetryTable readings={readings} />

      {/* 9. FOOTER */}
      <footer className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
          <span>Agesichain Cold-Chain Kinetic Intelligence System</span>
        </div>
        <div className="flex items-center gap-4 mono text-[11px]">
          <span>Arrhenius Eₐ Engine</span>
          <span>·</span>
          <span>Next.js 14 App Router</span>
          <span>·</span>
          <span>ESP32 WebSocket Ready</span>
        </div>
      </footer>
    </div>
  );
}
