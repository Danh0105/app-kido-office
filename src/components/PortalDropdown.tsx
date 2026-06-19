import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";

import {
  Bell,
  FileText,
  Lightbulb,
  ClipboardList,
  CalendarDays,
  ChevronDown,
  User,
  Calendar,
} from "lucide-react";

import { getEmployeeRole } from "@/utils/auth";
import { reportNotificationApi } from "@/service/notification";

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

type SenderGroup = {
  senderId: number;
  senderName: string;
  count: number;
  unreadCount: number;
  latestAt: string;
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
    {
      key: "REPORT" as NotificationType,
      icon: ClipboardList,
      count: unreadReportCount,
      activeClass: "bg-orange-100 text-orange-600",
    },
    ...(isEmployee
      ? []
      : [
          {
            key: "WEEKLY_PLAN" as NotificationType,
            icon: CalendarDays,
            count: unreadPlanCount,
            activeClass: "bg-purple-100 text-purple-600",
          },
        ]),
  ];

  // =================== REPORT GROUPED (director) ===================
  type DaySection = {
    date: string;
    groups: SenderGroup[];
  };

  const [daySections, setDaySections] = useState<DaySection[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [loadingMoreDays, setLoadingMoreDays] = useState(false);
  const [expandedSender, setExpandedSender] = useState<string | null>(null);
  const [senderNotifications, setSenderNotifications] = useState<
    Record<string, Notification[]>
  >({});
  const [senderLoading, setSenderLoading] = useState<string | null>(null);

  const isDirectorReport = typeTab === "REPORT" && !isEmployee;

  const toDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const fetchGroupsForDate = useCallback(
    async (date: string) => {
      const res = await reportNotificationApi.getGrouped(tab, date);
      return { date: res.date || date, groups: res.data || [] } as DaySection;
    },
    [tab],
  );

  useEffect(() => {
    if (isDirectorReport && open) {
      const loadToday = async () => {
        setGroupsLoading(true);
        setDaySections([]);
        setExpandedSender(null);
        setSenderNotifications({});
        try {
          const today = toDateString(new Date());
          const section = await fetchGroupsForDate(today);
          setDaySections([section]);

          const first = section.groups.find((g: SenderGroup) => g.count > 0);
          if (first) {
            const key = senderKey(first.senderId, section.date);
            setExpandedSender(key);
            setSenderLoading(key);
            try {
              const res = await reportNotificationApi.getBySender(
                first.senderId, 1, 50, tab, section.date,
              );
              setSenderNotifications({ [key]: res.data || [] });
            } finally {
              setSenderLoading(null);
            }
          }
        } catch (err) {
          console.error("Failed to fetch grouped reports:", err);
        } finally {
          setGroupsLoading(false);
        }
      };
      loadToday();
    }
  }, [isDirectorReport, open, tab, fetchGroupsForDate]);

  const handleLoadMoreDays = async () => {
    if (loadingMoreDays || daySections.length === 0) return;
    setLoadingMoreDays(true);
    try {
      const lastDate = daySections[daySections.length - 1].date;
      const prev = new Date(lastDate);
      prev.setDate(prev.getDate() - 1);
      const section = await fetchGroupsForDate(toDateString(prev));
      setDaySections((s) => [...s, section]);
    } catch (err) {
      console.error("Failed to load more days:", err);
    } finally {
      setLoadingMoreDays(false);
    }
  };

  const senderKey = (senderId: number, date: string) => `${senderId}_${date}`;

  const handleToggleSender = async (
    senderId: number,
    date: string,
    count: number,
  ) => {
    const key = senderKey(senderId, date);
    if (expandedSender === key) {
      setExpandedSender(null);
      return;
    }

    setExpandedSender(key);

    if (count === 0) return;
    if (senderNotifications[key]) return;

    setSenderLoading(key);
    try {
      const res = await reportNotificationApi.getBySender(
        senderId,
        1,
        50,
        tab,
        date,
      );
      setSenderNotifications((prev) => ({
        ...prev,
        [key]: res.data || [],
      }));
    } catch (err) {
      console.error("Failed to fetch sender notifications:", err);
    } finally {
      setSenderLoading(null);
    }
  };

  // =================== HOOKS GUARD ===================

  useEffect(() => {
    if (isEmployee && typeTab === "WEEKLY_PLAN") {
      setTypeTab("POLICY");
    }
  }, [isEmployee, typeTab]);

  const filtered =
    tab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications.filter((n) => n.isRead);

  const typeFiltered = filtered.filter((n) => n.type === typeTab);

  if (!open) return null;

  const handleLoadMore = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    await loadMore(typeTab);
    setLoadingMore(false);
  };

  // =================== RENDER ===================

  const renderNotificationItem = (n: Notification) => (
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
        <p className="text-[13px] leading-tight line-clamp-3">{n.message}</p>

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
  );

  const formatDayLabel = (dateStr: string) => {
    const today = toDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);

    if (dateStr === today) return "Hôm nay";
    if (dateStr === yesterdayStr) return "Hôm qua";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const renderSenderCard = (group: SenderGroup, date: string) => {
    const key = senderKey(group.senderId, date);
    const isOpen = expandedSender === key;
    const items = senderNotifications[key];
    const isLoadingItems = senderLoading === key;

    return (
      <div
        key={key}
        className={`rounded-xl border overflow-hidden ${
          group.count > 0 ? "border-orange-200" : "border-gray-200"
        }`}
      >
        <button
          onClick={() =>
            handleToggleSender(group.senderId, date, group.count)
          }
          className={`w-full flex items-center gap-2 px-3 py-2 transition ${
            group.count > 0
              ? "bg-orange-50 hover:bg-orange-100"
              : "bg-gray-50 hover:bg-gray-100"
          }`}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              group.count > 0 ? "bg-orange-200" : "bg-gray-200"
            }`}
          >
            <User
              className={`w-4 h-4 ${
                group.count > 0 ? "text-orange-600" : "text-gray-400"
              }`}
            />
          </div>

          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-medium truncate block">
              {group.senderName}
            </span>
            <span className="text-[11px] text-gray-400">
              {group.count > 0
                ? `${group.unreadCount} chưa đọc / ${group.count} thông báo`
                : "Chưa gửi báo cáo"}
            </span>
          </div>

          {group.unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">
              {group.unreadCount}
            </span>
          )}

          {group.count > 0 && (
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          )}
        </button>

        {isOpen && group.count > 0 && (
          <div className="divide-y divide-orange-100">
            {isLoadingItems && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {items?.map((n) => (
              <div
                key={n.id}
                onClick={() => onClickNotification(n)}
                className={`px-3 py-2 cursor-pointer transition ${
                  n.isRead
                    ? "bg-white hover:bg-gray-50"
                    : "bg-orange-50/50 hover:bg-orange-100/50"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <p className="text-[13px] leading-tight line-clamp-2">
                    {n.message}
                  </p>
                  {!n.isRead && (
                    <span className="w-2 h-2 bg-red-500 rounded-full mt-1 flex-shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {new Date(n.createdAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDirectorReportGroups = () => {
    if (groupsLoading && daySections.length === 0) {
      return (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (daySections.length === 0) {
      return (
        <p className="text-center text-sm text-gray-400 py-6">
          Không có thông báo
        </p>
      );
    }

    return (
      <>
        {daySections.map((section) => (
          <div key={section.date}>
            <div className="flex items-center gap-1.5 px-2 py-1.5 sticky top-0 bg-white z-[1]">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-semibold text-orange-600">
                {formatDayLabel(section.date)}
              </span>
            </div>

            <div className="space-y-1">
              {section.groups.map((group) =>
                renderSenderCard(group, section.date),
              )}
            </div>
          </div>
        ))}

        <button
          onClick={handleLoadMoreDays}
          disabled={loadingMoreDays}
          className="w-full py-2.5 text-orange-500 text-sm font-medium flex items-center justify-center gap-1 hover:bg-orange-50 rounded-lg transition"
        >
          {loadingMoreDays ? (
            <>
              <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              Đang tải...
            </>
          ) : (
            "Xem thêm ngày trước"
          )}
        </button>
      </>
    );
  };

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
            {isDirectorReport ? (
              renderDirectorReportGroups()
            ) : (
              <>
                {typeFiltered.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-6">
                    Không có thông báo
                  </p>
                )}

                {typeFiltered.map(renderNotificationItem)}

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
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
