// ==============================================================================
// POLARIS Telegram Notification Channel Adapter
// Description: Dispatches high-priority operational alerts to Telegram groups/chats.
// Sandbox Mode: Gracefully runs in simulated sandbox mode if credentials not provisioned.
// ==============================================================================

import { INotificationChannelAdapter } from '../channel-adapter.interface';
import { DeliveryResult, NotificationPayload } from '../types';

export class TelegramChannelAdapter implements INotificationChannelAdapter {
  readonly channel = 'TELEGRAM' as const;

  private readonly botToken: string | undefined;
  private readonly isSandbox: boolean;

  constructor(botToken?: string) {
    this.botToken = botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.isSandbox =
      process.env.POLARIS_NOTIFICATION_SANDBOX === 'true' ||
      !this.botToken ||
      this.botToken.startsWith('test_') ||
      this.botToken.startsWith('sandbox_');
  }

  private formatMessage(payload: NotificationPayload): string {
    const icon =
      payload.severity === 'CRITICAL'
        ? '🚨'
        : payload.severity === 'WARNING'
        ? '⚠️'
        : payload.severity === 'WATCH'
        ? '👁️'
        : 'ℹ️';

    return (
      `${icon} *POLARIS OPERATIONAL ALERT* ${icon}\n\n` +
      `*Severity:* ${payload.severity}\n` +
      `*Category:* ${payload.category}\n` +
      `*Station:* ${payload.stationCode || 'GLOBAL'}\n` +
      `*Title:* ${payload.title}\n\n` +
      `*Details:* ${payload.message}\n\n` +
      `_Dispatched via POLARIS Outbox Engine at ${new Date().toISOString()}_`
    );
  }

  async send(
    recipient: string,
    _subject: string | null | undefined,
    payload: NotificationPayload
  ): Promise<DeliveryResult> {
    const text = this.formatMessage(payload);

    if (this.isSandbox) {
      console.log(`[TELEGRAM SANDBOX] Outbox message to ${recipient}:\n${text}`);
      return {
        success: true,
        deliveryStatus: 'TEST_MODE_SIMULATED',
        externalReferenceId: `tg-sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipient,
          text,
          parse_mode: 'Markdown',
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return {
          success: false,
          deliveryStatus: res.status === 429 ? 'RATE_LIMITED' : 'PERMANENT_FAILURE',
          error: `Telegram API error (${res.status}): ${errBody}`,
        };
      }

      const json = await res.json();
      return {
        success: true,
        deliveryStatus: 'SUCCESS',
        externalReferenceId: String(json.result?.message_id || `tg-${Date.now()}`),
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        deliveryStatus: 'PERMANENT_FAILURE',
        error: error.message || 'Network error dispatching Telegram alert',
      };
    }
  }
}
