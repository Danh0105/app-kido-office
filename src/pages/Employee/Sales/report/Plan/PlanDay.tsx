import { useState } from "react";

export default function PlanDay({
    plans,
    getWeekday,
    handleEdit,
    handleDeletePlan,
    handleDeleteTask,
}: any) {
    const [openDayKey, setOpenDayKey] = useState<string | null>(null);
    const groupByDate = (plans: any[]) => {
        const map: Record<string, any[]> = {};

        plans.forEach(plan => {
            const start = new Date(plan.startDate);

            (plan.tasks || []).forEach((task: any) => {
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(start.setDate(diff));

                const date = new Date(monday);
                const offset = task.dayOfWeek === 0 ? 6 : task.dayOfWeek - 1;
                date.setDate(monday.getDate() + offset);

                const key = date.toISOString().slice(0, 10);

                if (!map[key]) map[key] = [];

                map[key].push({
                    ...plan,
                    tasks: [task],
                });
            });
        });

        return map;
    };
    return (
        <div className="space-y-3 p-2">
            <h2 className="text-lg font-semibold">Kế hoạch theo ngày</h2>

            {plans.map((week: any) => {
                const grouped = groupByDate(week.plans);

                return Object.entries(grouped)
                    .sort(
                        ([a], [b]) =>
                            new Date(b).getTime() - new Date(a).getTime()
                    )
                    .map(([date, plansInDay]) => {
                        const isOpen = openDayKey === date;

                        // 🔥 gộp toàn bộ task trong ngày
                        const tasks = (plansInDay as any[])
                            .flatMap((plan: any) =>
                                (plan.tasks || []).map((task: any) => ({
                                    ...task,
                                    plan,
                                }))
                            )
                            .sort((a, b) => a.id - b.id); // hoặc createdAt

                        return (
                            <div
                                key={date}
                                className="bg-white rounded-xl shadow-sm"
                            >
                                {/* HEADER */}
                                <div
                                    onClick={() =>
                                        setOpenDayKey(isOpen ? null : date)
                                    }
                                    className="p-4 flex justify-between items-center cursor-pointer border-b"
                                >
                                    <div>
                                        <div className="font-semibold text-gray-700">
                                            {getWeekday(date)}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {date}
                                        </div>
                                    </div>

                                    <span>{isOpen ? "▲" : "▼"}</span>
                                </div>

                                {/* BODY */}
                                {isOpen && (
                                    <div className="p-4 space-y-2">
                                        {tasks.map((item: any, index: number) => {
                                            const task = item;
                                            const plan = item.plan;

                                            return (
                                                <div
                                                    key={task.id}
                                                    className="bg-gray-50 p-2 rounded-lg"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-medium flex items-center gap-2">

                                                            {/* 🔥 số thứ tự */}
                                                            <span className="w-5 h-5 flex items-center justify-center text-xs rounded-full bg-blue-500 text-white">
                                                                {index + 1}
                                                            </span>

                                                            {task.title}
                                                        </div>

                                                        <div className="flex justify-between items-center">

                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleEdit(plan, task)}
                                                                    className="text-xs text-orange-500"
                                                                >
                                                                    ✏️
                                                                </button>

                                                                <button
                                                                    onClick={() => handleDeleteTask(plan, task.id)}
                                                                    className="text-xs text-red-500"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
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
                                                            📍 Xem vị trí
                                                        </a>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    });
            })}
        </div>
    );
}