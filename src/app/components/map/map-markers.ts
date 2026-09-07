import L from "leaflet";
import type { PolarMapStation } from "./map-types";
import type { TraverseWaypoint, HazardZone } from "@/core/spatial/traverse-routes";
import type { StationWeather } from "@/core/weather/types";

/**
 * Custom POLARIS Marker System for Leaflet.js
 * Produces crisp, scientific, accessible SVG/HTML DivIcons matching the POLARIS light UI.
 */

export function createStationIcon(
  station: PolarMapStation,
  isSelected: boolean,
  weather?: StationWeather | null
): L.DivIcon {
  const isHistorical = station.status === "HISTORICAL" || station.code === "DGT";
  const isArctic = station.latitude > 0;
  
  // Status color semantics
  const dotColor = isHistorical ? "#d97706" : isArctic ? "#0284c7" : "#059669";
  const borderColor = isSelected ? "#0284c7" : isHistorical ? "#f59e0b" : "#cbd5e1";
  const ringStyle = isSelected
    ? "box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.25), 0 2px 8px rgba(0,0,0,0.15); border-color: #0284c7;"
    : "box-shadow: 0 1px 4px rgba(0,0,0,0.1);";

  const tempDisplay = weather?.measurements?.temperatureC?.value != null
    ? `<span style="font-size: 9px; color: #64748b; margin-left: 2px; font-weight: normal;">${weather.measurements.temperatureC.value > 0 ? "+" : ""}${weather.measurements.temperatureC.value}°C</span>`
    : "";

  return L.divIcon({
    className: "polaris-station-marker",
    html: `
      <div style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #ffffff;
        border: 1.5px solid ${borderColor};
        padding: 2px 7px;
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        transform: translate(-50%, -100%);
        cursor: pointer;
        transition: all 0.15s ease-out;
        ${ringStyle}
      ">
        <span style="
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${dotColor};
          display: inline-block;
          flex-shrink: 0;
        "></span>
        <span style="color: #0f172a; letter-spacing: -0.01em;">${station.code}</span>
        ${isHistorical ? '<span style="font-size: 8px; color: #b45309; background: #fef3c7; padding: 0 3px; border-radius: 3px;">HIST</span>' : ""}
        ${tempDisplay}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function createWaypointIcon(waypoint: TraverseWaypoint): L.DivIcon {
  const isFuel = waypoint.isFuelCache;
  const color = isFuel ? "#d97706" : "#0284c7";
  const bg = isFuel ? "#fffbeb" : "#f0f9ff";

  return L.divIcon({
    className: "polaris-waypoint-marker",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        background: ${bg};
        border: 1.5px solid ${color};
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      " title="${waypoint.name} (${waypoint.code})">
        <span style="width: 4px; height: 4px; background: ${color}; border-radius: 50%;"></span>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function createVesselIcon(vesselName: string, isSelected = false): L.DivIcon {
  const borderColor = isSelected ? "#0284c7" : "#0369a1";
  return L.divIcon({
    className: "polaris-vessel-marker",
    html: `
      <div style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #0f172a;
        color: #f8fafc;
        border: 1.5px solid ${borderColor};
        padding: 3px 8px;
        border-radius: 6px;
        font-family: ui-monospace, monospace;
        font-size: 10px;
        font-weight: 700;
        white-space: nowrap;
        transform: translate(-50%, -100%);
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      ">
        <span style="font-size: 11px;">🚢</span>
        <span>${vesselName.split(" (")[0]}</span>
        <span style="
          background: #d97706;
          color: #ffffff;
          font-size: 8px;
          padding: 1px 3px;
          border-radius: 3px;
          font-weight: 800;
          letter-spacing: 0.05em;
        ">SIMULATED</span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export function createHazardPopupHtml(hazard: HazardZone): string {
  const isCritical = hazard.severity === "CRITICAL";
  const badgeBg = isCritical ? "#fee2e2" : "#fef3c7";
  const badgeColor = isCritical ? "#991b1b" : "#92400e";
  const borderColor = isCritical ? "#f87171" : "#fcd34d";

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 220px; color: #0f172a; font-size: 12px; line-height: 1.4;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
        <span style="font-weight: 800; font-size: 13px;">⚠️ ${hazard.name}</span>
        <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${borderColor}; font-size: 9px; font-weight: 800; font-family: monospace; padding: 1px 5px; border-radius: 4px;">
          ${hazard.severity}
        </span>
      </div>
      <div style="color: #475569; font-size: 11px; margin-bottom: 6px;">
        ${hazard.description}
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; font-size: 10px; font-family: monospace; color: #64748b;">
        <div>Hazard Type: <strong>${hazard.hazardType}</strong></div>
        <div>Danger Radius: <strong>${hazard.radiusKm} km</strong></div>
        <div>Provenance: <strong>SCAR / NCPOR SURVEY</strong></div>
      </div>
    </div>
  `;
}

export function createStationPopupHtml(station: PolarMapStation, weather?: StationWeather | null): string {
  const isHistorical = station.status === "HISTORICAL" || station.code === "DGT";
  const statusColor = isHistorical ? "#d97706" : "#059669";
  const statusBg = isHistorical ? "#fef3c7" : "#ecfdf5";
  const statusBorder = isHistorical ? "#fcd34d" : "#a7f3d0";

  let weatherSection = `
    <div style="margin-top: 6px; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; color: #64748b; font-style: italic;">
      In-situ weather telemetry offline
    </div>
  `;

  if (weather) {
    weatherSection = `
      <div style="margin-top: 8px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-family: ui-monospace, monospace; font-size: 10px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;">
          <span style="font-weight: 700; color: #0284c7;">IN-SITU AWS MET</span>
          <span style="color: #059669; font-weight: 700;">REAL / OBSERVED</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; text-align: center;">
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
            <span style="color: #64748b; font-size: 8px; display: block;">TEMP</span>
            <strong style="color: #0f172a;">${weather.measurements.temperatureC?.value ?? "--"}°C</strong>
          </div>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
            <span style="color: #64748b; font-size: 8px; display: block;">WIND</span>
            <strong style="color: #d97706;">${weather.measurements.windSpeedKmH?.value ?? "--"} kt</strong>
          </div>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
            <span style="color: #64748b; font-size: 8px; display: block;">CHILL</span>
            <strong style="color: #0284c7;">${weather.derivedCalculations?.apparentTemperatureC?.value ?? "--"}°C</strong>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 240px; color: #0f172a; font-size: 12px; line-height: 1.4;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${station.name}</div>
          <div style="font-family: monospace; font-size: 10px; color: #64748b;">${station.region || "Polar Research Base"}</div>
        </div>
        <span style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; font-size: 9px; font-weight: 800; font-family: monospace; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
          ${station.status}
        </span>
      </div>
      <div style="font-family: monospace; font-size: 10px; color: #334155; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;">
        <div>Lat: <strong>${station.latitude.toFixed(2)}°</strong></div>
        <div>Lon: <strong>${station.longitude.toFixed(2)}°</strong></div>
        <div>Cap: <strong>${station.capacity ?? "Unspecified"} pers</strong></div>
        <div>Source: <strong>NCPOR SOR</strong></div>
      </div>
      ${weatherSection}
    </div>
  `;
}
