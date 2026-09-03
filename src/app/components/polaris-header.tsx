import React from "react";
import Link from "next/link";

interface HeaderProps {
  currentPath?: string;
}

export function PolarisHeader({ currentPath = "/" }: HeaderProps) {
  const navItems = [
    { label: "Dashboard", href: "/" },
    { label: "Asset Inventory", href: "/assets" },
    { label: "Expeditions", href: "/expeditions" },
    { label: "Research Stations", href: "/stations" },
    { label: "Data Provenance", href: "/provenance" },
  ];

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

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-200">SUPER_ADMIN</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400">NCPOR Polar Net</span>
          </div>
        </div>
      </div>
    </header>
  );
}
