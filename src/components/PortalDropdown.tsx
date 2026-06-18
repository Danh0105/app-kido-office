import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import {
  Bell,
  FileText,
  Lightbulb,
  ClipboardList,
  CalendarDays,
} from "lucide-react";

import { getEmployeeRole } from "@/utils/auth";

type NotificationType = "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN";
type TabType = "unread" | "read";

type Notification = {
  id: number;
  type: NotificationType;
  entityId?: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  createdBy: number;
  senderId: number;
  meta?: {
    regionName?: string;
    schoolName?: string;
    schoolYear?: string;
    subjectName?: string;
  };
};

type Props = {
  open: boolean;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  notifications: Notification[];
  loadMore: (typeTab: NotificationType) => void;
  tab: TabType;
  setTab: (tab: TabType) => void;
  hasMore: Record<NotificationType, Record<TabType, boolean>>;
  notificationStats: Record<NotificationType, Record<TabType, number>>;
  onClickNotification: (n: Notification) => void;
};

export default function NotificationDropdown({
  open,
  dropdownRef,
  notifications,
  loadMore,
  tab,
  setTab,
  hasMore,
  notificationStats,
  onClickNotification,
}: Props) {
  console.log(notificationStats);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeTab, setTypeTab] = useState<NotificationType>("POLICY");

  const role = getEmployeeRole();
  const isEmployee = role === "employee";

  const unreadPolicyCount = notificationStats?.POLICY.unread;
  const unreadSuggestCount = notificationStats?.SUGGEST.unread;
  const unreadReportCount = notificationStats?.REPORT.unread;
  const unreadPlanCount = notificationStats?.WEEKLY_PLAN.unread;

  const notificationMenus: {
    key: NotificationType;
    icon: any;
    count: number;
    activeClass: string;
  }[] = [
    {
      key: "POLICY",
      icon: FileText,
      count: unreadPolicyCount,
      activeClass: "bg-blue-100 text-blue-600",
    },
    {
      key: "SUGGEST",
      icon: Lightbulb,
      count: unreadSuggestCount,
      activeClass: "bg-green-100 text-green-600",
    },
    ...(isEmployee
      ? []
      : [
          {
            key: "REPORT" as NotificationType,
            icon: ClipboardList,
            count: unreadReportCount,
            activeClass: "bg-orange-100 text-orange-600",
          },
          {
            key: "WEEKLY_PLAN" as NotificationType,
            icon: CalendarDays,
            count: unreadPlanCount,
            activeClass: "bg-purple-100 text-purple-600",
          },
        ]),
  ];

  useEffect(() => {
    if (isEmployee && (typeTab === "REPORT" || typeTab === "WEEKLY_PLAN")) {
      setTypeTab("POLICY");
    }
  }, [isEmployee, typeTab]);

  if (!open) return null;

  const handleLoadMore = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    await loadMore(typeTab);
    setLoadingMore(false);
  };

  const filtered =
    tab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications.filter((n) => n.isRead);

  const typeFiltered = filtered.filter((n) => n.type === typeTab);

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[9998]"
        onClick={() =>
          document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
        }
      />

      <div
        ref={dropdownRef}
        className="fixed top-0 right-0 w-[95%] max-w-[380px] h-[75dvh] bg-white z-[9999]
        rounded-l-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-white shadow-sm sticky top-0 z-10">
          <Bell className="w-5 h-5 text-blue-500" />
          <span className="font-semibold">Thông báo</span>
        </div>

        <div className="flex text-sm border-b">
          {["unread", "read"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as TabType)}
              className={`flex-1 py-3 font-medium transition ${
                tab === t
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-gray-400"
              }`}
            >
              {t === "unread" ? "Chưa đọc" : "Đã đọc"}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-16 border-r bg-gray-50 flex flex-col items-center py-2 gap-3">
            {notificationMenus.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  onClick={() => setTypeTab(item.key)}
                  className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
                    typeTab === item.key ? item.activeClass : "text-gray-400"
                  }`}
                >
                  <Icon size={18} />

                  {item.count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 rounded-full">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-1 space-y-1">
            {typeFiltered.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">
                Không có thông báo
              </p>
            )}

            {typeFiltered.map((n) => (
              <div
                key={n.id}
                onClick={() => onClickNotification(n)}
                className={`p-1 rounded-lg transition cursor-pointer ${
                  n.isRead
                    ? "bg-white border"
                    : typeTab === "POLICY"
                    ? "bg-blue-50 border-blue-100"
                    : typeTab === "SUGGEST"
                    ? "bg-green-50 border-green-100"
                    : typeTab === "REPORT"
                    ? "bg-orange-50 border-orange-100"
                    : "bg-purple-50 border-purple-100"
                } hover:shadow-md`}
              >
                <div className="flex justify-between gap-2">
                  <p className="text-[13px] leading-tight line-clamp-3">
                    {n.message}
                  </p>

                  {!n.isRead && (
                    <span className="w-2 h-2 bg-red-500 rounded-full mt-1" />
                  )}
                </div>

                <div className="text-xs text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {n.meta?.regionName && (
                    <span className="px-2 py-[2px] text-[10px] bg-purple-100 text-purple-600 rounded-full">
                      {n.meta.regionName}
                    </span>
                  )}

                  {n.meta?.schoolName && (
                    <span className="px-2 py-[2px] text-[10px] bg-blue-100 text-blue-600 rounded-full">
                      {n.meta.schoolName}
                    </span>
                  )}

                  {n.meta?.schoolYear && (
                    <span className="px-2 py-[2px] text-[10px] bg-orange-100 text-orange-600 rounded-full">
                      {n.meta.schoolYear}
                    </span>
                  )}

                  {n.meta?.subjectName && (
                    <span className="px-2 py-[2px] text-[10px] bg-green-100 text-green-600 rounded-full">
                      {n.meta.subjectName}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {hasMore[typeTab][tab] && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 text-blue-500 text-sm font-medium flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    Đang tải...
                  </>
                ) : (
                  "Xem thêm"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
