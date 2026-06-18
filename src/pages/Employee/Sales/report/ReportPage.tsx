import React, { useEffect, useState } from "react";
import ReportWeek from "./Report/ReportWeek";
import ReportDay from "./Report/ReportDay";
import { getEmployeeId } from "@/utils/auth";
import { dailyReportApi } from "@/service/report";
import { weeklyPlanApi } from "@/service/plan";



export default function ReportForm({
    report,
    setReport,
    openWeekIndex,
    setOpenWeekIndex,
    groupByDate,
    getWeekday,
    formatDateTime,
    openDayKey,
    setOpenDayKey,
}: any) {
    const [tab, setTab] = useState<"day" | "week">("week");
    const [loadingList, setLoadingList] = useState(false);
    const [tasks, setTasks] = useState([
        { title: "", content: "", location: "" }
    ]);
    const [loading, setLoading] = useState(false);
    const [editingReport, setEditingReport] = useState<any | null>(null);
    const [historyWeeks, setHistoryWeeks] = useState<any[]>([]);

    const [loadingLocationIndex, setLoadingLocationIndex] = useState<number | null>(null);

    const handleTaskChange = (index: number, key: string, value: string) => {
        const newTasks = [...tasks];
        newTasks[index][key as "title" | "content" | "location"] = value;
        setTasks(newTasks);
    };

    const addTask = () => {
        setTasks([...tasks, { title: "", content: "", location: "" }]);
    };

    const removeTask = (index: number) => {
        setTasks(tasks.filter((_, i) => i !== index));
    };

    // ================= LOCATION =================
    const handleGetLocation = (index: number) => {
        if (!navigator.geolocation) {
            alert("Không hỗ trợ định vị");
            return;
        }

        setLoadingLocationIndex(index);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newTasks = [...tasks];
                newTasks[index].location = `${latitude}, ${longitude}`;
                setTasks(newTasks);
                setLoadingLocationIndex(null);
            },
            () => {
                alert("Không lấy được vị trí");
                setLoadingLocationIndex(null);
            }
        );
    };

    // ================= SUBMIT =================
    const handleSubmit = async () => {
        if (!tasks.length || tasks.some(t => !t.title)) {
            alert("Vui lòng nhập tiêu đề công việc");
            return;
        }

        try {
            setLoading(true);
            const employeeId = getEmployeeId();

            if (editingReport) {
                await dailyReportApi.update(editingReport.id, {
                    date: report.date,
                    tasks,
                });
            } else {
                await dailyReportApi.create({
                    ...report,
                    employeeId,
                    tasks,
                });
            }
            alert("Lưu thành công");
            setEditingReport(null);
            setTasks([{ title: "", content: "", location: "" }]);
            fetchReports();

        } catch (err) {
            console.error(err);
            alert("Lưu thất bại");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (report: any) => {
        setEditingReport(report);

        setReport({ date: report.date });

        setTasks(
            report.tasks.map((t: any) => ({
                id: t.id,
                title: t.title,
                content: t.content,
                location: t.location || "",
            }))
        );

        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const fetchReports = async () => {
        try {
            setLoadingList(true);

            const res = await dailyReportApi.getByEmployeeWeeks(getEmployeeId());
            const now = new Date();

            const history: any[] = [];
            const plans: any[] = [];

            res.forEach((week: any) => {
                const historyReports: any[] = [];
                const planReports: any[] = [];

                week.reports.forEach((r: any) => {
                    const reportDate = new Date(r.date);

                    if (reportDate > now) {
                        planReports.push(r);
                    } else {
                        historyReports.push(r);
                    }
                });

                // nếu tuần có report quá khứ
                if (historyReports.length > 0) {
                    history.push({
                        ...week,
                        reports: historyReports
                    });
                }

                // nếu tuần có report tương lai
                if (planReports.length > 0) {
                    plans.push({
                        ...week,
                        reports: planReports
                    });
                }
            });

            setHistoryWeeks(history);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingList(false);
        }
    };
    const handleDelete = async (taskId: number) => {
        const confirmDelete = window.confirm("Bạn có chắc muốn xoá không?");
        if (!confirmDelete) return;

        try {
            await dailyReportApi.deleteTask(taskId);

            fetchReports(); // reload

        } catch (err) {
            console.error(err);
        }
    };
    useEffect(() => {
        fetchReports();
    }, []);
    return (
        <div className="px-4 pt-6 pb-6 space-y-5 max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto mt-5">
            {/* DATE */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
                <label className="text-sm text-gray-500">Ngày</label>
                <input
                    type="date"
                    value={report.date}
                    onChange={(e) => setReport({ ...report, date: e.target.value })}
                    className="w-full mt-1 p-3 rounded-xl bg-gray-100 focus:ring-2 focus:ring-orange-400 outline-none"
                />
            </div>

            {/* TASK LIST */}
            <div className="space-y-3">
                {tasks.map((task, index) => (
                    <div key={index} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">

                        <div className="flex justify-between items-center">
                            <span className="font-medium">Công việc #{index + 1}</span>
                            {tasks.length > 1 && (
                                <button
                                    onClick={() => removeTask(index)}
                                    className="text-red-400 text-sm"
                                >
                                    Xóa
                                </button>
                            )}
                        </div>

                        <input
                            placeholder="Tiêu đề công việc"
                            value={task.title}
                            onChange={(e) => handleTaskChange(index, "title", e.target.value)}
                            className="w-full p-3 rounded-xl bg-gray-100 focus:ring-2 focus:ring-orange-400 outline-none"
                        />

                        <textarea
                            placeholder="Nội dung công việc"
                            value={task.content}
                            onChange={(e) => handleTaskChange(index, "content", e.target.value)}
                            className="w-full p-3 rounded-xl bg-gray-100 h-24 focus:ring-2 focus:ring-orange-400 outline-none"
                        />

                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    value={task.location}
                                    readOnly
                                    placeholder="Chưa có vị trí"
                                    className="flex-1 p-2 rounded-xl bg-gray-100 text-sm"
                                />
                                <button
                                    onClick={() => handleGetLocation(index)}
                                    className="px-3 py-2 bg-blue-500 text-white rounded-xl flex items-center justify-center"
                                >
                                    {loadingLocationIndex === index ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        "📍"
                                    )}
                                </button>
                            </div>

                            {task.location && (
                                <a
                                    href={`https://maps.google.com/?q=${task.location}`}
                                    target="_blank"
                                    className="text-blue-500 text-sm"
                                >
                                    Xem bản đồ
                                </a>
                            )}
                        </div>

                    </div>
                ))}
            </div>

            {/* CTA */}
            {/* FLOAT BUTTON */}
            <button
                onClick={addTask}
                className="bg-green-500 text-white rounded-full shadow-lg w-full py-3  text-white font-medium shadow-lg transition"
            >
                +
            </button>
            <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full py-3 rounded-2xl text-white font-medium shadow-lg transition ${loading ? "bg-gray-400" : "bg-orange-500 active:scale-95"
                    }`}
            >
                {loading ? "Đang lưu..." : "Lưu báo cáo"}
            </button>
            <div className="flex rounded-xl p-1 bg-gray-200">
                <button
                    onClick={() => setTab("day")}
                    className={`flex-1 py-2 rounded-lg ${tab === "day"
                        ? "bg-white shadow"
                        : ""}`}
                >
                    Ngày
                </button>

                <button
                    onClick={() => setTab("week")}
                    className={`flex-1 py-2 rounded-lg ${tab === "week"
                        ? "bg-white shadow"
                        : ""}`}
                >
                    Tuần
                </button>
            </div>
            {tab === "week" && (
                <ReportWeek
                    historyWeeks={historyWeeks}
                    openWeekIndex={openWeekIndex}
                    setOpenWeekIndex={setOpenWeekIndex}
                    groupByDate={groupByDate}
                    getWeekday={getWeekday}
                    handleEdit={handleEdit}
                    formatDateTime={formatDateTime}
                    handleDelete={handleDelete}
                    openDayKey={openDayKey}
                    setOpenDayKey={setOpenDayKey}
                    loadingList={loadingList}
                />
            )}
            {tab === "day" && (
                <ReportDay
                    historyWeeks={historyWeeks}
                    openWeekIndex={openWeekIndex}
                    setOpenWeekIndex={setOpenWeekIndex}
                    groupByDate={groupByDate}
                    getWeekday={getWeekday}
                    handleEdit={handleEdit}
                    formatDateTime={formatDateTime}
                    handleDelete={handleDelete}
                    openDayKey={openDayKey}
                    setOpenDayKey={setOpenDayKey}
                    loadingList={loadingList}
                />
            )}
        </div>
    );
}