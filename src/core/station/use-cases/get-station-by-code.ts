import type { StationRepository, StationRow } from "../station-repository";
import type { UseCaseResult } from "@/core/errors/application-errors";

/**
 * Use case: Retrieve a polar research station by its unique code (e.g., 'BHR', 'MTR').
 *
 * Responsibilities:
 * - Validate/guard input string semantics.
 * - Delegate to StationRepository for reference data retrieval.
 * - Return a deterministic, typed UseCaseResult discriminated union.
 * - Translate missing records to 'STATION_NOT_FOUND' and unexpected throws to 'INFRASTRUCTURE_ERROR'.
 */
export class GetStationByCodeUseCase {
  constructor(private readonly repository: StationRepository) {}

  /**
   * Executes the retrieval of a station by station code.
   *
   * @param code - The unique alphanumeric station code.
   * @returns Discriminated union indicating success with StationRow data or failure with structured error.
   */
  async execute(
    code: string
  ): Promise<
    UseCaseResult<StationRow, "STATION_NOT_FOUND" | "INFRASTRUCTURE_ERROR">
  > {
    const normalizedCode = code?.trim();

    if (!normalizedCode) {
      return {
        success: false,
        error: {
          code: "STATION_NOT_FOUND",
          message: "Station code must be a non-empty string.",
        },
      };
    }

    try {
      const station = await this.repository.getByCode(normalizedCode);

      if (!station) {
        return {
          success: false,
          error: {
            code: "STATION_NOT_FOUND",
            message: `Station with code '${normalizedCode}' not found.`,
          },
        };
      }

      return {
        success: true,
        data: station,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          code: "INFRASTRUCTURE_ERROR",
          message: `Failed to retrieve station '${normalizedCode}': ${message}`,
        },
      };
    }
  }
}
