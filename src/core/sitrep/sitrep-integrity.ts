import crypto from "crypto";

export interface SitrepSignablePayload {
  stationCode: string;
  reportDate: string;
  commanderName: string;
  signerIdentity: string;
  winterOver: number;
  summerScience: number;
  transientAircrew: number;
  minTempC: number | null;
  maxTempC: number | null;
  peakWindKmh: number | null;
  pressureHpa: number | null;
  pressureTrend6h: number | null;
  fuelConsumed24hLiters: number;
  generatorRuntimeHours: number;
  outdoorStatus: string;
  operationalRemarks: string;
}

/**
 * Deterministically serializes a SITREP payload with sorted keys and normalized values.
 */
export function canonicalizeSitrepPayload(payload: SitrepSignablePayload): string {
  const normalized = {
    commanderName: payload.commanderName.trim(),
    fuelConsumed24hLiters: Number(payload.fuelConsumed24hLiters.toFixed(2)),
    generatorRuntimeHours: Number(payload.generatorRuntimeHours.toFixed(2)),
    maxTempC: payload.maxTempC !== null ? Number(payload.maxTempC.toFixed(2)) : null,
    minTempC: payload.minTempC !== null ? Number(payload.minTempC.toFixed(2)) : null,
    operationalRemarks: payload.operationalRemarks.trim(),
    outdoorStatus: payload.outdoorStatus.trim(),
    peakWindKmh: payload.peakWindKmh !== null ? Number(payload.peakWindKmh.toFixed(2)) : null,
    pressureHpa: payload.pressureHpa !== null ? Number(payload.pressureHpa.toFixed(2)) : null,
    pressureTrend6h: payload.pressureTrend6h !== null ? Number(payload.pressureTrend6h.toFixed(2)) : null,
    reportDate: payload.reportDate.trim(),
    signerIdentity: payload.signerIdentity.trim(),
    stationCode: payload.stationCode.trim(),
    summerScience: Math.round(payload.summerScience),
    transientAircrew: Math.round(payload.transientAircrew),
    winterOver: Math.round(payload.winterOver),
  };

  const sortedKeys = Object.keys(normalized).sort() as (keyof typeof normalized)[];
  const entries = sortedKeys.map((k) => `"${k}":${JSON.stringify(normalized[k])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Generates an authentic SHA-256 document integrity hash over the canonical SITREP payload.
 */
export function generateDocumentIntegrityHash(payload: SitrepSignablePayload): string {
  const canonical = canonicalizeSitrepPayload(payload);
  return crypto.createHash("sha256").update(canonical, "utf-8").digest("hex");
}

/**
 * Verifies that the given payload produces the exact expected SHA-256 hash.
 */
export function verifyDocumentIntegrity(
  payload: SitrepSignablePayload,
  storedHash: string
): { isValid: boolean; computedHash: string; storedHash: string } {
  const computedHash = generateDocumentIntegrityHash(payload);
  const isValid = computedHash.toLowerCase() === storedHash.toLowerCase();
  return { isValid, computedHash, storedHash };
}

export const computeSitrepIntegrityHash = generateDocumentIntegrityHash;
