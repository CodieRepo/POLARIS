import React from "react";
import type { StationWeather } from "@/core/weather/types";
import { ProvenanceBadge, SourceHealthIndicator } from "./provenance-badge";

interface WeatherTelemetryPanelProps {
  weather: Record<string, StationWeather> | null;
}

export function WeatherTelemetryPanel({ weather }: WeatherTelemetryPanelProps) {
  if (!weather || Object.keys(weather).length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>❄</span> Polar Meteorological Telemetry Feeds
          </h2>
          <SourceHealthIndicator health="DATA_UNAVAILABLE" />
        </div>
        <p className="text-xs text-slate-400">
          Live polar weather feeds are temporarily unreachable. Operational systems running in conservative fail-safe posture.
        </p>
      </div>
    );
  }

  const stations = Object.values(weather);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>❄</span> Polar Meteorological Telemetry &amp; Provenance Feeds
          </h2>
          <p className="text-xs text-slate-400">
            Field-level transparency distinguishing Authoritative In-Situ Observations from High-Resolution Numerical Models.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400">
            Coverage: Bharati, Maitri, Himadri
          </span>
          <span className="text-[11px] text-slate-600">•</span>
          <span className="text-[11px] text-slate-500 italic">
            DGT Historical Reference
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {stations.map((st) => {
          const temp = st.measurements?.temperatureC;
          const hum = st.measurements?.relativeHumidityPercent;
          const press = st.measurements?.pressureHpa;
          const wind = st.measurements?.windSpeedKmH;
          const chill = st.derivedCalculations?.apparentTemperatureC;
          const elev = st.derivedCalculations?.currentSolarElevationDeg;
          const regime = st.derivedCalculations?.solarRegime;
          const vis = st.derivedCalculations?.operationalVisibilityHeuristic;

          return (
            <div
              key={st.stationCode}
              className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 flex flex-col justify-between shadow-md"
            >
              <div>
                {/* Header: Station Name & Overall Provenance */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="font-mono text-cyan-400 font-bold text-base mr-1.5">
                      {st.stationCode}
                    </span>
                    <span className="text-slate-200 font-bold text-base">
                      {st.stationName}
                    </span>
                    <div className="text-[11px] text-slate-400">
                      {st.latitude > 0 ? `${st.latitude}° N (Arctic)` : `${Math.abs(st.latitude)}° S (Antarctica)`}
                    </div>
                  </div>
                  <SourceHealthIndicator health={st.stationOverallStatus?.sourceHealth || "ONLINE"} />
                </div>

                {/* Primary Attribution Note */}
                <div className="mb-3 rounded bg-slate-900/90 border border-slate-800/90 px-2.5 py-1.5 text-[11px]">
                  <div className="text-slate-400 flex items-center justify-between">
                    <span className="font-semibold text-slate-300">
                      {st.stationOverallStatus?.primarySource}
                    </span>
                    <ProvenanceBadge tier={st.stationOverallStatus?.classification} size="xs" />
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">
                    {st.stationOverallStatus?.attribution}
                  </div>
                </div>

                {/* Freshness & Timestamps */}
                <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-900/50 p-2.5 rounded border border-slate-800/60 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Latest Published Obs
                    </span>
                    <span className="font-mono text-slate-300">
                      {st.timestamps?.observedAt || st.observationTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">
                      Retrieved (UTC)
                    </span>
                    <span className="font-mono text-slate-300">
                      {st.timestamps?.fetchedAt ? new Date(st.timestamps.fetchedAt).toLocaleTimeString() : "Recent"}
                    </span>
                  </div>
                </div>

                {/* Field-by-Field Measured Telemetry Grid */}
                <div className="space-y-2 mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Field-Level Measurement Provenance
                  </span>

                  {/* Temperature */}
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Surface Temp</span>
                      <span className="font-mono font-bold text-white text-sm">
                        {temp?.value !== undefined ? `${temp.value}°C` : `${st.temperatureC}°C`}
                      </span>
                    </div>
                    <div className="text-right">
                      <ProvenanceBadge type={temp?.measurementType || "OBSERVED"} />
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                        {temp?.sourceName || "NCPOR AWS"}
                      </div>
                    </div>
                  </div>

                  {/* Pressure */}
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Barometric Pressure</span>
                      <span className="font-mono font-bold text-slate-200">
                        {press?.value !== undefined ? `${press.value} hPa` : `${st.pressureHpa} hPa`}
                      </span>
                    </div>
                    <div className="text-right">
                      <ProvenanceBadge type={press?.measurementType || "OBSERVED"} />
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                        {press?.sourceName || "NCPOR AWS"}
                      </div>
                    </div>
                  </div>

                  {/* Wind Velocity */}
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Wind Velocity</span>
                      <span className="font-mono font-bold text-slate-200">
                        {wind?.value !== undefined ? `${wind.value} km/h` : `${st.windSpeedKmH} km/h`}
                      </span>
                    </div>
                    <div className="text-right">
                      <ProvenanceBadge type={wind?.measurementType || "OBSERVED"} />
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                        {wind?.sourceName || "NCPOR AWS"}
                      </div>
                    </div>
                  </div>

                  {/* Relative Humidity */}
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Relative Humidity</span>
                      <span className="font-mono font-bold text-slate-200">
                        {hum?.value !== undefined ? `${hum.value}%` : `${st.relativeHumidityPercent}%`}
                      </span>
                    </div>
                    <div className="text-right">
                      <ProvenanceBadge type={hum?.measurementType || "OBSERVED"} />
                    </div>
                  </div>
                </div>

                {/* Derived Heuristic Intelligence Section */}
                <div className="border-t border-slate-800/80 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-2">
                    Deterministic Derived Intelligence
                  </span>

                  <div className="space-y-1.5 text-xs bg-indigo-950/20 p-2.5 rounded border border-indigo-900/40">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Wind Chill Apparent:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {chill?.value !== undefined ? `${chill.value}°C` : `${st.apparentTemperatureC}°C`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 italic">
                      Method: {chill?.derivationMethod || "Siple-Passel Antarctic Chill Formula"}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-indigo-900/30">
                      <span className="text-slate-400">Solar Elevation:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {elev?.value !== undefined ? `${elev.value}°` : "N/A"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">24h Solar Regime:</span>
                      <span className="font-mono font-semibold text-amber-300">
                        {regime?.value || "CIVIL_TWILIGHT"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Operational Visibility:</span>
                      <span className="font-mono font-semibold text-emerald-300">
                        {vis?.value || "NORMAL_DAYLIGHT"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Station Operational Risk Tier */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Cold Hazard:</span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    st.operationalRisk?.coldExposureRiskTier === "EXTREME"
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                      : st.operationalRisk?.coldExposureRiskTier === "HIGH"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  }`}
                >
                  {st.operationalRisk?.coldExposureRiskTier || "LOW"} RISK
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
