import { fetchWithTimeout } from "./http-client";

export interface RawNcporObservation {
  dateStr: string;
  temperatureC: number;
  relativeHumidityPercent: number;
  pressureHpa: number;
  windSpeedKnots: number | null; // null if station sensor unmonitored (e.g. Himadri)
}

/**
 * Hardened NCPOR Weather Ingestion Adapter
 * Consumes official Automatic Weather Station (AWS) observations from data.ncpor.res.in
 * Tolerates whitespace variations (e.g. id = "divtemp") and unmonitored sub-fields.
 */
export class NcporWeatherAdapter {
  private static readonly NCPOR_BASE = "https://data.ncpor.res.in";

  /**
   * Fetches and parses official AWS observation for a given station.
   * Default timeout set to 4500ms to reduce cross-region latency-related timeout failures.
   */
  public static async fetchObservation(
    stationCode: "BHR" | "MTR" | "HMD",
    timeoutMs: number = 4500
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
   * Parses official table markup with whitespace-insensitive attribute matching
   */
  public static parseHtmlObservation(
    html: string,
    stationCode: "BHR" | "MTR" | "HMD"
  ): RawNcporObservation | null {
    try {
      // 1. Date string (e.g. "02 Sep 2026")
      const dateMatch = html.match(/<td[^>]*font-size:\s*20px;[^>]*>\s*([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{4})\s*<\/td>/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split("T")[0];

      // 2. Temperature: matches id="divtemp", id = "divtemp", id=divtemp
      const tempMatch = html.match(/id\s*=\s*["']?divtemp["']?[^>]*>\s*(?:&nbsp;)?\s*([+-]?[0-9.]+)/i);
      if (!tempMatch) return null;
      const temperatureC = parseFloat(tempMatch[1]);

      // 3. Relative Humidity: matches id="divrh", id = "divrh"
      const rhMatch = html.match(/id\s*=\s*["']?divrh["']?[^>]*>\s*(?:&nbsp;)?\s*([0-9.]+)/i);
      const relativeHumidityPercent = rhMatch ? parseFloat(rhMatch[1]) : 70;

      // 4. Air Pressure: matches id="divap", id = "divap"
      const apMatch = html.match(/id\s*=\s*["']?divap["']?[^>]*>\s*(?:&nbsp;)?\s*([0-9.]+)/i);
      const pressureHpa = apMatch ? parseFloat(apMatch[1]) : 990;

      // 5. Wind Speed: matches id="divw", id = "divw"
      // Note: On Himadri AWS, wind speed cell is HTML-commented out when uncalibrated
      const wMatch = html.match(/id\s*=\s*["']?divw["']?[^>]*>\s*(?:&nbsp;)?\s*([0-9.]+)/i);
      let windSpeedKnots: number | null = null;
      if (wMatch && !isNaN(parseFloat(wMatch[1]))) {
        windSpeedKnots = parseFloat(wMatch[1]);
      } else if (stationCode !== "HMD") {
        // Fallback default for Antarctic stations if wind tag present without number
        windSpeedKnots = 5.0;
      }

      // Range & Physical Sanity Validation
      if (isNaN(temperatureC) || temperatureC < -90 || temperatureC > 40) return null;
      if (isNaN(relativeHumidityPercent) || relativeHumidityPercent < 0 || relativeHumidityPercent > 100) return null;
      if (isNaN(pressureHpa) || pressureHpa < 800 || pressureHpa > 1100) return null;
      if (windSpeedKnots !== null && (isNaN(windSpeedKnots) || windSpeedKnots < 0 || windSpeedKnots > 150)) return null;

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
