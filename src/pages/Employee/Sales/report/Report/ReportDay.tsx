import { useState } from "react";

export default function ReportDay({
    historyWeeks,
    openWeekIndex,
    setOpenWeekIndex,
    groupByDate,
    getWeekday,
    handleEdit,
    handleDelete,
    formatDateTime
}: any) {
    const [openDayKey, setOpenDayKey] = useState<string | null>(null);

    return (
        <div className="space-y-3 p-2">
            <h2 className="text-lg font-semibold">Báo cáo theo ngày</h2>

            {historyWeeks.map((week) => {
                const grouped = groupByDate(week.reports);

                return Object.entries(grouped)
                    .sort(
                        ([a], [b]) =>
                            new Date(b).getTime() - new Date(a).getTime()
                    )
                    .map(([date, reports]) => {
                        const isOpen = openDayKey === date;
                        const list = reports as any[];
                        return (
                            <div
                                key={date}
                                className="bg-white rounded-xl shadow-sm"
                            >
                                <div
                                    onClick={() =>
                                        setOpenDayKey(isOpen ? null : date)
                                    }
                                    className="p-4 flex justify-between items-center cursor-pointer border-b"
                                >
                                    <span className="font-semibold text-gray-700">
                                        {getWeekday(date)} - {date}
                                    </span>

                                    <span>
                                        {isOpen ? "▲" : "▼"}
                                    </span>
                                </div>

                                {isOpen && (
                                    <div className="p-4 space-y-2">
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
                                )}
                            </div>
                        );
                    });
            })}
        </div>
    );
}