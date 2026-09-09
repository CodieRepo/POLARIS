"use client";

import React from "react";

interface MapLegendProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function MapLegend({ isOpen, onClose }: MapLegendProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-12 left-3 w-80 bg-white/98 border border-slate-200 rounded-xl shadow-lg p-3.5 z-[1001] font-mono text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2.5">
        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
          <span>🏷️</span>
          <span>Cartographic Legend &amp; Symbology</span>
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
          aria-label="Close legend"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        {/* Research Stations */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">
            Operational Research Bases
          </span>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-700"></span>
              <span className="text-slate-700">Active Station</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600"></span>
              <span className="text-slate-700">Historical (DGT)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 border border-sky-700"></span>
              <span className="text-slate-700">Arctic Outpost</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-sky-500 bg-white"></span>
              <span className="text-slate-700">Selected Focus</span>
            </div>
          </div>
        </div>

        {/* Corridors & Hazards */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">
            Routes &amp; Cryospheric Hazards
          </span>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-sky-600"></span>
              <span className="text-slate-700">Maitri Shelf Corridor (TRV-MTR)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-teal-600"></span>
              <span className="text-slate-700">Bharati Amery Corridor (TRV-BHR)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border border-amber-600 bg-amber-50 flex items-center justify-center text-[8px] text-amber-700 font-bold">⛽</span>
              <span className="text-slate-700">Fuel Cache Depot</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-dashed border-rose-500 bg-rose-100/60"></span>
              <span className="text-slate-700">Critical Crevasse Field</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-dashed border-amber-500 bg-amber-100/60"></span>
              <span className="text-slate-700">Shear Zone / Whiteout Pass</span>
            </div>
          </div>
        </div>

        {/* Resupply Vessel */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">
            Logistics &amp; Maritime
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold">🚢 MV Vasily Golovnin</span>
            <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1 rounded font-bold">SIMULATED</span>
          </div>
        </div>

        {/* ISRO Oceansat Scatterometer Winds */}
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1.5">
            ISRO Satellite Winds (MOSDAC)
          </span>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
              <span className="text-slate-700">&lt; 8 m/s (Breeze)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
              <span className="text-slate-700">8–14 m/s (Moderate)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-slate-700">14–20 m/s (Gale)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <span className="text-slate-700">&gt; 20 m/s (Storm)</span>
            </div>
          </div>
        </div>

        {/* Mission Data Sources */}
        <div className="border-t border-slate-200 pt-2 text-[10px]">
          <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">
            Data Source Classification
          </span>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-sky-700 font-bold">● LIVE SATELLITE</span>
            <span className="text-emerald-700 font-bold">● OFFICIAL RECORD</span>
            <span className="text-purple-700 font-bold">● CALCULATED METRICS</span>
            <span className="text-amber-700 font-bold">● SIMULATED LOGISTICS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
