import type { TraverseMissionStatus, TraverseMissionRow, TraverseCheckinRow } from './types';

/**
 * Authoritative Traverse Mission State Machine Transitions.
 * Any status transition not explicitly listed in ALLOWED_TRANSITIONS is strictly rejected.
 */
export const ALLOWED_TRANSITIONS: Record<TraverseMissionStatus, readonly TraverseMissionStatus[]> = {
  PLANNED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE: ['CHECKIN_OVERDUE', 'COMPLETED', 'ABORTED'],
  CHECKIN_OVERDUE: ['EN_ROUTE', 'COMPLETED', 'ABORTED'],
  COMPLETED: [],
  ABORTED: [],
  CANCELLED: [],
};

export class TraverseStateMachine {
  /**
   * Validates if a transition from currentStatus to targetStatus is valid.
   */
  public static canTransition(current: TraverseMissionStatus, target: TraverseMissionStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  /**
   * Asserts transition validity, throwing an error if invalid.
   */
  public static assertValidTransition(current: TraverseMissionStatus, target: TraverseMissionStatus): void {
    if (!this.canTransition(current, target)) {
      throw new Error(
        `Invalid mission status transition from '${current}' to '${target}'. Allowed transitions: [${(
          ALLOWED_TRANSITIONS[current] || []
        ).join(', ')}]`
      );
    }
  }

  /**
   * Deterministically evaluates whether a mission has an overdue check-in.
   * Based on:
   * - Mission status (only EN_ROUTE or DISPATCHED can be overdue)
   * - checkin_interval_hours configured on mission
   * - latest check-in timestamp OR departure timestamp
   * - current evaluation time
   */
  public static isCheckinOverdue(
    mission: Pick<TraverseMissionRow, 'status' | 'checkin_interval_hours' | 'actual_departure_at' | 'scheduled_departure_at'>,
    latestCheckin: Pick<TraverseCheckinRow, 'checkin_at'> | null | undefined,
    currentTime: Date = new Date()
  ): boolean {
    if (mission.status !== 'EN_ROUTE' && mission.status !== 'CHECKIN_OVERDUE') {
      return false;
    }

    const intervalHours = mission.checkin_interval_hours || 6;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    let baselineTimeMs: number;
    if (latestCheckin?.checkin_at) {
      baselineTimeMs = new Date(latestCheckin.checkin_at).getTime();
    } else if (mission.actual_departure_at) {
      baselineTimeMs = new Date(mission.actual_departure_at).getTime();
    } else {
      baselineTimeMs = new Date(mission.scheduled_departure_at).getTime();
    }

    return currentTime.getTime() - baselineTimeMs > intervalMs;
  }
}
