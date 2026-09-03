export interface RawOpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    surface_pressure: number;
  };
}

/**
 * Open-Meteo High-Resolution Polar Model Adapter
 * Fallback and supplementary forecast layer (DWD ICON / NOAA GFS)
 */
import { fetchWithTimeout } from "./http-client";

export class OpenMeteoAdapter {
  private static readonly BASE_URL = "https://api.open-meteo.com/v1/forecast";

  public static async fetchModelData(
    lat: number,
    lon: number,
    timeoutMs: number = 3000
  ): Promise<RawOpenMeteoResponse["current"] | null> {
    try {
      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,surface_pressure",
        timezone: "auto",
      });

      const res = await fetchWithTimeout(`${this.BASE_URL}?${params.toString()}`, timeoutMs);
      if (!res.ok || !res.data) return null;

      const json: RawOpenMeteoResponse = JSON.parse(res.data);
      return json.current || null;
    } catch {
      return null;
    }
  }
}
