"use client";

import React, { useState } from "react";
import type { StationTelemetryTrend } from "@/core/telemetry/time-series-service";
import type { RealHistoricalTrendResult } from "@/core/weather/weather-history-service";

type TrendData = RealHistoricalTrendResult | StationTelemetryTrend;

interface WeatherTrendChartProps {
  readonly trends: Record<string, TrendData>;
}

export function WeatherTrendChart({ trends }: WeatherTrendChartProps) {
  const [stationCode, setStationCode] = useState<string>("BHR");
  const [metric, setMetric] = useState<"pressure" | "temp" | "wind">("pressure");

  const trend = trends[stationCode] || trends["BHR"];

  // Check if we have sufficient authentic data
  const hasSufficientData = "hasSufficientData" in trend ? trend.hasSufficientData : trend.points.length >= 2;
  const points = trend?.points || [];

  // Compute SVG dimensions and scale
  const width = 640;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  let values: number[] = [];
  let unit = "";
  let lineColor = "#38bdf8";

  if (points.length > 0) {
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
  }

  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 1;
  const valRange = maxValue - minValue || 1;

  // Build SVG path
  const pathD = points.length > 1
    ? points
        .map((p, i) => {
          const val = metric === "pressure" ? p.pressureHpa : metric === "temp" ? p.temperatureC : p.windSpeedKmH;
          const x = padding.left + (i / (points.length - 1)) * graphWidth;
          const y = padding.top + graphHeight - ((val - minValue) / valRange) * graphHeight;
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ")
    : "";

  const pressureDelta6h = trend?.pressureDelta6h;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
              24-Hour Synoptic Telemetry Trend
            </span>
            {pressureDelta6h !== null && pressureDelta6h !== undefined ? (
              pressureDelta6h <= -3.0 ? (
                <span className="rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 px-2 py-0.5 text-[10px] font-mono font-bold animate-pulse">
                  ⚠️ RAPID CYCLONIC DROP ({pressureDelta6h} hPa/6h)
                </span>
              ) : (
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                  ✓ BAROMETRICALLY STABLE ({pressureDelta6h > 0 ? `+${pressureDelta6h}` : pressureDelta6h} hPa/6h)
                </span>
              )
            ) : (
              <span className="rounded bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 text-[10px] font-mono">
                6h DELTA: BASELINE
              </span>
            )}
          </div>
          <h2 className="text-lg font-black text-white mt-1">
            Polar Atmospheric Observations &amp; Pressure Slope
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            {hasSufficientData
              ? `Source: public.weather_telemetry_history (${points.length} authentic AWS points logged)`
              : "Zero fabrication policy: trend renders only with genuine persisted observations"}
          </span>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Station Selector */}
          <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-1 text-xs font-mono">
            {["BHR", "MTR", "HMD"].map((code) => (
              <button
                key={code}
                onClick={() => setStationCode(code)}
                className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
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
              className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                metric === "pressure"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Pressure
            </button>
            <button
              onClick={() => setMetric("temp")}
              className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                metric === "temp"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Temp
            </button>
            <button
              onClick={() => setMetric("wind")}
              className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
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

      {/* Graph Area or Honest Empty State */}
      {!hasSufficientData || points.length < 2 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center space-y-3">
          <span className="inline-block rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 text-xs font-mono font-bold">
            INSUFFICIENT HISTORICAL DATA (Logging in progress)
          </span>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            POLARIS strictly prohibits synthesizing artificial weather curves. Real in-situ meteorological observations from NCPOR AWS are actively logged to PostgreSQL (`weather_telemetry_history`). A minimum of 2 historical observations are required to render an authentic trend.
          </p>
          <div className="flex justify-center items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-900">
            <span>Persisted Points: <strong className="text-cyan-400">{points.length}</strong></span>
            <span>•</span>
            <span>Station: <strong className="text-white">{stationCode}</strong></span>
            <span>•</span>
            <span>Latest Observation: <strong className="text-emerald-400">{trend.currentPressureHpa} hPa</strong></span>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[500px]"
          >
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = padding.top + graphHeight * pct;
              const val = maxValue - pct * valRange;
              return (
                <g key={pct}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(51, 65, 85, 0.4)"
                    strokeDasharray="4,4"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {val.toFixed(metric === "pressure" ? 0 : 1)}
                  </text>
                </g>
              );
            })}

            {/* Time Ticks */}
            {points.map((p, i) => {
              if (i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return null;
              const x = padding.left + (i / (points.length - 1)) * graphWidth;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 8}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {p.hourLabel}
                </text>
              );
            })}

            {/* Area Fill */}
            <path
              d={`${pathD} L ${padding.left + graphWidth} ${padding.top + graphHeight} L ${padding.left} ${padding.top + graphHeight} Z`}
              fill={metric === "pressure" ? "rgba(56, 189, 248, 0.08)" : metric === "temp" ? "rgba(248, 113, 113, 0.08)" : "rgba(251, 191, 36, 0.08)"}
            />

            {/* Data Line */}
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
                cx={padding.left + graphWidth}
                cy={
                  padding.top +
                  graphHeight -
                  (((metric === "pressure"
                    ? points[points.length - 1].pressureHpa
                    : metric === "temp"
                    ? points[points.length - 1].temperatureC
                    : points[points.length - 1].windSpeedKmH) -
                    minValue) /
                    valRange) *
                    graphHeight
                }
                r="4"
                fill={lineColor}
                stroke="#020617"
                strokeWidth="2"
              />
            )}
          </svg>

          {/* Metric Footer */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-4 pt-3 border-t border-slate-800/80">
            <div>
              <span>Range: </span>
              <strong className="text-white font-bold">
                {minValue.toFixed(1)} {unit} — {maxValue.toFixed(1)} {unit}
              </strong>
            </div>
            <div className="flex items-center gap-4">
              {trend.minTemp24h !== null && (
                <span>Min Temp: <strong className="text-cyan-400">{trend.minTemp24h}°C</strong></span>
              )}
              {trend.maxTemp24h !== null && (
                <span>Max Temp: <strong className="text-rose-400">{trend.maxTemp24h}°C</strong></span>
              )}
              {trend.peakWind24h !== null && (
                <span>Peak Wind: <strong className="text-amber-400">{trend.peakWind24h} km/h</strong></span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
