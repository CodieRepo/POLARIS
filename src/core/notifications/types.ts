// ==============================================================================
// POLARIS Notification Domain Types
// Description: Types for asynchronous notification outbox, delivery logs,
//              channel adapters, and push subscriptions.
// ==============================================================================

export type NotificationChannel = 'TELEGRAM' | 'EMAIL' | 'WEB_PUSH' | 'MOCK';

export type OutboxStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type DeliveryStatus =
  | 'SUCCESS'
  | 'PERMANENT_FAILURE'
  | 'RATE_LIMITED'
  | 'TEST_MODE_SIMULATED';

export interface NotificationPayload {
  alertId?: string;
  severity: 'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL';
  category: string;
  title: string;
  message: string;
  stationCode?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationOutboxItem {
  id: string;
  alertId?: string | null;
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  payload: NotificationPayload;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryResult {
  success: boolean;
  deliveryStatus: DeliveryStatus;
  externalReferenceId?: string;
  error?: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId?: string | null;
  stationId?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface OutboxDispatchSummary {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    outboxId: string;
    channel: NotificationChannel;
    recipient: string;
    status: DeliveryStatus;
    externalReferenceId?: string;
    error?: string;
  }>;
}
