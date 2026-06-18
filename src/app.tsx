import "./css/tailwind.scss";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Index from "./routes";

import { registerSW } from "virtual:pwa-register";

registerSW({
    immediate: true,
});

declare global {
    interface BeforeInstallPromptEvent extends Event {
        prompt: () => Promise<void>;
        userChoice: Promise<{
            outcome: "accepted" | "dismissed";
            platform: string;
        }>;
    }
}

function App() {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        const handler = (
            e: BeforeInstallPromptEvent,
        ) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener(
            "beforeinstallprompt",
            handler as EventListener,
        );

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handler as EventListener,
            );
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();

        const choice =
            await deferredPrompt.userChoice;

        console.log(choice.outcome);

        setDeferredPrompt(null);
    };

    return (
        <>
            <Index />

            {
                deferredPrompt && (
                    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-white border rounded-xl shadow-xl p-4 z-50" >
                        <div className="flex items-center gap-4" >
                            <div>
                                <h3 className="font-semibold" >
                                    Cài ứng dụng
                                </h3>

                                < p className="text-sm text-gray-500" >
                                    Thêm app vào màn hình chính
                                </p>
                            </div>

                            < button
                                onClick={handleInstall}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                            >
                                Cài đặt
                            </button>
                        </div>
                    </div>
                )
            }
        </>
    );
}

const root = createRoot(
    document.getElementById("app")!,
);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);