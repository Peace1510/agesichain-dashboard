"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  ThermometerSnowflake,
  Activity,
  CheckCircle2,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!res || res.error) {
        setError("Invalid email or password. Please verify credentials.");
        setLoading(false);
        return;
      }

      // Successful login
      router.push(res.url || callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("Login submission error:", err);
      setError("An unexpected error occurred during authentication.");
      setLoading(false);
    }
  };

  const fillCredentials = (role: "admin" | "viewer") => {
    if (role === "admin") {
      setEmail("admin@agesichain.com");
      setPassword("AgeisChain2026!");
    } else {
      setEmail("viewer@agesichain.com");
      setPassword("Viewer2026!");
    }
    setError(null);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Ambient background glow behind card */}
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-emerald-500/15 to-violet-500/20 rounded-3xl blur-xl opacity-70 animate-pulse pointer-events-none" />

      {/* Main Glass Card */}
      <div className="relative glass rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl backdrop-blur-2xl">
        {/* Top Accent bar */}
        <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 glow-accent shadow-lg shadow-cyan-950/50">
              <ThermometerSnowflake className="h-8 w-8 text-cyan-400" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#04070f]" />
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/40 text-[11px] font-mono font-semibold text-cyan-300 uppercase tracking-widest mb-2">
            <Activity className="h-3 w-3 text-cyan-400 animate-spin" />
            Secure Fleet Access
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            AGESICHAIN
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-xs">
            Kinetic Vaccine Viability & IoT Cold-Chain Monitoring System
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Work Email
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@agesichain.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-cyan-400 transition-colors">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit-button"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 mt-2 bg-gradient-to-r from-cyan-500 hover:from-cyan-400 to-blue-600 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 hover:shadow-cyan-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Enter Fleet Console</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick demo presets */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <div className="text-[11px] font-mono text-slate-400 text-center mb-3">
            DEFAULT OPERATOR ACCOUNTS
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => fillCredentials("admin")}
              className="px-3 py-2 rounded-lg bg-slate-900/50 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-700/50 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                Admin
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                admin@agesichain.com
              </div>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials("viewer")}
              className="px-3 py-2 rounded-lg bg-slate-900/50 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-700/50 text-left transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Viewer
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                viewer@agesichain.com
              </div>
            </button>
          </div>
        </div>

        {/* Hardware Status Footer */}
        <div className="mt-6 text-center">
          <p className="text-[10px] font-mono text-slate-500 flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            256-Bit TLS Hardware Link &bull; Fleet Protocol Active
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#04070f] relative overflow-hidden">
      {/* Background cyber grid & glow effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,182,212,0.15),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(139,92,246,0.12),transparent_70%)] pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-cyan-400 font-mono text-sm flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            Loading security portal...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
