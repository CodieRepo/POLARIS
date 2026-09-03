// NCPOR Weather Types & Adapter
export interface RawNcporObservation {
  dateStr: string;
  temperatureC: number;
  relativeHumidityPercent: number;
  pressureHpa: number;
  windSpeedKnots: number;
}

/**
 * NCPOR Weather Ingestion Adapter
 * Consumes official Automatic Weather Station (AWS) observations from data.ncpor.res.in
 * Targets dedicated element IDs (divtemp, divrh, divap, divw).
 */
import { fetchWithTimeout } from "./http-client";

export class NcporWeatherAdapter {
  private static readonly NCPOR_BASE = "https://data.ncpor.res.in";

  /**
   * Fetches and parses live AWS observation for a given station.
   */
  public static async fetchObservation(
    stationCode: "BHR" | "MTR" | "HMD",
    timeoutMs: number = 3000
  ): Promise<RawNcporObservation | null> {
    const path = stationCode === "BHR" ? "/bharati/live" : stationCode === "MTR" ? "/maitri/live" : "/himadri/live";
    const url = `${this.NCPOR_BASE}${path}`;

    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok || !res.data) {
        return null;
      }

      return this.parseHtmlObservation(res.data, stationCode);
    } catch {
      return null;
    }
  }

  /**
   * Parses official table markup targeting id="divtemp", id="divrh", id="divap", id="divw"
   */
  public static parseHtmlObservation(
    html: string,
    stationCode: "BHR" | "MTR" | "HMD"
  ): RawNcporObservation | null {
    try {
      // 1. Date string (e.g. "02 Sep 2026")
      const dateMatch = html.match(/<td[^>]*font-size:\s*20px;[^>]*>\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})\s*<\/td>/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split("T")[0];

      // 2. Temperature (id="divtemp") -> e.g. " -17.71&deg; C"
      const tempMatch = html.match(/id\s*=\s*["']divtemp["'][^>]*>\s*(?:&nbsp;)?\s*([+-]?[0-9.]+)/i);
      if (!tempMatch) return null;
      const temperatureC = parseFloat(tempMatch[1]);

      // 3. Relative Humidity (id="divrh") -> e.g. " 79.25%"
      const rhMatch = html.match(/id\s*=\s*["']divrh["'][^>]*>\s*(?:&nbsp;)?\s*([0-9.]+)/i);
      const relativeHumidityPercent = rhMatch ? parseFloat(rhMatch[1]) : 70;

      // 4. Air Pressure (id="divap") -> e.g. " 995.60 mBar"
      const apMatch = html.match(/id\s*=\s*["']divap["'][^>]*>\s*(?:&nbsp;)?\s*([0-9.]+)/i);
      const pressureHpa = apMatch ? parseFloat(apMatch[1]) : 990;

      // 5. Wind Speed (id="divw") -> e.g. " 8.56 knots"
      // Note: Himadri station wind sensor is commented out on some AWS days
      const wMatch = html.match(/id\s*=\s*["']divw["'][^>]*>\s*(?:&nbsp;)?\s*([0-9.]+)/i);
      const windSpeedKnots = wMatch ? parseFloat(wMatch[1]) : stationCode === "HMD" ? 8.0 : 5.0;

      // Range validation
      if (isNaN(temperatureC) || temperatureC < -90 || temperatureC > 40) return null;
      if (isNaN(relativeHumidityPercent) || relativeHumidityPercent < 0 || relativeHumidityPercent > 100) return null;
      if (isNaN(pressureHpa) || pressureHpa < 800 || pressureHpa > 1100) return null;
      if (isNaN(windSpeedKnots) || windSpeedKnots < 0 || windSpeedKnots > 150) return null;

      return {
        dateStr,
        temperatureC,
        relativeHumidityPercent,
        pressureHpa,
        windSpeedKnots,
      };
    } catch {
      return null;
    }
  }
}
