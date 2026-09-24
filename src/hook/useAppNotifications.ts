import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSocket } from "@/utils/socket";
import { hasRole } from "@/utils/auth";
import { canViewTeaching, isTeacher } from "@/pages/Teaching/lib";
import {
  isTeachingAlertType,
  isTeachingScheduleNotification,
  TEACHING_ALERT_TYPES,
  teachingReplacementPath,
} from "@/utils/teachingNotification";
import {
  notificationApi,
  policyNotificationApi,
  reportNotificationApi,
  teachingAlertNotificationApi,
  teachingScheduleNotificationApi,
  weeklyPlanNotificationApi,
} from "@/service/notification";
import { expenseNotificationApi } from "@/service/expenseRequest";
import { policiesApi } from "@/service/policy";

export type NotificationCategory =
  | "POLICY"
  | "SUGGEST"
  | "REPORT"
  | "WEEKLY_PLAN"
  | "TEACHING";
export type NotificationTab = "unread" | "read";

type PageState = Record<NotificationCategory, Record<NotificationTab, number>>;
type HasMoreState = Record<
  NotificationCategory,
  Record<NotificationTab, boolean>
>;
type StatsState = Record<
  NotificationCategory,
  { unread: number; read: number }
>;

const LIMIT = 5;

const emptyPage = (): PageState => ({
  POLICY: { unread: 1, read: 1 },
  SUGGEST: { unread: 1, read: 1 },
  REPORT: { unread: 1, read: 1 },
  WEEKLY_PLAN: { unread: 1, read: 1 },
  TEACHING: { unread: 1, read: 1 },
});

const emptyHasMore = (): HasMoreState => ({
  POLICY: { unread: true, read: true },
  SUGGEST: { unread: true, read: true },
  REPORT: { unread: true, read: true },
  WEEKLY_PLAN: { unread: true, read: true },
  TEACHING: { unread: true, read: true },
});

const emptyStats = (): StatsState => ({
  POLICY: { unread: 0, read: 0 },
  SUGGEST: { unread: 0, read: 0 },
  REPORT: { unread: 0, read: 0 },
  WEEKLY_PLAN: { unread: 0, read: 0 },
  TEACHING: { unread: 0, read: 0 },
});

/**
 * Chuông thông báo dùng chung — rút ra từ 2 bản gần như trùng nhau trong
 * Director/Home.tsx và Employee/Home.tsx (lệch nhau vài chỗ do đã copy-paste
 * qua thời gian) để dùng lại được ở nơi thứ ba: header của module Giảng dạy.
 *
 * "employee" (nhân viên Sales) và các role còn lại (director, nhân sự, giáo
 * vụ, giáo viên, kế toán…) có luồng dữ liệu khác nhau — nhánh theo đúng cách
 * `hasRole("employee")` đã được dùng để tách 2 cây route /employee và
 * /director trong toàn bộ app, không suy theo URL vì module Giảng dạy nằm ở
 * route riêng (/nhan-su, /giao-vien), không thuộc cây nào trong 2 cây đó.
 */
