"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
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
        router.push("/");
        router.refresh();
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
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black text-2xl mb-4">
          ❄
        </div>
        <h1 className="text-3xl font-black tracking-wider text-white">POLARIS</h1>
        <p className="mt-2 text-sm text-slate-400">
          Polar Logistics, Operations, Resource &amp; Asset Intelligence System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/60 border border-slate-800 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleLogin}>
            {errorMsg && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300">
                ⚠️ {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Operational Identity / Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Passphrase
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Authenticating Session..." : "Sign In to Polar Net"}
            </button>
          </form>

          {/* Quick Demo Preset Selection */}
          <div className="mt-6 pt-6 border-t border-slate-800/80">
            <span className="block text-xs font-semibold text-slate-400 mb-2 text-center uppercase tracking-wider">
              SIH Presentation Quick Logins
            </span>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setRoleDemo("super_admin_6c6_027160@polaris.test")}
                className="w-full text-left rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 p-2.5 text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-cyan-400">SUPER_ADMIN</strong>
                  <span className="text-slate-500 text-[10px]">Full Authority</span>
                </div>
                <span className="text-slate-400 text-[11px] block mt-0.5">super_admin_6c6_027160@polaris.test</span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDemo("cmd_admin_6c6_027160@polaris.test")}
                className="w-full text-left rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 p-2.5 text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-400">COMMAND_ADMIN</strong>
                  <span className="text-slate-500 text-[10px]">Station/Exp Operations</span>
                </div>
                <span className="text-slate-400 text-[11px] block mt-0.5">cmd_admin_6c6_027160@polaris.test</span>
              </button>

              <button
                type="button"
                onClick={() => setRoleDemo("viewer_6c6_027160@polaris.test")}
                className="w-full text-left rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 p-2.5 text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-amber-400">VIEWER</strong>
                  <span className="text-slate-500 text-[10px]">Read-Only (Forbidden to Mutate)</span>
                </div>
                <span className="text-slate-400 text-[11px] block mt-0.5">viewer_6c6_027160@polaris.test</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-cyan-400">
            ← Continue to Public Dashboard Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
