import {
    getToken,
    onMessage,
    isSupported,
} from "firebase/messaging";

import { messaging } from "@/firebase";
import { employeeApi } from "@/service/employee";
import { getDeviceType } from "./getDeviceType";

let initialized = false;
let initializationPromise: Promise<void> | null = null;

const firebaseServiceWorkerUrl = () => {
    const config = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    const missing = Object.entries(config)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length) {
        throw new Error(`Missing Firebase config: ${missing.join(", ")}`);
    }

    const params = new URLSearchParams(config);
    return `/firebase-messaging-sw.js?${params.toString()}`;
};

const initializeWebPush = async () => {
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

        // Dùng scope riêng để không tranh quyền kiểm soát `/` với service worker
        // cache/offline do vite-plugin-pwa tạo ra.
        const registration = await navigator.serviceWorker.register(
            firebaseServiceWorkerUrl(),
            { scope: "/firebase-cloud-messaging-push-scope" },
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

/**
 * Dùng chung một promise khi React StrictMode hoặc nhiều màn cùng gọi lúc
 * khởi động; tránh đăng ký hai worker và gọi getToken hai lần song song.
 */
export const initWebPush = () => {
    if (initialized) return Promise.resolve();
    if (initializationPromise) return initializationPromise;

    initializationPromise = initializeWebPush().finally(() => {
        initializationPromise = null;
    });
    return initializationPromise;
};
