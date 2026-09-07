import { NextRequest, NextResponse } from 'next/server';
import { requireActionPermission, handleAuthError } from '@/infrastructure/auth/role-guard';
import { TraverseRepository } from '@/core/traverse/traverse-repository';
import type { CreateMissionPayload } from '@/core/traverse/types';

export async function GET() {
  try {
    await requireActionPermission('TRAVERSE_MISSION_VIEW');
    const missions = await TraverseRepository.listMissions();
    return NextResponse.json({ success: true, data: missions });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list traverse missions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActionPermission('TRAVERSE_MISSION_CREATE');
    const body = (await req.json()) as CreateMissionPayload;

    if (
      !body.mission_code ||
      !body.title ||
      !body.corridor_id ||
      !body.origin_station_id ||
      !body.expedition_id ||
      !body.lead_person_id ||
      !body.lead_asset_id ||
      !body.scheduled_departure_at
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: mission_code, title, corridor_id, origin_station_id, expedition_id, lead_person_id, lead_asset_id, scheduled_departure_at',
        },
        { status: 400 }
      );
    }

    const mission = await TraverseRepository.createMission(body, user.userId);
    return NextResponse.json({ success: true, data: mission }, { status: 201 });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create traverse mission' },
      { status: 500 }
    );
  }
}
