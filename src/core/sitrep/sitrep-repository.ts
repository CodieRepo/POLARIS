import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { DailySitrepData, SitrepDraftInput, IntegrityVerificationResult } from "./types";
import {
  generateDocumentIntegrityHash,
  verifyDocumentIntegrity,
  type SitrepSignablePayload,
} from "./sitrep-integrity";

const STATION_CODE_TO_ID: Record<string, string> = {
  BHR: "b0000000-0000-0000-0000-000000000001",
  MTR: "b0000000-0000-0000-0000-000000000002",
  HMD: "b0000000-0000-0000-0000-000000000003",
  DGT: "b0000000-0000-0000-0000-000000000004",
};

const STATION_ID_TO_CODE: Record<string, "BHR" | "MTR" | "HMD"> = {
  "b0000000-0000-0000-0000-000000000001": "BHR",
  "b0000000-0000-0000-0000-000000000002": "MTR",
  "m0000000-0000-0000-0000-000000000002": "MTR",
  "b0000000-0000-0000-0000-000000000003": "HMD",
  "h0000000-0000-0000-0000-000000000003": "HMD",
};

const STATION_CODE_TO_NAME: Record<string, string> = {
  BHR: "Bharati Station",
  MTR: "Maitri Station",
  HMD: "Himadri Station",
};

export class SitrepRepository {
  /**
   * Retrieves all persisted SITREPs from PostgreSQL, optionally filtered by station.
   */
  public static async listSitreps(stationCode?: "BHR" | "MTR" | "HMD"): Promise<DailySitrepData[]> {
    const supabase = createServerClient();
    let query = supabase
      .from("daily_sitreps")
      .select("*")
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (stationCode && STATION_CODE_TO_ID[stationCode]) {
      query = query.eq("station_id", STATION_CODE_TO_ID[stationCode]);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error("Failed to query daily_sitreps:", error);
      return [];
    }

    return data.map((row) => {
      const code = STATION_ID_TO_CODE[row.station_id] || "BHR";
      return {
        id: row.id,
        stationCode: code,
        stationName: STATION_CODE_TO_NAME[code] || "Polar Base",
        reportDate: row.report_date,
        submittedByEmail: row.submitted_by ? "authenticated_operator@polaris.gov.in" : "commander@polaris.gov.in",
        commanderName: row.commander_name,
        signerIdentity: row.signer_identity || `STATION_COMMANDER_${code}`,
        integrityHash: row.integrity_hash,
        digitalSignatureToken: row.integrity_hash, // backwards compatibility
        headcount: {
          winterOver: row.winter_over_headcount,
          summerScience: row.summer_science_headcount,
          transientAircrew: row.transient_headcount,
          total: row.winter_over_headcount + row.summer_science_headcount + row.transient_headcount,
        },
        weatherSummary: {
          currentTempC: row.max_temp_c !== null ? Number(row.max_temp_c) : 0,
          minTemp24hC: row.min_temp_c !== null ? Number(row.min_temp_c) : 0,
          maxTemp24hC: row.max_temp_c !== null ? Number(row.max_temp_c) : 0,
          peakWindKmh: row.peak_wind_kmh !== null ? Number(row.peak_wind_kmh) : 0,
          currentPressureHpa: row.pressure_hpa !== null ? Number(row.pressure_hpa) : 0,
          pressureDelta6h: row.pressure_trend_6h !== null ? Number(row.pressure_trend_6h) : 0,
        },
        fuelConsumed24hLiters: Number(row.fuel_consumed_24h_liters),
        generatorRuntimeHours: Number(row.generator_runtime_hours),
        outdoorStatus: row.outdoor_status as DailySitrepData["outdoorStatus"],
        operationalRemarks: row.operational_remarks || "",
        signedOffAt: row.signed_off_at,
      };
    });
  }

  /**
   * Retrieves a single SITREP by ID.
   */
  public static async getSitrepById(id: string): Promise<DailySitrepData | null> {
    const supabase = createServerClient();
    const { data: row, error } = await supabase
      .from("daily_sitreps")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) return null;

