// ==============================================================================
// POLARIS Mock Notification Channel Adapter
// Description: Deterministic in-memory channel adapter for unit tests & CI/CD.
// ==============================================================================

import { INotificationChannelAdapter } from '../channel-adapter.interface';
import { DeliveryResult, NotificationPayload } from '../types';

export class MockChannelAdapter implements INotificationChannelAdapter {
  readonly channel = 'MOCK' as const;
  public dispatched: Array<{ recipient: string; payload: NotificationPayload }> = [];

  async send(
    recipient: string,
    _subject: string | null | undefined,
    payload: NotificationPayload
  ): Promise<DeliveryResult> {
    this.dispatched.push({ recipient, payload });
    return {
      success: true,
      deliveryStatus: 'SUCCESS',
      externalReferenceId: `mock-ref-${Date.now()}-${this.dispatched.length}`,
    };
  }
}
