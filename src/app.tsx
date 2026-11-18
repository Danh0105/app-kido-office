import "./css/tailwind.scss";
import "./css/directorBrand.css";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import Index from "./routes";
import DevRoleSwitcher from "./components/DevRoleSwitcher";
import { initWebPush } from "./utils/webPush";

import { registerSW } from "virtual:pwa-register";

// Khi service worker mới tiếp quản, trang hiện tại vẫn đang chạy bundle cũ đã
// nạp vào bộ nhớ. Tải lại đúng một lần để tránh tiếp tục gọi code lỗi thời sau
// khi production đã được cập nhật.
if ("serviceWorker" in navigator) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;

        refreshing = true;
        window.location.reload();
    });
}

registerSW({
    immediate: true,
});

function App() {
    // Không mời cài app: chặn luôn thanh gợi ý "Thêm vào màn hình chính" mặc
    // định của trình duyệt (Chrome Android). Vẫn cài được qua menu trình duyệt.
    useEffect(() => {
        const handler = (e: Event) => e.preventDefault();

        window.addEventListener("beforeinstallprompt", handler);

        return () => {
            window.removeEventListener("beforeinstallprompt", handler);
        };
    }, []);

    // Cập nhật cả registration Firebase cũ của người vẫn còn phiên đăng nhập.
    // Nếu chỉ gọi sau submit Login, các máy đã lưu token sẽ không bao giờ thay
    // worker URL trần bằng worker có query config cho tới khi đăng nhập lại.
    useEffect(() => {
        if (!localStorage.getItem("access_token")) return;

        void initWebPush().catch((error) => {
            console.warn("Web push initialization failed on app startup:", error);
        });
    }, []);

    return (
        <>
            <Index />
            <DevRoleSwitcher />
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
