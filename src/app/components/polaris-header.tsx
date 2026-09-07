"use client";

import React, { useState } from "react";
import Link from "next/link";
import { OfflineStatusBadge } from "./offline-status-badge";
import { useAuth } from "@/infrastructure/auth/auth-provider";

interface HeaderProps {
  currentPath?: string;
}

export function PolarisHeader({ currentPath = "/" }: HeaderProps) {
  const { user, role, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Command Center", href: "/" },
    { label: "Expeditions", href: "/expeditions" },
    { label: "Research Stations", href: "/stations" },
    { label: "Logistics & Cargo", href: "/logistics" },
    { label: "Asset Inventory", href: "/assets" },
    { label: "Daily SITREP", href: "/sitrep" },
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
    <header className="sticky top-0 z-50 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black text-sm group-hover:bg-cyan-500/20 transition-colors">
              ❄
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-wider text-white">POLARIS</span>
                <span className="rounded bg-cyan-950/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-cyan-400 border border-cyan-800/60 hidden sm:inline-block">
                  MISSION CONTROL
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden md:block">
                NCPOR / Indian Polar Operations
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-xs"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Status Badges & Identity */}
        <div className="flex items-center gap-2.5">
          <OfflineStatusBadge />

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <span
                className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${getRoleBadgeColor(
                  role
                )}`}
              >
                {role}
              </span>
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/40 transition-colors"
                title={`Logged in as ${user.email}`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-slate-200 truncate max-w-[90px] sm:max-w-[130px]">
                  {user.email.split("@")[0]}
                </span>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/40 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="font-semibold text-slate-200 text-xs">Login</span>
            </Link>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

