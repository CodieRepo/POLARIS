"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("super_admin_6c6_027160@polaris.test");
  const [password, setPassword] = useState("Polaris@2026");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error || "Authentication failed.");
      } else {
        window.location.href = "/";
      }
    } catch {
      setErrorMsg("Network error during login.");
    } finally {
      setLoading(false);
    }
  };

  const setRoleDemo = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword("Polaris@2026");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black text-3xl mb-4 shadow-lg shadow-cyan-500/10">
          ❄
        </div>
        <h1 className="text-3xl font-black tracking-wider text-white">POLARIS</h1>
        <p className="mt-2 text-xs font-mono text-cyan-400 tracking-wider uppercase">
          Polar Operations &amp; Resource Intelligence System
        </p>
        <p className="mt-1 text-xs text-slate-400">
          National Centre for Polar and Ocean Research (NCPOR)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/60 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {errorMsg && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300 font-mono">
                ⚠️ {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Operational Identity (Email)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Security Passphrase
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {loading ? "Authenticating Session..." : "Sign In to Polar Net"}
            </button>
          </form>

          {/* Quick Demo Preset Selection */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <span className="block text-xs font-mono font-bold text-slate-400 mb-3 text-center uppercase tracking-wider">
              SIH Presentation Quick Logins
            </span>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setRoleDemo("super_admin_6c6_027160@polaris.test")}
                className="w-full text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 p-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-cyan-400 font-mono font-bold">SUPER_ADMIN</strong>
                  <span className="text-slate-500 text-[10px] font-mono">Full Authority</span>
                </div>
                <span className="text-slate-400 text-[11px] font-mono block mt-1 group-hover:text-slate-200 transition-colors">
                  super_admin_6c6_027160@polaris.test
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDemo("cmd_admin_6c6_027160@polaris.test")}
                className="w-full text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 p-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-400 font-mono font-bold">COMMAND_ADMIN</strong>
                  <span className="text-slate-500 text-[10px] font-mono">Station &amp; Exp Ops</span>
                </div>
                <span className="text-slate-400 text-[11px] font-mono block mt-1 group-hover:text-slate-200 transition-colors">
                  cmd_admin_6c6_027160@polaris.test
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDemo("viewer_6c6_027160@polaris.test")}
                className="w-full text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 p-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-amber-400 font-mono font-bold">VIEWER</strong>
                  <span className="text-slate-500 text-[10px] font-mono">Read-Only Access</span>
                </div>
                <span className="text-slate-400 text-[11px] font-mono block mt-1 group-hover:text-slate-200 transition-colors">
                  viewer_6c6_027160@polaris.test
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-cyan-400 transition-colors font-mono">
            ← Continue to Public Dashboard Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

