"use client";

import React, { useState } from "react";
import type { StationTelemetryTrend } from "@/core/telemetry/time-series-service";

interface WeatherTrendChartProps {
  readonly trends: Record<string, StationTelemetryTrend>;
}

export function WeatherTrendChart({ trends }: WeatherTrendChartProps) {
  const [stationCode, setStationCode] = useState<string>("BHR");
  const [metric, setMetric] = useState<"pressure" | "temp" | "wind">("pressure");

  const trend = trends[stationCode] || trends["BHR"];
  if (!trend || trend.points.length === 0) return null;

  const points = trend.points;

  // Compute SVG dimensions and scale
  const width = 640;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  let values: number[] = [];
  let unit = "";
  let lineColor = "#38bdf8";

  if (metric === "pressure") {
    values = points.map((p) => p.pressureHpa);
    unit = "hPa";
    lineColor = "#38bdf8"; // Cyan
  } else if (metric === "temp") {
    values = points.map((p) => p.temperatureC);
    unit = "°C";
    lineColor = "#f87171"; // Rose
  } else {
    values = points.map((p) => p.windSpeedKmH);
    unit = "km/h";
    lineColor = "#fbbf24"; // Amber
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valRange = maxValue - minValue || 1;

  // Build SVG path
  const pathD = points
    .map((p, i) => {
      const val = metric === "pressure" ? p.pressureHpa : metric === "temp" ? p.temperatureC : p.windSpeedKmH;
      const x = padding.left + (i / (points.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - ((val - minValue) / valRange) * graphHeight;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
              24-Hour Synoptic Telemetry Trend
            </span>
            {trend.pressureDelta6h <= -3.0 ? (
              <span className="rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 text-[10px] font-mono font-bold animate-pulse">
                ⚠️ RAPID CYCLONIC DROP ({trend.pressureDelta6h} hPa/6h)
              </span>
            ) : (
              <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                ✓ BAROMETRICALLY STABLE ({trend.pressureDelta6h > 0 ? `+${trend.pressureDelta6h}` : trend.pressureDelta6h} hPa/6h)
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-white mt-1">
            Polar Environmental Wave &amp; Storm Pressure Slope
          </h2>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Selector */}
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-1 text-xs font-mono">
            {["BHR", "MTR", "HMD"].map((code) => (
              <button
                key={code}
                onClick={() => setStationCode(code)}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  stationCode === code
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-1 text-xs font-mono">
            <button
              onClick={() => setMetric("pressure")}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                metric === "pressure"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Pressure
            </button>
            <button
              onClick={() => setMetric("temp")}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                metric === "temp"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Temp
            </button>
            <button
              onClick={() => setMetric("wind")}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                metric === "wind"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Wind
            </button>
          </div>
        </div>
      </div>

      {/* SVG Trend Graph */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 text-xs font-mono"
        >
          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#334155"
            strokeDasharray="4 4"
            strokeWidth="0.5"
          />
          <line
            x1={padding.left}
            y1={padding.top + graphHeight / 2}
            x2={width - padding.right}
            y2={padding.top + graphHeight / 2}
            stroke="#334155"
            strokeDasharray="4 4"
            strokeWidth="0.5"
          />
          <line
            x1={padding.left}
            y1={padding.top + graphHeight}
            x2={width - padding.right}
            y2={padding.top + graphHeight}
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Y-Axis Labels */}
          <text
            x={padding.left - 8}
            y={padding.top + 4}
            textAnchor="end"
            fill="#94a3b8"
            fontSize="10"
          >
            {maxValue.toFixed(1)} {unit}
          </text>
          <text
            x={padding.left - 8}
            y={padding.top + graphHeight / 2 + 4}
            textAnchor="end"
            fill="#64748b"
            fontSize="9"
          >
            {((maxValue + minValue) / 2).toFixed(1)}
          </text>
          <text
            x={padding.left - 8}
            y={padding.top + graphHeight + 4}
            textAnchor="end"
            fill="#94a3b8"
            fontSize="10"
          >
            {minValue.toFixed(1)} {unit}
          </text>

          {/* Sparkline Path */}
          <path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Latest Point Marker */}
          {points.length > 0 && (
            <circle
              cx={width - padding.right}
              cy={
                padding.top +
                graphHeight -
                ((values[values.length - 1] - minValue) / valRange) * graphHeight
              }
              r="4.5"
              fill={lineColor}
              stroke="#0f172a"
              strokeWidth="2"
            />
          )}

          {/* X-Axis Time Labels */}
          <text
            x={padding.left}
            y={height - 8}
            textAnchor="start"
            fill="#64748b"
            fontSize="10"
          >
            -24h UTC
          </text>
          <text
            x={padding.left + graphWidth / 2}
            y={height - 8}
            textAnchor="middle"
            fill="#64748b"
            fontSize="10"
          >
            -12h UTC
          </text>
          <text
            x={width - padding.right}
            y={height - 8}
            textAnchor="end"
            fill="#38bdf8"
            fontSize="10"
            fontWeight="bold"
          >
            NOW (LIVE OBS)
          </text>
        </svg>
      </div>

      {/* Footer 24h Summary */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
        <div>
          <span>24h Min Temp: <strong className="text-white font-mono">{trend.minTemp24h}°C</strong></span>
          <span className="mx-2">•</span>
          <span>Max Temp: <strong className="text-white font-mono">{trend.maxTemp24h}°C</strong></span>
          <span className="mx-2">•</span>
          <span>Peak Gust: <strong className="text-amber-400 font-mono">{trend.peakWind24h} km/h</strong></span>
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          Source: NCPOR AWS in-situ observations &amp; Spencer Fourier harmonic model
        </div>
      </div>
    </div>
  );
}
