import { initializeApp } from "firebase/app";

import {
    getMessaging,
    isSupported,
    type Messaging,
} from "firebase/messaging";

const firebaseConfig = {
    apiKey:
        import.meta.env
            .VITE_FIREBASE_API_KEY,

    authDomain:
        import.meta.env
            .VITE_FIREBASE_AUTH_DOMAIN,

    projectId:
        import.meta.env
            .VITE_FIREBASE_PROJECT_ID,

    storageBucket:
        import.meta.env
            .VITE_FIREBASE_STORAGE_BUCKET,

    messagingSenderId:
        import.meta.env
            .VITE_FIREBASE_MESSAGING_SENDER_ID,

    appId:
        import.meta.env
            .VITE_FIREBASE_APP_ID,
};

const app =
    initializeApp(firebaseConfig);

// getMessaging() throws synchronously when service workers are unavailable
// (non-secure origin, native WebView), so only create it after isSupported().
let messagingPromise: Promise<Messaging | null> | null = null;

export const getMessagingSafe = () => {
    if (!messagingPromise) {
        messagingPromise = isSupported()
            .then((ok) => (ok ? getMessaging(app) : null))
            .catch(() => null);
    }
    return messagingPromise;
};