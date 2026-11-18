import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import type { Socket } from "socket.io-client";

import { queryClient } from "@/pages/Employee/Sales/Statistics/hooks/queryClient";
import { getSocket } from "@/utils/socket";
import { notificationApi } from "@/service/notification";
import {
    EMPTY_NOTIFICATION_STATS,
    NotificationPayload,
    NotificationStats,
    NotificationType,
    RealtimeNotificationEvent,
    RealtimeNotificationSignal,
    isLegacyNotificationPayload,
} from "@/types/notification";

export const NOTIFICATIONS_QUERY_KEY = ["realtime-notifications"] as const;

export type RealtimeNotificationsState = {
    items: NotificationPayload[];
    unreadTotal: number;
    unreadByType: NotificationStats;
    connected: boolean;
};

const DEFAULT_STATE: RealtimeNotificationsState = {
    items: [],
    unreadTotal: 0,
    unreadByType: EMPTY_NOTIFICATION_STATS,
    connected: false,
};

const REALTIME_EVENTS: RealtimeNotificationEvent[] = [
    "policy-notification:new",
    "suggest-notification:new",
    "report-notification:new",
    "weekly-plan:new",
    "expense-request-notification:new",
    "teaching-schedule-notification:new",
    "notification:new",
];

// ================= pub/sub for per-page subscribers =================
// Employee/Home.tsx, Director/Home.tsx and useExpenseSocket.ts subscribe here instead of
// opening their own socket — mirrors the ergonomics of socket.on(event, handler).

type Listener = (signal: RealtimeNotificationSignal) => void;
const listeners = new Set<Listener>();

export function onRealtimeNotification(handler: Listener): () => void {
    listeners.add(handler);
    return () => {
        listeners.delete(handler);
    };
}

const emit = (signal: RealtimeNotificationSignal) => {
    listeners.forEach((listener) => listener(signal));
};

// ================= shared cache (React Query as the store) =================

const patchState = (partial: Partial<RealtimeNotificationsState>) => {
    const current =
        queryClient.getQueryData<RealtimeNotificationsState>(NOTIFICATIONS_QUERY_KEY) ??
        DEFAULT_STATE;
    queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, { ...current, ...partial });
};

const normalizeCount = (raw: unknown): number => {
    if (typeof raw === "number") return raw;
    if (raw && typeof raw === "object") {
        const record = raw as Record<string, unknown>;
        const value = record.unreadCount ?? record.count;
        return typeof value === "number" ? value : 0;
    }
    return 0;
};

const normalizeStats = (raw: unknown): NotificationStats => {
    const source =
        (raw && typeof raw === "object" && "types" in raw
            ? (raw as { types: unknown }).types
            : raw) ?? {};
    const result = { ...EMPTY_NOTIFICATION_STATS };
    (Object.keys(EMPTY_NOTIFICATION_STATS) as NotificationType[]).forEach((key) => {
        const entry = (source as Record<string, { unread?: number; read?: number } | undefined>)[key];
        result[key] = { unread: entry?.unread ?? 0, read: entry?.read ?? 0 };
    });
    return result;
};

// ================= reconcile (server is the source of truth) =================
// §C: called on connect/reconnect, tab/app becoming visible, going online, and after
// mark-as-read. Debounced so 2-3 of those firing together only hit the API once.

let reconcileTimer: ReturnType<typeof setTimeout> | null = null;

export function reconcileNotifications() {
    if (reconcileTimer) clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(async () => {
        reconcileTimer = null;
        try {
            const [unreadTotal, stats] = await Promise.all([
                notificationApi.getUnreadCount(),
                notificationApi.getStats(),
            ]);
            patchState({
                unreadTotal: normalizeCount(unreadTotal),
                unreadByType: normalizeStats(stats),
            });
        } catch (err) {
            console.error("reconcileNotifications failed", err);
        }
    }, 500);
}

// ================= §D fallback polling =================
// Disconnected for >15s → poll unread-count every 60s. Stops the moment "connect" fires.

let fallbackArmTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackPollInterval: ReturnType<typeof setInterval> | null = null;
let appActive = true;

const isBackgrounded = () =>
    (typeof document !== "undefined" && document.visibilityState === "hidden") || !appActive;

const clearFallbackPolling = () => {
    if (fallbackArmTimer) {
        clearTimeout(fallbackArmTimer);
        fallbackArmTimer = null;
    }
    if (fallbackPollInterval) {
        clearInterval(fallbackPollInterval);
        fallbackPollInterval = null;
    }
};

