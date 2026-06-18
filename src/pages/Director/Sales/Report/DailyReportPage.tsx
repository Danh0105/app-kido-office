import { useEffect, useState } from "react";
import { dailyReportApi } from "@/service/report";
import HeaderWithBack from "@/components/HeaderWithBack";
import { data, useParams } from "react-router-dom";
import { weeklyPlanApi } from "@/service/plan";
type Task = {
    id: number;
    title: string;
    content?: string;
    location?: string;
    createdAt?: string;
    dayOfWeek?: number;
};

type DataByDate = Record<
    string,
    {
        plans: Task[];
        reports: Task[];
    }
>;
const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
};

const getWeekday = (date: string) => {
    const days = [
        "Chủ nhật", "Thứ 2", "Thứ 3",
        "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"
    ];
    return days[new Date(date).getDay()];
};

// 🔥 format yyyy-mm-dd không lệch timezone
const toDateKey = (d: Date) =>
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");

// 🔥 tính date chuẩn từ plan
const getDateFromPlan = (
    startDate: string,
    endDate: string,
    dayOfWeek: number
) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const d = new Date(start);

    const startDay = start.getDay(); // thứ của startDate
    const diff = dayOfWeek - startDay;

    d.setDate(start.getDate() + diff);

    // validate trong tuần
    if (d < start || d > end) {
        console.warn("⚠️ Task ngoài tuần", { startDate, dayOfWeek });
    }

    return toDateKey(d);
};

// 🔥 MAP CHUẨN
const mapByWeek = (resReport: any[], resPlan: any[]) => {
    const weeks: any[] = [];

    resReport.forEach((week: any) => {
        const map: Record<string, { plans: any[]; reports: any[] }> = {};

        // ===== REPORT =====
        week.reports?.forEach((r: any) => {
            const date = r.date;

            if (!map[date]) map[date] = { plans: [], reports: [] };

            r.tasks?.forEach((t: any) => {
                map[date].reports.push(t);
            });
        });

        // ===== PLAN =====
        resPlan.forEach((plan: any) => {
            plan.tasks?.forEach((t: any) => {
                const date = getDateFromPlan(
                    plan.startDate,
                    plan.endDate,
                    t.dayOfWeek
                );

                if (date >= week.weekStart && date <= week.weekEnd) {
                    if (!map[date]) map[date] = { plans: [], reports: [] };

                    map[date].plans.push({
                        ...t,
                        planId: plan.id
                    });
                }
            });
        });

        weeks.push({
            weekStart: week.weekStart,
            weekEnd: week.weekEnd,
            days: map
        });
    });

    return weeks;
};

