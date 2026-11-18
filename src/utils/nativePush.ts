import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

import { employeeApi } from "@/service/employee";
import { hasRole } from "@/utils/auth";
import { reconcileNotifications } from "@/hook/useRealtimeNotifications";
import {
    notificationPath,
    type RoutableNotification as NotificationLike,
    type NotificationSurface,
} from "@/utils/teachingNotification";

let initialized = false;

const EMPLOYEE_ROLES = ["employee", "probation", "employee_la", "sales"];

const currentSurface = (): NotificationSurface =>
    hasRole(...EMPLOYEE_ROLES) ? "employee" : "director";

// FCM data payloads are flat string maps — normalize into the same shape notificationPath()
// already understands from socket payloads.
const toNotificationLike = (data: Record<string, string> | undefined): NotificationLike => ({
    type: data?.type,
    entityId: data?.entityId ? Number(data.entityId) : undefined,
    senderId: data?.senderId ? Number(data.senderId) : undefined,
    createdBy: data?.createdBy ? Number(data.createdBy) : undefined,
    meta: {
        route: data?.route,
        url: data?.url,
        kind: data?.kind,
        module: data?.module,
        suggestType: data?.suggestType,
        suggestId: data?.suggestId ? Number(data.suggestId) : undefined,
        sessionId: data?.sessionId ? Number(data.sessionId) : undefined,
    },
});

// HashRouter reads everything after "#" — this navigates without needing a react-router
// context, since push taps can happen from a cold app start.
const navigateTo = (path: string) => {
    window.location.hash = path;
};

export const initNativePush = async () => {
    if (!Capacitor.isNativePlatform() || initialized) return;
    initialized = true;

    try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") {
            console.log("❌ Native push permission denied");
            initialized = false;
            return;
        }

        await PushNotifications.register();

        PushNotifications.addListener("registration", ({ value }) => {
            employeeApi.saveFcmToken(value, Capacitor.getPlatform()).catch((err) => {
                console.error("saveFcmToken (native) failed", err);
            });
        });

        PushNotifications.addListener("registrationError", (error) => {
            console.error("Native push registration error", error);
        });

        PushNotifications.addListener("pushNotificationReceived", () => {
            // The OS shows the banner regardless of this listener — just keep counters honest.
            reconcileNotifications();
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const data = action.notification?.data as Record<string, string> | undefined;
            const path = notificationPath(toNotificationLike(data), currentSurface());
            if (path) navigateTo(path);
        });
    } catch (err) {
        initialized = false;
        console.error("❌ initNativePush error:", err);
    }
};
