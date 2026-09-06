// ==============================================================================
// POLARIS Notification Outbox Processor
// Description: Asynchronous decoupled outbox processor with retry backoff,
//              channel adapters, delivery audit trail, and push subscriber fan-out.
// ==============================================================================

import { createServerClient } from '@/infrastructure/db/supabase-server';
import type { Json } from '@/infrastructure/db/database.types';
import { INotificationChannelAdapter } from './channel-adapter.interface';
import { TelegramChannelAdapter } from './adapters/telegram-adapter';
import { EmailChannelAdapter } from './adapters/email-adapter';
import { WebPushChannelAdapter } from './adapters/webpush-adapter';
import { MockChannelAdapter } from './adapters/mock-adapter';
import {
  NotificationChannel,
  NotificationPayload,
  OutboxDispatchSummary,
  OutboxStatus,
} from './types';

export class OutboxProcessor {
  private static adapters: Map<NotificationChannel, INotificationChannelAdapter> = new Map<NotificationChannel, INotificationChannelAdapter>([
    ['TELEGRAM', new TelegramChannelAdapter()],
    ['EMAIL', new EmailChannelAdapter()],
    ['WEB_PUSH', new WebPushChannelAdapter()],
    ['MOCK', new MockChannelAdapter()],
  ]);

  /**
   * Registers or replaces an adapter for a specific channel (e.g. for testing).
   */
  static registerAdapter(channel: NotificationChannel, adapter: INotificationChannelAdapter) {
    this.adapters.set(channel, adapter);
  }

