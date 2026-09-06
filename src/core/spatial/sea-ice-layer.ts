import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";

/**
 * NASA GIBS Antarctic Polar Stereographic (EPSG:3031) Sea Ice WMS Layer
 * Sourced from NASA Global Imagery Browse Services (GIBS) Earthdata.
 * Dataset: AMSR2 Sea Ice Concentration 12km (Daily) or OSISAF Sea Ice Concentration.
 * Provenance: EXTERNAL_VERIFIED_DATA
 */
export function createSeaIceWmsLayer(opacity = 0.65): TileLayer<TileWMS> {
  // Format current UTC date for NASA GIBS (YYYY-MM-DD)
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = (today.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = today.getUTCDate().toString().padStart(2, "0");
  const timeParam = `${year}-${month}-${day}`;

  const wmsSource = new TileWMS({
    url: "https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi",
    params: {
      LAYERS: "AMSR2_Sea_Ice_Concentration_12km",
      FORMAT: "image/png",
      TRANSPARENT: true,
      TIME: timeParam,
      VERSION: "1.3.0",
    },
    crossOrigin: "anonymous",
    wrapX: false,
  });

  return new TileLayer({
    source: wmsSource,
    opacity,
    visible: true,
    properties: {
      name: "NASA_GIBS_SEA_ICE",
      provenance: "EXTERNAL_VERIFIED_DATA",
    },
  });
}
