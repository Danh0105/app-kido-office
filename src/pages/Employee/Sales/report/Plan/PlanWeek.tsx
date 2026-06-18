export default function PlanWeek({
    plans,
    openWeekIndex,
    setOpenWeekIndex,
    handleDeleteTask,
    handleEdit
}: any) {
    const groupPlanByDay = (plans: any[]) => {
        const map: Record<number, any[]> = {};

        plans.forEach(plan => {
            (plan.tasks || []).forEach((task: any) => {
                const key = task.dayOfWeek;

                if (!map[key]) map[key] = [];

                // 🔥 giống report: push cả plan
                map[key].push({
                    ...plan,
                    task
                });
            });
        });

        return map;
    };
    const getDateOfWeek = (weekStart: string, dayOfWeek: number) => {
        const start = new Date(weekStart);

        // convert về thứ 2 (vì backend có thể lệch)
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(start.setDate(diff));

        // tính ngày theo thứ
        const result = new Date(monday);
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        result.setDate(monday.getDate() + offset);

        return result.toLocaleDateString("vi-VN");
    };
    const days = [
        { label: "Thứ 2", value: 1 },
        { label: "Thứ 3", value: 2 },
        { label: "Thứ 4", value: 3 },
        { label: "Thứ 5", value: 4 },
        { label: "Thứ 6", value: 5 },
        { label: "Thứ 7", value: 6 },
        { label: "Chủ nhật", value: 0 },
    ];
    return (
        <div className="space-y-3 p-2">
            <h2 className="text-lg font-semibold">Kế hoạch theo tuần</h2>

            {plans.map((week: any, index: number) => {
                const isOpen = openWeekIndex === index;
                const grouped = groupPlanByDay(week.plans);
                return (
                    <div key={index} className="bg-white rounded-2xl">
                        {/* HEADER */}
                        <div
                            onClick={() =>
                                setOpenWeekIndex(isOpen ? null : index)
                            }
                            className="p-4 flex justify-between cursor-pointer"
                        >
                            <span>
                                {new Date(week.weekStart).toLocaleDateString()} -{" "}
                                {new Date(week.weekEnd).toLocaleDateString()}
                            </span>
                            <span>{isOpen ? "▲" : "▼"}</span>
                        </div>

                        {/* BODY */}
                        {isOpen && (
                            <div className="p-4 space-y-4">

                                <div className="grid grid-cols-3 text-sm font-semibold text-gray-600 border-b pb-2">
                                    <div>Ngày</div>
                                    <div className="col-span-2">Công việc</div>
                                </div>

                                {days.map((d) => {
                                    const tasks = grouped[d.value];

                                    if (!tasks) return null;

                                    return (
                                        <div
                                            key={d.value}
                                            className="grid grid-cols-3 gap-3 border-b pb-3"
                                        >
                                            <div className="text-sm text-gray-500">
                                                <div className="text-sm text-gray-500">
                                                    <div className="font-medium">{d.label}</div>
                                                    <div className="text-xs text-gray-400">
                                                        {getDateOfWeek(week.weekStart, d.value)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-span-2 space-y-2">
                                                {(tasks as any[]).map((item: any, index: number) => {
                                                    const plan = item;
                                                    const task = item.task;

                                                    return (
                                                        <div key={task.id} className="bg-gray-50 p-2 rounded-lg">
                                                            <div className="flex justify-between items-center">
                                                                <div className="font-medium flex items-center gap-2">

                                                                    {/* số thứ tự */}
                                                                    <span className="w-5 h-5 flex items-center justify-center text-xs rounded-full bg-blue-500 text-white">
                                                                        {index + 1}
                                                                    </span>

                                                                    {task.title}
                                                                </div>

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

                                                            <div className="text-sm text-gray-600">
                                                                {task.content}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
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
    );
}