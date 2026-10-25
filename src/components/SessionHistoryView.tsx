"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  Calendar,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Download,
  Clock,
  MapPin,
  Truck,
  Box,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import SessionAiSummaryModal from "./SessionAiSummaryModal";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fmtTimestamp } from "@/lib/utils";

interface SessionListItem {
  id: string;
  sessionCode: string;
  vaccineName: string;
  vaccineTier: string;
  minTemp: number;
  maxTemp: number;
  batchNumber: string | null;
  origin: string;
  destination: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  totalReadings: number;
  avgTemperature: number | null;
  minRecordedTemp: number | null;
  maxRecordedTemp: number | null;
  excursionCount: number;
  finalViability: number | null;
  finalStatus: string | null;
  _count?: { telemetryLogs: number };
}

interface TelemetryPoint {
  id: string;
  timestamp: string;
  temperature: number;
  humidity: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  viability: number | null;
  isExcursion: boolean;
}

interface DetailedSession extends SessionListItem {
  transportEquip?: string | null;
  etaHours?: number;
  telemetryLogs: TelemetryPoint[];
}

interface SessionHistoryViewProps {
  onBack: () => void;
}

export default function SessionHistoryView({ onBack }: SessionHistoryViewProps) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected session for detailed view modal
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailedSession, setDetailedSession] = useState<DetailedSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Selected session for AI summary modal
  const [aiSummarySessionId, setAiSummarySessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load past sessions.");
      }
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleInspectSession = async (id: string) => {
    setSelectedSessionId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.success) {
        setDetailedSession(data.session);
      }
    } catch (err) {
      console.error("Failed to fetch session detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedSessionId(null);
    setDetailedSession(null);
  };

  // Filtered session list
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Search term filter (name, code, batch, origin, destination)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = s.vaccineName.toLowerCase().includes(term);
        const matchesCode = s.sessionCode.toLowerCase().includes(term);
        const matchesBatch = s.batchNumber?.toLowerCase().includes(term) ?? false;
        const matchesRoute =
          s.origin.toLowerCase().includes(term) || s.destination.toLowerCase().includes(term);
        if (!matchesName && !matchesCode && !matchesBatch && !matchesRoute) return false;
      }

      // Date filter (matches YYYY-MM-DD)
      if (selectedDate) {
        const sessionDate = new Date(s.startedAt).toISOString().split("T")[0];
        if (sessionDate !== selectedDate) return false;
      }

      // Tier filter
      if (tierFilter !== "ALL" && s.vaccineTier !== tierFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [sessions, searchTerm, selectedDate, tierFilter, statusFilter]);

  const exportSessionJson = (session: DetailedSession) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `audit-${session.sessionCode}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass rounded-3xl border border-white/10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer group"
            title="Return to Launchpad"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-[10px] font-mono uppercase font-bold text-cyan-300 mb-1">
              Historical Compliance Archive
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Shipment Session History & Logs
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Query past cold-chain sessions by specific date, time, vaccine payload, and inspect full telemetry logs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSessions}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer self-start sm:self-center"
          title="Refresh History"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-5 glass rounded-2xl border border-white/10 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search by Vaccine Name or Code */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vaccine, code, batch..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
            />
          </div>

          {/* Tier Filter */}
          <div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="ALL">All Vaccine Tiers</option>
              <option value="STANDARD_REFRIGERATED">+2°C to +8°C Standard</option>
              <option value="FROZEN">-25°C to -15°C Frozen</option>
              <option value="ULTRA_COLD">-80°C to -60°C Ultra-Cold</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="ACTIVE">Active (Live)</option>
            </select>

            {(searchTerm || selectedDate || tierFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDate("");
                  setTierFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>
            Found <span className="font-bold text-cyan-300 font-mono">{filteredSessions.length}</span> recorded sessions
          </span>
          {selectedDate && (
            <span className="font-mono text-cyan-400">
              Filtered for date: {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { dateStyle: "medium" })}
            </span>
          )}
        </div>
      </div>

      {/* History Session Cards List */}
      {loading ? (
        <div className="p-12 text-center text-cyan-400 font-mono text-xs flex items-center justify-center gap-2">
          <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          Loading audit archives...
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-12 text-center glass rounded-3xl border border-white/10 space-y-3">
          <History className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No matching transit sessions found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {sessions.length === 0
              ? "No transit sessions have been conducted yet. Return to the launchpad to start your first session!"
              : "Try adjusting your search criteria, date filter, or classification tier to view matching records."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSessions.map((session) => {
            const startDate = new Date(session.startedAt);
            const endDate = session.endedAt ? new Date(session.endedAt) : null;
            const durationHours = endDate
              ? ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)).toFixed(1)
              : null;

            const isCompliant = session.finalStatus === "NOMINAL" || session.excursionCount === 0;

            return (
              <div
                key={session.id}
                className="p-5 sm:p-6 glass rounded-2xl border border-white/10 hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 group"
              >
                {/* Left: Code, Name, Tier, Dates */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-800 text-cyan-300 border border-slate-700">
                      {session.sessionCode}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        session.status === "ACTIVE"
                          ? "bg-emerald-950/90 text-emerald-300 border border-emerald-800/60 animate-pulse"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {session.status}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-800/40">
                      {session.vaccineTier}
                    </span>
                    {session.batchNumber && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {session.batchNumber}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {session.vaccineName}
                  </h3>

                  {/* Route & Timestamp */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-cyan-400" />
                      <span>{session.origin}</span>
                      <span className="text-slate-600">➔</span>
                      <Truck className="h-3 w-3 text-emerald-400" />
                      <span className="text-slate-200">{session.destination}</span>
                    </span>

                    <span className="flex items-center gap-1 font-mono text-slate-400">
                      <Clock className="h-3 w-3 text-amber-400" />
                      <span>{startDate.toLocaleDateString(undefined, { dateStyle: "medium" })} at {startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {durationHours && <span>({durationHours} hrs)</span>}
                    </span>
                  </div>
                </div>

                {/* Right: Summary Metrics & Inspect Button */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                  {/* Total Readings */}
                  <div className="flex flex-col text-left lg:text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Telemetry Points</span>
                    <span className="font-mono text-sm font-bold text-slate-100">
                      {session.totalReadings || session._count?.telemetryLogs || 0}
                    </span>
                  </div>

                  {/* Temperature Adherence */}
                  <div className="flex flex-col text-left lg:text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Avg Temperature</span>
                    <span className="font-mono text-sm font-bold text-cyan-300">
                      {session.avgTemperature !== null ? `${session.avgTemperature}°C` : "—"}
                    </span>
                  </div>

                  {/* Excursion Count */}
                  <div className="flex flex-col text-left lg:text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Excursions</span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        session.excursionCount > 0 ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {session.excursionCount}
                    </span>
                  </div>

                  {/* Final Viability */}
                  <div className="flex flex-col text-left lg:text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 font-bold">Final Potency</span>
                    <span className="font-mono text-sm font-bold text-emerald-300">
                      {session.finalViability !== null ? `${(session.finalViability * 100).toFixed(1)}%` : "100%"}
                    </span>
                  </div>

                  {/* Actions: AI Summarize + View Audit Logs */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAiSummarySessionId(session.id)}
                      className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-950/90 to-blue-950/90 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-200 hover:text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-950/60 transition-all cursor-pointer group"
                      title="Generate non-technical AI summary for this trip"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform animate-pulse" />
                      <span>Summarize</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInspectSession(session.id)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>View Audit Logs</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL WITH CHARTS AND LOGS TABLE */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl my-8 max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                    {detailedSession?.sessionCode}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                    {detailedSession?.vaccineTier}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {detailedSession?.vaccineName}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {detailedSession?.origin} ➔ {detailedSession?.destination}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {detailedSession && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAiSummarySessionId(detailedSession.id)}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/90 to-blue-950/90 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 text-cyan-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Generate AI Trip Summary"
                    >
                      <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                      <span className="hidden sm:inline">Summarize</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportSessionJson(detailedSession)}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Export Audit JSON"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Export Audit</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="py-20 text-center text-cyan-400 font-mono text-xs flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Retrieving telemetry logs...
              </div>
            ) : detailedSession ? (
              <div className="space-y-6">
                {/* Audit Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Allowed Range</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {detailedSession.minTemp}°C to {detailedSession.maxTemp}°C
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Avg Recorded Temp</span>
                    <span className="font-mono text-sm font-bold text-cyan-300">
                      {detailedSession.avgTemperature !== null ? `${detailedSession.avgTemperature}°C` : "—"}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Excursion Events</span>
                    <span className={`font-mono text-sm font-bold ${detailedSession.excursionCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {detailedSession.excursionCount} breaches
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Final Viability</span>
                    <span className="font-mono text-sm font-bold text-emerald-300">
                      {detailedSession.finalViability !== null ? `${(detailedSession.finalViability * 100).toFixed(1)}%` : "100%"}
                    </span>
                  </div>
                </div>

                {/* Historical Recharts Temperature Profile */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-200 flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-cyan-400" />
                      Thermal Profile Adherence Over Transit Journey
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      {detailedSession.telemetryLogs.length} total readings
                    </span>
                  </div>

                  {detailedSession.telemetryLogs.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={detailedSession.telemetryLogs.map((log) => ({
                            time: new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                            temp: log.temperature,
                            viability: log.viability !== null ? log.viability * 100 : null,
                          }))}
                          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: "#64748b" }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: "#64748b" }} unit="°C" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderColor: "rgba(255,255,255,0.1)",
                              borderRadius: "12px",
                              fontSize: "12px",
                            }}
                          />
                          <ReferenceLine y={detailedSession.maxTemp} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Max ${detailedSession.maxTemp}°C`, fill: "#ef4444", fontSize: 10 }} />
                          <ReferenceLine y={detailedSession.minTemp} stroke="#06b6d4" strokeDasharray="4 4" label={{ value: `Min ${detailedSession.minTemp}°C`, fill: "#06b6d4", fontSize: 10 }} />
                          <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={2} dot={false} name="Temperature (°C)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-10 text-center font-mono">
                      No telemetry logs recorded for this session.
                    </p>
                  )}
                </div>

                {/* Telemetry Log Table */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-200">
                    Recorded Telemetry Log Stream (Most Recent 50)
                  </h4>
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 sticky top-0 text-[10px] uppercase font-mono text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-2.5 pl-3">Timestamp</th>
                          <th className="p-2.5">Temperature</th>
                          <th className="p-2.5">Humidity</th>
                          <th className="p-2.5">GPS Location</th>
                          <th className="p-2.5">Speed</th>
                          <th className="p-2.5 pr-3">Viability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {detailedSession.telemetryLogs.slice(-50).reverse().map((log) => (
                          <tr key={log.id} className={log.isExcursion ? "bg-red-950/30 text-red-200" : "hover:bg-slate-800/40"}>
                            <td className="p-2.5 pl-3 text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </td>
                            <td className={`p-2.5 font-bold ${log.isExcursion ? "text-red-400" : "text-cyan-300"}`}>
                              {log.temperature.toFixed(2)}°C
                            </td>
                            <td className="p-2.5 text-slate-300">{log.humidity.toFixed(1)}%</td>
                            <td className="p-2.5 text-slate-400">{log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</td>
                            <td className="p-2.5 text-slate-400">{log.speedKmh.toFixed(0)} km/h</td>
                            <td className="p-2.5 pr-3 text-emerald-400 font-bold">
                              {log.viability !== null ? `${(log.viability * 100).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* AI SUMMARY MODAL FOR NON-TECHNICAL PERSON */}
      {aiSummarySessionId && (
        <SessionAiSummaryModal
          sessionId={aiSummarySessionId}
          onClose={() => setAiSummarySessionId(null)}
        />
      )}
    </div>
  );
}
