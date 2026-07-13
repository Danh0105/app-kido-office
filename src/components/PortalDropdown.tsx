import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Bell,
  FileText,
  Lightbulb,
  ClipboardList,
  CalendarDays,
  ChevronDown,
  User,
  Calendar,
  AlertTriangle,
  Phone,
  Clock,
} from "lucide-react";

import { hasRole } from "@/utils/auth";
import { reportNotificationApi } from "@/service/notification";
import { employeeApi } from "@/service/employee";
import { expenseNotificationApi } from "@/service/expenseRequest";
import type {
  ExpenseNotification,
  ExpenseNotificationEmployeeGroup,
  ExpenseNotificationSummary,
} from "@/types/expenseRequest";
import { STATUS_LABEL } from "@/types/expenseRequest";

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
    suggestType?: string;
    suggestId?: number;
    suggestCode?: string;
    employeeId?: number;
    employeeName?: string;
    employeePhone?: string;
    kind?: string;
    status?: string;
    daysLate?: number;
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

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type ExpenseDropdownTab = "general" | "overdue";

const EXPENSE_LIMIT = 20;

const emptyExpenseSummary: ExpenseNotificationSummary = {
  general: { total: 0, unread: 0 },
  overdue: { total: 0, unread: 0 },
};

const groupExpenseNotifications = (items: ExpenseNotification[]) => {
  const fallbackIds = new Map<string, number>();
  let fallbackId = -1;
  const groups = new Map<
    number,
    ExpenseNotificationEmployeeGroup & { items: ExpenseNotification[] }
  >();

  items.forEach((item) => {
    const meta = item.meta || {};
    const employeeName = meta.employeeName?.trim();
    const fallbackKey = employeeName || meta.employeePhone || "Không rõ nhân viên";
    const employeeId =
      typeof meta.employeeId === "number" && meta.employeeId > 0
        ? meta.employeeId
        : fallbackIds.get(fallbackKey) ||
          (() => {
            fallbackIds.set(fallbackKey, fallbackId);
            return fallbackId--;
          })();
    const current = groups.get(employeeId);
    const createdAt = item.createdAt || "";

    if (!current) {
      groups.set(employeeId, {
        employeeId,
        employeeName: employeeName || fallbackKey,
        phone: meta.employeePhone,
        total: 1,
        unreadCount: item.isRead ? 0 : 1,
        latestAt: createdAt,
        items: [item],
      });
      return;
    }

    current.total += 1;
    current.unreadCount += item.isRead ? 0 : 1;
    current.items.push(item);
    if (
      createdAt &&
      (!current.latestAt ||
        new Date(createdAt).getTime() > new Date(current.latestAt).getTime())
    ) {
      current.latestAt = createdAt;
    }
  });

  return Array.from(groups.values()).sort(
    (a, b) =>
      new Date(b.latestAt || 0).getTime() -
        new Date(a.latestAt || 0).getTime() ||
      b.unreadCount - a.unreadCount,
  );
};

type EmployeeLite = {
  id: number;
  name?: string;
  phone?: string;
};

const expenseEmployeeCache = new Map<number, EmployeeLite | null>();

const pickEmployeeText = (...values: unknown[]) =>
  values.find((value) => typeof value === "string" && value.trim()) as
    | string
    | undefined;

const normalizeExpenseEmployee = (payload: any, fallbackId: number) => {
  let data =
    payload?.data ??
    payload?.employee ??
    payload?.user ??
    payload?.profile ??
    payload;

  data = Array.isArray(data) ? data[0] : data;

  if (data?.employee && typeof data.employee === "object" && !data.name) {
    data = data.employee;
  } else if (data?.user && typeof data.user === "object" && !data.name) {
    data = data.user;
  } else if (data?.profile && typeof data.profile === "object" && !data.name) {
    data = data.profile;
  }

  if (!data || typeof data !== "object") return null;

  const id = Number(data.id ?? data.employeeId ?? data.userId ?? fallbackId);
  const employee = {
    id: Number.isFinite(id) && id > 0 ? id : fallbackId,
    name: pickEmployeeText(
      data.name,
      data.displayName,
      data.fullName,
      data.full_name,
      data.employeeName,
      data.employee_name,
      data.username,
    ),
    phone: pickEmployeeText(
      data.phone,
      data.phoneNumber,
      data.phone_number,
      data.mobile,
    ),
  };

  return employee.name || employee.phone ? employee : null;
};

