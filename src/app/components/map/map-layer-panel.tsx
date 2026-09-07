"use client";

import React from "react";
import type { LayerVisibilityState } from "./map-types";

interface MapLayerPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly visibility: LayerVisibilityState;
  readonly onToggleLayer: (layerKey: keyof LayerVisibilityState) => void;
}

export function MapLayerPanel({
  isOpen,
  onClose,
  visibility,
  onToggleLayer,
}: MapLayerPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-12 right-3 w-72 bg-white/98 border border-slate-200 rounded-xl shadow-lg p-3 z-[1001] font-mono text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
        <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
          <span>📑</span>
          <span>Tactical GIS Layers</span>
        </span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
          aria-label="Close layer panel"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        {/* 1. OBSERVED DATA */}
        <div>
          <div className="text-[9px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mb-1 inline-block">
            ● Observed / System of Record
          </div>
          <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
            <span className="text-slate-700 font-medium">Research Bases</span>
            <input
              type="checkbox"
              checked={visibility.stations}
              onChange={() => onToggleLayer("stations")}
              className="rounded accent-sky-600 cursor-pointer"
            />
          </label>
        </div>

        {/* 2. REAL EXTERNAL DATA */}
        <div>
          <div className="text-[9px] font-bold uppercase text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 mb-1 inline-block">
            ● Real External / Satellite
          </div>
          <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
            <div>
              <span className="text-slate-700 font-medium block">NASA GIBS Sea Ice</span>
              <span className="text-[9px] text-slate-400">AMSR2 12km Daily WMS</span>
            </div>
            <input
              type="checkbox"
              checked={visibility.seaIce}
              onChange={() => onToggleLayer("seaIce")}
              className="rounded accent-sky-600 cursor-pointer"
            />
          </label>
        </div>

        {/* 3. OPERATIONAL GIS */}
        <div>
          <div className="text-[9px] font-bold uppercase text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mb-1 inline-block">
            ● Operational Surveyed
          </div>
          <div className="space-y-0.5">
            <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
              <span className="text-slate-700 font-medium">Traverse Corridors &amp; Depots</span>
              <input
                type="checkbox"
                checked={visibility.traverseRoutes}
                onChange={() => onToggleLayer("traverseRoutes")}
                className="rounded accent-sky-600 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
              <span className="text-slate-700 font-medium">Antarctic Coastline</span>
              <input
                type="checkbox"
                checked={visibility.coastline}
                onChange={() => onToggleLayer("coastline")}
                className="rounded accent-sky-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 4. DERIVED SPATIAL */}
        <div>
          <div className="text-[9px] font-bold uppercase text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 mb-1 inline-block">
            ● Mathematically Derived
          </div>
          <div className="space-y-0.5">
            <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
              <span className="text-slate-700 font-medium">Crevasse Hazard Zones</span>
              <input
                type="checkbox"
                checked={visibility.hazards}
                onChange={() => onToggleLayer("hazards")}
                className="rounded accent-sky-600 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
              <span className="text-slate-700 font-medium">Geodesic Baseline Vector</span>
              <input
                type="checkbox"
                checked={visibility.geodesicVector}
                onChange={() => onToggleLayer("geodesicVector")}
                className="rounded accent-sky-600 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* 5. SIMULATED SCENARIO */}
        <div>
          <div className="text-[9px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mb-1 inline-block">
            ● Simulated Scenario
          </div>
          <label className="flex items-center justify-between p-1 rounded hover:bg-slate-50 cursor-pointer">
            <div>
              <span className="text-slate-700 font-medium block">Resupply Vessel &amp; Route</span>
              <span className="text-[9px] text-amber-600 font-sans">MV Vasily Golovnin (Seeded)</span>
            </div>
            <input
              type="checkbox"
              checked={visibility.maritimeVoyage}
              onChange={() => onToggleLayer("maritimeVoyage")}
              className="rounded accent-sky-600 cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
