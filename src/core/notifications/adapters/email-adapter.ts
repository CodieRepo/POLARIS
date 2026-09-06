// ==============================================================================
// POLARIS Email Notification Channel Adapter
// Description: Dispatches high-priority operational bulletins via Email.
// Sandbox Mode: Gracefully runs in simulated sandbox mode if API key not provisioned.
// ==============================================================================

import { INotificationChannelAdapter } from '../channel-adapter.interface';
import { DeliveryResult, NotificationPayload } from '../types';

export class EmailChannelAdapter implements INotificationChannelAdapter {
  readonly channel = 'EMAIL' as const;

  private readonly resendApiKey: string | undefined;
  private readonly isSandbox: boolean;

  constructor(resendApiKey?: string) {
    this.resendApiKey = resendApiKey || process.env.RESEND_API_KEY;
    this.isSandbox =
      process.env.POLARIS_NOTIFICATION_SANDBOX === 'true' ||
      !this.resendApiKey ||
      this.resendApiKey.startsWith('test_') ||
      this.resendApiKey.startsWith('sandbox_');
  }

  async send(
    recipient: string,
    subject: string | null | undefined,
    payload: NotificationPayload
  ): Promise<DeliveryResult> {
    const effectiveSubject =
      subject || `[POLARIS ${payload.severity}] ${payload.title}`;

    if (this.isSandbox) {
      console.log(
        `[EMAIL SANDBOX] To: ${recipient} | Subject: ${effectiveSubject}\nBody: ${payload.message}`
      );
      return {
        success: true,
        deliveryStatus: 'TEST_MODE_SIMULATED',
        externalReferenceId: `email-sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'POLARIS Alert Engine <alerts@polaris-polar.org>',
          to: recipient,
          subject: effectiveSubject,
          text: `${effectiveSubject}\n\nStation: ${payload.stationCode || 'GLOBAL'}\nCategory: ${payload.category}\n\n${payload.message}`,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          deliveryStatus: res.status === 429 ? 'RATE_LIMITED' : 'PERMANENT_FAILURE',
          error: `Resend API error (${res.status}): ${errorText}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        deliveryStatus: 'SUCCESS',
        externalReferenceId: data.id || `email-${Date.now()}`,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        deliveryStatus: 'PERMANENT_FAILURE',
        error: error.message || 'Error dispatching email alert',
      };
    }
  }
}