const expenseNotificationEmployeeId = (item: ExpenseNotification) => {
  const metaId = Number(item.meta?.employeeId);
  if (Number.isFinite(metaId) && metaId > 0) return metaId;

  const senderId = Number(item.senderId);
  if (Number.isFinite(senderId) && senderId > 0) return senderId;

  return undefined;
};

const resolveExpenseEmployees = async (items: ExpenseNotification[]) => {
  const ids = Array.from(
    new Set(
      items
        .map(expenseNotificationEmployeeId)
        .filter((id): id is number => Boolean(id)),
    ),
  );

  const entries = await Promise.all(
    ids.map(async (id) => {
      if (expenseEmployeeCache.has(id)) {
        return [id, expenseEmployeeCache.get(id)] as const;
      }

      try {
        const payload = await employeeApi.getById(id);
        const employee = normalizeExpenseEmployee(payload, id);
        expenseEmployeeCache.set(id, employee);
        return [id, employee] as const;
      } catch (error) {
        console.warn(`Không tải được nhân viên #${id}`, error);
        expenseEmployeeCache.set(id, null);
        return [id, null] as const;
      }
    }),
  );

  return new Map(
    entries.filter(
      (entry): entry is readonly [number, EmployeeLite] => entry[1] !== null,
    ),
  );
};

