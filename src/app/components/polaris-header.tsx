"use client";

import React from "react";
import Link from "next/link";
import { OfflineStatusBadge } from "./offline-status-badge";
import { useAuth } from "@/infrastructure/auth/auth-provider";

interface HeaderProps {
  currentPath?: string;
}

export function PolarisHeader({ currentPath = "/" }: HeaderProps) {
  const { user, role, isAuthenticated } = useAuth();

  const navItems = [
    { label: "Dashboard", href: "/" },
    { label: "Daily SITREP", href: "/sitrep" },
    { label: "Logistics & Cargo", href: "/logistics" },
    { label: "Asset Inventory", href: "/assets" },
    { label: "Expeditions", href: "/expeditions" },
    { label: "Research Stations", href: "/stations" },
    { label: "Data Provenance", href: "/provenance" },
  ];

  const getRoleBadgeColor = (r: string | null) => {
    switch (r) {
      case "SUPER_ADMIN":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "COMMAND_ADMIN":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "EXPEDITION_MANAGER":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "STATION_OPERATOR":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "VIEWER":
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black text-lg">
              ❄
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-white">POLARIS</span>
              <span className="ml-2 hidden text-xs font-medium text-cyan-400 sm:inline-block px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60">
                v1.0 • SIH 2026
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <OfflineStatusBadge />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getRoleBadgeColor(
                  role
                )}`}
              >
                {role}
              </span>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500/40 transition-colors"
                title={`Logged in as ${user.email}`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-[160px]">
                  {user.email.split("@")[0]}
                </span>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:border-cyan-500/40 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-semibold text-slate-200">Switch Identity / Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
