import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { HomeIcon, ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";
import { getHomePath, PROFILE_PATH } from "@/utils/nav";
import NotificationBell from "@/components/NotificationBell";
import {
    isDirectorBrandUiEnabled,
    isEmployeeBrandUiEnabled,
} from "@/utils/directorUi";
type Props = {
    title?: string;
    /** Mặc định tắt — chỉ bật ở nơi đã sẵn sàng nhận thêm nút chuông, tránh đổi giao diện hàng loạt trang đang dùng header này. */
    showNotifications?: boolean;
    /**
     * Desktop brand pages có sidebar cố định 286px thì header cần chừa phần đó.
     * Mọi trang dưới /director/* đã được `DirectorBrandShell` bọc ở tầng route
     * nên tự bật; prop này chỉ còn dùng cho trang ngoài nhánh đó.
     */
    brandSidebarInset?: boolean;
};

export default function HeaderWithBack({ title = "Danh sách trường", showNotifications = false, brandSidebarInset = false }: Props) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isBrand =
        isDirectorBrandUiEnabled() ||
        (pathname.startsWith("/employee/") && isEmployeeBrandUiEnabled());
    const useSidebarInset =
        isBrand &&
        (brandSidebarInset ||
            pathname.startsWith("/director/") ||
            pathname.startsWith("/employee/"));

    const goHome = () => {
        navigate(getHomePath());
    };

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            CapacitorApp.exitApp();
        }
    };

    // 👉 Handle back button (Android hardware)
    useEffect(() => {
        let handler: any;

        const setup = async () => {
            handler = await CapacitorApp.addListener("backButton", goBack);
        };

        setup();

        return () => {
            handler?.remove();
        };
    }, [navigate]);

    return (
        <div
            className={`fixed top-0 left-0 w-full h-14 flex items-center px-4 z-50 shadow ${
                isBrand
                    ? `bg-white/95 border-b border-blue-900/10 text-[#0047B8] ${useSidebarInset ? "lg:left-[var(--brand-sidebar-w,286px)] lg:w-[calc(100%-var(--brand-sidebar-w,286px))] transition-[left,width] duration-200" : ""}`
                    : "bg-blue-500 text-white"
            }`}
        >

            {/* Back */}
            <div className="flex items-center gap-2">
                <button onClick={goBack} className={isBrand ? "text-[#0047B8]" : "text-white"}>
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>

                <h1 className={`font-semibold text-base ${isBrand ? "text-[#0047B8]" : "text-white"}`}>
                    {decodeURIComponent(title)}
                </h1>
            </div>
            {/* Title */}


            {/* Home + Thông báo + Cá nhân */}
            <div className="ml-auto flex items-center gap-2">
                <button
                    onClick={goHome}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm active:scale-95 transition shadow-sm ${
                        isBrand
                            ? "text-[#0047B8] bg-[#FFFDF2] border border-blue-900/10 hover:bg-blue-50"
                            : "text-blue-600 bg-white"
                    }`}
                >
                    <HomeIcon className="w-4 h-4" />
                    Trang chủ
                </button>

                {showNotifications && <NotificationBell />}

                {/*
                    Desktop không còn thanh điều hướng dưới (ẩn từ lg) nên trang
                    cá nhân cần lối vào ngay trên header.
                */}
                <button
                    onClick={() => navigate(PROFILE_PATH)}
                    title="Trang cá nhân"
                    className={`hidden lg:flex items-center gap-1.5 border px-3 py-1.5 rounded-xl font-medium text-sm active:scale-95 transition ${
                        isBrand
                            ? "text-[#0047B8] border-blue-900/10 hover:bg-blue-50"
                            : "text-white border-white/60 hover:bg-white/15"
                    }`}
                >
                    <UserIcon className="w-4 h-4" />
                    Cá nhân
                </button>
            </div>
        </div>
    );
}