const groupExpenseNotificationsByCreator = (
  items: ExpenseNotification[],
  employeesById: Map<number, EmployeeLite>,
) => {
  const fallbackIds = new Map<string, number>();
  let fallbackId = -1;
  const groups = new Map<
    number,
    ExpenseNotificationEmployeeGroup & { items: ExpenseNotification[] }
  >();

  items.forEach((item) => {
    const meta = item.meta || {};
    const knownEmployeeId = expenseNotificationEmployeeId(item);
    const employee = knownEmployeeId
      ? employeesById.get(knownEmployeeId)
      : undefined;
    const employeeName = meta.employeeName?.trim() || employee?.name;
    const employeePhone = meta.employeePhone || employee?.phone;
    const fallbackKey =
      employeeName || employeePhone || `Nhân viên #${knownEmployeeId || "?"}`;
    const employeeId =
      knownEmployeeId ||
      fallbackIds.get(fallbackKey) ||
      (() => {
        fallbackIds.set(fallbackKey, fallbackId);
        return fallbackId--;
      })();
    const current = groups.get(employeeId);
    const createdAt = item.createdAt || "";

    if (!current) {
      groups.set(employeeId, {
        employeeId,
        employeeName: employeeName || fallbackKey,
        phone: employeePhone,
        total: 1,
        unreadCount: item.isRead ? 0 : 1,
        latestAt: createdAt,
        items: [item],
      });
      return;
    }

    current.total += 1;
    current.unreadCount += item.isRead ? 0 : 1;
    current.items.push(item);
    if (
      createdAt &&
      (!current.latestAt ||
        new Date(createdAt).getTime() > new Date(current.latestAt).getTime())
    ) {
      current.latestAt = createdAt;
    }
  });

  return Array.from(groups.values()).sort(
    (a, b) =>
      new Date(b.latestAt || 0).getTime() -
        new Date(a.latestAt || 0).getTime() ||
      b.unreadCount - a.unreadCount,
  );
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
  const isEmployee = hasRole("employee");
  const isSuggestOnlyRole = hasRole("ketoan_congno", "ketoan_truong", "troly_gd");

  const [loadingMore, setLoadingMore] = useState(false);
  const [typeTab, setTypeTab] = useState<NotificationType>(
    isSuggestOnlyRole ? "SUGGEST" : "POLICY",
  );

  const unreadPolicyCount = notificationStats?.POLICY.unread;
  const unreadSuggestCount = notificationStats?.SUGGEST.unread;
  const unreadReportCount = notificationStats?.REPORT.unread;
  const unreadPlanCount = notificationStats?.WEEKLY_PLAN.unread;

  const notificationMenus: {
    key: NotificationType;
    icon: any;
    count: number;
    activeClass: string;
  }[] = isSuggestOnlyRole
    ? [
        {
          key: "SUGGEST",
          icon: Lightbulb,
          count: unreadSuggestCount,
          activeClass: "bg-green-100 text-green-600",
        },
      ]
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
  const [expandedExpenseEmployee, setExpandedExpenseEmployee] =
    useState<number | null>(null);
  const [expenseEmployeeItems, setExpenseEmployeeItems] = useState<
    Record<number, ExpenseNotification[]>
  >({});
  const [expenseEmployeeLoading, setExpenseEmployeeLoading] =
    useState<number | null>(null);
  const [overdueItems, setOverdueItems] = useState<ExpenseNotification[]>([]);
  const [overduePage, setOverduePage] = useState(1);
  const [overdueTotalPages, setOverdueTotalPages] = useState(1);
  const [overdueLoading, setOverdueLoading] = useState(false);

  const isDirectorReport = typeTab === "REPORT" && !isEmployee;
  const isExpenseSuggest = typeTab === "SUGGEST";

  // Chỉ hiển thị nhân viên kinh doanh trong phần thông báo báo cáo.
  const salesEmployeeIdsRef = useRef<Set<number> | null>(null);

  const getSalesEmployeeIds = useCallback(async () => {
    if (salesEmployeeIdsRef.current) return salesEmployeeIdsRef.current;
    try {
      const response = await employeeApi.getSales();
      const data: Array<{ id: number }> = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
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
        salesEmployeeIds.has(g.senderId),
      );
      return { date: res.date || date, groups } as DaySection;
    },
    [tab, getSalesEmployeeIds],
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
      setExpenseGroupsLoading(true);
      try {
        const res = await expenseNotificationApi.getGroupedByEmployee({
          scope: "general",
          tab,
          page,
          limit: EXPENSE_LIMIT,
        });
        const groupedData = Array.isArray(res.data) ? res.data : [];

        if (page === 1 && groupedData.length === 0) {
          const flatRes = await expenseNotificationApi.getAll(
            1,
            EXPENSE_LIMIT,
            tab,
            { scope: "general" },
          );
          const flatItems = Array.isArray(flatRes.data) ? flatRes.data : [];
          const employeesById = await resolveExpenseEmployees(flatItems);
          const fallbackGroups = groupExpenseNotificationsByCreator(
            flatItems,
            employeesById,
          );

          if (flatItems.length > 0) {
            console.info("Expense notification grouped fallback", {
              grouped: res,
              flat: flatRes,
            });
          }

          setExpenseGroups(fallbackGroups);
          setExpenseEmployeeItems(
            Object.fromEntries(
              fallbackGroups.map((group) => [group.employeeId, group.items]),
            ) as Record<number, ExpenseNotification[]>,
          );
          setExpenseGroupPage(1);
          setExpenseGroupTotalPages(flatRes.totalPages || 1);
          return;
        }

        setExpenseGroups((prev) =>
          page > 1 ? [...prev, ...groupedData] : groupedData,
        );
        setExpenseGroupPage(res.page || page);
        setExpenseGroupTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error("Failed to fetch grouped expense notifications:", err);
      } finally {
        setExpenseGroupsLoading(false);
      }
    },
    [tab],
  );

  const loadExpenseEmployeeItems = useCallback(
    async (employeeId: number) => {
      setExpenseEmployeeLoading(employeeId);
      try {
        const res = await expenseNotificationApi.getAll(1, 50, tab, {
          scope: "general",
          employeeId,
        });
        setExpenseEmployeeItems((prev) => ({
          ...prev,
          [employeeId]: res.data || [],
        }));
      } catch (err) {
        console.error("Failed to fetch employee expense notifications:", err);
      } finally {
        setExpenseEmployeeLoading(null);
      }
    },
    [tab],
  );

  const loadOverdueItems = useCallback(
    async (page = 1) => {
      setOverdueLoading(true);
      try {
        const res = await expenseNotificationApi.getAll(page, EXPENSE_LIMIT, tab, {
          scope: "overdue",
        });
        setOverdueItems((prev) =>
          page > 1 ? [...prev, ...(res.data || [])] : res.data || [],
        );
        setOverduePage(res.page || page);
        setOverdueTotalPages(res.totalPages || 1);
      } catch (err) {
        console.error("Failed to fetch overdue expense notifications:", err);
      } finally {
        setOverdueLoading(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    if (!open || !isExpenseSuggest) return;

    loadExpenseSummary();
    if (expenseTab === "overdue") {
      loadOverdueItems(1);
    } else {
      setExpandedExpenseEmployee(null);
      setExpenseEmployeeItems({});
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
    if (isSuggestOnlyRole && typeTab !== "SUGGEST") {
      setTypeTab("SUGGEST");
    } else if (isEmployee && typeTab === "WEEKLY_PLAN") {
      setTypeTab("POLICY");
    }
  }, [isEmployee, isSuggestOnlyRole, typeTab]);

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

  const clickExpenseNotification = (n: ExpenseNotification) => {
    onClickNotification(n as unknown as Notification);
    setExpenseEmployeeItems((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([employeeId, items]) => [
          employeeId,
          items.map((item) =>
            item.id === n.id ? { ...item, isRead: true } : item,
          ),
        ]),
      ) as Record<number, ExpenseNotification[]>,
    );
    setOverdueItems((items) =>
      items.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
    );
  };

  const handleToggleExpenseEmployee = async (employeeId: number) => {
    if (expandedExpenseEmployee === employeeId) {
      setExpandedExpenseEmployee(null);
      return;
    }

    setExpandedExpenseEmployee(employeeId);
    if (!expenseEmployeeItems[employeeId]) {
      await loadExpenseEmployeeItems(employeeId);
    }
  };

  const markExpenseGroupRead = async (employeeId: number) => {
    try {
      if (employeeId > 0) {
        await expenseNotificationApi.markAllAsRead({
          scope: "general",
          employeeId,
        });
      } else {
        const items = expenseEmployeeItems[employeeId] || [];
        await Promise.all(
          items
            .filter((item) => !item.isRead)
            .map((item) => expenseNotificationApi.markAsRead(item.id)),
        );
      }
      await Promise.all([
        loadExpenseSummary(),
        loadExpenseGroups(expenseGroupPage),
        employeeId > 0
          ? loadExpenseEmployeeItems(employeeId)
          : Promise.resolve(undefined),
      ]);
    } catch (err) {
      console.error("Failed to mark expense group as read:", err);
    }
  };

  const markOverdueRead = async () => {
    try {
      await expenseNotificationApi.markAllAsRead({ scope: "overdue" });
      await Promise.all([loadExpenseSummary(), loadOverdueItems(overduePage)]);
    } catch (err) {
      console.error("Failed to mark overdue expenses as read:", err);
    }
  };

  const renderExpenseNotificationItem = (
    n: ExpenseNotification,
    overdue = false,
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
          <div className="flex items-start gap-1.5">
            {overdue && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <p className="text-[13px] leading-tight line-clamp-3">
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
            <div className="flex justify-end px-2 py-1">
              <button
                onClick={() => markExpenseGroupRead(group.employeeId)}
                className="text-[11px] text-green-600 font-medium"
              >
                Đánh dấu đã đọc
              </button>
            </div>

            {isLoadingItems && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isLoadingItems && items.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">
                Không có thông báo
              </p>
            )}

            <div className="space-y-1 p-1">{items.map((n) => renderExpenseNotificationItem(n))}</div>
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

            <div className="space-y-1">{expenseGroups.map(renderExpenseGroupCard)}</div>

            {expenseGroupPage < expenseGroupTotalPages && (
              <button
                onClick={() => loadExpenseGroups(expenseGroupPage + 1)}
                className="w-full py-2.5 text-green-600 text-sm font-medium"
              >
                Xem thêm
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-end">
              <button
                onClick={markOverdueRead}
                className="text-[11px] text-red-600 font-semibold px-2 py-1"
              >
                Đọc hết
              </button>
            </div>

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
                className="w-full py-2.5 text-red-600 text-sm font-medium"
              >
                Xem thêm
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
