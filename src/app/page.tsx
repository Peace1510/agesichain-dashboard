"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ShipmentHeader from "@/components/ShipmentHeader";
import ViabilityGauge from "@/components/ViabilityGauge";
import MetricCard from "@/components/MetricCard";
import TelemetryCharts from "@/components/TelemetryCharts";
import KineticParametersCard from "@/components/KineticParametersCard";
import TelemetryTable from "@/components/TelemetryTable";
import LiveMap from "@/components/LiveMap";
import BuzzerControlCard from "@/components/BuzzerControlCard";
import DestinationConfigCard from "@/components/DestinationConfigCard";
import CreateSessionView from "@/components/CreateSessionView";
import SessionHistoryView from "@/components/SessionHistoryView";
import EndSessionModal from "@/components/EndSessionModal";
import type { ColdChainSnapshot, ShipmentStatus } from "@/lib/kinetics";
import { arrheniusRateConstant } from "@/lib/kinetics";
import type { TelemetryReading, ShipmentMeta, ActiveSessionInfo } from "@/lib/store";
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
  Activity,
  Table,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

type ViewMode = "DASHBOARD" | "CREATE_SESSION" | "HISTORY";
type AnalyticsTab = "CHARTS" | "KINETICS" | "LOGS";

export default function ColdChainDashboardPage() {
  const { data: sessionData } = useSession();
  const userRole = (sessionData?.user as { role?: string })?.role || "VIEWER";
  const isAdmin = userRole === "ADMIN";

  const [snapshot, setSnapshot] = useState<ColdChainSnapshot | null>(null);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [meta, setMeta] = useState<ShipmentMeta>({
    id: "—",
    name: "Agesichain Fleet",
    origin: "—",
    destination: "—",
    destinationLat: 18.9822,
    destinationLng: 72.8335,
  });
  const [etaHours, setEtaHours] = useState<number>(2.5);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [buzzerActive, setBuzzerActive] = useState<boolean>(false);
  const [buzzerLoading, setBuzzerLoading] = useState<boolean>(false);
  const [routeUpdating, setRouteUpdating] = useState<boolean>(false);

  // Session state
  const [activeSession, setActiveSession] = useState<ActiveSessionInfo | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("DASHBOARD");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("CHARTS");
  const [isEndModalOpen, setIsEndModalOpen] = useState<boolean>(false);

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

      if (data.active_session) {
        setActiveSession(data.active_session);
      } else {
        setActiveSession(null);
      }

      setLastUpdated(Math.floor(Date.now() / 1000));
      setPollError(null);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Polling failed";
      setPollError(msg);
      setIsConnected(false);
    }
  }, []);

  // Fetch initial active session on load to set view mode
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch("/api/sessions/active", { cache: "no-store" });
        const data = await res.json();
        if (data.activeSession) {
          setActiveSession(data.activeSession);
        } else {
          setActiveSession(null);
        }
      } catch (e) {
        console.error("Failed to check active session on init:", e);
      }
    };
    initSession();
  }, []);

  // Guard view mode: Only admins can enter CREATE_SESSION
  useEffect(() => {
    if (!isAdmin && viewMode === "CREATE_SESSION") {
      setViewMode("DASHBOARD");
    }
  }, [isAdmin, viewMode]);


  // Silence, re-arm, or test the buzzer from the dashboard
  const handleBuzzerControl = async (action: "silence" | "rearm" | "test" | "stop_test") => {
    // 1. Optimistic UI update — instant visual feedback in 0ms
    if (action === "silence" || action === "stop_test") {
      setBuzzerActive(false);
    } else if (action === "test") {
      setBuzzerActive(true);
    }

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
      // Re-fetch telemetry in background to sync state
      fetchTelemetry();
    } catch (err) {
      console.error("Buzzer control failed", err);
    } finally {
      setBuzzerLoading(false);
    }
  };


  // Update Route Destination and Transit ETA
  const handleUpdateRoute = async (newEta: number, newMeta: Partial<ShipmentMeta>) => {
    setRouteUpdating(true);
    try {
      const res = await fetch("/api/telemetry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eta_hours: newEta,
          meta: newMeta,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.eta_hours === "number") setEtaHours(data.eta_hours);
        if (data.meta) setMeta(data.meta);
        if (data.snapshot) setSnapshot(data.snapshot);
      }
      fetchTelemetry();
    } catch (err) {
      console.error("Route update failed", err);
    } finally {
      setRouteUpdating(false);
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

  // Handle session created callback
  const handleSessionCreated = () => {
    fetchTelemetry();
    setViewMode("DASHBOARD");
  };

  // Handle session ended callback
  const handleSessionEnded = () => {
    setIsEndModalOpen(false);
    setActiveSession(null);
    fetchTelemetry();
    setViewMode("HISTORY");
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const status: ShipmentStatus = snapshot?.evaluation.status ?? "NOMINAL";
  const latestReading = readings.length > 0 ? readings[readings.length - 1] : null;
  const currentTemp = latestReading?.temperature ?? null;
  const currentViability = snapshot ? snapshot.cumulative_viability : 1.0;
  const humidity = latestReading?.humidity ?? null;

  const { rate_constant_per_hour: kRate } = arrheniusRateConstant({
    temperature_celsius: currentTemp ?? (activeSession ? activeSession.minTemp + 2 : 4.0),
  });

  const timeToSpoil = snapshot?.time_to_spoil_hours ?? null;
  const projViability = currentTemp !== null
    ? currentViability * Math.exp(-kRate * etaHours) * 100
    : null;

  // Temperature envelope check
  const minAllowed = activeSession ? activeSession.minTemp : 2.0;
  const maxAllowed = activeSession ? activeSession.maxTemp : 8.0;

  return (
    <div className="min-h-screen bg-[#04070f] text-slate-100 flex flex-col p-4 md:p-8 lg:p-10 max-w-[1500px] mx-auto w-full gap-6">
      {/* 1. VIEW MODE ROUTING: HISTORY */}
      {viewMode === "HISTORY" && (
        <SessionHistoryView
          onBack={() => setViewMode("DASHBOARD")}
        />
      )}

      {/* 2. VIEW MODE ROUTING: CREATE SESSION LAUNCHPAD (ADMIN ONLY) */}
      {viewMode === "CREATE_SESSION" && isAdmin && (
        <CreateSessionView
          onSessionCreated={handleSessionCreated}
          onOpenHistory={() => setViewMode("HISTORY")}
          onBack={() => setViewMode("DASHBOARD")}
        />
      )}

      {/* 3. VIEW MODE ROUTING: LIVE ACTIVE DASHBOARD */}
      {viewMode === "DASHBOARD" && (
        <>
          {/* HEADER */}
          <ShipmentHeader
            meta={meta}
            status={status}
            lastUpdated={lastUpdated}
            etaHours={etaHours}
            isConnected={isConnected}
            activeSession={activeSession}
            onRefresh={fetchTelemetry}
            onEndSession={isAdmin ? () => setIsEndModalOpen(true) : undefined}
            onOpenHistory={() => setViewMode("HISTORY")}
            onOpenCreateSession={isAdmin ? () => setViewMode("CREATE_SESSION") : undefined}
          />


          {/* DEVICE DISCONNECTED BANNER */}
          {!isConnected && (
            <div className="glass rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-950/20 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-300">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <span className="font-semibold text-amber-200">
                  Waiting for ESP32 Telemetry:
                </span>
                <span className="text-slate-300">
                  Power on your ESP32 kit and connect to mobile hotspot. Dashboard will stream automatically.
                </span>
              </div>
              {pollError && (
                <span className="text-rose-400 mono text-[11px] bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                  {pollError}
                </span>
              )}
            </div>
          )}

          {/* BUZZER ALERT BANNER */}
          {buzzerActive && (
            <div className="glass scan-line rounded-2xl p-4 sm:p-5 border border-rose-500/60 bg-rose-950/40 flex flex-wrap items-center justify-between gap-4 glow-critical animate-in fade-in duration-300 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center flex-shrink-0 text-rose-400">
                  <Bell className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚠ ALARM ACTIVE ON ESP32 (GPIO 32)</span>
                  </h3>
                  <p className="text-xs text-rose-300/90 mt-0.5">
                    Chamber: <strong className="text-white">{currentTemp !== null ? currentTemp.toFixed(1) + "°C" : "—"}</strong> (Safe: {minAllowed}°C to {maxAllowed}°C) · Potency: <strong className="text-white">{(currentViability * 100).toFixed(2)}%</strong> · TTS: {timeToSpoil !== null ? timeToSpoil.toFixed(1) + "h" : "—"}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleBuzzerControl("silence")}
                  disabled={buzzerLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-400 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-rose-950/60 active:scale-95"
                >
                  <BellOff className="h-4 w-4" />
                  <span>Silence Buzzer</span>
                </button>
              )}
            </div>
          )}

          {/* CRITICAL / WARNING ALERT BANNERS */}
          {status === "CRITICAL" && isConnected && !buzzerActive && (
            <div className="glass scan-line rounded-2xl p-4 border border-rose-500/40 bg-rose-950/25 flex items-center gap-3.5 glow-critical animate-in fade-in duration-300">
              <div className="h-8 w-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0 text-rose-400">
                <AlertOctagon className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-rose-200 uppercase tracking-wider mr-2">
                  {currentViability <= 0.8
                    ? "Critical Potency Breach:"
                    : timeToSpoil !== null && timeToSpoil <= etaHours
                    ? "Critical Transit Deficit:"
                    : "Thermal Excursion Alert:"}
                </span>
                <span className="text-rose-300/90">
                  {currentViability <= 0.8
                    ? "Vaccine viability dropped below 80% threshold. Denaturation occurred."
                    : timeToSpoil !== null && timeToSpoil <= etaHours
                    ? `Remaining safe window (${timeToSpoil.toFixed(1)}h) is shorter than transit ETA (${etaHours.toFixed(1)}h). Re-ice or expedite.`
                    : `Chamber temperature is ${currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : "—"} (Allowed: ${minAllowed}°C to ${maxAllowed}°C).`}
                </span>
              </div>
            </div>
          )}

          {status === "WARNING" && isConnected && (
            <div className="glass rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-950/20 flex items-center gap-3.5 glow-warning animate-in fade-in duration-300">
              <div className="h-7 w-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="text-xs text-amber-300/90">
                <strong className="font-semibold text-amber-200 uppercase tracking-wider mr-2">
                  Thermal Advisory:
                </strong>
                Chamber is at {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : "—"} (Target: {minAllowed}°C–{maxAllowed}°C). Current potency: {(currentViability * 100).toFixed(2)}%.
              </div>
            </div>
          )}

          {/* HERO OVERVIEW: VIABILITY GAUGE + KPI CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left: Viability Radial Gauge */}
            <div className="lg:col-span-4 glass rounded-2xl p-5 sm:p-6 flex flex-col items-center justify-between relative overflow-hidden border border-white/[0.08] shadow-lg">
              <div className="w-full flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Kinetic Potency State
                </span>
                <span className="text-[10px] mono text-neutral-300 font-bold bg-neutral-900 border border-neutral-800 px-2.5 py-0.5 rounded-full">
                  {activeSession?.sessionCode || "ACTIVE"}
                </span>
              </div>

              <div className="py-3 my-auto">
                <ViabilityGauge viability={currentViability} status={status} />
              </div>

              <div className="w-full pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                <span>Baseline: 100.00%</span>
                <span className="mono">
                  Status: <strong className={status === "CRITICAL" ? "text-rose-400" : status === "WARNING" ? "text-amber-400" : "text-emerald-400"}>{status}</strong>
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
                    : currentTemp >= minAllowed && currentTemp <= maxAllowed
                    ? `Optimal (${minAllowed}°C to ${maxAllowed}°C)`
                    : currentTemp > maxAllowed
                    ? `Above Max (${maxAllowed}°C)`
                    : `Below Min (${minAllowed}°C)`
                }
                icon={<Thermometer className="h-5 w-5" />}
                accent={
                  currentTemp === null
                    ? "cyan"
                    : currentTemp >= minAllowed && currentTemp <= maxAllowed
                    ? "emerald"
                    : "red"
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

          {/* HARDWARE BUZZER REMOTE & SHIPMENT ROUTE PLANNER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <DestinationConfigCard
              meta={meta}
              etaHours={etaHours}
              timeToSpoil={timeToSpoil}
              onUpdateRoute={handleUpdateRoute}
              loading={routeUpdating}
              currentLat={latestReading?.latitude}
              currentLng={latestReading?.longitude}
              isAdmin={isAdmin}
            />
            <BuzzerControlCard
              buzzerActive={buzzerActive}
              currentTemp={currentTemp}
              status={status}
              onBuzzerAction={handleBuzzerControl}
              loading={buzzerLoading}
              isAdmin={isAdmin}
            />
          </div>

          {/* LIVE GPS MAP */}
          <LiveMap
            readings={readings}
            isConnected={isConnected}
            destinationMeta={meta}
          />

          {/* DEEP TELEMETRY & ANALYTICS HUB (UNIFIED TABS) */}
          <div className="glass rounded-2xl p-5 border border-white/[0.07] shadow-lg flex flex-col gap-4">
            {/* Header & Segmented Tab Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-neutral-800 border border-neutral-700/80 flex items-center justify-center text-neutral-300">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">
                    Telemetry &amp; Kinetic Analytics Hub
                  </h2>
                  <p className="text-[11px] text-neutral-400">
                    Switch between time-series curves, Arrhenius kinetics, and packet stream
                  </p>
                </div>
              </div>

              {/* Segmented Controller */}
              <div className="flex items-center rounded-xl bg-neutral-900/90 border border-neutral-800 p-1 text-xs">
                <button
                  onClick={() => setAnalyticsTab("CHARTS")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer text-xs",
                    analyticsTab === "CHARTS"
                      ? "bg-neutral-100 text-neutral-900 font-bold shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  )}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  <span>Telemetry Visualizer</span>
                </button>

                <button
                  onClick={() => setAnalyticsTab("KINETICS")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer text-xs",
                    analyticsTab === "KINETICS"
                      ? "bg-neutral-100 text-neutral-900 font-bold shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  )}
                >
                  <Gauge className="h-3.5 w-3.5" />
                  <span>Kinetic Engine</span>
                </button>

                <button
                  onClick={() => setAnalyticsTab("LOGS")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer text-xs",
                    analyticsTab === "LOGS"
                      ? "bg-neutral-100 text-neutral-900 font-bold shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200"
                  )}
                >
                  <Table className="h-3.5 w-3.5" />
                  <span>Packet Logs ({readings.length})</span>
                </button>
              </div>
            </div>

            {/* Active Tab Panel */}
            <div className="pt-1">
              {analyticsTab === "CHARTS" && <TelemetryCharts readings={readings} />}
              {analyticsTab === "KINETICS" && (
                <KineticParametersCard
                  snapshot={snapshot}
                  currentTemp={currentTemp ?? (activeSession?.minTemp ? activeSession.minTemp + 2 : 4.0)}
                  etaHours={etaHours}
                />
              )}
              {analyticsTab === "LOGS" && <TelemetryTable readings={readings} />}
            </div>
          </div>

          {/* MODAL: END SESSION */}
          {activeSession && (
            <EndSessionModal
              session={activeSession}
              snapshot={snapshot}
              isOpen={isEndModalOpen}
              onClose={() => setIsEndModalOpen(false)}
              onSuccess={handleSessionEnded}
            />
          )}
        </>
      )}

      {/* FOOTER */}
      <footer className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
          <span>Agesichain Cold-Chain Kinetic Intelligence System</span>
        </div>
        <div className="flex items-center gap-4 mono text-[11px]">
          <span>WHO / CDC Tier Validation</span>
          <span>·</span>
          <span>Next.js 14 App Router</span>
          <span>·</span>
          <span>PostgreSQL Audit Engine</span>
        </div>
      </footer>
    </div>
  );
}
