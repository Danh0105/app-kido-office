import React, { useEffect, useState } from "react";
import BottomNav from "../../layout/BottomNav";
import { useNavigate } from "react-router-dom";

import policy from "./static/policy.png";
import report from "./static/report.png";
import suggest from "./static/suggest.png";
import statistics from "./static/statistics.png";
import HDKH2 from "./static/HDKH2.png";
import HDKH3 from "./static/HDKH3.png";

import { getEmployeeId, getEmployeeRole } from "@/utils/auth";
import AppHeader from "@/layout/Header";
import BannerSlider from "@/layout/Banner";

import { policiesApi } from "@/service/policy";
import { getSocket } from "@/utils/socket";
import {
  notificationApi,
  policyNotificationApi,
  reportNotificationApi,
  suggestNotificationApi,
  weeklyPlanNotificationApi,
} from "@/service/notification";

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
  senderId: number;
  createdBy: number;
  meta?: { subjectId?: number };
};
type NotificationCategory = "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN";

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

// ================= MAIN =================
export default function Home() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const LIMIT = 10;

  const [tab, setTab] = useState<"unread" | "read">("unread");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const role = getEmployeeRole();
  const [notificationStats, setNotificationStats] = useState<NotificationStats>(
    {
      POLICY: { unread: 0, read: 0 },
      SUGGEST: { unread: 0, read: 0 },
      REPORT: { unread: 0, read: 0 },
      WEEKLY_PLAN: { unread: 0, read: 0 },
    },
  );
  const menus =
    role === "probation"
      ? [
          {
            title: "Training",
            icon: policy,
            path: "/training",
            from: "training",
          },
        ]
      : [
          {
            title: "Chính sách",
            icon: policy,
            path: `/region/${getEmployeeId()}`,
            from: "policy",
          },

          {
            title: "Báo cáo tuần",
            icon: report,
            path: "/daily-report",
            from: "report",
          },

          {
            title: "Đề xuất",
            icon: suggest,
            path: "/suggest",
            from: "suggest",
          },

          {
            title: "Thống kê",
            icon: statistics,
            path: "statistics",
            from: "statistics",
          },
        ];
  const [page, setPage] = useState<PageState>({
    POLICY: { unread: 1, read: 1 },
    SUGGEST: { unread: 1, read: 1 },
    REPORT: { unread: 1, read: 1 },
    WEEKLY_PLAN: { unread: 1, read: 1 },
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
  });
  const [loadingMore, setLoadingMore] = useState(false);

  // ================= INIT =================
  useEffect(() => {
    const init = async () => {
      const statsRes = await notificationApi.getStats();
      setNotificationStats(statsRes.types || statsRes);

      const requests = [
        policyNotificationApi.getAll(1, LIMIT, tab),
        suggestNotificationApi.getAll(1, LIMIT, tab),
      ];

      if (role !== "employee") {
        requests.push(
          reportNotificationApi.getAll(1, LIMIT, tab),
          weeklyPlanNotificationApi.getAll(1, LIMIT, tab),
        );
      }

      const responses = await Promise.all(requests);

      const merged = responses.flatMap((item: any) => item.data || []);

      setNotifications(merged);
    };

    init();
  }, []);

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
      setNotifications((prev) => {
        if (prev.find((n) => n.id === data.id)) {
          return prev;
        }

        return [data, ...prev];
      });

      setNotificationStats((prev) => ({
        ...prev,
        [data.type]: {
          ...prev[data.type],
          unread: prev[data.type].unread + 1,
        },
      }));
    };

    socket.on("policy-notification:new", handleNew);

    socket.on("suggest-notification:new", handleNew);

    socket.on("report-notification:new", handleNew);

    socket.on("weekly-plan:new", handleNew);

    return () => {
      socket.off("policy-notification:new", handleNew);

      socket.off("suggest-notification:new", handleNew);

      socket.off("report-notification:new", handleNew);

      socket.off("weekly-plan:new", handleNew);
    };
  }, []);

  // ================= LOAD MORE =================
  const loadMore = async (
    type: "POLICY" | "SUGGEST" | "REPORT" | "WEEKLY_PLAN",
  ) => {
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
          res = await suggestNotificationApi.getAll(nextPage, LIMIT, tab);
          break;

        case "REPORT":
          res = await reportNotificationApi.getAll(nextPage, LIMIT, tab);
          break;
        case "WEEKLY_PLAN":
          res = await weeklyPlanNotificationApi.getAll(nextPage, LIMIT, tab);
          break;
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
    if (!noti.entityId) return;
    console.log(noti);
    if (!noti.isRead) {
      await notificationApi.markAsRead(noti.id);
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
    }
    switch (noti.type) {
      case "POLICY": {
        const res = await policiesApi.findOne(noti.entityId);
        navigate(`/director/policy/${noti.entityId}`, {
          state: {
            ...res,
            user: noti.senderId,
          },
        });
        break;
      }
      case "SUGGEST":
        navigate(`/director/suggest-review/${noti.entityId}`);
        break;
      case "REPORT":
        navigate(`/director/daily-report/${noti.senderId}`);
        break;

      case "WEEKLY_PLAN":
        navigate(`/director/daily-report/${noti.senderId}`);
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
  };

  return isDesktop ? (
    <HomeDesktop {...commonProps} menus={menus} />
  ) : (
    <HomeMobile {...commonProps} menus={menus} />
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
                navigate(`/director/${item.path}`, {
                  state: { from: item.from },
                })
              }
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition"
            >
              <img src={item.icon} className="w-6 h-6" />
              <span className="text-sm text-gray-700">{item.title}</span>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col">
        <AppHeader {...props} />

        <div className="max-w-6xl mx-auto w-full px-6 mt-4">
          <BannerSlider images={[HDKH2, HDKH3]} />
          <Content {...props} desktop />
        </div>
      </div>
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
                navigate(`/employee/${item.path}`, {
                  state: { from: item.from },
                })
              }
              className="flex flex-col items-center cursor-pointer group"
            >
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center group-hover:shadow-lg transition">
                <img src={item.icon} className="w-7 h-7 lg:w-10 lg:h-10" />
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
