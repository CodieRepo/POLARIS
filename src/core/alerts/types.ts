/**
 * POLARIS Operational Alert & Incident Management Types
 */

export type AlertSeverity = "INFO" | "WATCH" | "WARNING" | "CRITICAL";

export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";

export interface OperationalAlert {
  readonly id: string;
  readonly stationCode: "BHR" | "MTR" | "HMD" | "GLOBAL";
  readonly title: string;
  readonly severity: AlertSeverity;
  readonly category: "METEOROLOGICAL" | "POWER_SYSTEMS" | "FUEL_FARM" | "LOGISTICS" | "TRAVERSE";
  readonly details: string;
  readonly status: AlertStatus;
  readonly triggeredAt: string;
  readonly acknowledgedBy?: string;
}

export interface SafetyIncident {
  readonly id: string;
  readonly stationCode: "BHR" | "MTR" | "HMD";
  readonly incidentType: "COLD_INJURY" | "EQUIPMENT_FAILURE" | "FIRE_ALARM" | "VEHICLE_BREAKDOWN" | "CREVASSE_HAZARD";
  readonly severity: AlertSeverity;
  readonly occurredAt: string;
  readonly reportedBy: string;
  readonly description: string;
  readonly actionsTaken: string;
  readonly status: "OPEN" | "CONTAINED" | "RESOLVED";
}
