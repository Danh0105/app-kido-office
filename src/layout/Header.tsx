import { Bell, ChevronDown, LayoutDashboard, Sparkles } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../static/Logo.png";
import NotificationDropdown from "@/components/PortalDropdown";
import { getEmployeeName } from "@/utils/auth";
import { PROFILE_PATH } from "@/utils/nav";

type Props = {
  appearance?: "classic" | "brand";
  uiVersion?: "classic" | "brand";
  onRequestNewInterface?: () => void;
  onSwitchClassicInterface?: () => void;
  teachingNotificationsOnly?: boolean;
  unreadCount?: number;
  notifications?: any[];
  loadMore: any;
  tab: "unread" | "read";
  setTab: (tab: "unread" | "read") => void;
  onClickNotification: (notification: any) => void | Promise<void>;
  expenseRefreshVersion: number;
  refreshExpenseNotifications: () => void | Promise<void>;
  hasMore: {
    POLICY: { unread: boolean; read: boolean };
    SUGGEST: { unread: boolean; read: boolean };
    REPORT: { unread: boolean; read: boolean };
    WEEKLY_PLAN: { unread: boolean; read: boolean };
    TEACHING: { unread: boolean; read: boolean };
  };
  notificationStats: Record<
    "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN" | "TEACHING",
    {
      unread: number;
      read: number;
    }
  >;
};

export default function AppHeader({
  appearance = "classic",
  uiVersion = "classic",
  onRequestNewInterface,
  onSwitchClassicInterface,
  teachingNotificationsOnly = false,
  unreadCount = 0,
  notifications = [],
  loadMore,
  tab,
  setTab,
  onClickNotification,
  expenseRefreshVersion,
  refreshExpenseNotifications,
  hasMore,
  notificationStats,
}: Props) {
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Tên đọc từ access token nên chỉ cần lấy một lần cho mỗi lần mount.
  const employeeName = useMemo(() => getEmployeeName() || "Cá nhân", []);

  // ================= CLICK OUTSIDE =================
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // Endpoint tổng bao gồm cả các type Giảng dạy mới; cộng thủ công theo bốn
  // nhóm cũ làm badge ở trang chủ luôn thiếu thông báo của Nhân sự/Giáo vụ.
  const totalUnread = unreadCount;
  const isBrand = appearance === "brand";
  const headerShellClass = isBrand
    ? "sticky top-0 z-50 bg-[#FFF8E6] border-b border-blue-900/10"
    : "sticky top-0 z-50 bg-gray-100 py-0 md:py-2";
  const headerClass = isBrand
    ? "w-full bg-white/95 text-[#0047B8] px-8 h-[94px] flex items-center justify-between shadow-sm"
    : `
            w-full md:max-w-6xl md:mx-auto

            bg-orange-500 text-white

            md:rounded-xl md:shadow

            px-4 md:px-6 lg:px-8

            h-16

            flex items-center justify-between
        `;
  return (
    <div className={headerShellClass}>
      <header className={headerClass}>
        {/* LEFT */}
        <div className="flex items-center gap-4">
          {!isBrand && (
            <img src={logo} className="h-12 w-auto object-contain" />
          )}
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {(onRequestNewInterface || onSwitchClassicInterface) && (
            <button
              onClick={
                uiVersion === "brand"
                  ? onSwitchClassicInterface
                  : onRequestNewInterface
              }
              className={`hidden lg:flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isBrand
                  ? "border-blue-900/15 bg-[#FFFDF2] text-[#0047B8] hover:bg-blue-50"
                  : "border-white/30 bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {uiVersion === "brand" ? (
                <LayoutDashboard size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              <span>
                {uiVersion === "brand" ? "Giao diện cũ" : "Giao diện mới"}
              </span>
            </button>
          )}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setOpen(!open)}
              title="Thông báo"
              aria-label="Mở thông báo"
              aria-expanded={open}
              className={`relative p-2 rounded-full transition flex items-center justify-center ${
                isBrand
                  ? "bg-[#FFFDF2] text-[#0047B8] border border-blue-900/10 shadow-sm hover:bg-blue-50"
                  : "hover:bg-white/20"
              }`}
            >
              <Bell size={20} />

              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 rounded-full">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </button>

            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-[320px] md:w-[380px] z-50">
              <NotificationDropdown
                teachingNotificationsOnly={teachingNotificationsOnly}
                open={open}
                dropdownRef={dropdownRef}
                notifications={notifications}
                loadMore={loadMore}
                tab={tab}
                setTab={setTab}
                hasMore={hasMore}
                notificationStats={notificationStats}
                onClickNotification={onClickNotification}
                expenseRefreshVersion={expenseRefreshVersion}
                onRefreshExpenseNotifications={refreshExpenseNotifications}
              />
            </div>
          </div>

          {/*
            Lối vào trang cá nhân trên desktop — mobile đã có thanh điều hướng
            dưới, thanh đó ẩn từ lg trở lên nên desktop cần nút riêng ở đây.
          */}
          <button
            onClick={() => navigate(PROFILE_PATH)}
            title="Trang cá nhân"
            className={`hidden lg:flex items-center gap-2 pl-1 pr-3 py-1 ml-1 rounded-full transition ${
              isBrand
                ? "bg-white border border-blue-900/10 text-[#0047B8] shadow-sm hover:bg-blue-50"
                : "hover:bg-white/20"
            }`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold uppercase ${
                isBrand ? "bg-[#005BEA] text-white" : "bg-white/25"
              }`}
            >
              {employeeName.charAt(0)}
            </span>
            <span className="text-sm font-medium max-w-[180px] truncate">
              {employeeName}
            </span>
            {isBrand && <ChevronDown size={16} className="text-[#78928c]" />}
          </button>
        </div>
      </header>
    </div>
  );
}
