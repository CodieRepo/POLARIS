import { NextRequest, NextResponse } from 'next/server';
import { requireActionPermission, handleAuthError } from '@/infrastructure/auth/role-guard';
import { TraverseRepository } from '@/core/traverse/traverse-repository';
import type { TraverseMissionStatus } from '@/core/traverse/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const targetStatus = body.status as TraverseMissionStatus;
    const notes = body.notes as string | undefined;

    if (!targetStatus) {
      return NextResponse.json(
        { success: false, error: 'Target status is required' },
        { status: 400 }
      );
    }

    // Role permission check depending on the transition intent
    if (targetStatus === 'DISPATCHED' || targetStatus === 'EN_ROUTE') {
      await requireActionPermission('TRAVERSE_MISSION_DISPATCH');
    } else if (
      targetStatus === 'COMPLETED' ||
      targetStatus === 'ABORTED' ||
      targetStatus === 'CANCELLED'
    ) {
      await requireActionPermission('TRAVERSE_MISSION_ABORT_COMPLETE');
    } else {
      await requireActionPermission('TRAVERSE_MISSION_DISPATCH');
    }

    const updated = await TraverseRepository.transitionMissionStatus(id, targetStatus, notes);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to transition mission status' },
      { status: 400 }
    );
  }
}