    const code = STATION_ID_TO_CODE[row.station_id] || "BHR";
    return {
      id: row.id,
      stationCode: code,
      stationName: STATION_CODE_TO_NAME[code] || "Polar Base",
      reportDate: row.report_date,
      submittedByEmail: "commander@polaris.gov.in",
      commanderName: row.commander_name,
      signerIdentity: row.signer_identity || `STATION_COMMANDER_${code}`,
      integrityHash: row.integrity_hash,
      digitalSignatureToken: row.integrity_hash,
      headcount: {
        winterOver: row.winter_over_headcount,
        summerScience: row.summer_science_headcount,
        transientAircrew: row.transient_headcount,
        total: row.winter_over_headcount + row.summer_science_headcount + row.transient_headcount,
      },
      weatherSummary: {
        currentTempC: row.max_temp_c !== null ? Number(row.max_temp_c) : 0,
        minTemp24hC: row.min_temp_c !== null ? Number(row.min_temp_c) : 0,
        maxTemp24hC: row.max_temp_c !== null ? Number(row.max_temp_c) : 0,
        peakWindKmh: row.peak_wind_kmh !== null ? Number(row.peak_wind_kmh) : 0,
        currentPressureHpa: row.pressure_hpa !== null ? Number(row.pressure_hpa) : 0,
        pressureDelta6h: row.pressure_trend_6h !== null ? Number(row.pressure_trend_6h) : 0,
      },
      fuelConsumed24hLiters: Number(row.fuel_consumed_24h_liters),
      generatorRuntimeHours: Number(row.generator_runtime_hours),
      outdoorStatus: row.outdoor_status as DailySitrepData["outdoorStatus"],
      operationalRemarks: row.operational_remarks || "",
      signedOffAt: row.signed_off_at,
    };
  }

  /**
   * Persists a newly signed-off SITREP with SHA-256 document integrity hash.
   */
  public static async createSitrep(
    input: SitrepDraftInput,
    weatherSummary: DailySitrepData["weatherSummary"],
    reportDateStr?: string
  ): Promise<DailySitrepData> {
    const supabase = createServerClient();
    const stationId = STATION_CODE_TO_ID[input.stationCode];
    if (!stationId) {
      throw new Error(`Invalid station code: ${input.stationCode}`);
    }

    const reportDate = reportDateStr || new Date().toISOString().split("T")[0];
    const signerIdentity = input.signerIdentity || `STATION_COMMANDER_${input.stationCode}`;

    const signablePayload: SitrepSignablePayload = {
      stationCode: input.stationCode,
      reportDate,
      commanderName: input.commanderName,
      signerIdentity,
      winterOver: input.winterOver,
      summerScience: input.summerScience,
      transientAircrew: input.transientAircrew,
      minTempC: weatherSummary.minTemp24hC !== null && weatherSummary.minTemp24hC !== undefined ? weatherSummary.minTemp24hC : null,
      maxTempC: weatherSummary.maxTemp24hC !== null && weatherSummary.maxTemp24hC !== undefined ? weatherSummary.maxTemp24hC : null,
      peakWindKmh: weatherSummary.peakWindKmh !== null && weatherSummary.peakWindKmh !== undefined ? weatherSummary.peakWindKmh : null,
      pressureHpa: weatherSummary.currentPressureHpa !== null && weatherSummary.currentPressureHpa !== undefined ? weatherSummary.currentPressureHpa : null,
      pressureTrend6h: weatherSummary.pressureDelta6h !== null && weatherSummary.pressureDelta6h !== undefined ? weatherSummary.pressureDelta6h : null,
      fuelConsumed24hLiters: input.fuelConsumed24hLiters,
      generatorRuntimeHours: input.generatorRuntimeHours,
      outdoorStatus: input.outdoorStatus,
      operationalRemarks: input.operationalRemarks,
    };

    const integrityHash = generateDocumentIntegrityHash(signablePayload);

    const { data: inserted, error } = await supabase
      .from("daily_sitreps")
      .upsert(
        {
          station_id: stationId,
          report_date: reportDate,
          commander_name: input.commanderName,
          signer_identity: signerIdentity,
          integrity_hash: integrityHash,
          winter_over_headcount: input.winterOver,
          summer_science_headcount: input.summerScience,
          transient_headcount: input.transientAircrew,
          min_temp_c: signablePayload.minTempC,
          max_temp_c: signablePayload.maxTempC,
          peak_wind_kmh: signablePayload.peakWindKmh,
          pressure_hpa: signablePayload.pressureHpa,
          pressure_trend_6h: signablePayload.pressureTrend6h,
          fuel_consumed_24h_liters: input.fuelConsumed24hLiters,
          generator_runtime_hours: input.generatorRuntimeHours,
          outdoor_status: input.outdoorStatus,
          operational_remarks: input.operationalRemarks,
          signed_off_at: new Date().toISOString(),
        },
        { onConflict: "station_id,report_date" }
      )
      .select("*")
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to persist daily sitrep: ${error?.message}`);
    }

    return {
      id: inserted.id,
      stationCode: input.stationCode,
      stationName: STATION_CODE_TO_NAME[input.stationCode] || "Polar Base",
      reportDate: inserted.report_date,
      submittedByEmail: "commander@polaris.gov.in",
      commanderName: inserted.commander_name,
      signerIdentity: inserted.signer_identity || signerIdentity,
      integrityHash: inserted.integrity_hash,
      digitalSignatureToken: inserted.integrity_hash,
      headcount: {
        winterOver: inserted.winter_over_headcount,
        summerScience: inserted.summer_science_headcount,
        transientAircrew: inserted.transient_headcount,
        total: inserted.winter_over_headcount + inserted.summer_science_headcount + inserted.transient_headcount,
      },
      weatherSummary,
      fuelConsumed24hLiters: Number(inserted.fuel_consumed_24h_liters),
      generatorRuntimeHours: Number(inserted.generator_runtime_hours),
      outdoorStatus: inserted.outdoor_status as DailySitrepData["outdoorStatus"],
      operationalRemarks: inserted.operational_remarks || "",
      signedOffAt: inserted.signed_off_at,
    };
  }

  /**
   * Re-evaluates and verifies the cryptographic SHA-256 document integrity hash against persisted record values.
   */
  public static async verifySitrep(id: string): Promise<IntegrityVerificationResult> {
    const supabase = createServerClient();
    const { data: row, error } = await supabase
      .from("daily_sitreps")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !row) {
      throw new Error(`SITREP with ID ${id} not found.`);
    }

    const stationCode = STATION_ID_TO_CODE[row.station_id] || "BHR";
    const signerIdentity = row.signer_identity || `STATION_COMMANDER_${stationCode}`;

    const payload: SitrepSignablePayload = {
      stationCode,
      reportDate: row.report_date,
      commanderName: row.commander_name,
      signerIdentity,
      winterOver: row.winter_over_headcount,
      summerScience: row.summer_science_headcount,
      transientAircrew: row.transient_headcount,
      minTempC: row.min_temp_c !== null && row.min_temp_c !== undefined ? Number(row.min_temp_c) : null,
      maxTempC: row.max_temp_c !== null && row.max_temp_c !== undefined ? Number(row.max_temp_c) : null,
      peakWindKmh: row.peak_wind_kmh !== null && row.peak_wind_kmh !== undefined ? Number(row.peak_wind_kmh) : null,
      pressureHpa: row.pressure_hpa !== null && row.pressure_hpa !== undefined ? Number(row.pressure_hpa) : null,
      pressureTrend6h: row.pressure_trend_6h !== null && row.pressure_trend_6h !== undefined ? Number(row.pressure_trend_6h) : null,
      fuelConsumed24hLiters: Number(row.fuel_consumed_24h_liters),
      generatorRuntimeHours: Number(row.generator_runtime_hours),
      outdoorStatus: row.outdoor_status,
      operationalRemarks: row.operational_remarks || "",
    };

    const res = verifyDocumentIntegrity(payload, row.integrity_hash);

    return {
      isValid: res.isValid,
      computedHash: res.computedHash,
      storedHash: res.storedHash,
      verifiedAt: new Date().toISOString(),
      algorithm: "SHA-256",
      reportId: id,
      signerIdentity,
    };
  }
}
