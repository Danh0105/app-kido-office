import { useEffect, useState } from "react";
import { weeklyPlanApi } from "@/service/plan";
import { getEmployeeId } from "@/utils/auth";
import PlanDay from "./Plan/PlanDay";
import PlanWeek from "./Plan/PlanWeek";
const days = [
    { label: "Thứ 2", value: 1 },
    { label: "Thứ 3", value: 2 },
    { label: "Thứ 4", value: 3 },
    { label: "Thứ 5", value: 4 },
    { label: "Thứ 6", value: 5 },
    { label: "Thứ 7", value: 6 },
    { label: "Chủ nhật", value: 0 },
];
export default function PlanForm() {
    const [plan, setPlan] = useState({
        startDate: "",
        endDate: "",
    });
    const employeeId = getEmployeeId();
    const [tasks, setTasks] = useState([
        { title: "", content: "", location: "", dayOfWeek: 1 }
    ]);
    const [editingPlan, setEditingPlan] = useState<any | null>(null);
    const [tab, setTab] = useState<"day" | "week">("week");
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [openWeekIndex, setOpenWeekIndex] = useState<number | null>(0);
    const [editingTask, setEditingTask] = useState<any | null>(null);
    // ================= TASK =================
    const handleTaskChange = (index: number, key: string, value: any) => {
        const newTasks = [...tasks];
        newTasks[index][key as any] = value;
        setTasks(newTasks);
    };

    const handleEditTask = (plan: any, task: any) => {
        setEditingPlan(plan);
        setEditingTask(task);

        setPlan({
            startDate: plan.startDate || "",
            endDate: plan.endDate || "",
        });

        setTasks([
            {
                title: task.title || "",
                content: task.content || "",
                location: task.location || "",
                dayOfWeek: task.dayOfWeek ?? 1,
            }
        ]);

        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const getWeekKey = (date: string) => {
        const d = new Date(date);

        // lấy thứ 2 của tuần
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);

        const monday = new Date(d.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        return {
            key: monday.toISOString().slice(0, 10),
            weekStart: monday.toISOString().slice(0, 10),
            weekEnd: sunday.toISOString().slice(0, 10),
        };
    };
    const groupPlansByWeek = (plans: any[]) => {
        const map: Record<string, any> = {};

        plans.forEach(plan => {
            const { key, weekStart, weekEnd } = getWeekKey(plan.startDate);

            if (!map[key]) {
                map[key] = {
                    weekStart,
                    weekEnd,
                    plans: []
                };
            }

            map[key].plans.push(plan);
        });

        return Object.values(map);
    };
    const getWeekday = (date: string) => {
        const days = [
            "Chủ nhật",
            "Thứ 2",
            "Thứ 3",
            "Thứ 4",
            "Thứ 5",
            "Thứ 6",
            "Thứ 7"
        ];
        return days[new Date(date).getDay()];
    };
    const handleDeletePlan = async (planId: number) => {
        const ok = window.confirm("Xoá toàn bộ kế hoạch này?");
        if (!ok) return;

        try {
            await weeklyPlanApi.delete(planId);
            fetchPlans();
        } catch (err) {
            console.error(err);
            alert("Xoá thất bại");
        }
    };
    const handleDeleteTask = async (plan: any, taskId: number) => {
        const ok = window.confirm("Xoá công việc này?");
        if (!ok) return;

        try {
            const newTasks = (plan.tasks || []).filter((t: any) => t.id !== taskId);

            await weeklyPlanApi.update(plan.id, {
                startDate: plan.startDate,
                endDate: plan.endDate,
                tasks: newTasks,
            });

            fetchPlans();
        } catch (err) {
            console.error(err);
            alert("Xoá thất bại");
        }
    };
    const fetchPlans = async () => {
        try {
            const res = await weeklyPlanApi.getByEmployee(employeeId);

            const grouped = groupPlansByWeek(res);

            setPlans(grouped);

        } catch (err) {
            console.error(err);
        }
    };
    useEffect(() => {
        fetchPlans();
    }, []);
    const addTask = () => {
        const lastDay = tasks[tasks.length - 1]?.dayOfWeek || 1;

        setTasks([
            ...tasks,
            {
                title: "",
                content: "",
                location: "",
                dayOfWeek: lastDay,
            },
        ]);
    };

    const removeTask = (index: number) => {
        setTasks(tasks.filter((_, i) => i !== index));
    };

    // ================= LOCATION =================

    // ================= SUBMIT =================
    const handleSubmit = async () => {
        if (!tasks.length || tasks.some(t => !t.title)) {
            alert("Nhập tiêu đề công việc");
            return;
        }

        try {
            setLoading(true);

            if (editingPlan && editingTask) {
                const updatedTask = tasks[0];

                const mergedTasks = (editingPlan.tasks || []).map((t: any) =>
                    t.id === editingTask.id
                        ? {
                            ...t,
                            title: updatedTask.title,
                            content: updatedTask.content,
                            location: updatedTask.location || "",
                            dayOfWeek: updatedTask.dayOfWeek ?? 1,
                        }
                        : t
                );

                await weeklyPlanApi.update(editingPlan.id, {
                    startDate: plan.startDate,
                    endDate: plan.endDate,
                    tasks: mergedTasks,
                });

                alert("Cập nhật công việc thành công");
            } else {
                await weeklyPlanApi.create({
                    employeeId,
                    startDate: plan.startDate,
                    endDate: plan.endDate,
                    tasks,
                });

                alert("Tạo kế hoạch thành công");
            }

            // reset
            setEditingPlan(null);
            setEditingTask(null);
            setPlan({ startDate: "", endDate: "" });
            setTasks([{ title: "", content: "", location: "", dayOfWeek: 1 }]);

            fetchPlans(); // 🔥 rất quan trọng
        } catch (err) {
            console.error(err);
            alert("Lỗi");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-4 pt-6 pb-6 space-y-5 max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto mt-5">

            {/* DATE RANGE (GIỐNG REPORT) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <div>
                    <label className="text-sm text-gray-500">Từ ngày</label>
                    <input
                        type="date"
                        value={plan.startDate}
                        onChange={(e) => setPlan({ ...plan, startDate: e.target.value })}
                        className="w-full mt-1 p-3 rounded-xl bg-gray-100 focus:ring-2 focus:ring-green-400 outline-none"
                    />
                </div>

                <div>
                    <label className="text-sm text-gray-500">Đến ngày</label>
                    <input
                        type="date"
                        value={plan.endDate}
                        onChange={(e) => setPlan({ ...plan, endDate: e.target.value })}
                        className="w-full mt-1 p-3 rounded-xl bg-gray-100 focus:ring-2 focus:ring-green-400 outline-none"
                    />
                </div>
            </div>

            {/* TASK LIST (COPY REPORT STYLE) */}
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
                            className="w-full p-3 rounded-xl bg-gray-100 focus:ring-2 focus:ring-green-400 outline-none"
                        />

                        <textarea
                            placeholder="Nội dung công việc"
                            value={task.content}
                            onChange={(e) => handleTaskChange(index, "content", e.target.value)}
                            className="w-full p-3 rounded-xl bg-gray-100 h-24 focus:ring-2 focus:ring-green-400 outline-none"
                        />

                        {/* DAY OF WEEK */}
                        <DaySelect
                            value={task.dayOfWeek}
                            onChange={(val: number) =>
                                handleTaskChange(index, "dayOfWeek", val)
                            }
                        />

                    </div>
                ))}
            </div>

            {/* CTA giống report */}
            <button
                onClick={addTask}
                className="bg-green-500 text-white rounded-full w-full py-3 font-medium shadow-lg"
            >
                +
            </button>

            <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full py-3 rounded-2xl text-white font-medium shadow-lg ${loading ? "bg-gray-400" : "bg-green-500 active:scale-95"
                    }`}
            >
                {loading
                    ? "Đang lưu..."
                    : editingPlan
                        ? "Cập nhật kế hoạch"
                        : "Lưu kế hoạch"}
            </button>
            <div className="flex rounded-xl p-1 bg-gray-200">
                <button
                    onClick={() => setTab("day")}
                    className={`flex-1 py-2 rounded-lg ${tab === "day" ? "bg-white shadow" : ""}`}
                >
                    Ngày
                </button>

                <button
                    onClick={() => setTab("week")}
                    className={`flex-1 py-2 rounded-lg ${tab === "week" ? "bg-white shadow" : ""}`}
                >
                    Tuần
                </button>
            </div>
            {tab === "week" && (
                <PlanWeek
                    plans={plans}
                    openWeekIndex={openWeekIndex}
                    setOpenWeekIndex={setOpenWeekIndex}
                    getWeekday={getWeekday}
                    handleEdit={handleEditTask}
                    handleDeletePlan={handleDeletePlan}
                    handleDeleteTask={handleDeleteTask}
                />
            )}

            {tab === "day" && (
                <PlanDay
                    plans={plans}
                    handleEdit={handleEditTask}
                    getWeekday={getWeekday}
                    handleDeletePlan={handleDeletePlan}
                    handleDeleteTask={handleDeleteTask}
                />
            )}
        </div>
    );
}
function DaySelect({ value, onChange }: any) {
    const [open, setOpen] = useState(false);

    const selected = days.find(d => d.value === value);

    useEffect(() => {
        const handleClick = () => setOpen(false);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    return (
        <div className="relative">

            {/* SELECT BOX */}
            <div
                onClick={(e) => {
                    e.stopPropagation(); // 🔥 fix bug
                    setOpen(!open);
                }}
                className="w-full p-3 rounded-xl bg-gray-100 flex justify-between items-center"
            >
                <span>{selected?.label}</span>
                <span>▼</span>
            </div>

            {/* DROPDOWN */}
            {open && (
                <div
                    className="absolute z-[999] mt-2 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()} // 🔥 fix bug
                >
                    {days.map(d => (
                        <div
                            key={d.value}
                            onClick={() => {
                                onChange(d.value);
                                setOpen(false);
                            }}
                            className={`p-3 text-sm ${d.value === value
                                ? "bg-blue-500 text-white"
                                : "hover:bg-gray-100"
                                }`}
                        >
                            {d.label}
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}