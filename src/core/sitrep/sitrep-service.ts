import type { DailySitrepData, SitrepDraftInput } from "./types";
import { TimeSeriesTelemetryService } from "@/core/telemetry/time-series-service";
import { computeSitrepIntegrityHash } from "./sitrep-integrity";

/**
 * Pre-seeded Historical Station Commander SITREPs (Official Record Baseline)
 */
const IN_MEMORY_SITREPS: DailySitrepData[] = [
  {
    id: "sitrep-bhr-20260905",
    stationCode: "BHR",
    stationName: "Bharati Station",
    reportDate: "2026-09-05",
    submittedByEmail: "cmd_admin_6c6_027160@polaris.test",
    commanderName: "Cmdr. Vikram Shekhawat (Station Leader)",
    headcount: {
      winterOver: 24,
      summerScience: 18,
      transientAircrew: 0,
      total: 42,
    },
    weatherSummary: {
      currentTempC: -13.8,
      minTemp24hC: -16.2,
      maxTemp24hC: -11.4,
      peakWindKmh: 46.5,
      currentPressureHpa: 984.2,
      pressureDelta6h: -2.1,
    },
    fuelConsumed24hLiters: 480.0,
    generatorRuntimeHours: 24.0,
    outdoorStatus: "YELLOW_RESTRICTED",
    operationalRemarks: "Blizzard watch active due to 46 km/h surface wind gusts. Heavy snow clearing around main modules completed. Prime Generator 1 running nominal on Day Tank 3.",
    signedOffAt: "2026-09-05T08:15:00Z",
    signerIdentity: "STATION_COMMANDER_BHR",
    integrityHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    digitalSignatureToken: "NCPOR-ISEA44-BHR-SIG-8F72A9B1",
  },
  {
    id: "sitrep-mtr-20260905",
    stationCode: "MTR",
    stationName: "Maitri Station",
    reportDate: "2026-09-05",
    submittedByEmail: "super_admin_6c6_027160@polaris.test",
    commanderName: "Dr. Rajesh Nair (Expedition Leader)",
    headcount: {
      winterOver: 19,
      summerScience: 0,
      transientAircrew: 2,
      total: 21,
    },
    weatherSummary: {
      currentTempC: -14.2,
      minTemp24hC: -18.5,
      maxTemp24hC: -12.0,
      peakWindKmh: 28.0,
      currentPressureHpa: 976.0,
      pressureDelta6h: 0.5,
    },
    fuelConsumed24hLiters: 420.0,
    generatorRuntimeHours: 24.0,
    outdoorStatus: "GREEN_NORMAL",
    operationalRemarks: "Priyadarshini Lake water pumping line operational with electric trace heating. Vehicle crane VEH-CRN-01 sub-zero hydraulic fluid replacement ongoing.",
    signedOffAt: "2026-09-05T08:05:00Z",
    signerIdentity: "EXPEDITION_LEADER_MTR",
    integrityHash: "8294c7989eb25e4c767db326e0e02c526d11e4bf3cb306a4bc4d46cfc6109961",
    digitalSignatureToken: "NCPOR-ISEA44-MTR-SIG-3E99D4C2",
  },
];

export class SitrepService {
  /**
   * Pre-populates a fresh Daily SITREP template from live meteorological and station state.
   */
  public static generateDraftSitrep(
    stationCode: "BHR" | "MTR" | "HMD",
    currentTemp: number,
    currentPressure: number,
    currentWindKmH: number
  ): SitrepDraftInput {
    const trend = TimeSeriesTelemetryService.getStationTelemetryTrend(
      stationCode,
      currentTemp,
      currentPressure,
      currentWindKmH
    );

    const isBharati = stationCode === "BHR";
    return {
      stationCode,
      commanderName: isBharati ? "Cmdr. Vikram Shekhawat" : "Dr. Rajesh Nair",
      winterOver: isBharati ? 24 : 19,
      summerScience: isBharati ? 18 : 0,
      transientAircrew: isBharati ? 0 : 2,
      fuelConsumed24hLiters: isBharati ? 480 : 420,
      generatorRuntimeHours: 24.0,
      outdoorStatus: trend.peakWind24h >= 45 ? "YELLOW_RESTRICTED" : "GREEN_NORMAL",
      operationalRemarks: `Official 08:00 UTC Daily Situation Report for ${stationCode}. 24-hour min temp: ${trend.minTemp24h}°C, peak wind: ${trend.peakWind24h} km/h. Fuel consumption nominal.`,
    };
  }

  /**
   * Commits a signed-off Daily SITREP.
   */
  public static submitSitrep(
    input: SitrepDraftInput,
    submittedByEmail: string,
    currentWeatherSummary: DailySitrepData["weatherSummary"]
  ): DailySitrepData {
    const todayStr = new Date().toISOString().split("T")[0];
    const signerIdentity = `STATION_COMMANDER_${input.stationCode}`;
    const integrityHash = computeSitrepIntegrityHash({
      stationCode: input.stationCode,
      reportDate: todayStr,
      commanderName: input.commanderName,
      signerIdentity,
      winterOver: input.winterOver,
      summerScience: input.summerScience,
      transientAircrew: input.transientAircrew,
      minTempC: currentWeatherSummary.minTemp24hC,
      maxTempC: currentWeatherSummary.maxTemp24hC,
      peakWindKmh: currentWeatherSummary.peakWindKmh,
      pressureHpa: currentWeatherSummary.currentPressureHpa,
      pressureTrend6h: currentWeatherSummary.pressureDelta6h,
      fuelConsumed24hLiters: input.fuelConsumed24hLiters,
      generatorRuntimeHours: input.generatorRuntimeHours,
      outdoorStatus: input.outdoorStatus,
      operationalRemarks: input.operationalRemarks,
    });

    const newSitrep: DailySitrepData = {
      id: `sitrep-${input.stationCode.toLowerCase()}-${todayStr.replace(/-/g, "")}`,
      stationCode: input.stationCode,
      stationName: input.stationCode === "BHR" ? "Bharati Station" : input.stationCode === "MTR" ? "Maitri Station" : "Himadri Station",
      reportDate: todayStr,
      submittedByEmail,
      commanderName: input.commanderName,
      signerIdentity,
      integrityHash,
      headcount: {
        winterOver: input.winterOver,
        summerScience: input.summerScience,
        transientAircrew: input.transientAircrew,
        total: input.winterOver + input.summerScience + input.transientAircrew,
      },
      weatherSummary: currentWeatherSummary,
      fuelConsumed24hLiters: input.fuelConsumed24hLiters,
      generatorRuntimeHours: input.generatorRuntimeHours,
      outdoorStatus: input.outdoorStatus,
      operationalRemarks: input.operationalRemarks,
      signedOffAt: new Date().toISOString(),
      digitalSignatureToken: `NCPOR-ISEA44-${input.stationCode}-SIG-${integrityHash.substring(0, 16).toUpperCase()}`,
    };

    IN_MEMORY_SITREPS.unshift(newSitrep);
    return newSitrep;
  }

  /**
   * Retrieves all filed Daily SITREPs.
   */
  public static getAllSitreps(): readonly DailySitrepData[] {
    return IN_MEMORY_SITREPS;
  }
}
