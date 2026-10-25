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
} from "lucide-react";
import { useSession } from "next-auth/react";

type ViewMode = "DASHBOARD" | "CREATE_SESSION" | "HISTORY";

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
            <div className="glass rounded-2xl p-5 border border-slate-700/60 bg-slate-900/60 flex items-start gap-4 animate-in fade-in duration-300">
              <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-400">
                <WifiOff className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Waiting for ESP32 Connection
                </h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  No telemetry received in the last 15 seconds. Ensure the ESP32 is powered on, connected to the hotspot, and transmitting data. Dashboard will stream automatically once readings arrive.
                </p>
                {pollError && (
                  <p className="mt-2 text-xs text-red-400 mono">{pollError}</p>
                )}
              </div>
            </div>
          )}

          {/* BUZZER ALERT BANNER */}
          {buzzerActive && (
            <div className="glass scan-line rounded-2xl p-5 border border-orange-500/60 bg-orange-950/40 flex items-start gap-4 glow-critical animate-in fade-in duration-300">
              <div className="h-10 w-10 rounded-xl bg-orange-500/20 border border-orange-500/50 flex items-center justify-center flex-shrink-0 text-orange-400">
                <Bell className="h-6 w-6 animate-bounce" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-orange-200 uppercase tracking-wider flex items-center gap-2">
                  ⚠ BUZZER ACTIVE — TEMPERATURE EXCURSION / SPOILAGE HAZARD
                </h3>
                <p className="mt-1 text-xs text-orange-300/90 leading-relaxed">
                  The physical ESP32 buzzer on GPIO 32 is actively buzzing! Chamber temperature is{" "}
                  {currentTemp !== null ? currentTemp.toFixed(1) + "°C" : "—"} (allowed: {minAllowed}°C to {maxAllowed}°C). Current viability:{" "}
                  {(currentViability * 100).toFixed(2)}% | TTS: {timeToSpoil !== null ? timeToSpoil.toFixed(1) + "h" : "—"}.
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleBuzzerControl("silence")}
                  disabled={buzzerLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 border border-orange-400 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-orange-950/60 active:scale-95"
                >
                  <BellOff className="h-4 w-4" />
                  Silence Buzzer
                </button>
              )}
            </div>
          )}

          {/* CRITICAL / WARNING ALERT BANNERS */}
          {status === "CRITICAL" && isConnected && !buzzerActive && (
            <div className="glass scan-line rounded-2xl p-5 border border-red-500/40 bg-red-950/30 flex items-start gap-4 glow-critical animate-in fade-in duration-300">
              <div className="h-10 w-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 text-red-400">
                <AlertOctagon className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-200 uppercase tracking-wider">
                  {currentViability <= 0.8
                    ? "CRITICAL POTENCY BREACH — VACCINE SPOILED"
                    : timeToSpoil !== null && timeToSpoil <= etaHours
                    ? "CRITICAL TRANSIT DEFICIT — SPOILAGE BEFORE DELIVERY"
                    : currentTemp !== null && activeSession?.vaccineTier === "STANDARD_REFRIGERATED" && currentTemp <= 0.0
                    ? `CRITICAL FREEZE EXCURSION (${currentTemp.toFixed(1)}°C) — DENATURATION HAZARD`
                    : "CRITICAL COLD CHAIN ALERT"}
                </h3>
                <p className="mt-1 text-xs text-red-300/90 leading-relaxed">
                  {currentViability <= 0.8 ? (
                    <>
                      Vaccine viability has dropped to <span className="font-semibold underline">{(currentViability * 100).toFixed(2)}%</span> (below 80% threshold). Molecular potency is irreversibly lost. Quarantine batch immediately.
                    </>
                  ) : timeToSpoil !== null && timeToSpoil <= etaHours ? (
                    <>
                      Remaining safe window ({timeToSpoil.toFixed(1)}h) is shorter than transit ETA ({etaHours.toFixed(1)}h). Product is projected to drop below 80% before arrival. Expedite transit or re-ice immediately.
                    </>
                  ) : currentTemp !== null && activeSession?.vaccineTier === "STANDARD_REFRIGERATED" && currentTemp <= 0.0 ? (
                    <>
                      Chamber temperature is at or below freezing (<span className="font-semibold">{currentTemp.toFixed(1)}°C</span>). Adjuvant crystallizes at ≤0°C. Immediate inspection required.
                    </>
                  ) : (
                    <>
                      Shipment is under critical thermal strain. Chamber temperature: {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : "—"}. Allowed: {minAllowed}°C to {maxAllowed}°C.
                    </>
                  )}
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
                  {currentTemp !== null && (currentTemp > maxAllowed || currentTemp < minAllowed)
                    ? `THERMAL EXCURSION WARNING (${currentTemp.toFixed(1)}°C)`
                    : "VIABILITY BUFFER WARNING"}
                </h3>
                <p className="mt-1 text-xs text-amber-300/90 leading-relaxed">
                  {currentTemp !== null && (currentTemp > maxAllowed || currentTemp < minAllowed) ? (
                    <>
                      Ambient temperature is at <span className="font-semibold">{currentTemp.toFixed(1)}°C</span> (Tier allowed range: {minAllowed}°C to {maxAllowed}°C). Current viability is {(currentViability * 100).toFixed(2)}%.
                    </>
                  ) : (
                    <>
                      Remaining safe transit buffer is approaching the destination ETA ({etaHours.toFixed(1)}h). Current viability: {(currentViability * 100).toFixed(2)}%. Monitor shipment progress closely.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* HERO OVERVIEW: VIABILITY GAUGE + KPI CARDS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left: Viability Radial Gauge */}
            <div className="lg:col-span-4 glass rounded-2xl p-6 flex flex-col items-center justify-between relative overflow-hidden">
              <div className="w-full flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Kinetic Potency State
                </span>
                <span className="text-[10px] mono text-cyan-400 font-bold">
                  {activeSession?.sessionCode || "ACTIVE"}
                </span>
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

          {/* REAL-TIME TELEMETRY CHARTS */}
          <TelemetryCharts readings={readings} />

          {/* KINETIC ENGINE MATHEMATICS */}
          <KineticParametersCard
            snapshot={snapshot}
            currentTemp={currentTemp ?? (activeSession?.minTemp ? activeSession.minTemp + 2 : 4.0)}
            etaHours={etaHours}
          />

          {/* TELEMETRY LOG TABLE */}
          <TelemetryTable readings={readings} />

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
