/**
 * POLARIS Daily Station Commander Situation Report (SITREP) Types
 * Aligned with official MoES / NCPOR Antarctic Station Reporting Standards.
 */

export type OutdoorClearanceStatus = "GREEN_NORMAL" | "YELLOW_RESTRICTED" | "RED_LOCKDOWN";

export interface DailySitrepData {
  readonly id: string;
  readonly stationCode: "BHR" | "MTR" | "HMD";
  readonly stationName: string;
  readonly reportDate: string; // YYYY-MM-DD
  readonly submittedByEmail: string;
  readonly commanderName: string;
  readonly signerIdentity: string;
  readonly integrityHash: string;
  readonly headcount: {
    readonly winterOver: number;
    readonly summerScience: number;
    readonly transientAircrew: number;
    readonly total: number;
  };
  readonly weatherSummary: {
    readonly currentTempC: number;
    readonly minTemp24hC: number;
    readonly maxTemp24hC: number;
    readonly peakWindKmh: number;
    readonly currentPressureHpa: number;
    readonly pressureDelta6h: number;
  };
  readonly fuelConsumed24hLiters: number;
  readonly generatorRuntimeHours: number;
  readonly outdoorStatus: OutdoorClearanceStatus;
  readonly operationalRemarks: string;
  readonly signedOffAt: string;
  // Legacy alias for backwards UI compatibility
  readonly digitalSignatureToken?: string;
}

export interface SitrepDraftInput {
  readonly stationCode: "BHR" | "MTR" | "HMD";
  readonly commanderName: string;
  readonly signerIdentity?: string;
  readonly winterOver: number;
  readonly summerScience: number;
  readonly transientAircrew: number;
  readonly fuelConsumed24hLiters: number;
  readonly generatorRuntimeHours: number;
  readonly outdoorStatus: OutdoorClearanceStatus;
  readonly operationalRemarks: string;
}

export interface IntegrityVerificationResult {
  readonly isValid: boolean;
  readonly computedHash: string;
  readonly storedHash: string;
  readonly verifiedAt: string;
  readonly algorithm: "SHA-256";
  readonly reportId: string;
  readonly signerIdentity: string;
}
