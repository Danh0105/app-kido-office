import React, { useCallback, useEffect, useRef, useState } from "react";
import BottomNav from "../../layout/BottomNav";
import { useNavigate } from "react-router-dom";

import HDKH2 from "./static/HDKH2.png";
import HDKH3 from "./static/HDKH3.png";

import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  X,
} from "lucide-react";
import { getEmployeeId, hasRole } from "@/utils/auth";
import AppHeader from "@/layout/Header";
import BannerSlider from "@/layout/Banner";
import { subjectApi } from "@/service/subject.api";
import {
  schoolClassApi,
  teacherApi,
  teachingScheduleApi,
} from "@/service/teaching";

import { getSocket } from "@/utils/socket";
import {
  notificationApi,
  policyNotificationApi,
  reportNotificationApi,
  teachingAlertNotificationApi,
  weeklyPlanNotificationApi,
} from "@/service/notification";
import { expenseNotificationApi } from "@/service/expenseRequest";
import ReportDetailPopup from "@/components/ReportDetailPopup";
import { toast } from "react-hot-toast";
import {
  isTeachingAlertType,
  TEACHING_ALERT_TYPES,
  teachingReplacementPath,
} from "@/utils/teachingNotification";
import { resolveExpenseRequestId } from "@/pages/ExpenseRequest/lib";
import { brandMenusForUser } from "@/utils/brandMenu";
import BrandSidebar from "@/pages/Director/components/BrandSidebar";

// ================= MENU =================
type NotificationStats = Record<
  NotificationCategory,
  {
    unread: number;
    read: number;
  }
>;
// ================= TYPES =================
type Notification = {
  id: number;
  type: "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN";
  entityId?: number;
  message: string;
  createdAt: string;
  isRead: boolean;
  senderId?: number;
  createdBy: number;
  subjectId?: number;
  meta?: {
    subjectId?: number;
    regionName?: string;
    schoolName?: string;
    subjectName?: string;
    schoolYear?: string;
    suggestType?: string;
    suggestId?: number;
  };
};
type NotificationCategory =
  | "POLICY"
  | "SUGGEST"
  | "REPORT"
  | "WEEKLY_PLAN"
  | "TEACHING";

/** `item.to` là đường dẫn tuyệt đối (dùng cho module khác, VD Giảng dạy) — ưu
 * tiên dùng nguyên văn, không ghép thêm "/employee/" phía trước. */
const employeeMenuPath = (item: { path?: string; to?: string }) =>
  item.to || `/employee/${(item.path || "").replace(/^\/+/, "")}`;

type PageState = Record<
  NotificationCategory,
  {
    unread: number;
    read: number;
  }
>;

// ================= HOOK =================
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop;
};

const DESKTOP_HOME_UI_KEY = "kido.employee.desktopHomeUi";
type DesktopHomeUi = "classic" | "brand";

// Giao diện mới là mặc định; chỉ về classic khi người dùng chủ động chọn.
const readDesktopHomeUi = (): DesktopHomeUi => {
  if (typeof window === "undefined") return "brand";
  return localStorage.getItem(DESKTOP_HOME_UI_KEY) === "classic"
    ? "classic"
    : "brand";
};

