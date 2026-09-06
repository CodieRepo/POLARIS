import { NextRequest, NextResponse } from "next/server";
import { AlertRepository } from "@/core/alerts/alert-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/alerts
 * Retrieves active & acknowledged operational alerts from PostgreSQL.
 */
export async function GET() {
  try {
    const alerts = await AlertRepository.getActiveAlerts();
    return NextResponse.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load alerts" },
      { status: 500 }
    );
  }
}

import { requireActionPermission, handleAuthError } from "@/infrastructure/auth/role-guard";

/**
 * POST /api/alerts
 * Transitions alert lifecycle: ACTIVE -> ACKNOWLEDGED -> RESOLVED.
 * Authorized Roles: SUPER_ADMIN, COMMAND_ADMIN, EXPEDITION_MANAGER, STATION_OPERATOR.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: id and action" },
        { status: 400 }
      );
    }

    if (action === "ACKNOWLEDGE") {
      await requireActionPermission("ALERT_ACKNOWLEDGE");
      const ok = await AlertRepository.acknowledgeAlert(id);
      if (!ok) throw new Error("Failed to acknowledge alert in database");
    } else if (action === "RESOLVE") {
      await requireActionPermission("ALERT_RESOLVE");
      const ok = await AlertRepository.resolveAlert(id);
      if (!ok) throw new Error("Failed to resolve alert in database");
    } else {
      return NextResponse.json(
        { success: false, error: `Invalid action: ${action}. Expected ACKNOWLEDGE or RESOLVE.` },
        { status: 400 }
      );
    }

    const updatedAlerts = await AlertRepository.getActiveAlerts();

    return NextResponse.json({
      success: true,
      message: `Alert ${id} transitioned to ${action}D successfully`,
      alerts: updatedAlerts,
    });
  } catch (err) {
    const authRes = handleAuthError(err);
    if (authRes) return authRes;

    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update alert" },
      { status: 500 }
    );
  }
}
