"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User as UserIcon, ShieldCheck, Shield } from "lucide-react";

export default function UserNav() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  const role = (session.user as { role?: string }).role || "VIEWER";
  const isAdmin = role === "ADMIN";

  return (
    <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-md">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
          {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
        </div>
        <div className="hidden sm:block">
          <div className="text-xs font-semibold text-slate-200 leading-tight truncate max-w-[140px]">
            {session.user.name || session.user.email}
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                isAdmin
                  ? "bg-cyan-950/90 text-cyan-300 border border-cyan-800/60"
                  : "bg-emerald-950/90 text-emerald-300 border border-emerald-800/60"
              }`}
            >
              {role}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        title="Sign Out"
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/40 border border-transparent hover:border-red-800/40 transition-colors cursor-pointer"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
