"use client";

import { useState } from "react";
import {
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Radio,
  Loader2,
} from "lucide-react";

interface BuzzerControlCardProps {
  buzzerActive: boolean;
  currentTemp: number | null;
  status: string;
  onBuzzerAction: (action: "silence" | "rearm" | "test" | "stop_test") => Promise<void>;
  loading: boolean;
  isAdmin?: boolean;
}

export default function BuzzerControlCard({
  buzzerActive,
  currentTemp,
  status,
  onBuzzerAction,
  loading,
  isAdmin = true,
}: BuzzerControlCardProps) {
  const [testMode, setTestMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isExcursion = currentTemp !== null && (currentTemp > 8.0 || currentTemp < 2.0);

  const handleAction = async (action: "silence" | "rearm" | "test" | "stop_test") => {
    setPendingAction(action);
    try {
      await onBuzzerAction(action);
    } finally {
      setPendingAction(null);
    }
  };

  const handleTestToggle = async () => {
    if (!testMode) {
      setTestMode(true);
      await handleAction("test");
    } else {
      setTestMode(false);
      await handleAction("stop_test");
    }
  };

  return (
    <div
      className={`glass rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between shadow-lg ${
        buzzerActive
          ? "border-rose-500/60 bg-rose-950/20 glow-critical"
          : "border-white/[0.08]"
      }`}
    >
      {/* Top accent line */}
      <div
        className={`absolute inset-x-0 top-0 h-[2px] transition-all ${
          buzzerActive
            ? "bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse"
            : "bg-gradient-to-r from-blue-500 via-indigo-500 to-transparent opacity-80"
        }`}
      />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                buzzerActive
                  ? "bg-rose-500/20 border border-rose-500/50 text-rose-400 animate-bounce"
                  : "bg-blue-500/10 border border-blue-500/25 text-blue-400"
              }`}
            >
              {buzzerActive ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Physical Buzzer Remote (GPIO 32)
                {buzzerActive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Closed-loop cloud command stream to ESP32 kit
              </p>
            </div>
          </div>

          {/* Current State Badge */}
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-all ${
              buzzerActive
                ? "bg-rose-950/80 border-rose-500/80 text-rose-300 animate-pulse"
                : "bg-slate-900/80 border-white/[0.08] text-slate-400"
            }`}
          >
            {buzzerActive ? (
              <>
                <Bell className="h-3 w-3 text-rose-400 animate-spin" />
                <span>ALARM ACTIVE</span>
              </>
            ) : pendingAction === "silence" ? (
              <>
                <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                <span>SYNCING...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>MUTED / NOMINAL</span>
              </>
            )}
          </div>
        </div>

        {/* Status description */}
        <div className="mt-3 text-xs leading-relaxed text-slate-300">
          {buzzerActive ? (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">
                  Excursion Alarm Active! (Chamber: {currentTemp?.toFixed(1) ?? "—"}°C)
                </p>
                <p className="text-[11px] text-rose-300/80 mt-0.5">
                  The physical buzzer is sounding on the van kit. Click &quot;Silence Buzzer&quot; below to silence it remotely.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs">
              {isExcursion
                ? "Buzzer was silenced by operator or awaiting re-arm. Click 'Re-arm' to sound alert again."
                : "Chamber is nominal. Physical buzzer triggers automatically if temperature breaches or spoilage window closes."}
            </p>
          )}
        </div>
      </div>

      {/* Control Buttons (Admin) or Hardware Status (Viewer) */}
      {isAdmin ? (
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
          {/* Silence Button */}
          <button
            onClick={() => handleAction("silence")}
            disabled={loading && pendingAction === "silence"}
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer disabled:opacity-75 active:scale-95 shadow-sm ${
              buzzerActive
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/50 border border-rose-400"
                : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/[0.08]"
            }`}
          >
            {pendingAction === "silence" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Silencing...</span>
              </>
            ) : (
              <>
                <BellOff className="h-3.5 w-3.5" />
                <span>Silence Buzzer</span>
              </>
            )}
          </button>

          {/* Re-arm Button */}
          <button
            onClick={() => handleAction("rearm")}
            disabled={loading && pendingAction === "rearm"}
            title="Re-arm threshold breach detection"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] hover:border-white/[0.16] text-slate-300 hover:text-white font-medium text-xs transition-all cursor-pointer disabled:opacity-75 active:scale-95"
          >
            {pendingAction === "rearm" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                <span>Re-arming...</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5 text-blue-400" />
                <span>Re-Arm</span>
              </>
            )}
          </button>

          {/* Hardware Test Button */}
          <button
            onClick={handleTestToggle}
            disabled={loading && (pendingAction === "test" || pendingAction === "stop_test")}
            title="Send test signal to physical buzzer GPIO 32"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs transition-all cursor-pointer disabled:opacity-75 border active:scale-95 ${
              testMode
                ? "bg-rose-950/80 text-rose-200 border-rose-500 animate-pulse"
                : "bg-slate-900/80 hover:bg-slate-800 border-white/[0.08] text-slate-300 hover:text-amber-300"
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-amber-400" />
            <span>{testMode ? "Stop Test" : "Test Kit"}</span>
          </button>
        </div>
      ) : (
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-blue-400" />
            <span>Hardware Remote:</span>
          </span>
          <span className="font-mono text-emerald-300 font-semibold">
            {buzzerActive ? "⚠ Alarm Active on GPIO 32" : "✓ Nominal (Cloud Automated)"}
          </span>
        </div>
      )}
    </div>
  );
}
