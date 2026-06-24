import { type ReactNode, useEffect, useMemo, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import ReportDetailPopup from "@/components/ReportDetailPopup";
import { weeklyPlanApi } from "@/service/plan";
import { dailyReportApi } from "@/service/report";
import {
    CalendarDays,
    Clock,
    ClipboardList,
    FileText,
    Loader2,
    MapPin,
    MessageCircle,
    X,
} from "lucide-react";
import { useParams } from "react-router-dom";

type Task = {
    id: number;
    title: string;
    content?: string;
    location?: string;
    createdAt?: string;
    dayOfWeek?: number;
    planId?: number;
};

type DayData = {
    plans: Task[];
    reports: Task[];
    reportId: number | null;
};

type WeekDay = {
    date: string;
    data: DayData;
    isInMonth: boolean;
    isToday: boolean;
};

type WeekGroup = {
    key: string;
    label: string;
    days: WeekDay[];
    totalPlans: number;
    totalReports: number;
    missingReports: number;
};

type MonthGroup = {
    key: string;
    label: string;
    weeks: WeekGroup[];
    totalPlans: number;
    totalReports: number;
    missingReports: number;
};

type TaskListModalData = {
    title: string;
    subtitle: string;
    items: Task[];
    tone: "blue" | "emerald";
};

const emptyDay = (): DayData => ({ plans: [], reports: [], reportId: null });

const parseDate = (date: string) => {
    if (!date) return new Date(NaN);
    return new Date(date.includes("T") ? date : `${date}T00:00:00`);
};

const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
    ).padStart(2, "0")}`;

const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(date.getDate() + days);
    return next;
};

const getMonday = (date: Date) => {
    const next = new Date(date);
    const day = next.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    next.setDate(next.getDate() + diff);
    return next;
};

const formatDateShort = (date: string) => {
    const d = parseDate(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1,
    ).padStart(2, "0")}`;
};