const scheduleFallbackPolling = () => {
    if (fallbackArmTimer || fallbackPollInterval) return;
    fallbackArmTimer = setTimeout(() => {
        fallbackArmTimer = null;
        if (isBackgrounded()) return;
        fallbackPollInterval = setInterval(() => {
            if (isBackgrounded()) return;
            notificationApi
                .getUnreadCount()
                .then((count) => patchState({ unreadTotal: normalizeCount(count) }))
                .catch(() => undefined);
        }, 60000);
    }, 15000);
};

// ================= incoming socket events =================

function applyIncoming(event: RealtimeNotificationEvent, raw: unknown) {
    if (isLegacyNotificationPayload(raw)) {
        // PolicyGateway/WeeklyPlanGateway legacy shape — no `id` to trust, refetch instead.
        emit({ event, payload: raw, legacy: true });
        reconcileNotifications();
        return;
    }

    const payload = raw as NotificationPayload;
    const state =
        queryClient.getQueryData<RealtimeNotificationsState>(NOTIFICATIONS_QUERY_KEY) ??
        DEFAULT_STATE;

    if (state.items.some((item) => item.id === payload.id)) return; // dedupe (socket + push)

    const items = [payload, ...state.items].slice(0, 20);
    let unreadTotal = state.unreadTotal;
    const unreadByType = { ...state.unreadByType };
    if (!payload.isRead) {
        const bucket = unreadByType[payload.type] ?? { unread: 0, read: 0 };
        unreadByType[payload.type] = { ...bucket, unread: bucket.unread + 1 };
        unreadTotal += 1;
    }
    patchState({ items, unreadTotal, unreadByType });

    if (payload.message) toast(payload.message);
    emit({ event, payload, legacy: false });
}

// ================= socket lifecycle =================

let boundSocket: Socket | null = null;

const hasAccessToken = () => Boolean(localStorage.getItem("access_token"));

function attachSocketListeners(socket: Socket) {
    REALTIME_EVENTS.forEach((event) => {
        socket.on(event, (payload: unknown) => applyIncoming(event, payload));
    });

    socket.on("connect", () => {
        clearFallbackPolling();
        patchState({ connected: true });
        reconcileNotifications();
    });

    socket.on("disconnect", () => {
        patchState({ connected: false });
        scheduleFallbackPolling();
    });
}

// Idempotent — safe to call from the boot effect, after login, on visibility/online/resume.
// Binds once per socket instance; utils/socket.ts itself recreates the instance on
// employeeId change (logout/login as a different account), so this naturally re-binds too.
export function ensureRealtimeConnection() {
    // Realtime boot is mounted for public routes too, including the login page.
    // Do not ask the socket factory for credentials until login has persisted
    // the token. Login calls this function again immediately after doing so.
    if (!hasAccessToken()) return;

    const socket = getSocket();
    if (!socket || socket === boundSocket) return;

    boundSocket = socket;
    attachSocketListeners(socket);

    if (socket.connected) {
        patchState({ connected: true });
        reconcileNotifications();
    }
}

// ================= public read hook =================

export function useRealtimeNotifications() {
    const { data } = useQuery({
        queryKey: NOTIFICATIONS_QUERY_KEY,
        queryFn: () =>
            queryClient.getQueryData<RealtimeNotificationsState>(NOTIFICATIONS_QUERY_KEY) ??
            DEFAULT_STATE,
        initialData: DEFAULT_STATE,
        staleTime: Infinity,
        gcTime: Infinity,
    });

    return data ?? DEFAULT_STATE;
}

// ================= boot: mount once inside <QueryClientProvider> =================

export function RealtimeNotificationsBoot() {
    useEffect(() => {
        ensureRealtimeConnection();

        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                appActive = true;
                ensureRealtimeConnection();
                if (hasAccessToken()) reconcileNotifications();
            } else {
                appActive = false;
            }
        };
        document.addEventListener("visibilitychange", onVisibility);

        const onOnline = () => {
            ensureRealtimeConnection();
            if (hasAccessToken()) reconcileNotifications();
        };
        window.addEventListener("online", onOnline);

        let removeAppStateListener: (() => void) | undefined;
        if (Capacitor.isNativePlatform()) {
            CapApp.addListener("appStateChange", ({ isActive }) => {
                appActive = isActive;
                if (isActive) {
                    ensureRealtimeConnection();
                    if (hasAccessToken()) reconcileNotifications();
                }
            }).then((handle) => {
                removeAppStateListener = () => handle.remove();
            });
        }

        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("online", onOnline);
            removeAppStateListener?.();
        };
    }, []);

    return null;
}
