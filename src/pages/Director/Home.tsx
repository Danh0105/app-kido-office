import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import BottomNav from "../../layout/BottomNav";
import AppHeader from "@/layout/Header";
import BannerSlider from "@/layout/Banner";
import ReportDetailPopup from "@/components/ReportDetailPopup";
import expense from "./static/expense.png";
import suggest from "./static/suggest.png";
import { getSocket, getSuggestSocket } from "../../utils/socket";
import { policiesApi } from "@/service/policy";

// assets
import policy from "./static/policy.png";
import HDKH2 from "./static/HDKH2.png";
import HDKH3 from "./static/HDKH3.png";
import report from "./static/report.png";
import {
  notificationApi,
  policyNotificationApi,
  reportNotificationApi,
  teachingAlertNotificationApi,
  teachingScheduleNotificationApi,
  weeklyPlanNotificationApi,
  type TeachingAlertType,
} from "@/service/notification";
import { expenseNotificationApi } from "@/service/expenseRequest";
import { subjectApi } from "@/service/subject.api";
import {
  schoolClassApi,
  teacherApi,
  teachingScheduleApi,
} from "@/service/teaching";
import { get } from "firebase/database";
import { hasRole } from "@/utils/auth";
import { ArrowRight, CheckCircle2, Sparkles, X } from "lucide-react";
import {
  canViewTeaching,
  isTeacher,
} from "@/pages/Teaching/lib";
import {
  isTeachingAlertType,
  isTeachingScheduleNotification,
  TEACHING_ALERT_TYPES,
  teachingReplacementPath,
} from "@/utils/teachingNotification";
import BrandSidebar from "@/pages/Director/components/BrandSidebar";
import {
  canUseDirectorBrandUi,
  DIRECTOR_DESKTOP_HOME_UI_KEY,
  isBusinessBrandUser,
  brandHomeCopy,
  readDirectorDesktopUi,
  type DirectorDesktopUi,
} from "@/utils/directorUi";

import { brandMenusForUser } from "@/utils/brandMenu";

const menuPath = (item: any) => item.to || `/director/${item.path}`;

// ================= TYPES =================
type Notification = {
  id: number;
  type:
    | "POLICY"
    | "SUGGEST"
    | "REPORT"
    | "WEEKLY_PLAN"
    | "TEACHING_SCHEDULE"
    | "SYSTEM"
    | TeachingAlertType;
  entityId?: number;
  message: string;
  createdAt: string;
  isRead: boolean;
  senderId: number;
  createdBy: number;
  meta?: {
    subjectId?: number;
    suggestType?: string;
    suggestId?: number;
    kind?: string;
    type?: string;
    category?: string;
    module?: string;
    target?: string;
    path?: string;
    /** Nhiều thông báo mới (xác nhận lịch, báo giảng…) trỏ sẵn route — ưu tiên dùng thay vì hardcode. */
    route?: string;
    url?: string;
    sessionId?: number;
    scheduleId?: number;
  };
};

// ================= HOOK: detect desktop =================
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop;
};

type DesktopHomeUi = DirectorDesktopUi;

type NotificationCategory =
  | "POLICY"
  | "SUGGEST"
  | "REPORT"
  | "WEEKLY_PLAN"
  | "TEACHING";

type PageState = Record<
  NotificationCategory,
  {
    unread: number;
    read: number;
  }
>;
type NotificationStats = Record<
  NotificationCategory,
  {
    unread: number;
    read: number;
  }
