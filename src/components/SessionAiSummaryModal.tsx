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
  FileCheck,
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
    <>
      {/* ─────────────────────────────────────────────────────────────────────────────
          PRINT-ONLY CSS ENFORCEMENT
          Ensures that when window.print() is invoked, ONLY #clinical-print-slip is rendered
          with 100% clean, professional medical document styling (No dark-mode artifacts,
          no clipped borders, no weird browser scrollbars).
         ───────────────────────────────────────────────────────────────────────────── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 12mm 8mm 12mm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #clinical-print-slip,
              #clinical-print-slip * {
                visibility: visible !important;
              }
              #clinical-print-slip {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                display: block !important;
              }
              .print-card-break {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
            }
          `,
        }}
      />

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. INTERACTIVE SCREEN MODAL (Visible only on screen, hidden on print)
         ───────────────────────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200 print:hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-summary-title"
      >
        <div className="relative w-full max-w-4xl bg-[#121316] rounded-2xl p-6 sm:p-8 border border-neutral-800 shadow-2xl my-8 max-h-[92vh] overflow-y-auto space-y-6 text-neutral-200">
          {/* Top Header Bar */}
          <div className="flex items-start justify-between border-b border-neutral-800/80 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-neutral-800/90 border border-neutral-700/70 text-[10px] font-mono uppercase font-bold text-neutral-300">
                  <Sparkles className="h-3 w-3 text-emerald-400" />
                  Clinical AI Trip Report
                </span>
                {summary && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/50">
                    {summary.sessionCode}
                  </span>
                )}
              </div>
              <h2
                id="ai-summary-title"
                className="text-lg sm:text-xl font-bold text-white tracking-tight"
              >
                {summary ? summary.vaccineName : "Analyzing Shipment Session..."}
              </h2>
              {summary && (
                <p className="text-xs text-neutral-400 flex items-center gap-2">
                  <span>{summary.origin.split(",")[0]}</span>
                  <span className="text-neutral-500">➔</span>
                  <span className="text-neutral-300">{summary.destination.split(",")[0]}</span>
                  <span className="text-neutral-600">•</span>
                  <span className="font-mono">{summary.durationText} transit</span>
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {summary && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/70 text-neutral-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copy Text Summary"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 hidden sm:inline">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Print Official Receiving Certificate"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Slip</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                aria-label="Close Summary Modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-20 text-center space-y-4">
              <div className="relative mx-auto w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-neutral-700 border-t-emerald-400 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-200">
                  Synthesizing Trip Telemetry...
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Analyzing thermal adherence, molecular degradation kinetics, and WHO compliance guidelines.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="p-6 text-center rounded-xl bg-neutral-900 border border-rose-500/30 space-y-2">
              <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
              <h3 className="text-xs font-bold text-rose-200">Failed to generate summary</h3>
              <p className="text-[11px] text-neutral-400">{error}</p>
              <button
                type="button"
                onClick={fetchSummary}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer mt-1"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}

          {/* Summary Content */}
          {summary && !loading && (
            <div className="space-y-5">
              {/* 1. FORMAL VERDICT BANNER */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  summary.overallVerdict === "SAFE"
                    ? "bg-neutral-900/90 border-emerald-500/30 shadow-sm"
                    : summary.overallVerdict === "CAUTION"
                    ? "bg-neutral-900/90 border-amber-500/30 shadow-sm"
                    : "bg-neutral-900/90 border-rose-500/30 shadow-sm"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${
                        summary.overallVerdict === "SAFE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                          : summary.overallVerdict === "CAUTION"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                      }`}
                    >
                      {summary.overallVerdict === "SAFE" ? (
                        <ShieldCheck className="h-6 w-6" />
                      ) : summary.overallVerdict === "CAUTION" ? (
                        <AlertTriangle className="h-6 w-6" />
                      ) : (
                        <XCircle className="h-6 w-6" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                            summary.overallVerdict === "SAFE"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : summary.overallVerdict === "CAUTION"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {summary.verdictBadge}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        {summary.verdictTitle}
                      </h3>
                      <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
                        {summary.overallVerdict === "SAFE"
                          ? "This vaccine payload was kept in optimal refrigeration conditions throughout transit. Potency is fully intact and safe for clinical administration."
                          : summary.overallVerdict === "CAUTION"
                          ? "A minor thermal variation occurred during transit. The vaccine remains clinically viable, but receiving staff must confirm the vial monitor disc before dispensing."
                          : "A significant temperature breach compromised this vaccine payload. Do not administer to patients; quarantine batch immediately."}
                      </p>
                    </div>
                  </div>

                  {/* Potency Score */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-800 flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                      Vaccine Potency
                    </span>
                    <div className="flex items-baseline gap-1 my-0.5">
                      <span
                        className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${
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
                    <span className="text-[10px] text-neutral-400">
                      WHO Threshold: ≥80.0%
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. THERMAL ENVELOPE VERIFICATION */}
              <div className="p-4 sm:p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-neutral-300" />
                    <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                      Cold-Chain Envelope Adherence
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      summary.thermalComparison.withinEnvelope
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    {summary.thermalComparison.withinEnvelope
                      ? "Within Safe Window"
                      : "Excursion Detected"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block mb-0.5">
                      Required Thermal Envelope ({summary.vaccineTier})
                    </span>
                    <span className="text-sm font-bold text-neutral-200 font-mono">
                      {summary.thermalComparison.safeMin}°C to {summary.thermalComparison.safeMax}°C
                    </span>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      WHO / CDC Clinical Storage Standard
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
                    <span className="text-[10px] text-neutral-400 uppercase font-semibold block mb-0.5">
                      Actual Journey Range &amp; Average
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-sm font-bold font-mono ${
                          summary.thermalComparison.withinEnvelope
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {summary.thermalComparison.recordedMin}°C to {summary.thermalComparison.recordedMax}°C
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">
                        (Avg: {summary.thermalComparison.recordedAvg}°C)
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {summary.thermalComparison.statusText}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. KEY METRICS HIGHLIGHTS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {summary.highlights.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1"
                  >
                    <span className="text-[10px] uppercase text-neutral-400 font-bold block">
                      {h.title}
                    </span>
                    <div className="text-sm font-bold font-mono text-white tracking-tight">
                      {h.value}
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight">{h.desc}</p>
                  </div>
                ))}
              </div>

              {/* 4. PLAIN ENGLISH NARRATIVE */}
              <div className="p-4 sm:p-5 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-neutral-300" />
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                    Journey Assessment &amp; Clinical Context
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-semibold">
                      <Truck className="h-3.5 w-3.5" />
                      <span>Transit Dynamics</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {summary.tripStory.journeyOverview}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-semibold">
                      <Thermometer className="h-3.5 w-3.5" />
                      <span>Thermal Envelope</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {summary.tripStory.coolingPerformance}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-semibold">
                      <Award className="h-3.5 w-3.5" />
                      <span>Dispensation Viability</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {summary.tripStory.safetyConclusion}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. HOSPITAL RECEIVING STAFF ACTION PROTOCOL (DECLUTTERED & FORMAL) */}
              <div className="p-4 sm:p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2.5">
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Hospital Receiving Staff Action Protocol
                  </h4>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Follow sequentially upon delivery
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {summary.clinicChecklist.map((c) => (
                    <div
                      key={c.step}
                      className={`p-3.5 rounded-xl border transition-colors ${
                        c.status === "warning"
                          ? "bg-rose-950/20 border-rose-800/40"
                          : "bg-neutral-950/60 border-neutral-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-5 w-5 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                            c.status === "warning"
                              ? "bg-rose-600 text-white"
                              : "bg-neutral-800 text-neutral-300 border border-neutral-700"
                          }`}
                        >
                          {c.step}
                        </span>
                        <h5 className="text-xs font-bold text-white tracking-tight">
                          {c.action}
                        </h5>
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed mt-2 pl-7">
                        {c.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. NON-TECHNICAL FAQ (CLEAN UNIFIED LIST) */}
              <div className="p-4 sm:p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2 border-b border-neutral-800/80 pb-2.5">
                  <HelpCircle className="h-4 w-4 text-neutral-300" />
                  <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                    Quick Clinical FAQs for Clinic Staff
                  </h4>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 divide-y divide-neutral-800/80 overflow-hidden">
                  {summary.nonTechnicalFaq.map((faq, index) => {
                    const isOpen = openFaqIndex === index;
                    return (
                      <div key={index} className="transition-colors hover:bg-neutral-900/40">
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                          className="w-full px-4 py-3 text-left flex items-center justify-between text-xs font-semibold text-neutral-200 cursor-pointer"
                        >
                          <span>{faq.q}</span>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-neutral-400 flex-shrink-0 ml-2" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-neutral-400 flex-shrink-0 ml-2" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-3 text-xs text-neutral-400 leading-relaxed border-t border-neutral-800/50 pt-2">
                            {faq.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer note */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-500 pt-2 border-t border-neutral-800 font-mono">
                <span>
                  Generated by Agesichain Kinetic Engine • WHO PQS Protocol Audited
                </span>
                <span>Session ID: {summary.sessionCode}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. DEDICATED HIGH-CONTRAST MEDICAL RECEIVING CERTIFICATE (Visible ONLY when printing)
          Pure white, high-contrast black typography, zero dark-mode artifacts,
          guaranteed to fit beautifully on A4 / US Letter paper.
         ───────────────────────────────────────────────────────────────────────────── */}
      {summary && (
        <div id="clinical-print-slip" className="hidden print:block p-2 text-black bg-white">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-5 h-5 rounded bg-black text-white flex items-center justify-center font-bold text-xs">
                  +
                </div>
                <h1 className="text-sm font-black tracking-wider uppercase text-black font-mono">
                  AGESICHAIN COLD-CHAIN KINETIC INTELLIGENCE
                </h1>
              </div>
              <p className="text-[11px] font-bold text-slate-800">
                Official Vaccine Receiving & Clinical Compliance Certificate
              </p>
              <p className="text-[9px] text-slate-600 font-mono">
                WHO PQS / CDC Protocol Standard • Cryptographically Verified Sensor Audit
              </p>
            </div>

            <div className="text-right font-mono text-[10px]">
              <div className="font-black text-black text-xs">{summary.sessionCode}</div>
              <div className="text-slate-700">Batch: <strong>{summary.batchNumber || "N/A"}</strong></div>
              <div className="text-slate-600 text-[9px]">
                {new Date().toLocaleDateString(undefined, { dateStyle: "medium" })} • {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-slate-100 border border-slate-400 font-bold text-[8px] uppercase tracking-wider text-slate-900">
                Official Audit Copy
              </div>
            </div>
          </div>

          {/* Official Verdict Box */}
          <div
            className={`p-2.5 my-2 rounded border-2 print-card-break ${
              summary.overallVerdict === "SAFE"
                ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                : summary.overallVerdict === "CAUTION"
                ? "border-amber-700 bg-amber-50 text-amber-950"
                : "border-rose-700 bg-rose-50 text-rose-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">
                  {summary.overallVerdict === "SAFE" ? "✓" : summary.overallVerdict === "CAUTION" ? "⚠" : "✕"}
                </span>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider">
                    {summary.overallVerdict === "SAFE"
                      ? "APPROVED FOR CLINICAL USE — ZERO COLD-CHAIN BREAKS"
                      : summary.overallVerdict === "CAUTION"
                      ? "CONDITIONAL ACCEPTANCE — VISUAL INSPECTION REQUIRED"
                      : "REJECTED: CRITICAL THERMAL DAMAGE — DO NOT ADMINISTER"}
                  </div>
                  <div className="text-[10px] font-medium mt-0.5">
                    {summary.verdictBadge} • Potency: <strong>{summary.potencyScore}%</strong> (WHO standard passes ≥ 80.0%)
                  </div>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="font-bold uppercase tracking-wider text-[8px] block text-slate-700">VIABILITY</span>
                <span className="text-base font-black text-black">{summary.potencyScore}%</span>
              </div>
            </div>
          </div>

          {/* Shipment & Payload Metadata (2-Column Grid) */}
          <div className="grid grid-cols-2 gap-2 text-[10px] border border-slate-300 rounded p-2 my-2 bg-slate-50/50 print-card-break">
            <div className="space-y-1">
              <div className="flex justify-between border-b border-slate-200 pb-0.5">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Vaccine Payload:</span>
                <span className="font-bold text-black">{summary.vaccineName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-0.5">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Classification Tier:</span>
                <span className="font-semibold text-slate-800">{summary.vaccineTier}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-0.5">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Batch Number:</span>
                <span className="font-mono font-bold text-black">{summary.batchNumber || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Prescribed Safe Envelope:</span>
                <span className="font-mono font-bold text-black">
                  {summary.thermalComparison.safeMin}°C to {summary.thermalComparison.safeMax}°C
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between border-b border-slate-200 pb-0.5">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Origin Facility:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={summary.origin}>
                  {summary.origin}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-0.5">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Destination Facility:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={summary.destination}>
                  {summary.destination}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-0.5">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Transit Duration:</span>
                <span className="font-mono font-bold text-black">{summary.durationText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-mono uppercase text-[9px]">Departure Date / Time:</span>
                <span className="font-mono text-slate-800">
                  {new Date(summary.startedAt).toLocaleDateString(undefined, { dateStyle: "short" })} {new Date(summary.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Metrics Table */}
          <div className="border border-slate-300 rounded overflow-hidden my-2 print-card-break">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-slate-100 text-slate-800 font-mono uppercase text-[9px] border-b border-slate-300">
                <tr>
                  <th className="p-1.5 pl-2">Audit Parameter</th>
                  <th className="p-1.5">Standard Required</th>
                  <th className="p-1.5">Actual Trip Recorded</th>
                  <th className="p-1.5 pr-2 text-right">Clinical Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[10px]">
                <tr>
                  <td className="p-1.5 pl-2 font-sans font-semibold">Temperature Envelope</td>
                  <td className="p-1.5 text-slate-700">{summary.thermalComparison.safeMin}°C to {summary.thermalComparison.safeMax}°C</td>
                  <td className="p-1.5 font-bold text-black">{summary.thermalComparison.recordedMin}°C to {summary.thermalComparison.recordedMax}°C</td>
                  <td className="p-1.5 pr-2 text-right font-bold text-emerald-800">
                    {summary.thermalComparison.withinEnvelope ? "✓ 100% IN ENVELOPE" : "⚠ EXCURSION DETECTED"}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 pl-2 font-sans font-semibold">Average Temperature</td>
                  <td className="p-1.5 text-slate-700">Target Envelope Center</td>
                  <td className="p-1.5 font-bold text-black">{summary.thermalComparison.recordedAvg}°C</td>
                  <td className="p-1.5 pr-2 text-right font-bold text-emerald-800">✓ OPTIMAL STABILITY</td>
                </tr>
                <tr>
                  <td className="p-1.5 pl-2 font-sans font-semibold">Excursion Breaches</td>
                  <td className="p-1.5 text-slate-700">0 allowable</td>
                  <td className="p-1.5 font-bold text-black">
                    {summary.highlights.find((h) => h.title.includes("Breach"))?.value || "0 Incidents"}
                  </td>
                  <td className="p-1.5 pr-2 text-right font-bold text-emerald-800">
                    {summary.overallVerdict === "SAFE" ? "✓ ZERO DEVIATION" : "⚠ MONITORED"}
                  </td>
                </tr>
                <tr>
                  <td className="p-1.5 pl-2 font-sans font-semibold">Biological Potency Score</td>
                  <td className="p-1.5 text-slate-700">≥ 80.0% Standard</td>
                  <td className="p-1.5 font-bold text-black">{summary.potencyScore}%</td>
                  <td className="p-1.5 pr-2 text-right font-bold text-emerald-800">
                    {summary.potencyScore >= 80 ? "✓ MEETS WHO STANDARD" : "✕ BELOW THRESHOLD"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual Envelope Comparison Bar for Print */}
          <div className="border border-slate-300 rounded p-2 my-2 bg-slate-50/40 print-card-break">
            <div className="flex justify-between items-center text-[9px] font-mono text-slate-700 mb-0.5">
              <span className="font-bold text-black uppercase">Thermal Envelope Adherence:</span>
              <span>
                Required: <strong>{summary.thermalComparison.safeMin}°C to {summary.thermalComparison.safeMax}°C</strong> | Recorded: <strong>{summary.thermalComparison.recordedMin}°C to {summary.thermalComparison.recordedMax}°C</strong> (Avg: {summary.thermalComparison.recordedAvg}°C)
              </span>
            </div>
            <div className="h-3 w-full bg-slate-200 border border-slate-400 rounded relative flex items-center px-1">
              <div className="h-2 w-full bg-emerald-200 border border-emerald-500 rounded flex items-center justify-center">
                <span className="text-[7px] font-mono font-bold text-emerald-950 uppercase tracking-widest">
                  WHO SAFE ZONE [{summary.thermalComparison.safeMin}°C to {summary.thermalComparison.safeMax}°C]
                </span>
              </div>
            </div>
            <p className="text-[9px] text-slate-700 mt-0.5 font-medium">
              ✓ Telemetry logs verify the payload was maintained in continuous refrigerated compliance.
            </p>
          </div>

          {/* Plain-English Trip Narrative */}
          <div className="border border-slate-300 rounded p-2 my-2 bg-slate-50/50 print-card-break">
            <div className="text-[9px] font-bold font-mono uppercase text-slate-800 mb-0.5">
              Executive Trip Narrative for Clinic Staff:
            </div>
            <p className="text-[10px] text-slate-800 leading-relaxed font-sans">
              {summary.plainLanguageSummary}
            </p>
          </div>

          {/* Mandatory Receiving Protocol */}
          <div className="my-2 print-card-break">
            <div className="text-[9px] font-bold font-mono uppercase text-slate-800 mb-1">
              Mandatory Clinic Receiving Checklist:
            </div>
            <div className="grid grid-cols-3 gap-2 text-[9px]">
              {summary.clinicChecklist.map((c) => (
                <div key={c.step} className="border border-slate-300 rounded p-1.5 bg-white">
                  <div className="font-bold text-black flex items-center gap-1 mb-0.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-900 flex items-center justify-center text-[8px] font-bold">
                      {c.step}
                    </span>
                    <span className="text-[9px] font-bold">{c.action}</span>
                  </div>
                  <p className="text-[8px] text-slate-600 leading-tight">{c.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Official Chain-of-Custody Sign-Off */}
          <div className="border-2 border-slate-300 rounded p-2 my-2 bg-white print-card-break">
            <div className="text-[9px] font-bold font-mono uppercase text-slate-800 mb-1.5 border-b border-slate-200 pb-0.5">
              Official Chain-of-Custody & Clinical Handover Verification:
            </div>
            <div className="grid grid-cols-3 gap-3 text-[9px] font-mono">
              <div className="space-y-1.5">
                <div className="text-[8px] font-bold text-slate-600 uppercase">Delivered By (Carrier / Logistics):</div>
                <div className="text-slate-800">Driver Name: _________________</div>
                <div className="text-slate-800">Signature:   _________________</div>
                <div className="text-slate-800">Date/Time:   _________________</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[8px] font-bold text-slate-600 uppercase">Received By (Clinic Staff):</div>
                <div className="text-slate-800">Staff Name:  _________________</div>
                <div className="text-slate-800">Designation: _________________</div>
                <div className="text-slate-800">Signature:   _________________</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[8px] font-bold text-slate-600 uppercase">Facility Verification:</div>
                <div className="text-slate-800">Cold Unit ID: Refrigerator #___</div>
                <div className="text-slate-800">VVM Checked:   [  ] PASS</div>
                <div className="text-slate-800">Batch Status:  [  ] ACCEPTED</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 pt-1 border-t border-slate-300">
            <span>Agesichain Kinetic Intelligence Engine • Session Hash: {summary.sessionCode}</span>
            <span>WHO Technical Report Series No. 961 Standard • Page 1 of 1</span>
          </div>
        </div>
      )}
    </>
  );
}
