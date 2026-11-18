// Canonical shapes for the realtime notification layer (socket + push).
// See §1 of the FE realtime notification spec for the backend contract this mirrors.

export type NotificationType =
    | "POLICY"
    | "SUGGEST"
    | "REPORT"
    | "WEEKLY_PLAN"
    | "EXPENSE_REQUEST"
    | "TEACHING_SCHEDULE"
    | "SYSTEM";

export type NotificationMeta = {
    route?: string;
    url?: string;
    module?: string;
    kind?: string;
    suggestType?: string;
    suggestId?: number;
    suggestCode?: string;
    employeeId?: number;
    employeeName?: string;
    employeePhone?: string;
    status?: string;
    daysLate?: number;
    sessionId?: number;
    fromDate?: string;
    toDate?: string;
    sessionCount?: number;
    periodCount?: number;
    [key: string]: unknown;
};

// The record shape shared by policy-notification:new, suggest-notification:new,
// report-notification:new, weekly-plan:new, expense-request-notification:new,
// teaching-schedule-notification:new, and the "real" notification:new (SYSTEM/other).
export type NotificationPayload = {
    id: number;
    receiverId?: number;
    senderId?: number | null;
    type: NotificationType;
    entityId?: number;
    meta?: NotificationMeta;
    message?: string;
    isRead: boolean;
    createdAt: string;
    createdBy?: number;
};

// PolicyGateway.notifyNewPolicy / WeeklyPlanGateway.notifyNewWeeklyPlan also emit under the
// "notification:new" name but without `id` or a canonical `type` — this shape is a refetch
// signal only, it must never be pushed into the notification list as-is.
export type LegacyNotificationPayload = {
    policyId?: number;
    weeklyPlanId?: number;
    type?: string;
    message: string;
    createdAt: string;
    isRead: boolean;
};

export const isLegacyNotificationPayload = (
    payload: unknown,
): payload is LegacyNotificationPayload =>
    typeof payload === "object" &&
    payload !== null &&
    !("id" in (payload as Record<string, unknown>));

export type RealtimeNotificationEvent =
    | "policy-notification:new"
    | "suggest-notification:new"
    | "report-notification:new"
    | "weekly-plan:new"
    | "expense-request-notification:new"
    | "teaching-schedule-notification:new"
    | "notification:new";

export type NotificationTypeStats = { unread: number; read: number };

export type NotificationStats = Record<NotificationType, NotificationTypeStats>;

export const EMPTY_NOTIFICATION_STATS: NotificationStats = {
    POLICY: { unread: 0, read: 0 },
    SUGGEST: { unread: 0, read: 0 },
    REPORT: { unread: 0, read: 0 },
    WEEKLY_PLAN: { unread: 0, read: 0 },
    EXPENSE_REQUEST: { unread: 0, read: 0 },
    TEACHING_SCHEDULE: { unread: 0, read: 0 },
    SYSTEM: { unread: 0, read: 0 },
};

// Event fired to onRealtimeNotification() subscribers — either a real payload (has `id`)
// or a legacy no-id payload that only means "go refetch, don't trust this shape".
export type RealtimeNotificationSignal =
    | { event: RealtimeNotificationEvent; payload: NotificationPayload; legacy: false }
    | { event: RealtimeNotificationEvent; payload: LegacyNotificationPayload; legacy: true };