>;
// ================= MAIN =================
export default function Home() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const LIMIT = 5;
  const teachingNotificationsOnly = isTeacher() && !canViewTeaching();
  const [notificationStats, setNotificationStats] = useState<NotificationStats>(
    {
      POLICY: { unread: 0, read: 0 },
      SUGGEST: { unread: 0, read: 0 },
      REPORT: { unread: 0, read: 0 },
      WEEKLY_PLAN: { unread: 0, read: 0 },
      TEACHING: { unread: 0, read: 0 },
    },
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expenseRefreshVersion, setExpenseRefreshVersion] = useState(0);
  const realtimeNotificationIdsRef = useRef(new Set<number>());
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
  const [tab, setTab] = useState<"unread" | "read">("unread");

  const [page, setPage] = useState<PageState>({
    POLICY: { unread: 1, read: 1 },
    SUGGEST: { unread: 1, read: 1 },
    REPORT: { unread: 1, read: 1 },
    WEEKLY_PLAN: { unread: 1, read: 1 },
    TEACHING: { unread: 1, read: 1 },
  });

  const [hasMore, setHasMore] = useState({
    POLICY: {
      unread: true,
      read: true,
    },

    SUGGEST: {
      unread: true,
      read: true,
    },

    REPORT: {
      unread: true,
      read: true,
    },

    WEEKLY_PLAN: {
      unread: true,
      read: true,
    },

    TEACHING: {
      unread: true,
      read: true,
    },
  });

  const [loadingMore, setLoadingMore] = useState(false);

  // ================= INIT =================
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
    // BE trả riêng từng type con (TEACHING_SCHEDULE_CONFIRM_RESULT…), không có
    // khoá "TEACHING" gộp — cộng lại ở đây, giống cách SUGGEST gộp từ expense.
    nextStats.TEACHING = TEACHING_ALERT_TYPES.reduce(
      (sum, type) => ({
        unread: sum.unread + (nextStats[type]?.unread || 0),
        read: sum.read + (nextStats[type]?.read || 0),
      }),
      { unread: 0, read: 0 },
    );
    setNotificationStats(nextStats);
  }, [teachingNotificationsOnly]);

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

  const isSuggestOnlyRole = hasRole(
    "accountant",
    "ketoan_congno",
    "ketoan_truong",
    "troly_gd",
    // Phòng kỹ thuật chỉ nhận thông báo đề xuất chi (nhánh thiết bị).
    "ky_thuat",
  );

  /**
   * Ô đếm cho một loại thông báo. Lịch dạy (type riêng, hoặc SYSTEM của bản cũ)
   * không có ô riêng: giáo viên mượn ô POLICY, role khác thì không đếm.
   */
  const statsKeyOf = useCallback(
    (type: string): NotificationCategory | null => {
      if (["POLICY", "SUGGEST", "REPORT", "WEEKLY_PLAN"].includes(type)) {
        return type as NotificationCategory;
      }
      if (isTeachingAlertType(type)) {
        return "TEACHING";
      }
      return teachingNotificationsOnly ? "POLICY" : null;
    },
    [teachingNotificationsOnly],
  );

  useEffect(() => {
    const loadNotifications = async () => {
      setNotifications([]);
      if (teachingNotificationsOnly) {
        // Endpoint riêng đã trả đúng thông báo lịch dạy (kể cả bản cũ lưu kiểu
        // SYSTEM); lọc thêm ở FE chỉ để chắc chắn với dữ liệu quá cũ.
        const response = await teachingScheduleNotificationApi.getAll(1, 100, tab);
        const teachingItems = (response.data || []).filter(
          isTeachingScheduleNotification,
        );
        setNotifications(teachingItems);
        setNotificationStats((prev) => ({
          ...prev,
          POLICY: {
            unread: teachingItems.filter((item: Notification) => !item.isRead).length,
            read: teachingItems.filter((item: Notification) => item.isRead).length,
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
      if (!isSuggestOnlyRole && !hasRole("employee")) {
        requests.push(
          reportNotificationApi.getAll(1, LIMIT, tab),
          weeklyPlanNotificationApi.getAll(1, LIMIT, tab),
        );
      }
      // Xác nhận lịch dạy + báo giảng: chỉ Nhân sự/Giáo vụ thực sự nhận được,
      // gọi thêm cho role khác chỉ tốn request vô ích vì BE luôn trả rỗng.
      if (hasRole("nhansu", "giaovu")) {
        requests.push(
          ...TEACHING_ALERT_TYPES.map((type) =>
            teachingAlertNotificationApi.getAll(type, 1, LIMIT, tab),
          ),
        );
      }
      const responses = await Promise.all(requests);
      const merged = responses.flatMap((item: any) => item.data || []);
      setNotifications(merged);
      setPage({
        POLICY: { unread: 1, read: 1 },
        SUGGEST: { unread: 1, read: 1 },
        REPORT: { unread: 1, read: 1 },
        WEEKLY_PLAN: { unread: 1, read: 1 },
        TEACHING: { unread: 1, read: 1 },
      });
    };
    loadNotifications();
  }, [isSuggestOnlyRole, tab, teachingNotificationsOnly]);

  // ================= SOCKET =================
  useEffect(() => {
    const socket = getSocket();

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!user?.id) return;

    const handleConnect = () => {
      console.log("socket connected", socket.id);

      socket.emit("notification:register", user.id);

      console.log("REGISTER SOCKET USER:", user.id);
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, []);
  useEffect(() => {
    const socket = getSocket();

    const handleNew = (data: Notification) => {
      // Đếm lại từ server thay vì +1 thủ công: sự kiện này tới được đây nghĩa
      // là bản ghi đã tồn tại cho đúng người nhận, kể cả khi bị các bộ lọc bên
      // dưới loại khỏi danh sách hiển thị của vai trò này.
      loadUnreadCount();
      if (teachingNotificationsOnly && !isTeachingScheduleNotification(data)) return;
      if (isSuggestOnlyRole && data.type !== "SUGGEST") return;
      if (realtimeNotificationIdsRef.current.has(data.id)) return;
      realtimeNotificationIdsRef.current.add(data.id);
      if (realtimeNotificationIdsRef.current.size > 500) {
        const oldestId = realtimeNotificationIdsRef.current.values().next().value;
        if (oldestId !== undefined) {
          realtimeNotificationIdsRef.current.delete(oldestId);
        }
      }
      setNotifications((prev) => {
        if (prev.find((n) => n.id === data.id)) {
          return prev;
        }

        return [data, ...prev];
      });
      if (data.type === "SUGGEST" && data.meta?.suggestType === "EXPENSE_REQUEST") {
        refreshExpenseNotifications();
      } else {
        const statsKey = statsKeyOf(data.type);
        if (statsKey) {
          setNotificationStats((prev) => ({
            ...prev,
            [statsKey]: {
              ...prev[statsKey],
              unread: prev[statsKey].unread + 1,
            },
          }));
        }
      }
    };

    socket.on("policy-notification:new", handleNew);

    socket.on("suggest-notification:new", handleNew);

    socket.on("report-notification:new", handleNew);

    socket.on("notification:new", handleNew);

    socket.on("weekly-plan:new", handleNew);

    socket.on("teaching-schedule-notification:new", handleNew);

    // Xác nhận lịch dạy (kết quả + báo động chưa phản hồi) + báo giảng — gửi
    // cho Giáo vụ/Nhân sự, cùng cơ chế với các type ở trên.
    socket.on("teaching-schedule-confirm-result:new", handleNew);

    socket.on("teaching-schedule-confirm-alert:new", handleNew);

    socket.on("teaching-lesson-report-alert:new", handleNew);

    // Giáo viên xin rút khỏi buổi đã phân công + xin đổi vị trí — cũng gửi
    // cho Giáo vụ/Nhân sự, cùng cơ chế với các type ở trên.
    socket.on("teaching-replacement-request:new", handleNew);

    socket.on("teacher-location-change-request:new", handleNew);

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

      socket.off("teaching-replacement-request:new", handleNew);

      socket.off("teacher-location-change-request:new", handleNew);
    };
  }, [
    isSuggestOnlyRole,
    refreshExpenseNotifications,
    statsKeyOf,
    teachingNotificationsOnly,
    loadUnreadCount,
  ]);

  // ================= LOAD MORE =================
  const loadMore = async (
    type: "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN" | "TEACHING",
  ) => {
    if (loadingMore) return;

    const currentPage = page[type][tab];
    if (!hasMore[type][tab]) return;

    setLoadingMore(true);

    const nextPage = currentPage + 1;

    try {
      let newData: any[];
      // Không đủ (LIMIT) ở mọi type con mới coi là hết — còn 1 type con vẫn đủ
      // trang thì trang sau vẫn có thể còn của riêng type đó.
      let exhausted: boolean;

      switch (type) {
        case "POLICY": {
          const res = await policyNotificationApi.getAll(nextPage, LIMIT, tab);
          newData = res.data || [];
          exhausted = newData.length < LIMIT;
          break;
        }

        case "SUGGEST": {
          const res = await expenseNotificationApi.getAll(nextPage, LIMIT, tab, {
            scope: "all",
          });
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
          const res = await weeklyPlanNotificationApi.getAll(nextPage, LIMIT, tab);
          newData = res.data || [];
          exhausted = newData.length < LIMIT;
          break;
        }
        case "TEACHING": {
          const responses = await Promise.all(
            TEACHING_ALERT_TYPES.map((alertType) =>
              teachingAlertNotificationApi.getAll(alertType, nextPage, LIMIT, tab),
            ),
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
        return [...prev, ...visibleData.filter((n: Notification) => !ids.has(n.id))];
      });

      setPage((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [tab]: nextPage,
        },
      }));

      if (exhausted) {
        setHasMore((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            [tab]: false,
          },
        }));
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ================= CLICK =================
  const handleClickNotification = async (noti: Notification) => {
    const targetEntityId = noti.entityId || noti.meta?.suggestId;
    const replacementPath = teachingReplacementPath(noti);
    if (!noti.isRead) {
      try {
        if (noti.type === "SUGGEST" && noti.meta?.suggestType === "EXPENSE_REQUEST") {
          await expenseNotificationApi.markAsRead(noti.id);
        } else {
          await notificationApi.markAsRead(noti.id);
        }
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === noti.id
              ? {
                  ...n,
                  isRead: true,
                }
              : n,
          ),
        );
        loadUnreadCount();
        if (noti.type === "SUGGEST" && noti.meta?.suggestType === "EXPENSE_REQUEST") {
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
    // Xác nhận lịch dạy + báo giảng: bản gửi Giáo vụ/Nhân sự có thể là thông
    // báo tổng hợp không gắn 1 entity cụ thể (không có entityId) — không được
    // đi qua cổng `!targetEntityId` bên dưới. BE gửi sẵn meta.route, chỉ
    // hardcode khi thiếu.
    if (isTeachingAlertType(noti.type)) {
      // PortalDropdown mở popup duyệt ngay tại trang chủ, không điều hướng
      // khỏi trang sau khi người dùng bấm thông báo đổi vị trí.
      if (
        noti.type === "TEACHER_LOCATION_CHANGE_REQUEST" ||
        noti.meta?.kind === "teacher_location_change_request"
      ) return;
      // Mở thẳng popup chi tiết buổi/mẫu lịch thay vì chỉ điều hướng chung
      // chung — Chi tiết đã sẵn khung "đổi giáo viên" khi bị từ chối.
      if (noti.meta?.sessionId) {
        navigate(`/nhan-su/lich-day?tab=sessions&sessionId=${noti.meta.sessionId}`);
        return;
      }
      if (noti.meta?.scheduleId) {
        navigate(`/nhan-su/lich-day?tab=timetable&scheduleId=${noti.meta.scheduleId}`);
        return;
      }
      navigate(noti.meta?.route || "/nhan-su/cham-cong");
      return;
    }
    if (!targetEntityId) return;
    switch (noti.type) {
      case "POLICY": {
        const res = await policiesApi.findOne(targetEntityId);
        navigate(`/director/policy/${targetEntityId}`, {
          state: {
            ...res,
            user: noti.senderId,
          },
        });
        break;
      }
      case "SUGGEST":
        navigate(
          noti.meta?.suggestType === "EXPENSE_REQUEST"
            ? `/director/expense-requests/${targetEntityId}`
            : "/director/expense-requests",
        );
        break;
      case "REPORT":
        if (noti.entityId) {
          setSelectedReportId(noti.entityId);
        }
        break;

      case "WEEKLY_PLAN":
        navigate(`/director/daily-report/${noti.senderId}`);
        break;
    }
  };

  const menus = brandMenusForUser("director");

  const commonProps = {
    navigate,
    notifications,
    unreadCount,
    loadMore,
    tab,
    setTab,
    hasMore,
    onClickNotification: handleClickNotification,
    notificationStats,
    expenseRefreshVersion,
    refreshExpenseNotifications,
    teachingNotificationsOnly,
    menus,
  };

  return (
    <>
      {isDesktop ? (
        <HomeDesktop {...commonProps} />
      ) : (
        <HomeMobile {...commonProps} />
      )}

      {selectedReportId && (
        <ReportDetailPopup
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
        />
      )}
    </>
  );
}

//////////////////////////////////////////////////////////
// ================= MOBILE =================
//////////////////////////////////////////////////////////

function HomeMobile(props: any) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AppHeader {...props} />

      <div className="px-4 mt-2">
        <BannerSlider images={[HDKH2, HDKH3]} />
      </div>

      <Content {...props} />

      <BottomNav />
    </div>
  );
}

//////////////////////////////////////////////////////////
// ================= DESKTOP =================
//////////////////////////////////////////////////////////

function HomeDesktop(props: any) {
  // Giám đốc dùng chung biến thể kinh doanh với sales admin.
  const isSalesAdmin = isBusinessBrandUser();
  const supportsBrandUi = canUseDirectorBrandUi();
  const [desktopUi, setDesktopUi] = useState<DesktopHomeUi>(readDirectorDesktopUi);
  const [showNewUiConfirm, setShowNewUiConfirm] = useState(false);

  const switchToBrand = () => {
    localStorage.setItem(DIRECTOR_DESKTOP_HOME_UI_KEY, "brand");
    setDesktopUi("brand");
    setShowNewUiConfirm(false);
  };

  const switchToClassic = () => {
    localStorage.setItem(DIRECTOR_DESKTOP_HOME_UI_KEY, "classic");
    setDesktopUi("classic");
    setShowNewUiConfirm(false);
  };

  const desktopProps = supportsBrandUi
    ? {
        ...props,
        uiVersion: desktopUi,
        onRequestNewInterface: () => setShowNewUiConfirm(true),
        onSwitchClassicInterface: switchToClassic,
      }
    : props;

  if (supportsBrandUi && desktopUi === "brand") {
    return (
      <>
        <HomeDesktopBrand {...desktopProps} isSalesAdmin={isSalesAdmin} />
        {showNewUiConfirm && (
          <NewInterfaceConfirmModal
            onClose={switchToClassic}
            onConfirm={switchToBrand}
          />
        )}
      </>
    );
  }

  return (
    <>
      <HomeDesktopClassic {...desktopProps} />
      {supportsBrandUi && showNewUiConfirm && (
        <NewInterfaceConfirmModal
          onClose={switchToClassic}
          onConfirm={switchToBrand}
        />
      )}
    </>
  );
}

function HomeDesktopClassic(props: any) {
  const navigate = props.navigate;
  const menus = props.menus;

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* ===== SIDEBAR ===== */}
      <div className="w-64 bg-white shadow-lg flex flex-col p-4">
        <h2 className="text-lg font-bold mb-6">Menu</h2>

        <div className="flex flex-col gap-3">
          {menus.map((item: any, i: number) => (
            <div
              key={i}
              onClick={() =>
                navigate(menuPath(item), {
                  state: { from: item.from },
                })
              }
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition"
            >
              {item.icon ? (
                <img src={item.icon} className="w-6 h-6" />
              ) : (
                <item.lucideIcon className="w-6 h-6 text-orange-500" />
              )}
              <span className="text-sm text-gray-700">{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col">
        <AppHeader {...props} appearance="classic" />

        <div className="max-w-6xl mx-auto w-full px-6 mt-4">
          <BannerSlider images={[HDKH2, HDKH3]} />
          <Content {...props} desktop />
        </div>
      </div>
    </div>
  );
}

function HomeDesktopBrand(props: any) {
  const navigate = props.navigate;
  const menus = props.menus;
  const isSalesAdmin = props.isSalesAdmin;
  const copy = brandHomeCopy();

  return (
    <div className="min-h-screen bg-[#FFF8E6] text-[#0047B8] flex">
      <BrandSidebar
        items={menus.map((item: any, i: number) => ({
          key: `${item.from}-${i}`,
          title: item.title,
          icon: item.icon,
          lucideIcon: item.lucideIcon,
          onClick: () =>
            navigate(menuPath(item), { state: { from: item.from } }),
        }))}
        onSwitchClassic={props.onSwitchClassicInterface}
      />

      <main className="min-w-0 flex-1">
        <AppHeader {...props} appearance="brand" />
        <div className="px-8 py-8">
          <section className="relative overflow-hidden rounded-[28px] border border-blue-900/10 bg-white shadow-sm">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,91,234,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(0,91,234,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="relative flex min-h-[180px] items-center justify-between gap-8 px-8 py-8">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-2 w-7 rounded-full bg-[#FFC928]" />
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#005BEA]">
                    {copy.label}
                  </span>
                </div>
                <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-[#0047B8]">
                  {copy.title}
                </h1>
                <p className="mt-3 max-w-xl text-sm text-[#5a6b85]">
                  {copy.description}
                </p>
              </div>
              <div className="hidden xl:block w-[360px] overflow-hidden rounded-3xl border border-white/70 bg-white p-2 shadow-lg shadow-blue-950/10">
                <img
                  src={HDKH2}
                  className="h-[142px] w-full rounded-2xl object-cover object-center"
                />
              </div>
            </div>
          </section>

          <BrandContent
            navigate={navigate}
            menus={menus}
            variant={isSalesAdmin ? "sales" : "teaching"}
            notificationStats={props.notificationStats}
          />
        </div>
      </main>
    </div>
  );
}

//////////////////////////////////////////////////////////
// ================= SHARED CONTENT =================
//////////////////////////////////////////////////////////

function Content({ navigate, desktop, menus }: any) {
  return (
    <div className="mt-4 pb-10">
      {/* MENU */}
      <div className="mb-4">
        <h2 className="font-semibold text-gray-800 mb-3">Tiện ích số</h2>

        <div
          className={`grid ${
            desktop ? "grid-cols-6 gap-6" : "grid-cols-3 gap-y-6"
          } text-center`}
        >
          {menus.map((item: any, i: number) => (
            <div
              key={i}
              onClick={() =>
                navigate(menuPath(item), {
                  state: { from: item.from },
                })
              }
              className="cursor-pointer group"
            >
              <div className="mx-auto w-16 h-16 lg:w-20 lg:h-20 bg-white rounded-xl shadow flex items-center justify-center group-hover:shadow-lg transition">
                {item.icon ? (
                  <img src={item.icon} className="w-8 h-8 lg:w-10 lg:h-10" />
                ) : (
                  <item.lucideIcon className="w-8 h-8 lg:w-10 lg:h-10 text-orange-500" />
                )}
              </div>

              <p className="text-sm mt-2 text-gray-700">{item.title}</p>
            </div>
          ))}
        </div>
      </div>

      {/* INFO */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">Thông tin kết nối</h2>

        <div
          className={`grid ${desktop ? "grid-cols-2 gap-4" : "grid-cols-1"}`}
        >
          <div className="bg-white rounded-xl shadow p-2 max-h-[220px]">
            <img
              src={HDKH3}
              className="
                            rounded-lg 
                            h-[220px]
                            w-full 
                            aspect-[3/4]   
                         object-cover object-[center_30%]
                            bg-gray-100
                        "
            />
          </div>

          {desktop && (
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2">Thông báo hệ thống</h3>
              <p className="text-sm text-gray-600">Nội dung demo...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Card nào đếm theo loại thông báo nào — số hiện là **thông báo chưa xem**. */
const SALES_CARD_STAT: Record<string, NotificationCategory> = {
  "Chính sách": "POLICY",
  "Báo cáo": "REPORT",
  "QL thu chi": "SUGGEST",
  "Quản lý thu chi": "SUGGEST",
  "Đề xuất chi": "SUGGEST",
  "Đề xuất thiết bị": "SUGGEST",
};

function BrandContent({
  navigate,
  menus = [],
  variant = "teaching",
  notificationStats,
}: any) {
  const featuredMenus =
    variant === "teaching"
      ? ["Giáo viên", "Lớp học", "Môn học", "Thời khóa biểu"]
          .map((title) => menus.find((item: any) => item.title === title))
          .filter(Boolean)
      : menus.slice(0, 4);
  const [metrics, setMetrics] = useState<Record<string, number | null>>({
    teachers: null,
    classes: null,
    subjects: null,
    schedules: null,
  });

  useEffect(() => {
    let active = true;

    const loadMetrics = async () => {
      if (variant !== "teaching") return;
      const [teachers, classes, subjects, schedules] = await Promise.all([
        teacherApi.list({ page: 1, limit: 1 }).catch(() => null),
        schoolClassApi.list({ page: 1, limit: 1 }).catch(() => null),
        subjectApi.getAll().catch(() => []),
        teachingScheduleApi.list({ page: 1, limit: 1 }).catch(() => null),
      ]);

      if (!active) return;
      setMetrics({
        teachers: teachers?.pagination?.total ?? teachers?.data?.length ?? 0,
        classes: classes?.pagination?.total ?? classes?.data?.length ?? 0,
        subjects: Array.isArray(subjects) ? subjects.length : 0,
        schedules:
          schedules?.pagination?.total ?? schedules?.data?.length ?? 0,
      });
    };

    loadMetrics();

    return () => {
      active = false;
    };
  }, [variant]);

  const metricForMenu = (title: string) => {
    if (variant !== "teaching") {
      // Chưa tải xong stats thì hiện "—", không hiện 0 giả.
      if (!notificationStats) return null;
      const key = SALES_CARD_STAT[title];
      if (key) return notificationStats[key]?.unread ?? 0;
      // Thống kê: tổng mọi thông báo chưa xem của các module.
      if (title === "Thống kê") {
        return Object.values(notificationStats).reduce(
          (sum: number, item: any) => sum + (item?.unread || 0),
          0,
        );
      }
      return null;
    }
    if (title.includes("Giáo viên")) return metrics.teachers;
    if (title.includes("Lớp")) return metrics.classes;
    if (title.includes("Môn")) return metrics.subjects;
    if (title.includes("Thời")) return metrics.schedules;
    return null;
  };

  const formatMetric = (value: number | null) =>
    value == null ? "—" : value.toLocaleString("vi-VN");

  return (
    <div className="mt-6 pb-10">
      <section className="grid grid-cols-4 gap-5">
        {featuredMenus.map((item: any, i: number) => (
          <button
            key={i}
            onClick={() =>
              navigate(menuPath(item), {
                state: { from: item.from },
              })
            }
            className={`min-h-[118px] rounded-3xl p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              i === 0
                ? "bg-[#005BEA] text-white"
                : i === 1
                ? "bg-[#1D9BF0] text-white"
                : i === 2
                ? "bg-white text-[#0047B8] border border-blue-900/10"
                : "bg-[#FFC928] text-[#3f2d05]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm font-bold">{item.title}</span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                {item.icon ? (
                  <img src={item.icon} className="h-6 w-6 object-contain" />
                ) : (
                  <item.lucideIcon className="h-5 w-5" />
                )}
              </span>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold leading-none">
                {formatMetric(metricForMenu(item.title))}
              </span>
              {variant !== "teaching" && metricForMenu(item.title) != null && (
                <span className="text-[11px] font-semibold opacity-70">
                  chưa xem
                </span>
              )}
            </div>
            <div className="mt-4 h-1 w-8 rounded-full bg-current opacity-80" />
          </button>
        ))}
      </section>

      <section className="mt-5 rounded-3xl border border-blue-900/10 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#0047B8]">
            Tiện ích số
          </h2>
          <span className="text-xs font-semibold text-[#6b7c95]">
            {menus.length} mục
          </span>
        </div>
        <div className="grid grid-cols-6 gap-5">
          {menus.map((item: any, i: number) => (
            <button
              key={i}
              onClick={() =>
                navigate(menuPath(item), {
                  state: { from: item.from },
                })
              }
              className="group flex min-h-[118px] flex-col items-center justify-center rounded-2xl border border-blue-900/10 bg-[#FFFDF2] px-3 py-4 text-center transition hover:border-[#005BEA]/40 hover:bg-blue-50"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#005BEA] shadow-sm ring-1 ring-blue-900/10 group-hover:text-[#FFB300]">
                {item.icon ? (
                  <img src={item.icon} className="h-8 w-8 object-contain" />
                ) : (
                  <item.lucideIcon className="h-7 w-7" />
                )}
              </span>
              <span className="mt-3 text-sm font-semibold text-[#0047B8]">
                {item.title}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 grid grid-cols-[1.3fr_0.7fr] gap-5">
        <div className="overflow-hidden rounded-3xl border border-blue-900/10 bg-white shadow-sm">
          <div className="border-b border-blue-900/10 px-6 py-5">
            <h2 className="text-base font-extrabold text-[#0047B8]">
              Thông tin kết nối
            </h2>
          </div>
          <img
            src={HDKH3}
            className="h-[300px] w-full object-cover object-center"
          />
        </div>

        <div className="rounded-3xl border border-blue-900/10 bg-white p-6 shadow-sm">
          <h2 className="text-base font-extrabold text-[#0047B8]">
            Thông báo hệ thống
          </h2>
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-14 w-14 text-[#005BEA]" />
            <p className="mt-4 text-lg font-extrabold text-[#0047B8]">
              Sẵn sàng làm việc
            </p>
            <p className="mt-2 text-sm text-[#6b7c95]">
              Các thông báo mới sẽ hiển thị tại chuông trên thanh đầu trang.
            </p>
          </div>
        </div>
      </section>
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
              Giao diện mới chỉ áp dụng trên desktop và có thể đổi lại bất cứ lúc nào.
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
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
