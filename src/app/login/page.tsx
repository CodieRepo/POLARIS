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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 font-black text-3xl mb-4 shadow-xs">
          ❄
        </div>
        <h1 className="text-3xl font-black tracking-wider text-slate-900">POLARIS</h1>
        <p className="mt-2 text-xs font-mono text-sky-700 tracking-wider uppercase font-semibold">
          Polar Operations &amp; Resource Intelligence System
        </p>
        <p className="mt-1 text-xs text-slate-500">
          National Centre for Polar and Ocean Research (NCPOR)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 py-8 px-6 shadow-sm rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 font-mono">
                ⚠️ {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Operational Identity (Email)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none font-mono transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Security Passphrase
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none font-mono transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {loading ? "Authenticating Session..." : "Sign In to Polar Net"}
            </button>
          </form>

          {/* Quick Demo Preset Selection */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <span className="block text-xs font-mono font-bold text-slate-500 mb-3 text-center uppercase tracking-wider">
              SIH Presentation Quick Logins
            </span>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setRoleDemo("super_admin_6c6_027160@polaris.test")}
                className="w-full text-left rounded-xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 p-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sky-700 font-mono font-bold">SUPER_ADMIN</strong>
                  <span className="text-slate-500 text-[10px] font-mono">Full Authority</span>
                </div>
                <span className="text-slate-600 text-[11px] font-mono block mt-1 group-hover:text-slate-900 transition-colors">
                  super_admin_6c6_027160@polaris.test
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDemo("cmd_admin_6c6_027160@polaris.test")}
                className="w-full text-left rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 p-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-700 font-mono font-bold">COMMAND_ADMIN</strong>
                  <span className="text-slate-500 text-[10px] font-mono">Station &amp; Exp Ops</span>
                </div>
                <span className="text-slate-600 text-[11px] font-mono block mt-1 group-hover:text-slate-900 transition-colors">
                  cmd_admin_6c6_027160@polaris.test
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDemo("viewer_6c6_027160@polaris.test")}
                className="w-full text-left rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 p-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-amber-800 font-mono font-bold">VIEWER</strong>
                  <span className="text-slate-500 text-[10px] font-mono">Read-Only Access</span>
                </div>
                <span className="text-slate-600 text-[11px] font-mono block mt-1 group-hover:text-slate-900 transition-colors">
                  viewer_6c6_027160@polaris.test
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-sky-700 transition-colors font-mono">
            ← Continue to Public Dashboard Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

