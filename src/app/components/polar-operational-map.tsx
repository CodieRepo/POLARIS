"use client";

/**
 * POLARIS Operational Map Bridge
 * Re-exports the unified Leaflet.js operational GIS console.
 */
export { default } from "./map/polaris-operational-map";
export type {
  PolarMapStation,
  PolarMapExpedition,
  PolarOperationalMapProps,
  MapSector,
  LayerVisibilityState,
  SelectedMapEntity,
} from "./map/map-types";
