"use client";

import React, { useState } from "react";
import Link from "next/link";
import { OfflineStatusBadge } from "./offline-status-badge";
import { useAuth } from "@/infrastructure/auth/auth-provider";
import { DataProvenanceModal } from "./data-provenance-modal";

interface HeaderProps {
  currentPath?: string;
}

export function PolarisHeader({ currentPath = "/" }: HeaderProps) {
  const { user, role, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [originModalOpen, setOriginModalOpen] = useState(false);

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
        return "bg-sky-50 text-sky-800 border-sky-300";
      case "COMMAND_ADMIN":
        return "bg-emerald-50 text-emerald-800 border-emerald-300";
      case "EXPEDITION_MANAGER":
        return "bg-purple-50 text-purple-800 border-purple-300";
      case "STATION_OPERATOR":
        return "bg-amber-50 text-amber-800 border-amber-300";
      case "VIEWER":
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Institutional Mission Utility Bar */}
      <div className="border-b border-slate-150 bg-slate-50 text-[11px] font-mono text-slate-600">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              NCPOR POLAR NET
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="hidden sm:inline">UTC: 08:00</span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="hidden md:inline">Bharati: 13:00 (UTC+5)</span>
            <span className="text-slate-300 hidden md:inline">•</span>
            <span className="hidden md:inline">Maitri: 08:00 (UTC)</span>
            <span className="text-slate-300 hidden lg:inline">•</span>
            <span className="hidden lg:inline">Himadri: 09:00 (UTC+1)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setOriginModalOpen(true)}
              className="text-slate-600 hover:text-sky-800 flex items-center gap-1 font-mono text-[10px] bg-white border border-slate-200 hover:border-sky-300 rounded px-2 py-0.5 transition-all cursor-pointer shadow-2xs"
              title="View Observed vs Past vs Simulated Data Origin Guide"
            >
              <span>🔍</span>
              <span>Data Origin Guide</span>
            </button>
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Mission Systems Online
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 border border-sky-200 text-sky-700 font-black text-sm group-hover:bg-sky-100 transition-colors">
              ❄
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-wider text-slate-900">POLARIS</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-700 border border-slate-300 hidden sm:inline-block">
                  MISSION OPS
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono hidden md:block">
                National Centre for Polar and Ocean Research • MoES
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
                    ? "bg-sky-50 text-sky-800 border border-sky-200 shadow-xs font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                className="flex items-center gap-2 rounded-full border border-slate-250 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                title={`Logged in as ${user.email}`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-slate-800 truncate max-w-[90px] sm:max-w-[130px]">
                  {user.email.split("@")[0]}
                </span>
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border border-slate-250 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="font-semibold text-slate-800 text-xs">Login</span>
            </Link>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-sky-50 text-sky-800 border border-sky-200 font-bold"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Global Data Origin & Pipelines Modal */}
      <DataProvenanceModal
        isOpen={originModalOpen}
        onClose={() => setOriginModalOpen(false)}
      />
    </header>
  );
}

