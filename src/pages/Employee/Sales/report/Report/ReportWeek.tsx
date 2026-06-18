export default function ReportWeek({
    historyWeeks,
    openWeekIndex,
    setOpenWeekIndex,
    groupByDate,
    getWeekday,
    handleEdit,
    handleDelete,
    formatDateTime
}: any) {
    return (
        <div className="space-y-3 p-2">
            <h2 className="text-lg font-semibold">Báo cáo theo tuần</h2>

            {historyWeeks.map((week: any, index: number) => {
                const isOpen = openWeekIndex === index;
                const grouped = groupByDate(week.reports);

                return (
                    <div key={index} className="bg-white rounded-2xl">
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

                        {isOpen && (
                            <div className="p-4 space-y-4">

                                <div className="grid grid-cols-3 text-sm font-semibold text-gray-600 border-b pb-2">
                                    <div>Ngày</div>

                                    <div className="col-span-2">Công việc</div>
                                </div>

                                {Object.entries(grouped).map(([date, reports]) => {
                                    const list = reports as any[];
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
                                                                        onClick={() => handleEdit(report)}
                                                                        className="text-xs text-orange-500 hover:text-orange-600"
                                                                    >
                                                                        ✏️ Sửa
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleDelete(task.id)}
                                                                        className="text-xs text-red-500 hover:text-red-600"
                                                                    >
                                                                        🗑️ Xoá
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
                                                                    📍 Xem vị trí
                                                                </a>
                                                            )}

                                                            <div className="text-xs text-gray-400 mt-1">
                                                                🕒 {formatDateTime(task.createdAt)}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                                }
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}