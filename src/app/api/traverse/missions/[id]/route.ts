import { NextRequest, NextResponse } from 'next/server';
import { requireActionPermission, handleAuthError } from '@/infrastructure/auth/role-guard';
import { TraverseRepository } from '@/core/traverse/traverse-repository';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireActionPermission('TRAVERSE_MISSION_VIEW');
    const { id } = await params;

    const data = await TraverseRepository.getMissionById(id);
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Traverse mission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const authRes = handleAuthError(error);
    if (authRes) return authRes;

    const err = error as Error;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch traverse mission' },
      { status: 500 }
    );
  }
}
