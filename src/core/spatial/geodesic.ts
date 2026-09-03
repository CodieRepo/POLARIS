/**
 * Deterministic Geodesic Spatial Calculations (Spherical Law of Cosines / Haversine / Great-Circle Bearing)
 * Pure mathematical functions for calculating distances and bearings between polar coordinates.
 * Zero external API dependencies, 0ms latency.
 */

export interface GeodeticCoordinate {
  lat: number;
  lon: number;
}

export interface GeodesicDistanceResult {
  distanceKm: number;
  initialBearingDeg: number;
  compassDirection: string;
  derivationMethod: string;
  provenance: "DERIVED_SPATIAL";
}

/**
 * Calculates Great-Circle Distance (in kilometers) using the Haversine formula.
 * Earth mean radius = 6371.0 km
 */
export function calculateHaversineDistance(
  coord1: GeodeticCoordinate,
  coord2: GeodeticCoordinate
): number {
  const R = 6371.0; // Earth mean radius in km
  const lat1Rad = (coord1.lat * Math.PI) / 180;
  const lat2Rad = (coord2.lat * Math.PI) / 180;
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lon - coord1.lon) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Calculates the Initial Great-Circle Bearing (in degrees 0-360) from coord1 to coord2.
 */
export function calculateInitialBearing(
  coord1: GeodeticCoordinate,
  coord2: GeodeticCoordinate
): number {
  const lat1Rad = (coord1.lat * Math.PI) / 180;
  const lat2Rad = (coord2.lat * Math.PI) / 180;
  const dLon = ((coord2.lon - coord1.lon) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const initialBearingRad = Math.atan2(y, x);
  const initialBearingDeg = (initialBearingRad * 180) / Math.PI;

  return Math.round((initialBearingDeg + 360) % 360);
}

/**
 * Converts degrees azimuth to 16-point compass card direction.
 */
export function degreesToCompass(deg: number): string {
  const sectors = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
  ];
  const idx = Math.round(deg / 22.5) % 16;
  return sectors[idx];
}

/**
 * Full spatial derivation helper between two geodetic coordinates.
 */
export function deriveSpatialMetrics(
  coord1: GeodeticCoordinate,
  coord2: GeodeticCoordinate
): GeodesicDistanceResult {
  const distanceKm = calculateHaversineDistance(coord1, coord2);
  const initialBearingDeg = calculateInitialBearing(coord1, coord2);
  const compassDirection = degreesToCompass(initialBearingDeg);

  return {
    distanceKm,
    initialBearingDeg,
    compassDirection,
    derivationMethod: "Great-Circle Haversine Formula & Forward Azimuth Equation",
    provenance: "DERIVED_SPATIAL",
  };
}
