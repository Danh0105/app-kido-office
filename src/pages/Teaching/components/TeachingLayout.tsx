import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  LayoutDashboard,
  Sparkles,
  User,
  X,
} from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import NotificationBell from "@/components/NotificationBell";
import BottomNav from "@/layout/BottomNav";
import { PROFILE_PATH, getHomePath } from "@/utils/nav";
import TimetableImportWidget from "./TimetableImportWidget";
import BrandSidebar from "@/pages/Director/components/BrandSidebar";
import { brandMenusForUser, isBrandMenuActive } from "@/utils/brandMenu";
import { brandHomeCopy, canUseDirectorBrandUi } from "@/utils/directorUi";

const TEACHING_UI_KEYS = [
  "kido.director.teachingDesktopHomeUi",
  "kido.employee.desktopHomeUi",
] as const;

type DesktopTeachingUi = "classic" | "brand";

// Giao diện mới là mặc định; chỉ về classic khi người dùng chủ động chọn.
const readDesktopTeachingUi = (): DesktopTeachingUi => {
  if (typeof window === "undefined") return "brand";
  return TEACHING_UI_KEYS.some((key) => localStorage.getItem(key) === "classic")
    ? "classic"
    : "brand";
};

const saveDesktopTeachingUi = (value: DesktopTeachingUi) => {
  TEACHING_UI_KEYS.forEach((key) => localStorage.setItem(key, value));
};

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop;
};

/**
 * Khung chung của module Giảng dạy.
 * Mobile: 1 cột sát mép như cũ. Desktop: dùng trọn bề ngang màn hình (chỉ
 * chừa padding) — lưới TKB/chấm công nhiều cột cần càng rộng càng đỡ cuộn.
 */
export default function TeachingLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const supportsBrandUi = canUseDirectorBrandUi();
  const [desktopUi, setDesktopUi] = useState<DesktopTeachingUi>(
    readDesktopTeachingUi,
  );
  const [showNewUiConfirm, setShowNewUiConfirm] = useState(false);

  const switchToBrand = () => {
    saveDesktopTeachingUi("brand");
    setDesktopUi("brand");
    setShowNewUiConfirm(false);
  };

  const switchToClassic = () => {
    saveDesktopTeachingUi("classic");
    setDesktopUi("classic");
    setShowNewUiConfirm(false);
  };

  if (isDesktop && supportsBrandUi && desktopUi === "brand") {
    return (
      <BrandTeachingLayout
        title={title}
        onSwitchClassic={switchToClassic}
      >
        {children}
      </BrandTeachingLayout>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title={title} showNotifications />

      {isDesktop && supportsBrandUi && (
        <button
          onClick={() => setShowNewUiConfirm(true)}
          className="fixed right-56 top-2.5 z-[60] hidden items-center gap-2 rounded-full border border-white/50 bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25 lg:flex"
        >
          <Sparkles size={16} />
          Giao diện mới
        </button>
      )}

      <div className="flex-1 mt-[60px] w-full px-3 md:px-6 xl:px-8 pb-28 md:pb-24 space-y-3">
        {children}
      </div>

      <BottomNav />
      <TimetableImportWidget />
      {showNewUiConfirm && (
          <NewInterfaceConfirmModal
          onClose={switchToClassic}
          onConfirm={switchToBrand}
        />
      )}
    </div>
  );
}

function BrandTeachingLayout({
  title,
  children,
  onSwitchClassic,
}: {
  title: string;
  children: ReactNode;
  onSwitchClassic: () => void;
}) {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const menus = brandMenusForUser();
  const workspaceLabel = brandHomeCopy().label;

  return (
    <div className="min-h-screen bg-[#FFF8E6] text-[#0047B8] flex">
      <BrandSidebar
        items={menus.map((item) => ({
          key: item.key,
          title: item.title,
          icon: item.icon,
          lucideIcon: item.lucideIcon,
          active: isBrandMenuActive(item, pathname, state),
          onClick: () => navigate(item.to, { state: { from: item.from } }),
        }))}
        onSwitchClassic={onSwitchClassic}
      />

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-50 flex h-[94px] items-center justify-between border-b border-blue-900/10 bg-white/95 px-8 text-[#0047B8] shadow-sm">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#B87500]">
              {workspaceLabel}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#0047B8]">
              {decodeURIComponent(title)}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSwitchClassic}
              className="flex items-center gap-2 rounded-full border border-blue-900/15 bg-[#FFFDF2] px-4 py-2 text-sm font-semibold text-[#0047B8] transition hover:bg-blue-50"
            >
              <LayoutDashboard size={16} />
              Giao diện cũ
            </button>
            <button
              onClick={() => navigate(getHomePath())}
              className="flex items-center gap-2 rounded-full border border-blue-900/15 bg-[#FFFDF2] px-4 py-2 text-sm font-semibold text-[#0047B8] transition hover:bg-blue-50"
            >
              <Home size={16} />
              Trang chủ
            </button>
            <NotificationBell />
            <button
              onClick={() => navigate(PROFILE_PATH)}
              title="Trang cá nhân"
              className="flex items-center gap-2 rounded-full border border-blue-900/10 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-[#0047B8] shadow-sm hover:bg-blue-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#005BEA] text-white">
                <User size={16} />
              </span>
              Cá nhân
            </button>
          </div>
        </header>

        <div className="w-full px-8 py-6 pb-24 space-y-4">{children}</div>
      </main>

      <TimetableImportWidget />
    </div>
  );
}

function NewInterfaceConfirmModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-blue-900/10 px-6 py-5">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#005BEA]">
              <Sparkles size={22} />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-[#0047B8]">
              Đổi sang giao diện mới?
            </h2>
            <p className="mt-2 text-sm text-[#5a6b85]">
              Giao diện mới sẽ áp dụng cho toàn bộ module nhân sự/giáo vụ trên desktop.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Để sau
          </button>
          <button
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#005BEA] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0047B8]"
          >
            Đồng ý
            <Sparkles size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
