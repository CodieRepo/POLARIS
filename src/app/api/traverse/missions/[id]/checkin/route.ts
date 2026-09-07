import { NextRequest, NextResponse } from 'next/server';
import { requireActionPermission, handleAuthError } from '@/infrastructure/auth/role-guard';
import { TraverseRepository } from '@/core/traverse/traverse-repository';
import type { RecordCheckinPayload } from '@/core/traverse/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActionPermission('TRAVERSE_CHECKIN_RECORD');
    const { id } = await params;
    const body = (await req.json()) as RecordCheckinPayload;

    if (!body.waypoint_code || body.latitude === undefined || body.longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required waypoint fields: waypoint_code, latitude, longitude' },
        { status: 400 }
      );
    }

    const checkin = await TraverseRepository.recordCheckin(id, body, user.userId);
    return NextResponse.json({ success: true, data: checkin }, { status: 201 });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to record traverse check-in' },
      { status: 400 }
    );
  }
}
