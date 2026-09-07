"use client";

import React from "react";
import type { MapSector } from "./map-types";

interface MapControlsProps {
  readonly activeSector: MapSector;
  readonly onSectorChange: (sector: MapSector) => void;
  readonly onResetView: () => void;
  readonly onFitStations: () => void;
  readonly isLayerPanelOpen: boolean;
  readonly onToggleLayerPanel: () => void;
  readonly isLegendOpen: boolean;
  readonly onToggleLegend: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
}

export function MapControls({
  activeSector,
  onSectorChange,
  onResetView,
  onFitStations,
  isLayerPanelOpen,
  onToggleLayerPanel,
  isLegendOpen,
  onToggleLegend,
  onZoomIn,
  onZoomOut,
}: MapControlsProps) {
  return (
    <>
      {/* Sector Switcher (Top-Center) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 border border-slate-200 p-1 rounded-lg shadow-xs z-[1000] flex items-center gap-1 font-mono text-[11px] backdrop-blur-xs">
        <button
          onClick={() => onSectorChange("ANTARCTICA")}
          className={`px-3 py-1 rounded transition-colors cursor-pointer font-bold ${
            activeSector === "ANTARCTICA"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
          title="Focus Antarctic Operations (Bharati & Maitri)"
        >
          Antarctic Hub
        </button>
        <button
          onClick={() => onSectorChange("ARCTIC")}
          className={`px-3 py-1 rounded transition-colors cursor-pointer font-bold ${
            activeSector === "ARCTIC"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
          title="Focus Arctic Outpost (Himadri, Ny-Ålesund)"
        >
          Arctic Outpost (HMD)
        </button>
        <button
          onClick={() => onSectorChange("MARITIME")}
          className={`px-3 py-1 rounded transition-colors cursor-pointer font-bold ${
            activeSector === "MARITIME"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
          title="View Southern Ocean Maritime Resupply Corridor"
        >
          Maritime Resupply
        </button>
      </div>

      {/* Top-Right GIS Action Buttons (Layers & Legend Toggles) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-[1000]">
        <button
          onClick={onToggleLayerPanel}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer shadow-xs backdrop-blur-xs ${
            isLayerPanelOpen
              ? "bg-sky-50 text-sky-800 border-sky-300 ring-1 ring-sky-300"
              : "bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
          title="Manage Operational GIS Layers"
        >
          <span>📑</span>
          <span>Layers</span>
        </button>

        <button
          onClick={onToggleLegend}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer shadow-xs backdrop-blur-xs ${
            isLegendOpen
              ? "bg-sky-50 text-sky-800 border-sky-300 ring-1 ring-sky-300"
              : "bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
          title="Toggle Symbology & Provenance Legend"
        >
          <span>🏷️</span>
          <span>Legend</span>
        </button>
      </div>

      {/* Left Vertical Navigation Controls (Zoom & Extents) */}
      <div className="absolute top-14 left-3 flex flex-col gap-1 z-[1000] font-mono">
        <div className="flex flex-col bg-white/95 border border-slate-200 rounded-lg shadow-xs overflow-hidden backdrop-blur-xs">
          <button
            onClick={onZoomIn}
            className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold text-base cursor-pointer border-b border-slate-100"
            title="Zoom In"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={onZoomOut}
            className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold text-base cursor-pointer"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        <div className="flex flex-col bg-white/95 border border-slate-200 rounded-lg shadow-xs overflow-hidden backdrop-blur-xs">
          <button
            onClick={onFitStations}
            className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-sky-700 text-xs cursor-pointer border-b border-slate-100"
            title="Fit Stations Extent"
            aria-label="Fit stations extent"
          >
            🎯
          </button>
          <button
            onClick={onResetView}
            className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-sky-700 text-xs cursor-pointer"
            title="Reset to South Pole Extent"
            aria-label="Reset to South Pole extent"
          >
            🧭
          </button>
        </div>
      </div>
    </>
  );
}
