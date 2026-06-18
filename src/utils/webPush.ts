import {
    getToken,
    onMessage,
    isSupported,
} from "firebase/messaging";

import { messaging } from "@/firebase";
import { employeeApi } from "@/service/employee";
import { getDeviceType } from "./getDeviceType";

let initialized = false;

export const initWebPush = async () => {
    try {
        if (initialized) return;

        const supported = await isSupported();

        if (!supported) {
            console.log("❌ Firebase Messaging not supported on this browser");
            return;
        }

        initialized = true;

        if (!("Notification" in window)) {
            console.log("❌ Notification API not supported");
            return;
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("❌ Notification denied");
            return;
        }

        const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
        );

        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        console.log("🔥 WEB FCM TOKEN:", token);

        if (!token) {
            console.log("❌ No FCM token returned");
            return;
        }

        const deviceType = getDeviceType();

        await employeeApi.saveFcmToken(token, deviceType);

        onMessage(messaging, (payload) => {
            console.log("📩 Foreground:", payload);
        });
    } catch (err) {
        initialized = false;
        console.error("❌ initWebPush error:", err);
    }
};