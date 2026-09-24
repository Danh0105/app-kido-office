import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Bell,
  FileText,
  Lightbulb,
  ClipboardList,
  CalendarDays,
  GraduationCap,
  ChevronDown,
  User,
  Calendar,
  AlertTriangle,
  Phone,
  Clock,
  CalendarCheck,
  BellRing,
  BookOpenCheck,
  MapPin,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { hasRole } from "@/utils/auth";
import { canViewTeaching } from "@/pages/Teaching/lib";
import {
  isTeachingAlertType,
  isTeachingCancellationNotification,
  isTeachingScheduleNotification,
} from "@/utils/teachingNotification";
import {
  reportNotificationApi,
  type TeachingAlertType,
} from "@/service/notification";
import { employeeApi } from "@/service/employee";
import {
  expenseNotificationApi,
  expenseRequestApi,
} from "@/service/expenseRequest";
import type {
  ExpenseNotification,
  ExpenseNotificationEmployeeGroup,
  ExpenseNotificationSummary,
} from "@/types/expenseRequest";
import { STATUS_LABEL } from "@/types/expenseRequest";
import TeacherLocationChangeModal from "@/components/TeacherLocationChangeModal";

type NotificationType =
  | "POLICY"
  | "SUGGEST"
  | "REPORT"
  | "WEEKLY_PLAN"
  | "TEACHING";
type TabType = "unread" | "read";
type TeachingTypeTab = "ALL" | TeachingAlertType;

