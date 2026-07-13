import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { AlertTriangle, ChevronDown, Clock, Phone, User } from "lucide-react";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { expenseNotificationApi } from "@/service/expenseRequest";
import type {
  ExpenseNotification,
  ExpenseNotificationEmployeeGroup,
  ExpenseNotificationSummary,
} from "@/types/expenseRequest";
import { STATUS_LABEL } from "@/types/expenseRequest";

import { useExpenseSocket } from "./useExpenseSocket";
import { expenseBasePath, formatDateTime } from "./lib";

type MainTab = "employee" | "overdue";

const LIMIT = 20;

const emptySummary: ExpenseNotificationSummary = {
  general: { total: 0, unread: 0 },
  overdue: { total: 0, unread: 0 },
};

const cx = (...classes: Array<string | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function ExpenseNotifications() {
  const navigate = useNavigate();
  const base = expenseBasePath();

  const [activeTab, setActiveTab] = useState<MainTab>("employee");
  const [summary, setSummary] = useState<ExpenseNotificationSummary>(emptySummary);

  const [groups, setGroups] = useState<ExpenseNotificationEmployeeGroup[]>([]);
  const [groupPage, setGroupPage] = useState(1);
  const [groupTotalPages, setGroupTotalPages] = useState(1);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);
  const [employeeItems, setEmployeeItems] = useState<
    Record<number, ExpenseNotification[]>
  >({});
  const [employeeLoading, setEmployeeLoading] = useState<number | null>(null);

  const [overdueItems, setOverdueItems] = useState<ExpenseNotification[]>([]);
  const [overduePage, setOverduePage] = useState(1);
  const [overdueTotalPages, setOverdueTotalPages] = useState(1);
  const [overdueLoading, setOverdueLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const res = await expenseNotificationApi.getSummary();
      setSummary({
        general: res.general || emptySummary.general,
        overdue: res.overdue || emptySummary.overdue,
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadGroups = useCallback(async (page = 1) => {
    setGroupsLoading(true);
    try {
      const res = await expenseNotificationApi.getGroupedByEmployee({
        scope: "general",
        page,
        limit: LIMIT,
      });
      setGroups(res.data || []);
      setGroupPage(res.page || page);
      setGroupTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được thông báo theo nhân viên");
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadEmployeeItems = useCallback(async (employeeId: number) => {
    setEmployeeLoading(employeeId);
    try {
      const res = await expenseNotificationApi.getAll(1, 50, undefined, {
        scope: "general",
        employeeId,
      });
      setEmployeeItems((prev) => ({
        ...prev,
        [employeeId]: res.data || [],
      }));
    } catch (e) {
      console.error(e);
      toast.error("Không tải được thông báo của nhân viên");
    } finally {
      setEmployeeLoading(null);
    }
  }, []);

  const loadOverdue = useCallback(async (page = 1) => {
    setOverdueLoading(true);
    try {
      const res = await expenseNotificationApi.getAll(page, LIMIT, undefined, {
        scope: "overdue",
      });
      setOverdueItems(res.data || []);
      setOverduePage(res.page || page);
      setOverdueTotalPages(res.totalPages || 1);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được thông báo quá hạn");
    } finally {
      setOverdueLoading(false);
    }
  }, []);

  const refreshCurrentTab = useCallback(() => {
    if (activeTab === "overdue") {
      loadOverdue(overduePage);
      return;
    }

    loadGroups(groupPage);
    if (expandedEmployeeId) loadEmployeeItems(expandedEmployeeId);
  }, [
    activeTab,
    expandedEmployeeId,
    groupPage,
    loadEmployeeItems,
    loadGroups,
    loadOverdue,
    overduePage,
  ]);

  useEffect(() => {
    loadSummary();
    loadGroups(1);
  }, [loadGroups, loadSummary]);

  useEffect(() => {
    if (activeTab === "overdue") loadOverdue(1);
  }, [activeTab, loadOverdue]);

  useExpenseSocket((n) => {
    if (n.meta?.suggestType !== "EXPENSE_REQUEST") return;
    loadSummary();
    refreshCurrentTab();
    toast(n.title || n.message || "Thông báo đề xuất chi mới");
  });

  const openNotification = async (n: ExpenseNotification) => {
    if (!n.isRead) {
      try {
        await expenseNotificationApi.markAsRead(n.id);
        setEmployeeItems((prev) => markItemRead(prev, n.id));
        setOverdueItems((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
        );
        loadSummary();
        if (activeTab === "employee") loadGroups(groupPage);
      } catch {
        /* keep navigation non-blocking */
      }
    }

    const entityId = n.meta?.suggestId ?? n.entityId;
    if (entityId) navigate(`${base}/${entityId}`);
  };

  const toggleEmployee = async (employeeId: number) => {
    if (expandedEmployeeId === employeeId) {
      setExpandedEmployeeId(null);
      return;
    }

    setExpandedEmployeeId(employeeId);
    if (!employeeItems[employeeId]) {
      await loadEmployeeItems(employeeId);
    }
  };

  const markGroupRead = async (employeeId: number) => {
    try {
      await expenseNotificationApi.markAllAsRead({
        scope: "general",
        employeeId,
      });
      await Promise.all([loadSummary(), loadGroups(groupPage), loadEmployeeItems(employeeId)]);
      toast.success("Đã đánh dấu nhóm là đã đọc");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const markOverdueRead = async () => {
    try {
      await expenseNotificationApi.markAllAsRead({ scope: "overdue" });
      await Promise.all([loadSummary(), loadOverdue(overduePage)]);
      toast.success("Đã đọc hết thông báo quá hạn");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
    }
  };

  const tabs = useMemo(
    () => [
      {
        key: "employee" as const,
        label: "Theo nhân viên",
        unread: summary.general.unread,
      },
      {
        key: "overdue" as const,
        label: "Quá hạn",
        unread: summary.overdue.unread,
      },
    ],
    [summary],
  );

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title="Thông báo đề xuất chi" />

      <div className="flex-1 mt-[60px] px-3 pb-28 pt-2 space-y-3">
        <div className="grid grid-cols-2 gap-2 bg-white p-1 rounded-xl shadow-sm">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={cx(
                "relative rounded-lg px-2 py-2 text-sm font-semibold transition",
                activeTab === item.key
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-gray-500",
              )}
            >
              {item.label}
              {item.unread > 0 && (
                <span
                  className={cx(
                    "ml-2 inline-flex min-w-5 justify-center rounded-full px-1.5 text-[11px]",
                    activeTab === item.key
                      ? "bg-white text-blue-600"
                      : "bg-red-500 text-white",
                  )}
                >
                  {item.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "employee" ? (
          <EmployeeGroups
            groups={groups}
            loading={groupsLoading}
            page={groupPage}
            totalPages={groupTotalPages}
            expandedEmployeeId={expandedEmployeeId}
            employeeItems={employeeItems}
            employeeLoading={employeeLoading}
            onToggle={toggleEmployee}
            onOpen={openNotification}
            onMarkGroupRead={markGroupRead}
            onPageChange={loadGroups}
          />
        ) : (
          <OverdueList
            items={overdueItems}
            loading={overdueLoading}
            page={overduePage}
            totalPages={overdueTotalPages}
            onOpen={openNotification}
            onMarkRead={markOverdueRead}
            onPageChange={loadOverdue}
          />
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function EmployeeGroups({
  groups,
  loading,
  page,
  totalPages,
  expandedEmployeeId,
  employeeItems,
  employeeLoading,
  onToggle,
  onOpen,
  onMarkGroupRead,
  onPageChange,
}: {
  groups: ExpenseNotificationEmployeeGroup[];
  loading: boolean;
  page: number;
  totalPages: number;
  expandedEmployeeId: number | null;
  employeeItems: Record<number, ExpenseNotification[]>;
  employeeLoading: number | null;
  onToggle: (employeeId: number) => void;
  onOpen: (n: ExpenseNotification) => void;
  onMarkGroupRead: (employeeId: number) => void;
  onPageChange: (page: number) => void;
}) {
  if (loading && groups.length === 0) return <LoadingText />;

  if (!loading && groups.length === 0) {
    return <EmptyText label="Chưa có thông báo đề xuất chi" />;
  }

  return (
    <>
      <div className="space-y-2">
        {groups.map((group) => {
          const isOpen = expandedEmployeeId === group.employeeId;
          const items = employeeItems[group.employeeId] || [];
          const isLoadingItems = employeeLoading === group.employeeId;

          return (
            <div
              key={group.employeeId}
              className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden"
            >
              <button
                onClick={() => onToggle(group.employeeId)}
                className="w-full p-3 flex items-center gap-3 text-left active:bg-gray-50"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    {group.employeeName || `Nhân viên #${group.employeeId}`}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-gray-500">
                    {group.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} />
                        {group.phone}
                      </span>
                    )}
                    {group.latestAt && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {formatDateTime(group.latestAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    <Badge tone="gray">{group.total} thông báo</Badge>
                    {group.unreadCount > 0 && (
                      <Badge tone="red">{group.unreadCount} chưa đọc</Badge>
                    )}
                  </div>
                </div>

                <ChevronDown
                  size={18}
                  className={cx(
                    "text-gray-400 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-2 space-y-2">
                  <div className="flex justify-end">
                    <button
                      onClick={() => onMarkGroupRead(group.employeeId)}
                      className="text-xs text-blue-600 font-medium px-2 py-1"
                    >
                      Đánh dấu đã đọc
                    </button>
                  </div>

                  {isLoadingItems && <LoadingText compact />}
                  {!isLoadingItems && items.length === 0 && (
                    <EmptyText label="Không có thông báo" compact />
                  )}
                  {items.map((item) => (
                    <NotificationItem key={item.id} item={item} onOpen={onOpen} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}

function OverdueList({
  items,
  loading,
  page,
  totalPages,
  onOpen,
  onMarkRead,
  onPageChange,
}: {
  items: ExpenseNotification[];
  loading: boolean;
  page: number;
  totalPages: number;
  onOpen: (n: ExpenseNotification) => void;
  onMarkRead: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={onMarkRead}
          className="text-xs text-red-600 font-semibold px-3 py-1"
        >
          Đọc hết
        </button>
      </div>

      {loading && items.length === 0 && <LoadingText />}
      {!loading && items.length === 0 && (
        <EmptyText label="Không có đề xuất quá hạn" />
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <NotificationItem key={item.id} item={item} onOpen={onOpen} overdue />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </>
  );
}

function NotificationItem({
  item,
  onOpen,
  overdue,
}: {
  item: ExpenseNotification;
  onOpen: (n: ExpenseNotification) => void;
  overdue?: boolean;
}) {
  const daysLate = item.meta?.daysLate;
  const status = item.meta?.status;

  return (
    <button
      onClick={() => onOpen(item)}
      className={cx(
        "w-full rounded-xl p-3 shadow-sm border text-left active:scale-[0.99] transition",
        overdue
          ? item.isRead
            ? "bg-white border-red-100"
            : "bg-red-50 border-red-200"
          : item.isRead
          ? "bg-white border-gray-100"
          : "bg-blue-50 border-blue-200",
      )}
    >
      <div className="flex items-start gap-2">
        {!item.isRead && (
          <span
            className={cx(
              "mt-1.5 w-2 h-2 rounded-full shrink-0",
              overdue ? "bg-red-500" : "bg-blue-500",
            )}
          />
        )}
        {overdue && <AlertTriangle size={16} className="text-red-500 mt-0.5" />}

        <div className="min-w-0 flex-1">
          {item.title && (
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          )}
          {item.message && <p className="text-sm text-gray-700">{item.message}</p>}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {overdue && typeof daysLate === "number" && (
              <Badge tone="red">Quá hạn {daysLate} ngày</Badge>
            )}
            {status && <Badge tone="amber">{STATUS_LABEL(status)}</Badge>}
            {item.meta?.suggestCode && (
              <Badge tone="gray">{item.meta.suggestCode}</Badge>
            )}
          </div>

          {item.createdAt && (
            <p className="text-[11px] text-gray-400 mt-1">
              {formatDateTime(item.createdAt)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "gray" | "red" | "amber";
}) {
  const classes = {
    gray: "bg-gray-100 text-gray-600",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-700",
  };

  return (
    <span className={cx("rounded-full px-2 py-0.5 text-[11px]", classes[tone])}>
      {children}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-3 py-1.5 rounded-lg bg-white border text-sm disabled:text-gray-300"
      >
        Trước
      </button>
      <span className="text-xs text-gray-500">
        {page}/{totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-3 py-1.5 rounded-lg bg-white border text-sm disabled:text-gray-300"
      >
        Sau
      </button>
    </div>
  );
}

function LoadingText({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        "text-center text-gray-400 text-sm",
        compact ? "py-4" : "py-10",
      )}
    >
      Đang tải...
    </div>
  );
}

function EmptyText({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div
      className={cx(
        "text-center text-gray-400 text-sm",
        compact ? "py-4" : "py-16",
      )}
    >
      {label}
    </div>
  );
}

function markItemRead(
  store: Record<number, ExpenseNotification[]>,
  id: number,
) {
  return Object.fromEntries(
    Object.entries(store).map(([employeeId, items]) => [
      employeeId,
      items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    ]),
  ) as Record<number, ExpenseNotification[]>;
}
