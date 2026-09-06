import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/db/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint, keys, stationId, userId } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription. Missing endpoint, p256dh, or auth.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const userAgent = req.headers.get('user-agent') || 'Browser Client';

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          station_id: stationId || null,
          user_id: userId || null,
          user_agent: userAgent,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select('id, endpoint, station_id, is_active')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (error) {
    const err = error as Error;
    console.error('Error in /api/notifications/push-subscribe:', err);
    return NextResponse.json(
      { error: err.message || 'Push registration failed' },
      { status: 500 }
    );
  }
}
