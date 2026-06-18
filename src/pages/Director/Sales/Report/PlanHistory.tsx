import { useEffect, useState } from "react";
import { weeklyPlanApi } from "@/service/plan";

type HistoryItem = {
    id: number;
    version: number;
    snapshot: any;
};

export default function PlanHistory({ planId }: { planId: number }) {
    const [histories, setHistories] = useState<HistoryItem[]>([]);
    const [openVersion, setOpenVersion] = useState<number | null>(null);

    useEffect(() => {
        if (planId) {
            weeklyPlanApi.getHistory(planId).then(setHistories);
        }
    }, [planId]);

    return (
        <div className="bg-white rounded-xl p-3 shadow mt-3">
            <h3 className="font-semibold mb-2">Lịch sử thay đổi</h3>

            {histories.length === 0 && (
                <div className="text-sm text-gray-400">
                    Chưa có lịch sử
                </div>
            )}

            {histories.map((h) => {
                const isOpen = openVersion === h.version;

                return (
                    <div key={h.id} className="border-b py-2">
                        {/* HEADER */}
                        <div
                            onClick={() =>
                                setOpenVersion(isOpen ? null : h.version)
                            }
                            className="cursor-pointer flex justify-between text-sm font-medium"
                        >
                            <span>
                                {isOpen ? "🔽" : "▶"} Version {h.version}
                            </span>
                        </div>

                        {/* CONTENT */}
                        {isOpen && (
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                                {h.snapshot.tasks?.map((t: any) => (
                                    <div
                                        key={t.id}
                                        className="bg-gray-50 p-2 rounded"
                                    >
                                        📌 {t.title}
                                        <div className="text-xs text-gray-400">
                                            Thứ {t.dayOfWeek}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}