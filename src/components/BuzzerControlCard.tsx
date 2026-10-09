"use client";

import { useState } from "react";
import {
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Radio,
} from "lucide-react";

interface BuzzerControlCardProps {
  buzzerActive: boolean;
  currentTemp: number | null;
  status: string;
  onBuzzerAction: (action: "silence" | "rearm" | "test" | "stop_test") => Promise<void>;
  loading: boolean;
}

export default function BuzzerControlCard({
  buzzerActive,
  currentTemp,
  status,
  onBuzzerAction,
  loading,
}: BuzzerControlCardProps) {
  const [testMode, setTestMode] = useState(false);

  const isExcursion = currentTemp !== null && (currentTemp > 8.0 || currentTemp < 2.0);

  const handleTestToggle = async () => {
    if (!testMode) {
      setTestMode(true);
      await onBuzzerAction("test");
    } else {
      setTestMode(false);
      await onBuzzerAction("stop_test");
    }
  };

  return (
    <div
      className={`glass rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
        buzzerActive
          ? "border-orange-500/60 bg-orange-950/20 glow-warning"
          : "border-slate-800/80 bg-slate-900/40"
      }`}
    >
      {/* Top accent line */}
      <div
        className={`absolute inset-x-0 top-0 h-1 transition-all ${
          buzzerActive
            ? "bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 animate-pulse"
            : "bg-slate-800"
        }`}
      />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
                buzzerActive
                  ? "bg-orange-500/20 border border-orange-500/50 text-orange-400 animate-bounce"
                  : "bg-slate-800 border border-slate-700 text-slate-400"
              }`}
            >
              {buzzerActive ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Physical Buzzer Remote (GPIO 32)
                {buzzerActive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
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
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 border ${
              buzzerActive
                ? "bg-orange-950/80 border-orange-500/80 text-orange-300 animate-pulse"
                : "bg-slate-950/80 border-slate-800 text-slate-400"
            }`}
          >
            {buzzerActive ? (
              <>
                <Bell className="h-3.5 w-3.5 text-orange-400 animate-spin" />
                <span>BUZZING (ALARM ACTIVE)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>MUTED / IDLE</span>
              </>
            )}
          </div>
        </div>

        {/* Status description */}
        <div className="mt-3.5 text-xs leading-relaxed text-slate-300">
          {buzzerActive ? (
            <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-900/50 text-orange-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Excursion Alarm Triggered! (Temp: {currentTemp?.toFixed(1) ?? "—"}°C)
                </p>
                <p className="text-[11px] text-orange-300/80 mt-0.5">
                  The ESP32 is actively sounding its hardware buzzer on GPIO 32. Click &quot;Silence Buzzer&quot; below to silence it remotely from the website.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-xs">
              {isExcursion
                ? "Buzzer was silenced by operator or waiting for re-arm. Click 'Re-arm Buzzer' to sound alert again."
                : "System is in normal thermal envelope (2.0°C – 8.0°C). Buzzer triggers automatically if temperature breaches or spoilage window closes."}
            </p>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
        {/* Silence Button (Always visible) */}
        <button
          onClick={() => onBuzzerAction("silence")}
          disabled={loading}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50 ${
            buzzerActive
              ? "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/50 border border-orange-400 active:scale-95"
              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          }`}
        >
          <BellOff className="h-4 w-4" />
          <span>Silence Buzzer</span>
        </button>

        {/* Re-arm Button */}
        <button
          onClick={() => onBuzzerAction("rearm")}
          disabled={loading}
          title="Re-arm threshold breach detection"
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 font-medium text-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5 text-cyan-400" />
          <span>Re-Arm</span>
        </button>

        {/* Hardware Test Button */}
        <button
          onClick={handleTestToggle}
          disabled={loading}
          title="Send test signal to physical buzzer GPIO 32"
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer disabled:opacity-50 border ${
            testMode
              ? "bg-red-950/80 text-red-200 border-red-500 animate-pulse"
              : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-amber-300"
          }`}
        >
          <Radio className="h-3.5 w-3.5 text-amber-400" />
          <span>{testMode ? "Stop Test" : "Test Kit Buzzer"}</span>
        </button>
      </div>
    </div>
  );
}
