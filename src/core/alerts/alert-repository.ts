import { createServerClient } from "@/infrastructure/db/supabase-server";
import type { OperationalAlert, AlertSeverity, AlertStatus } from "./types";

const STATION_ID_TO_CODE: Record<string, "BHR" | "MTR" | "HMD"> = {
  "b0000000-0000-0000-0000-000000000001": "BHR",
  "b0000000-0000-0000-0000-000000000002": "MTR",
  "b0000000-0000-0000-0000-000000000003": "HMD",
};

const STATION_CODE_TO_ID: Record<string, string> = {
  BHR: "b0000000-0000-0000-0000-000000000001",
  MTR: "b0000000-0000-0000-0000-000000000002",
  HMD: "b0000000-0000-0000-0000-000000000003",
};

export class AlertRepository {
  /**
   * Retrieves active & acknowledged operational alerts from PostgreSQL.
   */
  public static async getActiveAlerts(): Promise<OperationalAlert[]> {
    const supabase = createServerClient();
    const { data: rows, error } = await supabase
      .from("operational_alerts")
      .select("*")
      .in("status", ["ACTIVE", "ACKNOWLEDGED"])
      .order("triggered_at", { ascending: false });

    if (error || !rows) {
      console.error("Failed to query operational_alerts:", error);
      return [];
    }

    return rows.map((r) => {
      const stationCode = r.station_id ? STATION_ID_TO_CODE[r.station_id] || "GLOBAL" : "GLOBAL";
      return {
        id: r.id,
        stationCode,
        title: r.title,
        severity: r.severity as AlertSeverity,
        category: r.category as OperationalAlert["category"],
        details: r.details,
        status: r.status as AlertStatus,
        triggeredAt: r.triggered_at,
        acknowledgedBy: r.acknowledged_by || undefined,
      };
    });
  }

  /**
   * Acknowledges an alert by transitioning status to ACKNOWLEDGED in PostgreSQL.
   */
  public static async acknowledgeAlert(id: string, userUuid?: string): Promise<boolean> {
    const supabase = createServerClient();
    const updateData: {
      status: "ACKNOWLEDGED";
      acknowledged_at: string;
      acknowledged_by?: string;
    } = {
      status: "ACKNOWLEDGED",
      acknowledged_at: new Date().toISOString(),
    };

    if (userUuid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)) {
      updateData.acknowledged_by = userUuid;
    }

    const { error } = await supabase
      .from("operational_alerts")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error(`Failed to acknowledge alert ${id}:`, error);
      return false;
    }
    return true;
  }

  /**
   * Resolves an alert by transitioning status to RESOLVED in PostgreSQL.
   */
  public static async resolveAlert(id: string): Promise<boolean> {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("operational_alerts")
      .update({
        status: "RESOLVED",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(`Failed to resolve alert ${id}:`, error);
      return false;
    }
    return true;
  }

  /**
   * Evaluates wind speed and commits a blizzard alert to PostgreSQL if wind >= 55 km/h.
   */
  public static async syncWeatherAlert(
    stationCode: "BHR" | "MTR" | "HMD",
    windSpeedKmH: number
  ): Promise<void> {
    if (windSpeedKmH < 55) return;

    try {
      const supabase = createServerClient();
      const stationId = STATION_CODE_TO_ID[stationCode];

      // Check if active alert already exists for this station
      const { data: existing } = await supabase
        .from("operational_alerts")
        .select("id")
        .eq("station_id", stationId)
        .eq("title", "Severe Blizzard Warning Triggered")
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!existing) {
        await supabase.from("operational_alerts").insert({
          station_id: stationId,
          severity: "CRITICAL",
          category: "METEOROLOGICAL",
          title: "Severe Blizzard Warning Triggered",
          details: `In-situ surface wind speed is ${windSpeedKmH} km/h (exceeds 55 km/h gale threshold). Station lockdown protocol advised.`,
          status: "ACTIVE",
        });
      }
    } catch (err) {
      console.error("Failed to sync weather alert to DB:", err);
    }
  }
}
