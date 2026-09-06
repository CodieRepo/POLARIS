import type { OperationalAlert, SafetyIncident } from "./types";
import type { StationWeather } from "@/core/weather/types";

let IN_MEMORY_ALERTS: OperationalAlert[] = [
  {
    id: "alert-01",
    stationCode: "BHR",
    title: "Surface Wind Blizzard Watch Active",
    severity: "WATCH",
    category: "METEOROLOGICAL",
    details: "In-situ AWS reporting surface wind speed > 38 km/h at Larsemann Hills. Field traverse operations restricted; outdoor movement requires buddy-system.",
    status: "ACTIVE",
    triggeredAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: "alert-02",
    stationCode: "MTR",
    title: "Hydraulic Crane Maintenance In-Progress",
    severity: "INFO",
    category: "POWER_SYSTEMS",
    details: "VEH-CRN-01 All-Terrain Polar Crane undergoing scheduled sub-zero hydraulic fluid flush and boom seal replacement by Heavy Plant Engineers.",
    status: "ACTIVE",
    triggeredAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: "alert-03",
    stationCode: "GLOBAL",
    title: "Sorsdal Glacier Crevasse Shear Margin Warning",
    severity: "WARNING",
    category: "TRAVERSE",
    details: "Tidal shear margin flexing detected along Amery transect. Convoy routing restricted to verified radar-sounded waypoints.",
    status: "ACTIVE",
    triggeredAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

const IN_MEMORY_INCIDENTS: SafetyIncident[] = [
  {
    id: "inc-01",
    stationCode: "MTR",
    incidentType: "VEHICLE_BREAKDOWN",
    severity: "WATCH",
    occurredAt: "2026-08-25T08:30:00Z",
    reportedBy: "Subedar M. Gurung",
    description: "Hydraulic pressure drop on main boom during heavy cargo unloading at Maitri base.",
    actionsTaken: "Boom secured in travel cradle; corrective work order scheduled with sub-zero synthetic oil flush.",
    status: "CONTAINED",
  },
];

export class AlertEngine {
  /**
   * Evaluates active telemetry to ensure threshold alerts are synchronized.
   */
  public static evaluateTelemetryAlerts(
    weatherTelemetry: Record<string, StationWeather> | null
  ): readonly OperationalAlert[] {
    if (!weatherTelemetry) return IN_MEMORY_ALERTS;

    // Check Bharati wind
    const bhr = weatherTelemetry["BHR"];
    if (bhr) {
      const wind = bhr.measurements.windSpeedKmH.value ?? 0;
      if (wind >= 55) {
        // Warning
        if (!IN_MEMORY_ALERTS.some((a) => a.id === "alert-bhr-warning" && a.status === "ACTIVE")) {
          IN_MEMORY_ALERTS.unshift({
            id: "alert-bhr-warning",
            stationCode: "BHR",
            title: "Severe Blizzard Warning Triggered",
            severity: "CRITICAL",
            category: "METEOROLOGICAL",
            details: `Surface wind speed is ${wind} km/h (exceeds 55 km/h warning threshold). Station lockdown protocol advised.`,
            status: "ACTIVE",
            triggeredAt: new Date().toISOString(),
          });
        }
      }
    }

    return IN_MEMORY_ALERTS;
  }

  /**
   * Returns active operational alerts.
   */
  public static getActiveAlerts(): readonly OperationalAlert[] {
    return IN_MEMORY_ALERTS.filter((a) => a.status === "ACTIVE");
  }

  /**
   * Returns safety incidents.
   */
  public static getIncidents(): readonly SafetyIncident[] {
    return IN_MEMORY_INCIDENTS;
  }

  /**
   * Acknowledges an alert by ID.
   */
  public static acknowledgeAlert(alertId: string, userEmail: string): void {
    IN_MEMORY_ALERTS = IN_MEMORY_ALERTS.map((a) =>
      a.id === alertId ? { ...a, status: "ACKNOWLEDGED", acknowledgedBy: userEmail } : a
    );
  }
}
