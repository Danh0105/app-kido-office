import { useEffect, useRef, useState } from "react";
import { Bell, Maximize2, Minimize2 } from "lucide-react";
import { createPortal } from "react-dom";

import { useAppNotifications } from "@/hook/useAppNotifications";
import NotificationDropdown from "@/components/PortalDropdown";
import ReportDetailPopup from "@/components/ReportDetailPopup";

/**
 * Chuông thông báo dùng lại được ở bất kỳ header nào — tách khỏi
 * `layout/Header.tsx` (nơi bọc theo bố cục trang chủ) để gắn được vào
 * `HeaderWithBack`, nơi các trang con của module Giảng dạy, Chính sách, Đề
 * xuất chi… đang dùng.
 *
 * Trên desktop: thêm nút mở rộng để xem thông báo ở dạng modal lớn fullscreen
 * thay vì dropdown nhỏ (giữ nguyên dropdown nhỏ trên mobile).
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    tab,
    setTab,
    notifications,
    notificationStats,
    hasMore,
    loadMore,
    onClickNotification,
    expenseRefreshVersion,
    refreshExpenseNotifications,
    teachingNotificationsOnly,
    selectedReportId,
    setSelectedReportId,
  } = useAppNotifications();

  // Bell này luôn giới hạn 1 tab "Giảng dạy" (`onlyTeachingTab` bên dưới) nên
  // badge phải đếm đúng tab đó — `unreadCount` của hook là tổng toàn tài
  // khoản (Chính sách, Đề xuất…), hiện lên sẽ lệch với nội dung dropdown.
  const teachingUnreadCount = teachingNotificationsOnly
    ? notificationStats.POLICY?.unread ?? 0
    : notificationStats.TEACHING?.unread ?? 0;

  useEffect(() => {
    if (!open || isExpanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, isExpanded]);

  // Chỉnh vị trí dropdown khi expanded — dùng CSS data-attribute
  useEffect(() => {
    if (isExpanded) {
      document.documentElement.setAttribute("data-notification-expanded", "true");
    } else {
      document.documentElement.removeAttribute("data-notification-expanded");
    }
    return () => {
      document.documentElement.removeAttribute("data-notification-expanded");
    };
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [isExpanded]);

  return (
    <>
      <style>{`
        /* Khi expanded, chỉnh vị trí dropdown từ góc phải sang trung tâm */
        html[data-notification-expanded="true"] .fixed.top-0.right-0 {
          left: 50% !important;
          right: auto !important;
          top: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 90vw !important;
          max-width: 560px !important;
          height: 80vh !important;
          border-radius: 1.5rem !important;
          border-l: none !important;
        }

        html[data-notification-expanded="true"] .fixed.inset-0 {
          z-index: 9997 !important;
        }
      `}</style>

      <div className="relative" ref={bellRef}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          title="Thông báo"
          className="relative flex items-center justify-center gap-1.5 text-blue-600 bg-white px-2.5 py-1.5 rounded-xl font-medium text-sm active:scale-95 transition shadow-sm"
        >
          <Bell className="w-4 h-4" />
          {teachingUnreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none px-1.5 py-1 rounded-full">
              {teachingUnreadCount > 99 ? "99+" : teachingUnreadCount}
            </span>
          )}
        </button>

        {/* Dropdown — compact trên mobile/desktop, expanded di chuyển vào center khi click expand */}
        {open && (
          <>
            <NotificationDropdown
              teachingNotificationsOnly={teachingNotificationsOnly}
              onlyTeachingTab
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

            {/* Nút mở rộng — chỉ hiện trên desktop, dán vào style của NotificationDropdown */}
            {!isExpanded &&
              createPortal(
                <button
                  onClick={() => {
                    setIsExpanded(true);
                    setOpen(false);
                  }}
                  title="Mở rộng"
                  className="hidden lg:flex fixed w-7 h-7 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                  style={{
                    top: "calc(100vh - 320px + 8px)",
                    right: "12px",
                    zIndex: 10000,
                  }}
                >
                  <Maximize2 size={14} />
                </button>,
                document.body
              )}

            {/* Nút thu nhỏ khi expanded — dán vào style của NotificationDropdown expanded */}
            {isExpanded &&
              createPortal(
                <button
                  onClick={() => setIsExpanded(false)}
                  title="Thu nhỏ"
                  className="hidden lg:flex fixed w-8 h-8 items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition"
                  style={{
                    top: "calc(50% - 40vh + 12px)",
                    left: "calc(50% + 260px)",
                    zIndex: 10000,
                  }}
                >
                  <Minimize2 size={16} />
                </button>,
                document.body
              )}
          </>
        )}
      </div>

      {selectedReportId && (
        <ReportDetailPopup
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
        />
      )}
    </>
  );
}
