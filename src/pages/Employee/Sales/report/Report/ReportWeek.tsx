import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import ReportDetailPopup from "@/components/ReportDetailPopup";

const MONTH_NAMES = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
    "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
    "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

type MonthGroup = {
    key: string;
    label: string;
    weeks: { week: any; originalIndex: number }[];
};

const groupWeeksByMonth = (weeks: any[]): MonthGroup[] => {
    const map = new Map<string, MonthGroup>();

    weeks.forEach((week: any, index: number) => {
        const d = new Date(week.weekStart);
        const month = d.getMonth();
        const year = d.getFullYear();
        const key = `${year}-${month}`;

        if (!map.has(key)) {
            map.set(key, {
                key,
                label: `${MONTH_NAMES[month]} ${year}`,
                weeks: [],
            });
        }

        map.get(key)!.weeks.push({ week, originalIndex: index });
    });

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
};

export default function ReportWeek({
    historyWeeks,
    openWeekIndex,
    setOpenWeekIndex,
    groupByDate,
    getWeekday,
    handleEdit,
    handleDelete,
    formatDateTime,
}: any) {
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
    const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

    const monthGroups = useMemo(
        () => groupWeeksByMonth(historyWeeks || []),
        [historyWeeks],
    );

    const toggleMonth = (key: string) => {
        setCollapsedMonths((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="space-y-4 p-2">
            <h2 className="text-lg font-semibold">Báo cáo theo tuần</h2>

            {monthGroups.map((group) => {
                const isCollapsed = collapsedMonths.has(group.key);
                const totalReports = group.weeks.reduce(
                    (sum, { week }) => sum + (week.reports?.length || 0),
                    0,
                );

                return (
                    <div key={group.key} className="space-y-2">
                        {/* MONTH HEADER */}
                        <div
                            onClick={() => toggleMonth(group.key)}
                            className="flex items-center justify-between px-3 py-2.5 bg-orange-50 border border-orange-200 rounded-xl cursor-pointer active:scale-[0.99] transition"
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-orange-700">
                                    {group.label}
                                </span>
                                <span className="text-xs text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">
                                    {group.weeks.length} tuần
                                </span>
                            </div>
                            <div className="text-orange-400">
                                {isCollapsed
                                    ? <ChevronDown className="w-4 h-4" />
                                    : <ChevronUp className="w-4 h-4" />
                                }
                            </div>
                        </div>

                        {/* WEEKS IN MONTH */}
                        {!isCollapsed && (
                            <div className="space-y-2 pl-1">
                                {group.weeks.map(({ week, originalIndex }) => {
                                    const isOpen = openWeekIndex === originalIndex;
                                    const grouped = groupByDate(week.reports);

                                    return (
                                        <div key={originalIndex} className="bg-white rounded-2xl">
                                            <div
                                                onClick={() =>
                                                    setOpenWeekIndex(isOpen ? null : originalIndex)
                                                }
                                                className="p-4 flex justify-between cursor-pointer"
                                            >
                                                <span>
                                                    {new Date(week.weekStart).toLocaleDateString()} -{" "}
                                                    {new Date(week.weekEnd).toLocaleDateString()}
                                                </span>
                                                <span>{isOpen ? "▲" : "▼"}</span>
                                            </div>

                                            {isOpen && (
                                                <div className="p-4 space-y-4">
                                                    <div className="grid grid-cols-3 text-sm font-semibold text-gray-600 border-b pb-2">
                                                        <div>Ngày</div>
                                                        <div className="col-span-2">Công việc</div>
                                                    </div>

                                                    {Object.entries(grouped).map(([date, reports]) => {
                                                        const list = reports as any[];
                                                        const firstReportId = list[0]?.id;

                                                        return (
                                                            <div
                                                                key={`${week.weekStart}_${date}`}
                                                                className="grid grid-cols-3 gap-3 border-b pb-3"
                                                            >
                                                                <div className="text-sm text-gray-500">
                                                                    <div className="font-medium">
                                                                        {getWeekday(date)}
                                                                    </div>
                                                                    <div>{date}</div>

                                                                    {firstReportId && (
                                                                        <button
                                                                            onClick={() =>
                                                                                setSelectedReportId(firstReportId)
                                                                            }
                                                                            className="flex items-center gap-1 mt-2 px-3 py-1.5 bg-orange-500 text-white text-xs rounded-full active:scale-95 transition"
                                                                        >
                                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                                            Chat
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="col-span-2 space-y-2">
                                                                    {list.map((report: any) =>
                                                                        report.tasks.map((task: any) => (
                                                                            <div
                                                                                key={task.id}
                                                                                className="bg-gray-50 p-2 rounded-lg"
                                                                            >
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="font-medium">
                                                                                        {task.title}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-2">
                                                                                        <button
                                                                                            onClick={() =>
                                                                                                handleEdit(report)
                                                                                            }
                                                                                            className="text-xs text-orange-500 hover:text-orange-600"
                                                                                        >
                                                                                            Sửa
                                                                                        </button>

                                                                                        <button
                                                                                            onClick={() =>
                                                                                                handleDelete(task.id)
                                                                                            }
                                                                                            className="text-xs text-red-500 hover:text-red-600"
                                                                                        >
                                                                                            Xoá
                                                                                        </button>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="text-sm text-gray-600">
                                                                                    {task.content}
                                                                                </div>

                                                                                {task.location && (
                                                                                    <a
                                                                                        href={`https://maps.google.com/?q=${task.location}`}
                                                                                        target="_blank"
                                                                                        className="text-xs text-blue-500"
                                                                                    >
                                                                                        Xem vị trí
                                                                                    </a>
                                                                                )}

                                                                                <div className="text-xs text-gray-400 mt-1">
                                                                                    {formatDateTime(task.createdAt)}
                                                                                </div>
                                                                            </div>
                                                                        )),
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            {selectedReportId && (
                <ReportDetailPopup
                    reportId={selectedReportId}
                    onClose={() => setSelectedReportId(null)}
                />
            )}
        </div>
    );
}
