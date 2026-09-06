// ==============================================================================
// POLARIS Notification Channel Adapter Interface
// Description: Contract for external delivery adapters (Telegram, Email, Web Push, Mock).
// ==============================================================================

import { DeliveryResult, NotificationChannel, NotificationPayload } from './types';

export interface INotificationChannelAdapter {
  readonly channel: NotificationChannel;

  /**
   * Sends a notification payload to a designated recipient address/ID.
   */
  send(
    recipient: string,
    subject: string | null | undefined,
    payload: NotificationPayload
  ): Promise<DeliveryResult>;
}