export function useAppNotifications() {
  const navigate = useNavigate();
  const isEmployeeRole = hasRole("employee", "sales");
  const isTeachingManager = hasRole("nhansu", "giaovu");
  const teachingNotificationsOnly = isTeacher() && !canViewTeaching();
  const isSuggestOnlyRole =
    !isEmployeeRole &&
    hasRole(
      "accountant",
      "ketoan_congno",
      "ketoan_truong",
      "troly_gd",
      // Phòng kỹ thuật chỉ nhận thông báo đề xuất chi (nhánh thiết bị).
      "ky_thuat",
    );

  const [tab, setTab] = useState<NotificationTab>("unread");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationStats, setNotificationStats] = useState<StatsState>(
    emptyStats()
  );
  const [page, setPage] = useState<PageState>(emptyPage());
  const [hasMore, setHasMore] = useState<HasMoreState>(emptyHasMore());
  const [loadingMore, setLoadingMore] = useState(false);
  const [expenseRefreshVersion, setExpenseRefreshVersion] = useState(0);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const realtimeIdsRef = useRef(new Set<number>());

  // Badge trên chuông phải là TỔNG số chưa đọc thật của tài khoản, không phải
  // đếm trên danh sách đã tải: mỗi loại thông báo chỉ tải tối đa `LIMIT` (hoặc
  // 100 với riêng lịch dạy) cho một trang, nên đếm trên mảng đó luôn bị chặn
  // trần ở đúng số đã tải — sai ngay khi có nhiều hơn thế. `GET
  // /notifications/unread-count` đếm thẳng trên toàn bộ bản ghi theo
  // receiverId, không lọc theo loại/trang.
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await notificationApi.getUnreadCount());
    } catch (error) {
      console.error("Failed to load unread notification count:", error);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  const statsKeyOf = useCallback(
    (type: string): NotificationCategory | null => {
      if (["POLICY", "SUGGEST", "REPORT", "WEEKLY_PLAN"].includes(type)) {
        return type as NotificationCategory;
      }
      if (isTeachingAlertType(type)) return "TEACHING";
      return teachingNotificationsOnly ? "POLICY" : null;
    },
    [teachingNotificationsOnly]
  );

  // ================= STATS =================
  const loadNotificationStats = useCallback(async () => {
    if (teachingNotificationsOnly) return;
    const [statsRes, expenseSummary] = await Promise.all([
      notificationApi.getStats(),
      expenseNotificationApi.getSummary().catch(() => null),
    ]);
    const nextStats = statsRes.types || statsRes;
    if (expenseSummary) {
      const expenseTotal =
        expenseSummary.general.total + expenseSummary.overdue.total;
      const expenseUnread =
        expenseSummary.general.unread + expenseSummary.overdue.unread;
      nextStats.SUGGEST = {
        unread: expenseUnread,
        read: Math.max(0, expenseTotal - expenseUnread),
      };
    }
    if (isTeachingManager) {
      // BE trả riêng từng type con (TEACHING_SCHEDULE_CONFIRM_RESULT…), không
      // có khoá "TEACHING" gộp — cộng lại ở đây, giống cách SUGGEST gộp từ expense.
      nextStats.TEACHING = TEACHING_ALERT_TYPES.reduce(
        (sum, type) => ({
          unread: sum.unread + (nextStats[type]?.unread || 0),
          read: sum.read + (nextStats[type]?.read || 0),
        }),
        { unread: 0, read: 0 }
      );
    }
    setNotificationStats(nextStats);
  }, [teachingNotificationsOnly, isTeachingManager]);

  const refreshExpenseNotifications = useCallback(async () => {
    setExpenseRefreshVersion((version) => version + 1);
    try {
      await loadNotificationStats();
    } catch (error) {
      console.error("Failed to refresh expense notification stats:", error);
    }
  }, [loadNotificationStats]);

  useEffect(() => {
    refreshExpenseNotifications();
  }, [refreshExpenseNotifications]);

  // ================= LOAD LIST =================
  useEffect(() => {
    let alive = true;

    const load = async () => {
      setNotifications([]);

      if (teachingNotificationsOnly) {
        // Endpoint riêng đã trả đúng thông báo lịch dạy (kể cả bản cũ lưu kiểu
        // SYSTEM); lọc thêm ở FE chỉ để chắc chắn với dữ liệu quá cũ.
        const response = await teachingScheduleNotificationApi.getAll(
          1,
          100,
          tab
        );
        if (!alive) return;
        const teachingItems = (response.data || []).filter(
          isTeachingScheduleNotification
        );
        setNotifications(teachingItems);
        setNotificationStats((prev) => ({
          ...prev,
          POLICY: {
            unread: teachingItems.filter((item: any) => !item.isRead).length,
            read: teachingItems.filter((item: any) => item.isRead).length,
          },
          SUGGEST: { unread: 0, read: 0 },
          REPORT: { unread: 0, read: 0 },
          WEEKLY_PLAN: { unread: 0, read: 0 },
        }));
        setHasMore((prev) => ({
          ...prev,
          POLICY: { ...prev.POLICY, [tab]: false },
        }));
        return;
      }

      const requests = isSuggestOnlyRole
        ? [expenseNotificationApi.getAll(1, LIMIT, tab, { scope: "all" })]
        : [
            policyNotificationApi.getAll(1, LIMIT, tab),
            expenseNotificationApi.getAll(1, LIMIT, tab, { scope: "all" }),
          ];
      if (!isSuggestOnlyRole && !isEmployeeRole) {
        requests.push(
          reportNotificationApi.getAll(1, LIMIT, tab),
          weeklyPlanNotificationApi.getAll(1, LIMIT, tab)
        );
      } else if (isEmployeeRole) {
        requests.push(reportNotificationApi.getAll(1, LIMIT, tab));
      }
      // Xác nhận lịch dạy + báo giảng: chỉ Nhân sự/Giáo vụ thực sự nhận được.
      if (hasRole("nhansu", "giaovu")) {
        requests.push(
          ...TEACHING_ALERT_TYPES.map((type) =>
            teachingAlertNotificationApi.getAll(type, 1, LIMIT, tab)
          )
        );
      }
      const responses = await Promise.all(requests);
      if (!alive) return;
      const merged = responses.flatMap((item: any) => item.data || []);
      setNotifications(merged);
      setPage(emptyPage());
    };

    load();

    return () => {
      alive = false;
    };
  }, [tab, isSuggestOnlyRole, isEmployeeRole, teachingNotificationsOnly]);

  // ================= SOCKET =================
  useEffect(() => {
    const socket = getSocket();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user?.id) return;

    const handleConnect = () => socket.emit("notification:register", user.id);
    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleNew = (data: any) => {
      // Đếm lại từ server thay vì +1 thủ công: sự kiện này tới được đây nghĩa
      // là bản ghi đã tồn tại cho đúng người nhận, kể cả khi bị các bộ lọc bên
      // dưới loại khỏi danh sách hiển thị của vai trò này.
      loadUnreadCount();
      if (teachingNotificationsOnly && !isTeachingScheduleNotification(data))
        return;
      if (isSuggestOnlyRole && data.type !== "SUGGEST") return;
      if (realtimeIdsRef.current.has(data.id)) return;
      realtimeIdsRef.current.add(data.id);
      if (realtimeIdsRef.current.size > 500) {
        const oldestId = realtimeIdsRef.current.values().next().value;
        if (oldestId !== undefined) realtimeIdsRef.current.delete(oldestId);
      }

      setNotifications((prev) =>
        prev.find((n) => n.id === data.id) ? prev : [data, ...prev]
      );

      if (
        data.type === "SUGGEST" &&
        data.meta?.suggestType === "EXPENSE_REQUEST"
      ) {
        refreshExpenseNotifications();
        return;
      }
      const statsKey = statsKeyOf(data.type);
      if (statsKey) {
        setNotificationStats((prev) => ({
          ...prev,
          [statsKey]: { ...prev[statsKey], unread: prev[statsKey].unread + 1 },
        }));
      }
    };

    socket.on("policy-notification:new", handleNew);
    socket.on("suggest-notification:new", handleNew);
    socket.on("report-notification:new", handleNew);
    socket.on("notification:new", handleNew);
    socket.on("weekly-plan:new", handleNew);
    socket.on("teaching-schedule-notification:new", handleNew);
    socket.on("teaching-schedule-confirm-result:new", handleNew);
    socket.on("teaching-schedule-confirm-alert:new", handleNew);
    socket.on("teaching-lesson-report-alert:new", handleNew);
    socket.on("teacher-location-change-request:new", handleNew);
    socket.on("teaching-replacement-request:new", handleNew);

    return () => {
      socket.off("policy-notification:new", handleNew);
      socket.off("suggest-notification:new", handleNew);
      socket.off("report-notification:new", handleNew);
      socket.off("notification:new", handleNew);
      socket.off("weekly-plan:new", handleNew);
      socket.off("teaching-schedule-notification:new", handleNew);
      socket.off("teaching-schedule-confirm-result:new", handleNew);
      socket.off("teaching-schedule-confirm-alert:new", handleNew);
      socket.off("teaching-lesson-report-alert:new", handleNew);
      socket.off("teacher-location-change-request:new", handleNew);
      socket.off("teaching-replacement-request:new", handleNew);
    };
  }, [
    isSuggestOnlyRole,
    teachingNotificationsOnly,
    statsKeyOf,
    refreshExpenseNotifications,
    loadUnreadCount,
  ]);

  // ================= LOAD MORE =================
  const loadMore = async (type: NotificationCategory) => {
    if (loadingMore) return;
    const currentPage = page[type][tab];
    if (!hasMore[type][tab]) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      let newData: any[];
      let exhausted: boolean;

      switch (type) {
        case "POLICY": {
          const res = await policyNotificationApi.getAll(nextPage, LIMIT, tab);
          newData = res.data || [];
          exhausted = newData.length < LIMIT;
          break;
        }
        case "SUGGEST": {
          const res = await expenseNotificationApi.getAll(
            nextPage,
            LIMIT,
            tab,
            {
              scope: "all",
            }
          );
          newData = res.data || [];
          exhausted = newData.length < LIMIT;
          break;
        }
        case "REPORT": {
          const res = await reportNotificationApi.getAll(nextPage, LIMIT, tab);
          newData = res.data || [];
          exhausted = newData.length < LIMIT;
          break;
        }
        case "WEEKLY_PLAN": {
          const res = await weeklyPlanNotificationApi.getAll(
            nextPage,
            LIMIT,
            tab
          );
          newData = res.data || [];
          exhausted = newData.length < LIMIT;
          break;
        }
        case "TEACHING": {
          const responses = await Promise.all(
            TEACHING_ALERT_TYPES.map((alertType) =>
              teachingAlertNotificationApi.getAll(
                alertType,
                nextPage,
                LIMIT,
                tab
              )
            )
          );
          newData = responses.flatMap((res) => res.data || []);
          exhausted = responses.every((res) => (res.data || []).length < LIMIT);
          break;
        }
        default:
          return;
      }

      const visibleData = teachingNotificationsOnly
        ? newData.filter(isTeachingScheduleNotification)
        : newData;

      setNotifications((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        return [...prev, ...visibleData.filter((n) => !ids.has(n.id))];
      });
      setPage((prev) => ({
        ...prev,
        [type]: { ...prev[type], [tab]: nextPage },
      }));
      if (exhausted) {
        setHasMore((prev) => ({
          ...prev,
          [type]: { ...prev[type], [tab]: false },
        }));
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ================= CLICK =================
  const handleClickNotification = async (noti: any) => {
    const targetEntityId = noti.entityId || noti.meta?.suggestId;
    const replacementPath = teachingReplacementPath(noti);

    if (!noti.isRead) {
      try {
        if (
          noti.type === "SUGGEST" &&
          noti.meta?.suggestType === "EXPENSE_REQUEST"
        ) {
          await expenseNotificationApi.markAsRead(noti.id);
        } else {
          await notificationApi.markAsRead(noti.id);
        }
        setNotifications((prev) =>
          prev.map((n) => (n.id === noti.id ? { ...n, isRead: true } : n))
        );
        loadUnreadCount();
        if (
          noti.type === "SUGGEST" &&
          noti.meta?.suggestType === "EXPENSE_REQUEST"
        ) {
          refreshExpenseNotifications();
        } else {
          const statsKey = statsKeyOf(noti.type);
          if (statsKey) {
            setNotificationStats((prev) => ({
              ...prev,
              [statsKey]: {
                unread: Math.max(0, prev[statsKey].unread - 1),
                read: prev[statsKey].read + 1,
              },
            }));
          }
        }
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }

    if (teachingNotificationsOnly && isTeachingScheduleNotification(noti)) {
      navigate("/giao-vien/lich-day");
      return;
    }
    if (replacementPath) {
      navigate(replacementPath);
      return;
    }
    if (isTeachingAlertType(noti.type)) {
      // Popup duyệt đổi vị trí được PortalDropdown mở tại chỗ.
      if (
        noti.type === "TEACHER_LOCATION_CHANGE_REQUEST" ||
        noti.meta?.kind === "teacher_location_change_request"
      )
        return;
      // BE gửi route của màn danh sách duyệt yêu cầu đổi vị trí trong metadata.
      // Ưu tiên route này trước các route suy ra từ session/schedule.
      if (noti.meta?.route) {
        navigate(noti.meta.route);
        return;
      }
      // Mở thẳng popup chi tiết buổi/mẫu lịch thay vì chỉ điều hướng chung
      // chung — Chi tiết đã sẵn khung "đổi giáo viên" khi bị từ chối.
      if (noti.meta?.sessionId) {
        navigate(
          `/nhan-su/lich-day?tab=sessions&sessionId=${noti.meta.sessionId}`
        );
        return;
      }
      if (noti.meta?.scheduleId) {
        navigate(
          `/nhan-su/lich-day?tab=timetable&scheduleId=${noti.meta.scheduleId}`
        );
        return;
      }
      navigate("/nhan-su/cham-cong");
      return;
    }

    const base = isEmployeeRole ? "/employee" : "/director";
    if (!targetEntityId) return;

    switch (noti.type) {
      case "POLICY": {
        if (isEmployeeRole) {
          navigate(`${base}/policy/${targetEntityId}`);
        } else {
          const res = await policiesApi.findOne(targetEntityId);
          navigate(`${base}/policy/${targetEntityId}`, {
            state: { ...res, user: noti.senderId },
          });
        }
        break;
      }
      case "SUGGEST":
        navigate(
          noti.meta?.suggestType === "EXPENSE_REQUEST"
            ? `${base}/expense-requests/${targetEntityId}`
            : `${base}/expense-requests`
        );
        break;
      case "REPORT":
        if (noti.entityId) setSelectedReportId(noti.entityId);
        break;
      case "WEEKLY_PLAN":
        navigate(`/director/daily-report/${noti.senderId || noti.createdBy}`);
        break;
    }
  };

  return {
    tab,
    setTab,
    notifications,
    notificationStats,
    hasMore,
    loadMore,
    onClickNotification: handleClickNotification,
    expenseRefreshVersion,
    refreshExpenseNotifications,
    teachingNotificationsOnly,
    unreadCount,
    selectedReportId,
    setSelectedReportId,
  };
}
