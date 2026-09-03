import { createServerClient } from "@/infrastructure/db/supabase-server";
import { ExpeditionRepository } from "@/modules/expedition/expedition-repository";
import { NextRequest, NextResponse } from "next/server";

interface RosterMemberResult {
  id: string;
  expedition_id: string;
  person_id: string;
  assignment_role: string;
  joined_at: string;
  left_at: string | null;
  person: {
    id: string;
    display_name: string;
    role_title: string | null;
    organization: string | null;
    active: boolean;
  } | null;
}

interface AssignedAssetResult {
  id: string;
  asset_id: string;
  assignment_type: string;
  assigned_at: string;
  released_at: string | null;
  notes: string | null;
  asset: {
    id: string;
    asset_code: string;
    name: string;
    category: string;
    type: string | null;
    status: string;
    condition: string;
    criticality: string;
  } | null;
}

/**
 * GET /api/expeditions/[code]
 * Returns full operational expedition context:
 * - Expedition metadata
 * - Personnel roster (with role titles and organizations)
 * - Assigned field assets (live equipment assigned to this expedition)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const normalizedCode = code.trim().toUpperCase();

    // Use server client for resilient read access (subject to RLS / server fallback)
    const supabase = createServerClient();
    const expeditionRepo = new ExpeditionRepository(supabase);

    // 1. Fetch expedition by code
    const expedition = await expeditionRepo.getByCode(normalizedCode);
    if (!expedition) {
      return NextResponse.json(
        { error: `Expedition '${normalizedCode}' not found`, code: "EXPEDITION_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Fetch expedition roster (members + personnel profiles)
    let roster: RosterMemberResult[] = [];
    const { data: memberRows } = await supabase
      .from("expedition_members")
      .select("id, expedition_id, person_id, assignment_role, joined_at, left_at")
      .eq("expedition_id", expedition.id)
      .order("joined_at", { ascending: true });

    if (memberRows && memberRows.length > 0) {
      const personIds = Array.from(new Set(memberRows.map((m) => m.person_id)));
      const { data: personRows } = await supabase
        .from("persons")
        .select("id, display_name, role_title, organization, active")
        .in("id", personIds);

      const personMap = new Map((personRows || []).map((p) => [p.id, p]));
      roster = memberRows.map((m) => ({
        ...m,
        person: personMap.get(m.person_id) || null,
      }));
    }

    // 3. Fetch all active asset assignments for this expedition
    const { data: assignments, error: assignErr } = await supabase
      .from("asset_assignments")
      .select("id, asset_id, assignment_type, assigned_at, released_at, notes")
      .eq("expedition_id", expedition.id)
      .is("released_at", null);

    let assignedAssets: AssignedAssetResult[] = [];
    if (!assignErr && assignments && assignments.length > 0) {
      const assetIds = assignments.map((a) => a.asset_id);
      const { data: assets } = await supabase
        .from("assets")
        .select("id, asset_code, name, category, type, status, condition, criticality")
        .in("id", assetIds);

      if (assets) {
        assignedAssets = assignments.map((assignment) => {
          const asset = assets.find((a) => a.id === assignment.asset_id);
          return {
            ...assignment,
            asset: asset || null,
          };
        });
      }
    }

    // 4. Fetch origin and destination stations
    const stationIds = [expedition.origin_station_id, expedition.destination_station_id].filter(Boolean) as string[];
    let stationsMap: Record<string, { code: string; name: string }> = {};
    if (stationIds.length > 0) {
      const { data: stations } = await supabase
        .from("stations")
        .select("id, code, name")
        .in("id", stationIds);
      if (stations) {
        stationsMap = stations.reduce((acc, s) => ({ ...acc, [s.id]: { code: s.code, name: s.name } }), {});
      }
    }

    return NextResponse.json(
      {
        data: {
          expedition,
          roster,
          assignedAssets,
          originStation: expedition.origin_station_id ? stationsMap[expedition.origin_station_id] || null : null,
          destinationStation: expedition.destination_station_id ? stationsMap[expedition.destination_station_id] || null : null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
