"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Thermometer,
  Clock,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Printer,
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Award,
} from "lucide-react";
import type { NonTechnicalSummary } from "@/app/api/sessions/[id]/summary/route";

interface SessionAiSummaryModalProps {
  sessionId: string;
  onClose: () => void;
}

export default function SessionAiSummaryModal({
  sessionId,
  onClose,
}: SessionAiSummaryModalProps) {
  const [summary, setSummary] = useState<NonTechnicalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch AI Summary
  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/summary`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate AI trip summary.");
      }
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generating summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSummary();
    }
  }, [sessionId]);

  const handleCopyText = () => {
    if (!summary) return;
    const textToCopy = `Agesichain Cold-Chain AI Trip Summary
=============================================
Session: ${summary.sessionCode} | Batch: ${summary.batchNumber || "N/A"}
Vaccine: ${summary.vaccineName} (${summary.vaccineTier})
Route: ${summary.origin} -> ${summary.destination}
Duration: ${summary.durationText}

VERDICT: ${summary.verdictTitle}
${summary.verdictBadge}

POTENCY: ${summary.potencyScore}% (WHO standard passes >= 80%)
TEMPERATURE RANGE: ${summary.thermalComparison.recordedMin}°C to ${summary.thermalComparison.recordedMax}°C (Safe Envelope: ${summary.thermalComparison.safeMin}°C to ${summary.thermalComparison.safeMax}°C)

SUMMARY:
${summary.plainLanguageSummary}

RECEIVING INSTRUCTIONS:
${summary.clinicChecklist.map((c) => `${c.step}. ${c.action}: ${c.detail}`).join("\n")}
`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-summary-title"
    >
      <div className="relative w-full max-w-4xl glass rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl my-8 max-h-[92vh] overflow-y-auto space-y-6 print:border-none print:shadow-none print:max-h-none print:bg-white print:text-black">
        {/* Top Header Bar */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 print:border-slate-300">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border border-cyan-500/40 text-[11px] font-mono font-bold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                AI Trip Summary & Compliance Report
              </span>
              {summary && (
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  {summary.sessionCode}
                </span>
              )}
            </div>
            <h2
              id="ai-summary-title"
              className="text-xl sm:text-2xl font-black text-white tracking-tight print:text-black"
            >
              {summary ? summary.vaccineName : "Analyzing Shipment Session..."}
            </h2>
            {summary && (
              <p className="text-xs text-slate-400 flex items-center gap-2 print:text-slate-600">
                <span>{summary.origin.split(",")[0]}</span>
                <span className="text-cyan-400">➔</span>
                <span>{summary.destination.split(",")[0]}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono">{summary.durationText} transit</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 print:hidden">
            {summary && (
              <>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy Text Summary"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-400 hidden sm:inline">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Print Receiving Certificate"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print Slip</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Summary Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-24 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-7 w-7 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">
                Generating Plain-English Trip Intelligence...
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Synthesizing sensor readings, temperature envelope, and clinical viability.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-8 text-center glass rounded-2xl border border-red-500/30 space-y-3">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <h3 className="text-sm font-bold text-red-200">Failed to generate summary</h3>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              type="button"
              onClick={fetchSummary}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Summary Content */}
        {summary && !loading && (
          <div className="space-y-6">
            {/* 1. BIG VISUAL VERDICT BANNER */}
            <div
              className={`p-6 sm:p-7 rounded-3xl border transition-all ${
                summary.overallVerdict === "SAFE"
                  ? "bg-gradient-to-br from-emerald-950/70 via-slate-900/90 to-cyan-950/60 border-emerald-500/40 shadow-lg shadow-emerald-950/40"
                  : summary.overallVerdict === "CAUTION"
                  ? "bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-orange-950/60 border-amber-500/40 shadow-lg shadow-amber-950/40"
                  : "bg-gradient-to-br from-rose-950/70 via-slate-900/90 to-red-950/60 border-rose-500/40 shadow-lg shadow-rose-950/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3.5 rounded-2xl flex-shrink-0 ${
                      summary.overallVerdict === "SAFE"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : summary.overallVerdict === "CAUTION"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {summary.overallVerdict === "SAFE" ? (
                      <ShieldCheck className="h-8 w-8" />
                    ) : summary.overallVerdict === "CAUTION" ? (
                      <AlertTriangle className="h-8 w-8" />
                    ) : (
                      <XCircle className="h-8 w-8" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <span
                      className={`inline-block text-[11px] font-mono uppercase tracking-wider font-extrabold px-3 py-0.5 rounded-full ${
                        summary.overallVerdict === "SAFE"
                          ? "bg-emerald-900/80 text-emerald-200 border border-emerald-700/60"
                          : summary.overallVerdict === "CAUTION"
                          ? "bg-amber-900/80 text-amber-200 border border-amber-700/60"
                          : "bg-rose-900/80 text-rose-200 border border-rose-700/60"
                      }`}
                    >
                      {summary.verdictBadge}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {summary.verdictTitle}
                    </h3>
                    <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                      {summary.overallVerdict === "SAFE"
                        ? "This vaccine payload was kept in optimal refrigeration conditions throughout its route. Biological potency is fully intact and safe for clinical administration."
                        : summary.overallVerdict === "CAUTION"
                        ? "A minor thermal variation occurred during transit. The vaccine remains clinically viable, but receiving staff must confirm the vial monitor disc before dispensing."
                        : "A significant temperature breach compromised this vaccine payload. Do not administer to patients; quarantine batch immediately."}
                    </p>
                  </div>
                </div>

                {/* Potency Ring Badge */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10 flex-shrink-0">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    Vaccine Potency
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                        summary.potencyScore >= 95
                          ? "text-emerald-400"
                          : summary.potencyScore >= 80
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {summary.potencyScore}%
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    WHO Standard: ≥80.0%
                  </span>
                </div>
              </div>
            </div>

            {/* 2. VISUAL COLD-CHAIN THERMOMETER COMPARISON BAR */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-cyan-400" />
                  <h4 className="text-xs font-mono uppercase font-bold text-slate-200 tracking-wider">
                    Visual Cold-Chain Envelope Check
                  </h4>
                </div>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                    summary.thermalComparison.withinEnvelope
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                      : "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                  }`}
                >
                  {summary.thermalComparison.withinEnvelope
                    ? "✓ 100% Inside Safe Window"
                    : "⚠️ Excursion Outside Window"}
                </span>
              </div>

              {/* Graphic Comparison */}
              <div className="space-y-3 pt-2">
                {/* Safe Window Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>
                      Required Safe Range:{" "}
                      <strong className="text-white">
                        {summary.thermalComparison.safeMin}°C to {summary.thermalComparison.safeMax}°C
                      </strong>
                    </span>
                    <span className="text-slate-500">WHO / CDC Clinical Envelope</span>
                  </div>
                  <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                    <div className="h-full w-full bg-gradient-to-r from-cyan-500/40 via-emerald-500/50 to-cyan-500/40 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-cyan-200 tracking-wider">
                        TARGET SAFE ZONE ({summary.vaccineTier})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actual Recorded Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>
                      Actual Trip Recorded Range:{" "}
                      <strong
                        className={
                          summary.thermalComparison.withinEnvelope
                            ? "text-cyan-300"
                            : "text-rose-400"
                        }
                      >
                        {summary.thermalComparison.recordedMin}°C to {summary.thermalComparison.recordedMax}°C
                      </strong>
                    </span>
                    <span className="text-slate-400">
                      Average:{" "}
                      <strong className="text-white font-mono">
                        {summary.thermalComparison.recordedAvg}°C
                      </strong>
                    </span>
                  </div>
                  <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700 relative">
                    <div
                      className={`h-full rounded-full transition-all flex items-center justify-center ${
                        summary.thermalComparison.withinEnvelope
                          ? "bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-sm shadow-cyan-500/50"
                          : "bg-gradient-to-r from-amber-500 to-rose-500 shadow-sm shadow-rose-500/50"
                      }`}
                      style={{ width: "100%" }}
                    >
                      <span className="text-[9px] font-mono font-black text-slate-950 uppercase tracking-widest">
                        {summary.thermalComparison.statusText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. FAST STATS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {summary.highlights.map((h, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1"
                >
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                    {h.title}
                  </span>
                  <div className="text-base font-black font-mono text-white tracking-tight">
                    {h.value}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">{h.desc}</p>
                </div>
              ))}
            </div>

            {/* 4. THE TRIP STORY IN PLAIN WORDS */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-mono uppercase font-bold text-slate-200 tracking-wider">
                  The Journey in Plain English (Non-Technical Narrative)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
                    <Truck className="h-3.5 w-3.5" />
                    <span>The Journey</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {summary.tripStory.journeyOverview}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 text-blue-300 text-xs font-bold">
                    <Thermometer className="h-3.5 w-3.5" />
                    <span>Cooling Performance</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {summary.tripStory.coolingPerformance}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                    <Award className="h-3.5 w-3.5" />
                    <span>Clinical Conclusion</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {summary.tripStory.safetyConclusion}
                  </p>
                </div>
              </div>
            </div>

            {/* 5. RECEIVING STAFF ACTION CHECKLIST */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono uppercase font-bold text-slate-200 tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Hospital Receiving Staff Action Protocol
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  Follow in order upon delivery arrival
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {summary.clinicChecklist.map((c) => (
                  <div
                    key={c.step}
                    className={`p-4 rounded-xl border space-y-1.5 ${
                      c.status === "warning"
                        ? "bg-rose-950/30 border-rose-800/50"
                        : "bg-slate-950/50 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-5 w-5 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                          c.status === "warning"
                            ? "bg-rose-500 text-white"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}
                      >
                        {c.step}
                      </span>
                      <h5 className="text-xs font-bold text-white tracking-tight">
                        {c.action}
                      </h5>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed pl-7">
                      {c.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. NON-TECHNICAL FREQUENTLY ASKED QUESTIONS */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-cyan-400" />
                <h4 className="text-xs font-mono uppercase font-bold text-slate-200 tracking-wider">
                  Quick Answers for Clinic Staff
                </h4>
              </div>

              <div className="space-y-2">
                {summary.nonTechnicalFaq.map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="w-full p-3.5 text-left flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-3.5 pb-3.5 text-xs text-slate-400 leading-relaxed border-t border-slate-900 pt-2.5">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer note */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 font-mono">
              <span>
                Generated by Agesichain Kinetic Engine • WHO PQS Protocol Audited
              </span>
              <span>Session ID: {summary.sessionCode}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
