import L from "leaflet";

/**
 * NASA GIBS Antarctic Sea Ice WMS Layer Integration for Leaflet.js
 * Sourced from NASA Global Imagery Browse Services (GIBS) Earthdata.
 * Dataset: AMSR2 Sea Ice Concentration 12km (Daily) / OSISAF.
 * Provenance: REAL_EXTERNAL_DATA
 */
export interface SeaIceLayerConfig {
  readonly url: string;
  readonly layerName: string;
  readonly opacity: number;
  readonly time: string;
  readonly attribution: string;
  readonly provenance: "REAL_EXTERNAL_DATA";
}

export function getSeaIceWmsConfig(opacity = 0.65): SeaIceLayerConfig {
  // Format target UTC date for NASA GIBS (YYYY-MM-DD)
  // GIBS daily satellite composites are typically published with ~24h operational processing buffer
  const now = new Date();
  const targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const year = targetDate.getUTCFullYear();
  const month = (targetDate.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = targetDate.getUTCDate().toString().padStart(2, "0");
  const timeParam = `${year}-${month}-${day}`;

  return {
    url: "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi",
    layerName: "AMSR2_Sea_Ice_Concentration_12km",
    opacity,
    time: timeParam,
    attribution: "&copy; NASA EOSDIS GIBS / Earthdata (AMSR2 12km Sea Ice)",
    provenance: "REAL_EXTERNAL_DATA",
  };
}

export function createLeafletSeaIceLayer(opacity = 0.65): L.TileLayer.WMS {
  const config = getSeaIceWmsConfig(opacity);
  return L.tileLayer.wms(config.url, {
    layers: config.layerName,
    format: "image/png",
    transparent: true,
    opacity: config.opacity,
    attribution: config.attribution,
    // @ts-expect-error Leaflet WMS options accepts time param
    time: config.time,
    maxZoom: 9,
    minZoom: 1,
    zIndex: 3,
  });
}