// ================= MAIN =================
export default function Home() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const LIMIT = 5;

  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [tab, setTab] = useState<"unread" | "read">("unread");
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
  const [notificationStats, setNotificationStats] = useState<NotificationStats>(
    {
      POLICY: { unread: 0, read: 0 },
      SUGGEST: { unread: 0, read: 0 },
      REPORT: { unread: 0, read: 0 },
      WEEKLY_PLAN: { unread: 0, read: 0 },
      TEACHING: { unread: 0, read: 0 },
    }
  );
  const menus = brandMenusForUser("employee");
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
    nextStats.TEACHING = TEACHING_ALERT_TYPES.reduce(
      (sum, type) => ({
        unread: sum.unread + (nextStats[type]?.unread ?? 0),
        read: sum.read + (nextStats[type]?.read ?? 0),
      }),
      { unread: 0, read: 0 }
    );
    setNotificationStats((previous) => ({ ...previous, ...nextStats }));
  }, []);

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

  useEffect(() => {
    const loadNotifications = async () => {
      setNotifications([]);
      const requests = [
        policyNotificationApi.getAll(1, LIMIT, tab),
        expenseNotificationApi.getAll(1, LIMIT, tab, { scope: "all" }),
        reportNotificationApi.getAll(1, LIMIT, tab),
      ];
      if (!hasRole("employee", "sales")) {
        requests.push(weeklyPlanNotificationApi.getAll(1, LIMIT, tab));
      }
      if (hasRole("nhansu", "giaovu")) {
        requests.push(
          ...TEACHING_ALERT_TYPES.map((type) =>
            teachingAlertNotificationApi.getAll(type, 1, LIMIT, tab)
          )
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
  }, [tab]);

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
      // là bản ghi đã tồn tại cho đúng người nhận.
      loadUnreadCount();
      if (realtimeNotificationIdsRef.current.has(data.id)) return;
      realtimeNotificationIdsRef.current.add(data.id);
      if (realtimeNotificationIdsRef.current.size > 500) {
        const oldestId = realtimeNotificationIdsRef.current
          .values()
          .next().value;
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

      if (
        data.type === "SUGGEST" &&
        data.meta?.suggestType === "EXPENSE_REQUEST"
      ) {
        refreshExpenseNotifications();
      } else {
        const statsKey = isTeachingAlertType(data.type)
          ? "TEACHING"
          : data.type;
        setNotificationStats((currentStats) => ({
          ...currentStats,
          [statsKey]: {
            ...(currentStats[statsKey] ?? { unread: 0, read: 0 }),
            unread: (currentStats[statsKey]?.unread ?? 0) + 1,
          },
        }));
      }
    };

    const handleRealtimeNotification = (data: Notification) => {
      handleNew(data);

      if (data.type === "POLICY") {
        toast.success(data.message || "Chính sách vừa được cập nhật.");
      }
    };

    socket.on("policy-notification:new", handleNew);

    socket.on("suggest-notification:new", handleNew);

    socket.on("report-notification:new", handleNew);

    socket.on("notification:new", handleRealtimeNotification);

    socket.on("weekly-plan:new", handleNew);

    // Tài khoản kiêm cả role kinh doanh lẫn Giáo vụ/Nhân sự (VD sales +
    // giaovu) vẫn hạ cánh ở trang chủ Nhân viên này — cần nghe cả 2 type
    // giảng dạy gửi cho Giáo vụ/Nhân sự, không chỉ đợi tải lại trang.
    socket.on("teaching-replacement-request:new", handleNew);

    socket.on("teacher-location-change-request:new", handleNew);

    return () => {
      socket.off("policy-notification:new", handleNew);

      socket.off("suggest-notification:new", handleNew);

      socket.off("report-notification:new", handleNew);

      socket.off("notification:new", handleRealtimeNotification);

      socket.off("weekly-plan:new", handleNew);

      socket.off("teaching-replacement-request:new", handleNew);

      socket.off("teacher-location-change-request:new", handleNew);
    };
  }, [refreshExpenseNotifications, loadUnreadCount]);

  // ================= LOAD MORE =================
  const loadMore = async (type: NotificationCategory) => {
    if (loadingMore) return;

    const currentPage = page[type][tab];
    if (!hasMore[type][tab]) return;

    setLoadingMore(true);

    const nextPage = currentPage + 1;

    try {
      let res;

      switch (type) {
        case "POLICY":
          res = await policyNotificationApi.getAll(nextPage, LIMIT, tab);
          break;

        case "SUGGEST":
          res = await expenseNotificationApi.getAll(nextPage, LIMIT, tab, {
            scope: "all",
          });
          break;

        case "REPORT":
          res = await reportNotificationApi.getAll(nextPage, LIMIT, tab);
          break;
        case "WEEKLY_PLAN":
          res = await weeklyPlanNotificationApi.getAll(nextPage, LIMIT, tab);
          break;
        case "TEACHING": {
          const responses = await Promise.all(
            TEACHING_ALERT_TYPES.map((teachingType) =>
              teachingAlertNotificationApi.getAll(
                teachingType,
                nextPage,
                LIMIT,
                tab
              )
            )
          );
          res = {
            data: responses.flatMap((response: any) => response.data || []),
          };
          break;
        }
        default:
          return;
      }
      const newData = res.data || [];

      setNotifications((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        return [...prev, ...newData.filter((n) => !ids.has(n.id))];
      });

      setPage((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [tab]: nextPage,
        },
      }));

      if (newData.length < LIMIT) {
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
    const targetEntityId = resolveExpenseRequestId(noti);
    const replacementPath = teachingReplacementPath(noti);
    if (!targetEntityId && !replacementPath) return;
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
          prev.map((n) =>
            n.id === noti.id
              ? {
                  ...n,
                  isRead: true,
                }
              : n
          )
        );
        loadUnreadCount();
        if (
          noti.type === "SUGGEST" &&
          noti.meta?.suggestType === "EXPENSE_REQUEST"
        ) {
          refreshExpenseNotifications();
        } else {
          setNotificationStats((prev) => ({
            ...prev,
            [noti.type]: {
              unread: Math.max(0, prev[noti.type].unread - 1),
              read: prev[noti.type].read + 1,
            },
          }));
        }
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    }
    if (replacementPath) {
      navigate(replacementPath);
      return;
    }
    switch (noti.type) {
      case "POLICY": {
        navigate(`/employee/policy/${targetEntityId}`);
        break;
      }
      case "SUGGEST":
        navigate(
          noti.meta?.suggestType === "EXPENSE_REQUEST"
            ? `/employee/expense-requests/${targetEntityId}`
            : "/employee/expense-requests"
        );
        break;
      case "REPORT":
        if (noti.entityId) {
          setSelectedReportId(noti.entityId);
        }
        break;

      case "WEEKLY_PLAN":
        navigate(`/director/daily-report/${noti.senderId || noti.createdBy}`);
        break;
    }
  };

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
  };

  return (
    <>
      {isDesktop ? (
        <HomeDesktop {...commonProps} menus={menus} />
      ) : (
        <HomeMobile {...commonProps} menus={menus} />
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

// ================= MOBILE =================
function HomeMobile(props: any) {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <AppHeader {...props} />

      <div className="px-4 -mt-[80px] relative z-20">
        <BannerSlider images={[HDKH2, HDKH3]} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <Content {...props} />
      </div>

      <BottomNav />
    </div>
  );
}

// ================= DESKTOP =================
function HomeDesktop(props: any) {
  const [desktopUi, setDesktopUi] = useState<DesktopHomeUi>(readDesktopHomeUi);
  const [showNewUiConfirm, setShowNewUiConfirm] = useState(false);

  const switchToBrand = () => {
    localStorage.setItem(DESKTOP_HOME_UI_KEY, "brand");
    setDesktopUi("brand");
    setShowNewUiConfirm(false);
  };

  const switchToClassic = () => {
    localStorage.setItem(DESKTOP_HOME_UI_KEY, "classic");
    setDesktopUi("classic");
    setShowNewUiConfirm(false);
  };

  const desktopProps = {
    ...props,
    uiVersion: desktopUi,
    onRequestNewInterface: () => setShowNewUiConfirm(true),
    onSwitchClassicInterface: switchToClassic,
  };

  return (
    <>
      {desktopUi === "brand" ? (
        <HomeDesktopBrand {...desktopProps} />
      ) : (
        <HomeDesktopClassic {...desktopProps} />
      )}

      {showNewUiConfirm && (
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
          {menus.map((item, i) => (
            <div
              key={i}
              onClick={() =>
                navigate(employeeMenuPath(item), {
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

  return (
    <div className="min-h-screen bg-[#FFF8E6] text-[#0047B8] flex">
      <BrandSidebar
        items={menus.map((item: any) => ({
          key: item.key,
          title: item.title,
          icon: item.icon,
          lucideIcon: item.lucideIcon,
          onClick: () =>
            navigate(employeeMenuPath(item), { state: { from: item.from } }),
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
                    Xin chào
                  </span>
                </div>
                <h1 className="max-w-2xl text-3xl font-extrabold leading-tight text-[#0047B8]">
                  Không gian quản lý Kido hôm nay
                </h1>
                <p className="mt-3 max-w-xl text-sm text-[#5a6b85]">
                  Truy cập nhanh các nghiệp vụ, thông báo và thông tin kết nối trong một giao diện đồng bộ với nhận diện Kido.
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

          <BrandContent navigate={navigate} menus={menus} />
        </div>
      </main>
    </div>
  );
}

// ================= CONTENT =================
function Content({ navigate, desktop, menus = [] }: any) {
  return (
    <div className="mt-5 pb-10">
      {/* MENU */}
      <div>
        <div className="flex items-center mb-3">
          <div className="w-1 h-5 bg-blue-500 mr-2 rounded"></div>
          <h2 className="text-sm font-semibold text-gray-800">Tiện ích số</h2>
        </div>

        <div
          className={`grid ${
            desktop ? "grid-cols-6 gap-6" : "grid-cols-3 gap-4"
          }`}
        >
          {menus.map((item, i) => (
            <div
              key={i}
              onClick={() =>
                navigate(employeeMenuPath(item), {
                  state: { from: item.from },
                })
              }
              className="flex flex-col items-center cursor-pointer group"
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center group-hover:shadow-lg transition">
                {item.icon ? (
                  <img src={item.icon} className="w-7 h-7 lg:w-10 lg:h-10" />
                ) : (
                  <item.lucideIcon className="w-7 h-7 lg:w-10 lg:h-10 text-orange-500" />
                )}
              </div>

              <p className="text-xs lg:text-sm mt-2 text-gray-600 text-center">
                {item.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* INFO */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">
          Thông tin kết nối
        </h2>

        <div
          className={`grid ${desktop ? "grid-cols-2 gap-4" : "grid-cols-1"}`}
        >
          <div className="bg-white rounded-2xl shadow-sm p-2">
            <img
              src={HDKH3}
              className="rounded-xl w-full h-32 lg:h-40 object-cover"
            />
          </div>

          {desktop && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-semibold mb-2">Thông báo hệ thống</h3>
              <p className="text-sm text-gray-600">Nội dung demo...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandContent({ navigate, menus = [] }: any) {
  const featuredMenus =
    ["Giáo viên", "Lớp học", "Môn học", "Thời khóa biểu"]
      .map((title) => menus.find((item: any) => item.title === title))
      .filter(Boolean);
  const [metrics, setMetrics] = useState<Record<string, number | null>>({
    teachers: null,
    classes: null,
    subjects: null,
    schedules: null,
  });

  useEffect(() => {
    let active = true;

    // Chỉ gọi API đếm cho menu mà user thực sự có. Gọi bừa cho mọi role thì
    // tài khoản sales bị 403 ở /teachers và /school-classes ngay khi vào
    // trang chủ — không hỏng gì (đã catch) nhưng console đỏ và tốn request.
    const has = (title: string) =>
      menus.some((item: any) => item.title === title);

    const loadMetrics = async () => {
      const [teachers, classes, subjects, schedules] = await Promise.all([
        has("Giáo viên")
          ? teacherApi.list({ page: 1, limit: 1 }).catch(() => null)
          : Promise.resolve(null),
        has("Lớp học")
          ? schoolClassApi.list({ page: 1, limit: 1 }).catch(() => null)
          : Promise.resolve(null),
        has("Môn học")
          ? subjectApi.getAll().catch(() => [])
          : Promise.resolve([]),
        has("Thời khóa biểu")
          ? teachingScheduleApi.list({ page: 1, limit: 1 }).catch(() => null)
          : Promise.resolve(null),
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
  }, []);

  const metricForMenu = (title: string) => {
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
              navigate(employeeMenuPath(item), {
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
            <div className="mt-6 text-3xl font-extrabold leading-none">
              {formatMetric(metricForMenu(item.title))}
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
                navigate(employeeMenuPath(item), {
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