export default function DailyReportPage() {
    const { employeeId } = useParams();
    const Id = Number(employeeId);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(false);
    const [planHistories, setPlanHistories] = useState<Record<number, any[]>>({});
    const [taskHistories, setTaskHistories] = useState<any[]>([]);
    const [weeks, setWeeks] = useState<any[]>([]);
    const [openWeekIndex, setOpenWeekIndex] = useState<number | null>(null);
    const fetchData = async () => {
        try {
            setLoading(true);

            const [resReport, resPlan] = await Promise.all([
                dailyReportApi.getByEmployeeWeeks(Id),
                weeklyPlanApi.getByEmployee(Id),
            ]);

            // 🔥 lấy history cho từng plan
            const historyMap: Record<number, any[]> = {};

            await Promise.all(
                resPlan.map(async (plan: any) => {
                    const history = await weeklyPlanApi.getHistory(plan.id);
                    historyMap[plan.id] = history;
                })
            );
            console.log("historyMap", historyMap)
            setPlanHistories(historyMap);

            const weeks = mapByWeek(resReport || [], resPlan || []);
            setTaskHistories([]); // optional reset
            setWeeks(weeks);


        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    console.log("selectedTask", selectedTask);
    console.log("planHistories", planHistories);
    console.log("taskHistories", taskHistories);
    useEffect(() => {
        if (Id) fetchData();
    }, [Id]);
    const formatWeekRange = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);

        return `${s.getDate()}/${s.getMonth() + 1} - ${e.getDate()}/${e.getMonth() + 1}/${e.getFullYear()}`;
    };
    return (
        <div className="min-h-screen bg-gray-100 pb-24">
            <HeaderWithBack title="Báo cáo | Kế hoạch" />

            <div className="p-2 mt-[55px]">


                <div className="space-y-3">
                    {weeks.map((week, index) => {
                        const isOpen = openWeekIndex === index;

                        return (
                            <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">

                                {/* WEEK HEADER */}
                                <div
                                    onClick={() =>
                                        setOpenWeekIndex(isOpen ? null : index)
                                    }
                                    className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                                >
                                    <div>
                                        <div className="font-semibold text-sm">
                                            {formatWeekRange(week.weekStart, week.weekEnd)}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            7 ngày trong tuần
                                        </div>
                                    </div>

                                    <div className="text-gray-400 text-sm">
                                        {isOpen ? "▲" : "▼"}
                                    </div>
                                </div>

                                {/* WEEK BODY */}
                                {isOpen && (
                                    <div className="p-3 space-y-4">

                                        {Object.entries(week.days)
                                            .sort(
                                                ([a], [b]) =>
                                                    new Date(a).getTime() -
                                                    new Date(b).getTime()
                                            )
                                            .map(([date, data]) => {
                                                const { plans = [], reports = [] } = data as any;

                                                return (
                                                    <div
                                                        key={date}
                                                        className="bg-gray-50 rounded-xl p-3 space-y-3"
                                                    >
                                                        {/* DATE */}
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="font-medium text-sm">
                                                                    {getWeekday(date)}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    {date}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 🔥 2 COLUMN SONG SONG */}
                                                        <div className="grid grid-cols-2 gap-3">

                                                            {/* PLAN COLUMN */}
                                                            <div className="space-y-2">
                                                                <div className="text-xs font-semibold text-blue-600">
                                                                    📋 Kế hoạch
                                                                </div>

                                                                {plans.length > 0 ? (
                                                                    plans.map((t: any) => (
                                                                        <div
                                                                            key={`plan-${t.id}`}
                                                                            onClick={() => setSelectedTask(t)}
                                                                            className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm cursor-pointer active:scale-[0.98]"
                                                                        >
                                                                            {t.title}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="text-xs text-gray-400">
                                                                        Không có
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* REPORT COLUMN */}
                                                            <div className="space-y-2">
                                                                <div className="text-xs font-semibold text-green-600">
                                                                    📝 Báo cáo
                                                                </div>

                                                                {reports.length > 0 ? (
                                                                    reports.map((t: any) => (
                                                                        <div
                                                                            key={`report-${t.id}`}
                                                                            onClick={() => setSelectedTask(t)}
                                                                            className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm cursor-pointer active:scale-[0.98]"
                                                                        >
                                                                            {t.title}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="text-xs text-gray-400">
                                                                        Chưa có
                                                                    </div>
                                                                )}
                                                            </div>

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
            </div>

            {/* POPUP (ĐẶT NGOÀI MAP) */}
            {selectedTask && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                    onClick={() => {
                        setSelectedTask(null);
                        setTaskHistories([]);
                    }}
                >
                    <div
                        className="bg-white w-[90%] max-w-md rounded-2xl p-4 shadow-lg relative max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* CLOSE */}
                        <button
                            onClick={() => {
                                setSelectedTask(null);
                                setTaskHistories([]);
                            }}
                            className="absolute top-2 right-3 text-gray-400 text-xl"
                        >
                            ✕
                        </button>

                        {/* ===== CURRENT ===== */}
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold">
                                {selectedTask.title}
                            </h3>

                            <div className="text-xs text-blue-500 mb-2">
                                Hiện tại
                            </div>

                            {selectedTask.content && (
                                <div className="text-sm text-gray-600 mb-2">
                                    {selectedTask.content}
                                </div>
                            )}

                            {selectedTask.location ? (
                                <a
                                    href={`https://maps.google.com/?q=${selectedTask.location}`}
                                    target="_blank"
                                    className="text-sm text-blue-500 block mb-2"
                                >
                                    📍 {selectedTask.location}
                                </a>
                            ) : (
                                <div className="text-sm text-gray-400 mb-2">
                                    📍 Không có vị trí
                                </div>
                            )}
                        </div>

                        {/* ===== HISTORY ===== */}
                        <div className="space-y-3">
                            {taskHistories.map((h) => {
                                const oldTask = h.snapshot?.tasks?.find(
                                    (x: any) =>
                                        x.dayOfWeek === selectedTask.dayOfWeek
                                );

                                if (!oldTask) return null;

                                return (
                                    <div
                                        key={h.id}
                                        className="border rounded-lg p-2 bg-gray-50"
                                    >
                                        <div className="text-xs text-gray-400">
                                            Version {h.version}
                                        </div>

                                        <div className="text-sm font-medium">
                                            {oldTask.title}
                                        </div>

                                        {oldTask.content && (
                                            <div className="text-sm text-gray-600">
                                                {oldTask.content}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {taskHistories.length === 0 && (
                                <div className="text-xs text-gray-400">
                                    Không có lịch sử
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}