type Notification = {
  id: number;
  // Type thô từ BE — 4 loại đầu trùng khoá tab, riêng "Giảng dạy" gộp 3 type
  // con (TEACHING_SCHEDULE_CONFIRM_RESULT…) vào một khoá tab "TEACHING".
  type: NotificationType | TeachingAlertType;
  entityId?: number;
  message: string;
  isRead: boolean;
  createdAt: string;
  createdBy: number;
  senderId: number;
  meta?: {
    regionName?: string;
    schoolName?: string;
    className?: string;
    schoolYear?: string;
    subjectName?: string;
    suggestType?: string;
    suggestId?: number;
    suggestCode?: string;
    employeeId?: number;
    employeeName?: string;
    employeePhone?: string;
    kind?: string;
    status?: string;
    daysLate?: number;
    requestId?: number;
    teacherId?: number;
    route?: string;
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
  teachingNotificationsOnly?: boolean;
  /** Mở từ trong module Giảng dạy — chỉ giữ tab "Giảng dạy", ẩn 4 tab còn lại vốn không liên quan. */
  onlyTeachingTab?: boolean;
  open: boolean;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  notifications: Notification[];
  loadMore: (typeTab: NotificationType) => void;
  tab: TabType;
  setTab: (tab: TabType) => void;
  hasMore: Record<NotificationType, Record<TabType, boolean>>;
  notificationStats: Record<NotificationType, Record<TabType, number>>;
  onClickNotification: (n: Notification) => void | Promise<void>;
  expenseRefreshVersion: number;
  onRefreshExpenseNotifications: () => void | Promise<void>;
};

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

type ExpenseDropdownTab = "general" | "overdue";

const EXPENSE_LIMIT = 20;

const emptyExpenseSummary: ExpenseNotificationSummary = {
  general: { total: 0, unread: 0 },
  overdue: { total: 0, unread: 0 },
};

export default function NotificationDropdown({
  teachingNotificationsOnly = false,
  onlyTeachingTab = false,
  open,
  dropdownRef,
  notifications,
  loadMore,
  tab,
  setTab,
  hasMore,
  notificationStats,
  onClickNotification,
  expenseRefreshVersion,
  onRefreshExpenseNotifications,
}: Props) {
  // `sales` đi theo workspace Nhân viên dù token không nhất thiết có thêm
  // role `employee`. Tài khoản sales + giaovu phải giữ cả hai nhóm tab.
  const isEmployee = hasRole("employee", "sales");
  const isTeachingManager = hasRole("nhansu", "giaovu");
  const isTeachingSales = hasRole("giaovu") && isEmployee;
  const hideBusinessNotificationTabs =
    hasRole("nhansu") || (hasRole("giaovu") && !isTeachingSales);
  const isSuggestOnlyRole = hasRole(
    "accountant",
    "ketoan_congno",
    "ketoan_truong",
    "troly_gd",
    // Phòng kỹ thuật chỉ nhận thông báo đề xuất chi (nhánh thiết bị).
    "ky_thuat"
  );

  // Panel hẹp 380px đủ cho thông báo ngắn, nhưng tiêu đề chính sách kèm
  // trường/năm học thì xuống 4–5 dòng. Cho phép bung rộng để đọc một lượt.
  const [expanded, setExpanded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typeTab, setTypeTab] = useState<NotificationType>(
    teachingNotificationsOnly
      ? "POLICY"
      : onlyTeachingTab
      ? "TEACHING"
      : hideBusinessNotificationTabs
      ? "TEACHING"
      : !isSuggestOnlyRole
      ? "POLICY"
      : "SUGGEST"
  );
  const [teachingTypeTab, setTeachingTypeTab] =
    useState<TeachingTypeTab>("ALL");
  const [locationRequestId, setLocationRequestId] = useState<number | null>(
    null
  );

  const unreadPolicyCount = notificationStats?.POLICY?.unread ?? 0;
  const unreadSuggestCount = notificationStats?.SUGGEST?.unread ?? 0;
  const unreadReportCount = notificationStats?.REPORT?.unread ?? 0;
  const unreadPlanCount = notificationStats?.WEEKLY_PLAN?.unread ?? 0;
  const unreadTeachingCount = notificationStats?.TEACHING?.unread ?? 0;

  const teachingIconMenus: {
    key: NotificationType;
    teachingType: TeachingTypeTab;
    icon: any;
    count: number;
    activeClass: string;
    label: string;
  }[] = [
    {
      key: "TEACHING",
      teachingType: "ALL",
      icon: GraduationCap,
      count: unreadTeachingCount,
      activeClass: "bg-teal-100 text-teal-600",
      label: "Tất cả thông báo giảng dạy",
    },
    {
      key: "TEACHING",
      teachingType: "TEACHING_SCHEDULE_CONFIRM_RESULT",
      icon: CalendarCheck,
      count: notifications.filter(
        (item) =>
          !item.isRead && item.type === "TEACHING_SCHEDULE_CONFIRM_RESULT"
      ).length,
      activeClass: "bg-teal-100 text-teal-600",
      label: "Xác nhận lịch",
    },
    {
      key: "TEACHING",
      teachingType: "TEACHING_SCHEDULE_CONFIRM_ALERT",
      icon: BellRing,
      count: notifications.filter(
        (item) =>
          !item.isRead && item.type === "TEACHING_SCHEDULE_CONFIRM_ALERT"
      ).length,
      activeClass: "bg-teal-100 text-teal-600",
      label: "Nhắc xác nhận",
    },
    {
      key: "TEACHING",
      teachingType: "TEACHING_LESSON_REPORT_ALERT",
      icon: BookOpenCheck,
      count: notifications.filter(
        (item) =>
          !item.isRead &&
          (item.type === "TEACHING_LESSON_REPORT_ALERT" ||
            isTeachingCancellationNotification(item))
      ).length,
      activeClass: "bg-teal-100 text-teal-600",
      label: "Báo giảng và hủy tiết",
    },
    {
      key: "TEACHING",
      teachingType: "TEACHER_LOCATION_CHANGE_REQUEST",
      icon: MapPin,
      count: notifications.filter(
        (item) =>
          !item.isRead && item.type === "TEACHER_LOCATION_CHANGE_REQUEST"
      ).length,
      activeClass: "bg-teal-100 text-teal-600",
      label: "Đổi vị trí",
    },
  ];

  const notificationMenus: {
    key: NotificationType;
    icon: any;
    count: number;
    activeClass: string;
    teachingType?: TeachingTypeTab;
    label?: string;
  }[] = teachingNotificationsOnly
    ? [
        {
          key: "POLICY",
          icon: CalendarDays,
          count: unreadPolicyCount,
          activeClass: "bg-blue-100 text-blue-600",
        },
      ]
    : onlyTeachingTab
    ? isTeachingManager
      ? teachingIconMenus
      : [
          {
            key: "TEACHING",
            icon: GraduationCap,
            count: unreadTeachingCount,
            activeClass: "bg-teal-100 text-teal-600",
          },
        ]
    : isSuggestOnlyRole
    ? [
        {
          key: "SUGGEST",
          icon: Lightbulb,
          count: unreadSuggestCount,
          activeClass: "bg-green-100 text-green-600",
        },
      ]
    : hideBusinessNotificationTabs
    ? teachingIconMenus
    : [
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
        ...(isEmployee && !isTeachingSales
          ? []
          : [
              {
                key: "WEEKLY_PLAN" as NotificationType,
                icon: CalendarDays,
                count: unreadPlanCount,
                activeClass: "bg-purple-100 text-purple-600",
              },
            ]),
        // Xác nhận lịch dạy + báo giảng — chỉ Nhân sự/Giáo vụ (và các role
        // chỉ-xem module Giảng dạy) mới có gì để xem ở đây.
        ...(canViewTeaching()
          ? isTeachingManager
            ? teachingIconMenus
            : [
                {
                  key: "TEACHING" as NotificationType,
                  icon: GraduationCap,
                  count: unreadTeachingCount,
                  activeClass: "bg-teal-100 text-teal-600",
                },
              ]
          : []),
      ];

  // =================== REPORT GROUPED (director) ===================
  type DaySection = {
    date: string;
    groups: SenderGroup[];
  };

  const [daySections, setDaySections] = useState<DaySection[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [loadingMoreDays, setLoadingMoreDays] = useState(false);
  const [reportDate, setReportDate] = useState(() => toDateString(new Date()));
  const [expandedSender, setExpandedSender] = useState<string | null>(null);
  const [senderNotifications, setSenderNotifications] = useState<
    Record<string, Notification[]>
  >({});
  const [senderLoading, setSenderLoading] = useState<string | null>(null);

  // =================== EXPENSE REQUEST GROUPED ===================
  const [expenseTab, setExpenseTab] = useState<ExpenseDropdownTab>("general");
  const [expenseSummary, setExpenseSummary] =
    useState<ExpenseNotificationSummary>(emptyExpenseSummary);
  const [expenseGroups, setExpenseGroups] = useState<
    ExpenseNotificationEmployeeGroup[]
  >([]);
  const [expenseGroupPage, setExpenseGroupPage] = useState(1);
  const [expenseGroupTotalPages, setExpenseGroupTotalPages] = useState(1);
  const [expenseGroupsLoading, setExpenseGroupsLoading] = useState(false);
  const [expandedExpenseEmployee, setExpandedExpenseEmployee] = useState<
    number | null
  >(null);
  const [expenseEmployeeItems, setExpenseEmployeeItems] = useState<
    Record<number, ExpenseNotification[]>
  >({});
  const [expenseEmployeePages, setExpenseEmployeePages] = useState<
    Record<number, number>
  >({});
  const [expenseEmployeeTotalPages, setExpenseEmployeeTotalPages] = useState<
    Record<number, number>
  >({});
  const [expenseEmployeeLoading, setExpenseEmployeeLoading] = useState<
    number | null
  >(null);
  const [overdueItems, setOverdueItems] = useState<ExpenseNotification[]>([]);
  const [overduePage, setOverduePage] = useState(1);
  const [overdueTotalPages, setOverdueTotalPages] = useState(1);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const expenseGroupsRequestRef = useRef(0);
  const expenseEmployeeRequestRef = useRef(0);
  const overdueRequestRef = useRef(0);
  const lastExpenseRefreshVersionRef = useRef(expenseRefreshVersion);

  const isDirectorReport = typeTab === "REPORT" && !isEmployee;
  const isExpenseSuggest = typeTab === "SUGGEST";

  // Chỉ hiển thị nhân viên kinh doanh trong phần thông báo báo cáo.
  const salesEmployeeIdsRef = useRef<Set<number> | null>(null);

  const getSalesEmployeeIds = useCallback(async () => {
    if (salesEmployeeIdsRef.current) return salesEmployeeIdsRef.current;
    try {
      const response = await employeeApi.getSales();
      const data: Array<{ id: number }> = response;
      salesEmployeeIdsRef.current = new Set(data.map((e) => e.id));
    } catch (err) {
      console.error("Failed to fetch sales employees:", err);
      salesEmployeeIdsRef.current = new Set();
    }
    return salesEmployeeIdsRef.current;
  }, []);

  const fetchGroupsForDate = useCallback(
    async (date: string) => {
      const [res, salesEmployeeIds] = await Promise.all([
        reportNotificationApi.getGrouped(tab, date),
        getSalesEmployeeIds(),
      ]);
      const groups = (res.data || []).filter((g: SenderGroup) =>
        salesEmployeeIds.has(g.senderId)
      );
      return { date: res.date || date, groups } as DaySection;
    },
    [tab, getSalesEmployeeIds]
  );

  // Reset về hôm nay mỗi lần mở lại chuông thông báo.
  useEffect(() => {
    if (open) setReportDate(toDateString(new Date()));
  }, [open]);

  useEffect(() => {
    if (isDirectorReport && open) {
      const loadForDate = async () => {
        setGroupsLoading(true);
        setDaySections([]);
        setExpandedSender(null);
        setSenderNotifications({});
        try {
          const section = await fetchGroupsForDate(reportDate);
          setDaySections([section]);

          const first = section.groups.find((g: SenderGroup) => g.count > 0);
          if (first) {
            const key = senderKey(first.senderId, section.date);
            setExpandedSender(key);
            setSenderLoading(key);
            try {
              const res = await reportNotificationApi.getBySender(
                first.senderId,
                1,
                50,
                tab,
                section.date
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
      loadForDate();
    }
  }, [isDirectorReport, open, tab, reportDate, fetchGroupsForDate]);

  const loadExpenseSummary = useCallback(async () => {
    try {
      const res = await expenseNotificationApi.getSummary();
      setExpenseSummary({
        general: res.general || emptyExpenseSummary.general,
        overdue: res.overdue || emptyExpenseSummary.overdue,
      });
    } catch (err) {
      console.error("Failed to fetch expense summary:", err);
    }
  }, []);

  const loadExpenseGroups = useCallback(
    async (page = 1) => {
      const requestId = ++expenseGroupsRequestRef.current;
      setExpenseGroupsLoading(true);
      try {
        const res = await expenseNotificationApi.getGroupedByEmployee({
          scope: "general",
          tab,
          page,
          limit: EXPENSE_LIMIT,
        });
        if (requestId !== expenseGroupsRequestRef.current) return;

        const groupedData = Array.isArray(res.data) ? res.data : [];
        setExpenseGroups((prev) => {
          if (page === 1) return groupedData;
          const employeeIds = new Set(prev.map((group) => group.employeeId));
          return [
            ...prev,
            ...groupedData.filter(
              (group) => !employeeIds.has(group.employeeId)
            ),
          ];
        });
        setExpenseGroupPage(res.page || page);
        setExpenseGroupTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error("Failed to fetch grouped expense notifications:", err);
      } finally {
        if (requestId === expenseGroupsRequestRef.current) {
          setExpenseGroupsLoading(false);
        }
      }
    },
    [tab]
  );

  const loadExpenseEmployeeItems = useCallback(
    async (employeeId: number, page = 1) => {
      const requestId = ++expenseEmployeeRequestRef.current;
      setExpenseEmployeeLoading(employeeId);
      try {
        const res = await expenseNotificationApi.getAll(
          page,
          EXPENSE_LIMIT,
          tab,
          {
            scope: "general",
            employeeId,
          }
        );
        if (requestId !== expenseEmployeeRequestRef.current) return;

        const nextItems = Array.isArray(res.data) ? res.data : [];
        setExpenseEmployeeItems((prev) => {
          if (page === 1) {
            return { ...prev, [employeeId]: nextItems };
          }

          const currentItems = prev[employeeId] || [];
          const itemIds = new Set(currentItems.map((item) => item.id));
          return {
            ...prev,
            [employeeId]: [
              ...currentItems,
              ...nextItems.filter((item) => !itemIds.has(item.id)),
            ],
          };
        });
        setExpenseEmployeePages((prev) => ({
          ...prev,
          [employeeId]: res.page || page,
        }));
        setExpenseEmployeeTotalPages((prev) => ({
          ...prev,
          [employeeId]: res.totalPages || 1,
        }));
      } catch (err) {
        console.error("Failed to fetch employee expense notifications:", err);
      } finally {
        if (requestId === expenseEmployeeRequestRef.current) {
          setExpenseEmployeeLoading(null);
        }
      }
    },
    [tab]
  );

  const loadOverdueItems = useCallback(
    async (page = 1) => {
      const requestId = ++overdueRequestRef.current;
      setOverdueLoading(true);
      try {
        const res = await expenseNotificationApi.getAll(
          page,
          EXPENSE_LIMIT,
          tab,
          {
            scope: "overdue",
          }
        );
        if (requestId !== overdueRequestRef.current) return;

        const nextItems = Array.isArray(res.data) ? res.data : [];
        setOverdueItems((prev) => {
          if (page === 1) return nextItems;
          const itemIds = new Set(prev.map((item) => item.id));
          return [
            ...prev,
            ...nextItems.filter((item) => !itemIds.has(item.id)),
          ];
        });
        setOverduePage(res.page || page);
        setOverdueTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error("Failed to fetch overdue expense notifications:", err);
      } finally {
        if (requestId === overdueRequestRef.current) {
          setOverdueLoading(false);
        }
      }
    },
    [tab]
  );

  useEffect(() => {
    if (!open || !isExpenseSuggest) return;

    expenseGroupsRequestRef.current += 1;
    expenseEmployeeRequestRef.current += 1;
    overdueRequestRef.current += 1;
    setExpenseGroupsLoading(false);
    setExpenseEmployeeLoading(null);
    setOverdueLoading(false);
    loadExpenseSummary();
    if (expenseTab === "overdue") {
      setExpandedExpenseEmployee(null);
      setExpenseEmployeeItems({});
      setExpenseEmployeePages({});
      setExpenseEmployeeTotalPages({});
      setOverdueItems([]);
      setOverduePage(1);
      setOverdueTotalPages(1);
      loadOverdueItems(1);
    } else {
      setExpenseGroups([]);
      setExpenseGroupPage(1);
      setExpenseGroupTotalPages(1);
      setExpandedExpenseEmployee(null);
      setExpenseEmployeeItems({});
      setExpenseEmployeePages({});
      setExpenseEmployeeTotalPages({});
      loadExpenseGroups(1);
    }
  }, [
    expenseTab,
    isExpenseSuggest,
    loadExpenseGroups,
    loadExpenseSummary,
    loadOverdueItems,
    open,
    tab,
  ]);

  useEffect(() => {
    if (expenseRefreshVersion === lastExpenseRefreshVersionRef.current) return;
    lastExpenseRefreshVersionRef.current = expenseRefreshVersion;
    if (!open || !isExpenseSuggest) return;

    expenseGroupsRequestRef.current += 1;
    expenseEmployeeRequestRef.current += 1;
    overdueRequestRef.current += 1;
    setExpenseGroupsLoading(false);
    setExpenseEmployeeLoading(null);
    setOverdueLoading(false);
    loadExpenseSummary();

    if (expenseTab === "overdue") {
      setExpandedExpenseEmployee(null);
      setExpenseEmployeeItems({});
      setExpenseEmployeePages({});
      setExpenseEmployeeTotalPages({});
      setOverdueItems([]);
      setOverduePage(1);
      setOverdueTotalPages(1);
      loadOverdueItems(1);
      return;
    }

    const employeeId = expandedExpenseEmployee;
    setExpenseGroups([]);
    setExpenseGroupPage(1);
    setExpenseGroupTotalPages(1);
    setExpenseEmployeeItems({});
    setExpenseEmployeePages({});
    setExpenseEmployeeTotalPages({});
    loadExpenseGroups(1);
    if (employeeId !== null) {
      loadExpenseEmployeeItems(employeeId, 1);
    }
  }, [
    expenseRefreshVersion,
    expenseTab,
    expandedExpenseEmployee,
    isExpenseSuggest,
    loadExpenseEmployeeItems,
    loadExpenseGroups,
    loadExpenseSummary,
    loadOverdueItems,
    open,
  ]);

  useEffect(() => {
    if (expandedExpenseEmployee === null || expenseGroupsLoading) return;
    if (
      expenseGroups.some(
        (group) => group.employeeId === expandedExpenseEmployee
      )
    ) {
      return;
    }

    setExpandedExpenseEmployee(null);
    expenseEmployeeRequestRef.current += 1;
    setExpenseEmployeeLoading(null);
    setExpenseEmployeeItems({});
    setExpenseEmployeePages({});
    setExpenseEmployeeTotalPages({});
  }, [expandedExpenseEmployee, expenseGroups, expenseGroupsLoading]);

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
    count: number
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
        date
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
    // Ưu tiên cố định để tránh 2 điều kiện cùng đúng làm effect nhảy qua lại
    // vô hạn giữa 2 tab (vd hideBusinessNotificationTabs và isSuggestOnlyRole
    // cùng true cho một role).
    let target: NotificationType | null = null;
    if (teachingNotificationsOnly) {
      target = "POLICY";
    } else if (hideBusinessNotificationTabs) {
      target = "TEACHING";
    } else if (isSuggestOnlyRole) {
      target = "SUGGEST";
    } else if (isEmployee && !isTeachingSales && typeTab === "WEEKLY_PLAN") {
      target = "POLICY";
    }

    if (target !== null && target !== typeTab) {
      setTypeTab(target);
    }
  }, [
    hideBusinessNotificationTabs,
    isEmployee,
    isSuggestOnlyRole,
    isTeachingSales,
    teachingNotificationsOnly,
    typeTab,
  ]);

  const filtered =
    tab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications.filter((n) => n.isRead);

  // Giáo viên chỉ có một tab "lịch dạy": thông báo loại này ở BE mang type riêng
  // TEACHING_SCHEDULE (bản cũ là SYSTEM) nên không so thẳng với typeTab được.
  // Tab "TEACHING" của Giáo vụ/Nhân sự cũng vậy — gộp 3 type con lại.
  const categoryFiltered = teachingNotificationsOnly
    ? filtered.filter(isTeachingScheduleNotification)
    : typeTab === "TEACHING"
    ? filtered.filter(
        (n) =>
          isTeachingAlertType(n.type) ||
          isTeachingCancellationNotification(n),
      )
    : filtered.filter((n) => n.type === typeTab);

  const typeFiltered =
    typeTab === "TEACHING" && teachingTypeTab !== "ALL"
      ? categoryFiltered.filter(
          (n) =>
            n.type === teachingTypeTab ||
            (teachingTypeTab === "TEACHING_LESSON_REPORT_ALERT" &&
              isTeachingCancellationNotification(n)),
        )
      : categoryFiltered;

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
      onClick={() => {
        if (
          n.type === "TEACHER_LOCATION_CHANGE_REQUEST" ||
          n.meta?.kind === "teacher_location_change_request"
        ) {
          const requestId = Number(n.meta?.requestId || n.entityId);
          if (Number.isInteger(requestId) && requestId > 0) {
            setLocationRequestId(requestId);
          }
        }
        onClickNotification(n);
      }}
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
        <p className="text-[13px] leading-normal line-clamp-3">{n.message}</p>

        {!n.isRead && <span className="w-2 h-2 bg-red-500 rounded-full mt-1" />}
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

        {n.meta?.className && (
          <span className="px-2 py-[2px] text-[10px] bg-teal-100 text-teal-600 rounded-full">
            {n.meta.className}
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
          onClick={() => handleToggleSender(group.senderId, date, group.count)}
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
                  <p className="text-[13px] leading-normal line-clamp-2">
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

  const clickExpenseNotification = async (n: ExpenseNotification) => {
    await onClickNotification(n as unknown as Notification);
  };

  const handleToggleExpenseEmployee = async (employeeId: number) => {
    if (expandedExpenseEmployee === employeeId) {
      setExpandedExpenseEmployee(null);
      return;
    }

    setExpandedExpenseEmployee(employeeId);
    if (!expenseEmployeeItems[employeeId]) {
      await loadExpenseEmployeeItems(employeeId, 1);
    }
  };

  const markExpenseGroupRead = async (employeeId: number) => {
    if (tab !== "unread") return;

    try {
      await expenseNotificationApi.markAllAsRead({
        scope: "general",
        employeeId,
      });
      await onRefreshExpenseNotifications();
    } catch (err) {
      console.error("Failed to mark expense group as read:", err);
    }
  };

  const markOverdueRead = async () => {
    if (tab !== "unread") return;

    try {
      await expenseNotificationApi.markAllAsRead({ scope: "overdue" });
      await onRefreshExpenseNotifications();
    } catch (err) {
      console.error("Failed to mark overdue expenses as read:", err);
    }
  };

  /** Tắt nhắc quá hạn cho riêng đề xuất này — không ảnh hưởng đề xuất khác. */
  const muteOverdueAlert = async (
    e: React.MouseEvent,
    n: ExpenseNotification
  ) => {
    e.stopPropagation(); // tránh trigger onClick điều hướng của cả dòng
    const suggestId = n.meta?.suggestId;
    if (!suggestId) return;

    try {
      await expenseRequestApi.muteOverdueAlert(suggestId);
      await onRefreshExpenseNotifications();
    } catch (err) {
      console.error("Failed to mute overdue alert:", err);
    }
  };

  const renderExpenseNotificationItem = (
    n: ExpenseNotification,
    overdue = false
  ) => (
    <div
      key={n.id}
      onClick={() => clickExpenseNotification(n)}
      className={`p-2 rounded-lg border transition cursor-pointer ${
        overdue
          ? n.isRead
            ? "bg-white border-red-100"
            : "bg-red-50 border-red-200"
          : n.isRead
          ? "bg-white border-gray-100"
          : "bg-green-50 border-green-100"
      } hover:shadow-md`}
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          {n.meta?.employeeName && (
            <p className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
              <User className="w-3 h-3 text-gray-400" />
              {n.meta.employeeName}
              {n.meta.employeePhone && ` · ${n.meta.employeePhone}`}
            </p>
          )}
          <div className="flex items-start gap-1.5">
            {overdue && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <p className="text-[13px] leading-normal line-clamp-3">
              {n.message}
            </p>
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            {overdue && typeof n.meta?.daysLate === "number" && (
              <span className="px-2 py-[2px] text-[10px] bg-red-100 text-red-600 rounded-full">
                Quá hạn {n.meta.daysLate} ngày
              </span>
            )}
            {n.meta?.status && (
              <span className="px-2 py-[2px] text-[10px] bg-amber-100 text-amber-700 rounded-full">
                {STATUS_LABEL(n.meta.status)}
              </span>
            )}
            {n.meta?.suggestCode && (
              <span className="px-2 py-[2px] text-[10px] bg-gray-100 text-gray-600 rounded-full">
                {n.meta.suggestCode}
              </span>
            )}
            {overdue && n.meta?.suggestId && (
              <button
                type="button"
                onClick={(e) => muteOverdueAlert(e, n)}
                title="Đề xuất này sẽ không bị nhắc quá hạn nữa"
                className="px-2 py-[2px] text-[10px] text-gray-500 border border-gray-200 rounded-full hover:bg-gray-100 hover:text-red-600"
              >
                Tắt nhắc
              </button>
            )}
          </div>

          {n.createdAt && (
            <div className="text-[11px] text-gray-400 mt-1">
              {new Date(n.createdAt).toLocaleString("vi-VN")}
            </div>
          )}
        </div>

        {!n.isRead && (
          <span className="w-2 h-2 bg-red-500 rounded-full mt-1 flex-shrink-0" />
        )}
      </div>
    </div>
  );

  const renderExpenseGroupCard = (group: ExpenseNotificationEmployeeGroup) => {
    const isOpen = expandedExpenseEmployee === group.employeeId;
    const items = expenseEmployeeItems[group.employeeId] || [];
    const isLoadingItems = expenseEmployeeLoading === group.employeeId;
    const itemPage = expenseEmployeePages[group.employeeId] || 1;
    const itemTotalPages = expenseEmployeeTotalPages[group.employeeId] || 1;

    return (
      <div
        key={group.employeeId}
        className="rounded-xl border border-green-100 overflow-hidden bg-white"
      >
        <button
          onClick={() => handleToggleExpenseEmployee(group.employeeId)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 transition"
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-green-200 flex-shrink-0">
            <User className="w-4 h-4 text-green-700" />
          </div>

          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-medium truncate block">
              {group.employeeName || `Nhân viên #${group.employeeId}`}
            </span>
            <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-2 gap-y-0.5">
              {group.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {group.phone}
                </span>
              )}
              {group.latestAt && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(group.latestAt).toLocaleString("vi-VN")}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-400">
              {group.unreadCount} chưa đọc / {group.total} thông báo
            </span>
          </div>

          {group.unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">
              {group.unreadCount}
            </span>
          )}

          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="divide-y divide-green-100 bg-gray-50">
            {tab === "unread" && group.unreadCount > 0 && (
              <div className="flex justify-end px-2 py-1">
                <button
                  onClick={() => markExpenseGroupRead(group.employeeId)}
                  className="text-[11px] text-green-600 font-medium"
                >
                  Đánh dấu đã đọc
                </button>
              </div>
            )}

            {isLoadingItems && items.length === 0 && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoadingItems && items.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">
                Không có thông báo
              </p>
            )}

            <div className="space-y-1 p-1">
              {items.map((n) => renderExpenseNotificationItem(n))}
            </div>

            {itemPage < itemTotalPages && (
              <button
                onClick={() =>
                  loadExpenseEmployeeItems(group.employeeId, itemPage + 1)
                }
                disabled={isLoadingItems}
                className="w-full py-2 text-xs font-medium text-green-600 disabled:text-gray-400"
              >
                {isLoadingItems ? "Đang tải..." : "Xem thêm thông báo"}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderExpenseSuggest = () => {
    const tabs = [
      {
        key: "general" as const,
        label: "Theo nhân viên",
        unread: expenseSummary.general.unread,
      },
      {
        key: "overdue" as const,
        label: "Quá hạn",
        unread: expenseSummary.overdue.unread,
      },
    ];

    return (
      <>
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1 sticky top-0 z-[1]">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setExpenseTab(item.key)}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                expenseTab === item.key
                  ? item.key === "overdue"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                  : "text-gray-500"
              }`}
            >
              {item.label}
              {item.unread > 0 && (
                <span
                  className={`ml-1 inline-flex min-w-4 justify-center rounded-full px-1 text-[10px] ${
                    expenseTab === item.key
                      ? "bg-white text-red-500"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {item.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {expenseTab === "general" ? (
          <>
            {expenseGroupsLoading && expenseGroups.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!expenseGroupsLoading && expenseGroups.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">
                Không có thông báo
              </p>
            )}

            <div className="space-y-1">
              {expenseGroups.map(renderExpenseGroupCard)}
            </div>

            {expenseGroupPage < expenseGroupTotalPages && (
              <button
                onClick={() => loadExpenseGroups(expenseGroupPage + 1)}
                disabled={expenseGroupsLoading}
                className="w-full py-2.5 text-green-600 text-sm font-medium disabled:text-gray-400"
              >
                {expenseGroupsLoading ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </>
        ) : (
          <>
            {tab === "unread" && expenseSummary.overdue.unread > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={markOverdueRead}
                  className="text-[11px] text-red-600 font-semibold px-2 py-1"
                >
                  Đọc hết
                </button>
              </div>
            )}

            {overdueLoading && overdueItems.length === 0 && (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!overdueLoading && overdueItems.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">
                Không có cảnh báo quá hạn
              </p>
            )}

            <div className="space-y-1">
              {overdueItems.map((n) => renderExpenseNotificationItem(n, true))}
            </div>

            {overduePage < overdueTotalPages && (
              <button
                onClick={() => loadOverdueItems(overduePage + 1)}
                disabled={overdueLoading}
                className="w-full py-2.5 text-red-600 text-sm font-medium disabled:text-gray-400"
              >
                {overdueLoading ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </>
        )}
      </>
    );
  };

  const renderDirectorReportGroups = () => {
    const isReportDateToday = reportDate === toDateString(new Date());

    return (
      <>
        <div className="sticky top-0 z-[2] flex items-center gap-2 bg-white px-1 pb-1.5 pt-0.5">
          <input
            type="date"
            value={reportDate}
            max={toDateString(new Date())}
            onChange={(e) => {
              if (e.target.value) setReportDate(e.target.value);
            }}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          />
          {!isReportDateToday && (
            <button
              onClick={() => setReportDate(toDateString(new Date()))}
              className="shrink-0 rounded-lg bg-orange-50 px-2 py-1.5 text-[11px] font-medium text-orange-600 hover:bg-orange-100"
            >
              Hôm nay
            </button>
          )}
        </div>

        {groupsLoading && daySections.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : daySections.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            Không có thông báo
          </p>
        ) : (
          <>
            {daySections.map((section) => (
              <div key={section.date}>
                <div className="flex items-center gap-1.5 px-2 py-1.5 sticky top-[38px] bg-white z-[1]">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-semibold text-orange-600">
                    {formatDayLabel(section.date)}
                  </span>
                </div>

                <div className="space-y-1">
                  {section.groups.map((group) =>
                    renderSenderCard(group, section.date)
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
        )}
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
        className={`fixed top-0 right-0 bg-white z-[9999] rounded-l-2xl shadow-2xl flex flex-col overflow-hidden transition-[max-width,height] duration-200 ${
          expanded
            ? "w-full max-w-[900px] h-[100dvh]"
            : "w-[95%] max-w-[380px] h-[75dvh]"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-white shadow-sm sticky top-0 z-10">
          <Bell className="w-5 h-5 text-blue-500" />
          <span className="font-semibold">Thông báo</span>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? "Thu gọn" : "Mở rộng"}
            aria-label={expanded ? "Thu gọn thông báo" : "Mở rộng thông báo"}
            aria-pressed={expanded}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 active:scale-95"
          >
            {expanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
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
                  key={`${item.key}-${item.teachingType || "category"}`}
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => {
                    setTypeTab(item.key);
                    if (item.teachingType)
                      setTeachingTypeTab(item.teachingType);
                  }}
                  className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition ${
                    typeTab === item.key &&
                    (!item.teachingType ||
                      teachingTypeTab === item.teachingType)
                      ? item.activeClass
                      : "text-gray-400"
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

          <div className="flex-1 min-w-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-y-auto p-1 space-y-1">
              {isDirectorReport ? (
                renderDirectorReportGroups()
              ) : isExpenseSuggest ? (
                renderExpenseSuggest()
              ) : (
                <>
                  {typeFiltered.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-6">
                      Không có thông báo
                    </p>
                  )}

                  {typeFiltered.map(renderNotificationItem)}

                  {(hasMore?.[typeTab]?.[tab] ?? false) && (
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
      </div>
      {locationRequestId && (
        <TeacherLocationChangeModal
          requestId={locationRequestId}
          onClose={() => setLocationRequestId(null)}
        />
      )}
    </>,
    document.body
  );
}