  /**
   * Enqueues an operational alert to the asynchronous outbox.
   */
  static async enqueueAlert(
    alertId: string,
    channels: Array<{ channel: NotificationChannel; recipient: string; subject?: string }>,
    payload: NotificationPayload
  ): Promise<string[]> {
    const supabase = createServerClient();
    const queuedIds: string[] = [];

    for (const ch of channels) {
      const { data, error } = await supabase
        .from('notification_outbox')
        .insert({
          alert_id: alertId,
          channel: ch.channel,
          recipient: ch.recipient,
          subject: ch.subject || `[POLARIS ${payload.severity}] ${payload.title}`,
          payload: (payload as unknown as Json),
          status: 'QUEUED',
          retry_count: 0,
          max_retries: 3,
          next_retry_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Failed to enqueue alert for channel ${ch.channel}:`, error);
      } else if (data) {
        queuedIds.push(data.id);
      }
    }

    return queuedIds;
  }

  /**
   * Automatically enqueues an alert to all active Web Push subscribers for that station.
   */
  static async enqueuePushSubscribers(
    alertId: string,
    stationId: string | null | undefined,
    payload: NotificationPayload
  ): Promise<number> {
    const supabase = createServerClient();
    let query = supabase.from('push_subscriptions').select('endpoint, station_id').eq('is_active', true);
    if (stationId) {
      query = query.or(`station_id.eq.${stationId},station_id.is.null`);
    }

    const { data: subs, error } = await query;
    if (error || !subs || subs.length === 0) return 0;

    let enqueued = 0;
    for (const sub of subs) {
      const { error: insErr } = await supabase.from('notification_outbox').insert({
        alert_id: alertId,
        channel: 'WEB_PUSH',
        recipient: sub.endpoint,
        subject: payload.title,
        payload: (payload as unknown as Json),
        status: 'QUEUED',
        retry_count: 0,
        max_retries: 3,
        next_retry_at: new Date().toISOString(),
      });
      if (!insErr) enqueued++;
    }

    return enqueued;
  }

  /**
   * Processes pending messages in the notification outbox.
   */
  static async processPendingQueue(batchSize: number = 20): Promise<OutboxDispatchSummary> {
    const supabase = createServerClient();
    const nowIso = new Date().toISOString();

    // 1. Fetch eligible queued records
    const { data: records, error } = await supabase
      .from('notification_outbox')
      .select('*')
      .eq('status', 'QUEUED')
      .lte('next_retry_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error || !records || records.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, results: [] };
    }

    const summary: OutboxDispatchSummary = {
      processed: records.length,
      succeeded: 0,
      failed: 0,
      results: [],
    };

    for (const record of records) {
      // 2. Mark as SENDING to prevent concurrency duplicate delivery
      await supabase
        .from('notification_outbox')
        .update({ status: 'SENDING', updated_at: new Date().toISOString() })
        .eq('id', record.id);

      const channel = record.channel as NotificationChannel;
      const adapter = this.adapters.get(channel);

      if (!adapter) {
        console.error(`No adapter registered for notification channel: ${channel}`);
        await supabase
          .from('notification_outbox')
          .update({
            status: 'FAILED',
            last_error: `Unknown channel ${channel}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

        summary.failed++;
        continue;
      }

      try {
        const result = await adapter.send(
          record.recipient,
          record.subject,
          record.payload as unknown as NotificationPayload
        );

        if (result.success) {
          // Update outbox to SENT
          await supabase
            .from('notification_outbox')
            .update({
              status: 'SENT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          // Record delivery audit
          await supabase.from('notification_deliveries').insert({
            outbox_id: record.id,
            alert_id: record.alert_id,
            channel: record.channel,
            recipient: record.recipient,
            delivery_status: result.deliveryStatus,
            external_reference_id: result.externalReferenceId,
            delivered_at: new Date().toISOString(),
          });

          summary.succeeded++;
          summary.results.push({
            outboxId: record.id,
            channel,
            recipient: record.recipient,
            status: result.deliveryStatus,
            externalReferenceId: result.externalReferenceId,
          });
        } else {
          // Increment retry count
          const newRetryCount = record.retry_count + 1;
          const isFinalFailure = newRetryCount >= record.max_retries;

          if (isFinalFailure) {
            await supabase
              .from('notification_outbox')
              .update({
                status: 'FAILED',
                retry_count: newRetryCount,
                last_error: result.error,
                updated_at: new Date().toISOString(),
              })
              .eq('id', record.id);

            await supabase.from('notification_deliveries').insert({
              outbox_id: record.id,
              alert_id: record.alert_id,
              channel: record.channel,
              recipient: record.recipient,
              delivery_status: 'PERMANENT_FAILURE',
              failure_reason: result.error,
              delivered_at: new Date().toISOString(),
            });

            summary.failed++;
          } else {
            // Exponential backoff: 30s * 2^retry
            const backoffSec = 30 * Math.pow(2, newRetryCount);
            const nextRetry = new Date(Date.now() + backoffSec * 1000).toISOString();

            await supabase
              .from('notification_outbox')
              .update({
                status: 'QUEUED',
                retry_count: newRetryCount,
                next_retry_at: nextRetry,
                last_error: result.error,
                updated_at: new Date().toISOString(),
              })
              .eq('id', record.id);

            summary.failed++;
          }

          summary.results.push({
            outboxId: record.id,
            channel,
            recipient: record.recipient,
            status: result.deliveryStatus,
            error: result.error,
          });
        }
      } catch (err) {
        const error = err as Error;
        summary.failed++;
        await supabase
          .from('notification_outbox')
          .update({
            status: 'FAILED',
            last_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      }
    }

    return summary;
  }

  /**
   * Retrieves audit logs of recent deliveries.
   */
  static async getRecentDeliveries(limit: number = 30) {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('notification_deliveries')
      .select('*')
      .order('delivered_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data;
  }

  /**
   * Retrieves summary counts of current outbox queue.
   */
  static async getOutboxQueueSummary() {
    const supabase = createServerClient();
    const { data: outbox } = await supabase
      .from('notification_outbox')
      .select('status');

    const counts = {
      QUEUED: 0,
      SENDING: 0,
      SENT: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    if (outbox) {
      for (const item of outbox) {
        if (item.status in counts) {
          counts[item.status as OutboxStatus]++;
        }
      }
    }

    return counts;
  }
}