const formatDateTime = (date?: string) => {
    if (!date) return "";
    return parseDate(date).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const getDayNumber = (date: string) => String(parseDate(date).getDate()).padStart(2, "0");

const getMonthKey = (date: string) => {
    const d = parseDate(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (date: string) => {
    const d = parseDate(date);
    return `TH${d.getMonth() + 1}`;
};

const getDateFromPlan = (startDate: string, endDate: string, dayOfWeek?: number) => {
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
    if (typeof dayOfWeek !== "number") return toDateKey(start);

    const date = new Date(start);
    date.setDate(start.getDate() + (dayOfWeek - start.getDay()));

    return toDateKey(date);
};

const isDateInRange = (date: string, start: string, end: string) =>
    date >= start && date <= end;

const ensureDay = (days: Record<string, DayData>, date: string) => {
    if (!days[date]) {
        days[date] = emptyDay();
    }

    return days[date];
};

const mergeTask = (items: Task[], nextTask: Task) => {
    if (!items.some((item) => item.id === nextTask.id)) {
        items.push(nextTask);
    }
};

const mapByDate = (resReport: any[] = [], resPlan: any[] = []) => {
    const days: Record<string, DayData> = {};

    resReport.forEach((week: any) => {
        week.reports?.forEach((report: any) => {
            const day = ensureDay(days, report.date);

            if (!day.reportId) day.reportId = report.id;

            report.tasks?.forEach((task: any) => {
                mergeTask(day.reports, task);
            });
        });
    });

    resPlan.forEach((plan: any) => {
        plan.tasks?.forEach((task: any) => {
            const date = getDateFromPlan(plan.startDate, plan.endDate, task.dayOfWeek);

            if (!date || !isDateInRange(date, plan.startDate, plan.endDate)) return;

            mergeTask(ensureDay(days, date).plans, {
                ...task,
                planId: plan.id,
            });
        });
    });

    return days;
};

const createWeek = (
    weekStartKey: string,
    monthKey: string,
    daysByDate: Record<string, DayData>,
) => {
    const weekStart = parseDate(weekStartKey);
    const todayKey = toDateKey(new Date());
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = toDateKey(addDays(weekStart, index));
        const isInMonth = getMonthKey(date) === monthKey;

        return {
            date,
            data: isInMonth ? daysByDate[date] || emptyDay() : emptyDay(),
            isInMonth,
            isToday: date === todayKey,
        };
    });

    const activeDays = days.filter((day) => day.isInMonth);
    const weekEndKey = days[6].date;

    return {
        key: weekStartKey,
        label: `${formatDateShort(weekStartKey)} - ${formatDateShort(weekEndKey)}`,
        days,
        totalPlans: activeDays.reduce((sum, day) => sum + day.data.plans.length, 0),
        totalReports: activeDays.reduce((sum, day) => sum + day.data.reports.length, 0),
        missingReports: activeDays.filter(
            (day) => day.data.plans.length > 0 && day.data.reports.length === 0,
        ).length,
    } satisfies WeekGroup;
};

const getMonthGroups = (daysByDate: Record<string, DayData>) => {
    const groups = new Map<
        string,
        MonthGroup & { weekMap: Map<string, WeekGroup> }
    >();

    Object.entries(daysByDate).forEach(([date, data]) => {
        const monthKey = getMonthKey(date);
        const weekStartKey = toDateKey(getMonday(parseDate(date)));
        const group =
            groups.get(monthKey) ||
            ({
                key: monthKey,
                label: getMonthLabel(date),
                weeks: [],
                weekMap: new Map<string, WeekGroup>(),
                totalPlans: 0,
                totalReports: 0,
                missingReports: 0,
            } satisfies MonthGroup & { weekMap: Map<string, WeekGroup> });

        if (!group.weekMap.has(weekStartKey)) {
            const week = createWeek(weekStartKey, monthKey, daysByDate);
            group.weekMap.set(weekStartKey, week);
            group.weeks.push(week);
        }

        group.totalPlans += data.plans.length;
        group.totalReports += data.reports.length;
        if (data.plans.length > 0 && data.reports.length === 0) {
            group.missingReports += 1;
        }

        groups.set(monthKey, group);
    });

    return Array.from(groups.values())
        .map(({ weekMap, ...group }) => ({
            ...group,
            weeks: group.weeks.sort((a, b) => b.key.localeCompare(a.key)),
        }))
        .sort((a, b) => b.key.localeCompare(a.key));
};

export default function DailyReportPage() {
    const { employeeId } = useParams();
    const id = Number(employeeId);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [planHistories, setPlanHistories] = useState<Record<number, any[]>>({});
    const [taskHistories, setTaskHistories] = useState<any[]>([]);
    const [daysByDate, setDaysByDate] = useState<Record<string, DayData>>({});
    const [taskListModal, setTaskListModal] = useState<TaskListModalData | null>(null);

    const monthGroups = useMemo(() => getMonthGroups(daysByDate), [daysByDate]);

    const totals = useMemo(
        () =>
            monthGroups.reduce(
                (sum, month) => ({
                    plans: sum.plans + month.totalPlans,
                    reports: sum.reports + month.totalReports,
                    missing: sum.missing + month.missingReports,
                }),
                { plans: 0, reports: 0, missing: 0 },
            ),
        [monthGroups],
    );

    const fetchData = async () => {
        try {
            setLoading(true);
            setError("");

            const [resReport, resPlan] = await Promise.all([
                dailyReportApi.getByEmployeeWeeks(id),
                weeklyPlanApi.getByEmployee(id),
            ]);

            const plans = Array.isArray(resPlan) ? resPlan : [];
            const historyEntries = await Promise.all(
                plans.map(async (plan: any) => {
                    if (!plan.id) return [plan.id, []] as const;

                    try {
                        const history = await weeklyPlanApi.getHistory(plan.id);
                        return [plan.id, Array.isArray(history) ? history : []] as const;
                    } catch (err) {
                        console.error("Failed to load plan history:", err);
                        return [plan.id, []] as const;
                    }
                }),
            );

            setPlanHistories(Object.fromEntries(historyEntries));
            setTaskHistories([]);
            setDaysByDate(
                mapByDate(Array.isArray(resReport) ? resReport : [], plans),
            );
        } catch (err) {
            console.error(err);
            setError("Không tải được dữ liệu báo cáo. Vui lòng thử lại sau.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const handleSelectTask = (task: Task) => {
        setSelectedTask(task);
        setTaskHistories(task.planId ? planHistories[task.planId] || [] : []);
    };

    return (
        <div className="min-h-screen bg-slate-100 pb-20 text-slate-900">
            <HeaderWithBack title="Báo cáo | Kế hoạch" />

            <main className="mx-auto mt-14 w-full max-w-[1500px] px-3 py-4 sm:px-5 lg:px-7">
                <section className="mb-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Lịch báo cáo nhân viên
                            </h2>
                            <p className="text-sm text-slate-500">
                                Nhóm theo tháng, tuần và ngày để đối chiếu kế hoạch với báo cáo.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm font-semibold">
                            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                                {totals.plans} kế hoạch
                            </span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                                {totals.reports} báo cáo
                            </span>
                            <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">
                                {totals.missing} chưa báo cáo
                            </span>
                        </div>
                    </div>
                </section>

                {loading && <LoadingState />}

                {!loading && error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                {!loading && !error && monthGroups.length === 0 && <EmptyState />}

                {!loading && !error && monthGroups.length > 0 && (
                    <div className="space-y-4">
                        {monthGroups.map((month) => (
                            <MonthCalendar
                                key={month.key}
                                month={month}
                                onOpenChat={setSelectedReportId}
                                onOpenTaskList={setTaskListModal}
                                onSelectTask={handleSelectTask}
                            />
                        ))}
                    </div>
                )}
            </main>

            {selectedReportId && (
                <ReportDetailPopup
                    reportId={selectedReportId}
                    onClose={() => setSelectedReportId(null)}
                />
            )}

            {selectedTask && (
                <TaskDetailModal
                    histories={taskHistories}
                    task={selectedTask}
                    onClose={() => {
                        setSelectedTask(null);
                        setTaskHistories([]);
                    }}
                />
            )}

            {taskListModal && (
                <TaskListModal
                    data={taskListModal}
                    onClose={() => setTaskListModal(null)}
                    onSelectTask={(task) => {
                        setTaskListModal(null);
                        handleSelectTask(task);
                    }}
                />
            )}
        </div>
    );
}

function MonthCalendar({
    month,
    onSelectTask,
    onOpenChat,
    onOpenTaskList,
}: {
    month: MonthGroup;
    onSelectTask: (task: Task) => void;
    onOpenChat: (id: number) => void;
    onOpenTaskList: (data: TaskListModalData) => void;
}) {
    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 text-center">
                <div className="inline-flex items-center justify-center gap-2 text-2xl font-bold text-slate-900">
                    <CalendarDays className="h-6 w-6 text-blue-600" />
                    {month.label}
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm font-semibold text-slate-500">
                    <span>{month.weeks.length} tuần</span>
                    <span>{month.totalPlans} kế hoạch</span>
                    <span>{month.totalReports} báo cáo</span>
                </div>
            </div>

            <div className="space-y-6 bg-slate-50 p-3 sm:p-5">
                {month.weeks.map((week) => (
                    <WeekCalendar
                        key={week.key}
                        onOpenChat={onOpenChat}
                        onOpenTaskList={onOpenTaskList}
                        onSelectTask={onSelectTask}
                        week={week}
                    />
                ))}
            </div>
        </section>
    );
}

function WeekCalendar({
    week,
    onSelectTask,
    onOpenChat,
    onOpenTaskList,
}: {
    week: WeekGroup;
    onSelectTask: (task: Task) => void;
    onOpenChat: (id: number) => void;
    onOpenTaskList: (data: TaskListModalData) => void;
}) {
    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="text-base font-bold uppercase tracking-wide text-slate-700">
                    Tuần {week.label}
                </div>
                <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-500">
                    <span>{week.totalPlans} KH</span>
                    <span>{week.totalReports} BC</span>
                    {week.missingReports > 0 && (
                        <span className="text-rose-600">{week.missingReports} thiếu</span>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="grid min-w-[1120px] grid-cols-7 border-y border-l border-slate-200 bg-white">
                    {week.days.map((day, index) => (
                        <DayCell
                            key={day.date}
                            day={day}
                            dayName={["T.2", "T.3", "T.4", "T.5", "T.6", "T.7", "CN"][index]}
                            onOpenChat={onOpenChat}
                            onOpenTaskList={onOpenTaskList}
                            onSelectTask={onSelectTask}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function DayCell({
    day,
    dayName,
    onSelectTask,
    onOpenChat,
    onOpenTaskList,
}: {
    day: WeekDay;
    dayName: string;
    onSelectTask: (task: Task) => void;
    onOpenChat: (id: number) => void;
    onOpenTaskList: (data: TaskListModalData) => void;
}) {
    const hasPlans = day.data.plans.length > 0;
    const hasReports = day.data.reports.length > 0;
    const status = getDayStatus(hasPlans, hasReports);

    return (
        <div
            className={`flex min-h-[260px] flex-col border-r border-slate-200 p-3 transition ${
                day.isInMonth ? "bg-white hover:bg-slate-50" : "bg-slate-100 text-slate-400"
            } ${day.isToday ? "ring-2 ring-inset ring-blue-500" : ""}`}
        >
            <div className="mb-3 text-center">
                <div className={`text-sm font-bold ${dayName === "CN" ? "text-rose-500" : "text-slate-500"}`}>
                    {dayName}
                </div>
                <div
                    className={`mx-auto mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${
                        day.isToday
                            ? "bg-blue-600 text-white"
                            : dayName === "CN"
                              ? "text-rose-500"
                              : "text-slate-900"
                    }`}
                >
                    {getDayNumber(day.date)}
                </div>
            </div>

            {day.isInMonth ? (
                <div className="flex flex-1 flex-col">
                    <div className={`rounded-full px-3 py-1.5 text-center text-xs font-bold ${status.className}`}>
                        {status.label}
                    </div>

                    <div className="mt-2 space-y-2">
                        <MiniTaskList
                            emptyLabel="Không có KH"
                            icon={<ClipboardList className="h-4 w-4" />}
                            items={day.data.plans}
                            label="KH"
                            onShowAll={() =>
                                onOpenTaskList({
                                    title: "Kế hoạch",
                                    subtitle: `${dayName} ${formatDateShort(day.date)}`,
                                    items: day.data.plans,
                                    tone: "blue",
                                })
                            }
                            onSelectTask={onSelectTask}
                            tone="sky"
                        />

                        <MiniTaskList
                            emptyLabel="Chưa có BC"
                            icon={<FileText className="h-4 w-4" />}
                            items={day.data.reports}
                            label="BC"
                            onShowAll={() =>
                                onOpenTaskList({
                                    title: "Báo cáo",
                                    subtitle: `${dayName} ${formatDateShort(day.date)}`,
                                    items: day.data.reports,
                                    tone: "emerald",
                                })
                            }
                            onSelectTask={onSelectTask}
                            tone="emerald"
                        />
                    </div>

                    {day.data.reportId && (
                        <button
                            type="button"
                            onClick={() => onOpenChat(day.data.reportId as number)}
                            className="mt-auto flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 text-sm font-bold text-white transition hover:bg-orange-600 active:scale-95"
                        >
                            <MessageCircle className="h-4 w-4" />
                            Chat
                        </button>
                    )}
                </div>
            ) : (
                <div className="mt-8 text-center text-sm text-slate-400">Ngoài tháng</div>
            )}
        </div>
    );
}

function MiniTaskList({
    emptyLabel,
    icon,
    items,
    label,
    onShowAll,
    onSelectTask,
    tone,
}: {
    emptyLabel: string;
    icon: ReactNode;
    items: Task[];
    label: string;
    onShowAll: () => void;
    onSelectTask: (task: Task) => void;
    tone: "sky" | "emerald";
}) {
    const toneClass = {
        sky: "text-blue-700",
        emerald: "text-emerald-700",
    }[tone];

    return (
        <div>
            <div className={`mb-1.5 flex items-center gap-1 text-sm font-bold ${toneClass}`}>
                {icon}
                {label} {items.length > 0 ? `(${items.length})` : ""}
            </div>

            {items.length > 0 ? (
                <div className="space-y-1.5">
                    {items.slice(0, 2).map((task) => (
                        <button
                            type="button"
                            key={`${label}-${task.id}`}
                            onClick={() => onSelectTask(task)}
                            className="block w-full truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
                            title={task.title}
                        >
                            {task.title}
                        </button>
                    ))}
                    {items.length > 2 && (
                        <div className="space-y-1 px-2">
                            <div className="text-xs font-semibold text-slate-500">
                                +{items.length - 2} mục
                            </div>
                            <button
                                type="button"
                                onClick={onShowAll}
                                className="text-xs font-bold text-blue-600 underline-offset-2 transition hover:text-blue-700 hover:underline"
                            >
                                Xem thêm
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-sm text-slate-400">
                    {emptyLabel}
                </div>
            )}
        </div>
    );
}

function TaskListModal({
    data,
    onClose,
    onSelectTask,
}: {
    data: TaskListModalData;
    onClose: () => void;
    onSelectTask: (task: Task) => void;
}) {
    const toneClass = {
        blue: {
            badge: "bg-blue-50 text-blue-700",
            item: "hover:border-blue-300 hover:bg-blue-50",
            title: "text-blue-700",
        },
        emerald: {
            badge: "bg-emerald-50 text-emerald-700",
            item: "hover:border-emerald-300 hover:bg-emerald-50",
            title: "text-emerald-700",
        },
    }[data.tone];

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3 sm:items-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
                    <div>
                        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${toneClass.badge}`}>
                            {data.items.length} mục
                        </div>
                        <h3 className="mt-2 text-lg font-bold text-slate-900">
                            {data.title}
                        </h3>
                        <div className="text-sm font-medium text-slate-500">
                            {data.subtitle}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[68vh] space-y-2 overflow-y-auto p-4">
                    {data.items.map((task, index) => (
                        <button
                            type="button"
                            key={`${task.id}-${index}`}
                            onClick={() => onSelectTask(task)}
                            className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition ${toneClass.item}`}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${toneClass.badge}`}>
                                    {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className={`text-sm font-bold leading-snug ${toneClass.title}`}>
                                        {task.title}
                                    </div>
                                    {task.content && (
                                        <div className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
                                            {task.content}
                                        </div>
                                    )}
                                    {task.location && (
                                        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500">
                                            <MapPin className="h-3.5 w-3.5" />
                                            <span className="truncate">{task.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TaskDetailModal({
    histories,
    task,
    onClose,
}: {
    histories: any[];
    task: Task;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 sm:items-center sm:p-4"
            onClick={onClose}
        >
            <div
                className="max-h-[86vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white text-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-blue-600">
                            Chi tiết công việc
                        </div>
                        <h3 className="mt-1 text-lg font-bold leading-snug text-slate-900">
                            {task.title}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 px-4 py-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        {task.content ? (
                            <p className="text-sm leading-relaxed text-slate-700">{task.content}</p>
                        ) : (
                            <p className="text-sm text-slate-400">Chưa có nội dung chi tiết.</p>
                        )}

                        <div className="mt-4 space-y-2 text-sm">
                            {task.location ? (
                                <a
                                    href={`https://maps.google.com/?q=${task.location}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-600 hover:underline"
                                >
                                    <MapPin className="h-4 w-4" />
                                    {task.location}
                                </a>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-400">
                                    <MapPin className="h-4 w-4" />
                                    Không có vị trí
                                </div>
                            )}

                            {task.createdAt && (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Clock className="h-4 w-4" />
                                    {formatDateTime(task.createdAt)}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-slate-800">Lịch sử kế hoạch</h4>
                            <span className="text-xs font-medium text-slate-400">
                                {histories.length} phiên bản
                            </span>
                        </div>

                        <div className="space-y-2">
                            {histories.map((history) => {
                                const oldTask = history.snapshot?.tasks?.find(
                                    (item: any) => item.dayOfWeek === task.dayOfWeek,
                                );

                                if (!oldTask) return null;

                                return (
                                    <div
                                        key={history.id}
                                        className="rounded-xl border border-slate-200 bg-white p-3"
                                    >
                                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                                            <Clock className="h-3.5 w-3.5" />
                                            Version {history.version}
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900">
                                            {oldTask.title}
                                        </div>
                                        {oldTask.content && (
                                            <div className="mt-1 text-sm leading-relaxed text-slate-600">
                                                {oldTask.content}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {histories.length === 0 && (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
                                    Không có lịch sử chỉnh sửa cho công việc này.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
            <div className="mt-3 text-sm font-semibold text-slate-700">
                Đang tải báo cáo...
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">
                Chưa có dữ liệu báo cáo
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Khi nhân viên có kế hoạch hoặc gửi báo cáo, dữ liệu sẽ hiển thị theo tháng, tuần và ngày.
            </p>
        </div>
    );
}

function getDayStatus(hasPlans: boolean, hasReports: boolean) {
    if (hasPlans && hasReports) {
        return {
            label: "Đã báo cáo",
            className: "bg-emerald-50 text-emerald-700",
        };
    }

    if (hasPlans && !hasReports) {
        return {
            label: "Chưa báo cáo",
            className: "bg-rose-50 text-rose-700",
        };
    }

    if (!hasPlans && hasReports) {
        return {
            label: "Phát sinh",
            className: "bg-blue-50 text-blue-700",
        };
    }

    return {
        label: "Trống",
        className: "bg-slate-100 text-slate-500",
    };
}
