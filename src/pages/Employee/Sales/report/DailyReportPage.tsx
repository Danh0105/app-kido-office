import { useEffect, useState } from "react";
import { dailyReportApi } from "@/service/report";
import { weeklyPlanApi } from "@/service/plan";
import { getEmployeeId } from "@/utils/auth";
import HeaderWithBack from "@/components/HeaderWithBack";
import ReportForm from "./ReportPage";
import PlanForm from "./PlanPage";




const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
};

const groupByDate = (reports: any[]) => {
    const map: Record<string, any[]> = {};

    reports.forEach((r) => {
        if (!map[r.date]) map[r.date] = [];
        map[r.date].push(r);
    });

    return map;
};

export default function DailyReportPage() {

    const [mainTab, setMainTab] = useState<"plan" | "report">("report");

    const [report, setReport] = useState({
        date: new Date().toISOString().slice(0, 10),
    });
    const [openWeekIndex, setOpenWeekIndex] = useState<number | null>(0);
    const [openDayKey, setOpenDayKey] = useState<string | null>(null);
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

    // ================= FETCH =================




    useEffect(() => {

        setOpenDayKey(null);
        setOpenWeekIndex(0);
    }, [mainTab]);

    // ================= TASK =================


    // ================= UI =================
    return (
        <div className="min-h-screen bg-gray-100 pb-24">

            {/* HEADER */}
            <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-2 shadow-sm">
                <HeaderWithBack title="Báo cáo | Kế hoạch" />
            </div>



            <div className="px-4 pt-6 space-y-5 max-w-3xl mx-auto">
                {/* TAB */}
                <div className="bg-white rounded-xl p-1 shadow-sm mt-[60px] flex">
                    <button
                        onClick={() => setMainTab("plan")}
                        className={`flex-1 py-2 rounded-lg ${mainTab === "plan"
                            ? "bg-green-500 text-white"
                            : "text-gray-500"}`}
                    >
                        Kế hoạch
                    </button>

                    <button
                        onClick={() => setMainTab("report")}
                        className={`flex-1 py-2 rounded-lg ${mainTab === "report"
                            ? "bg-blue-500 text-white"
                            : "text-gray-500"}`}
                    >
                        Báo cáo
                    </button>
                </div>

                {mainTab === "report" && (
                    <ReportForm
                        report={report}
                        setReport={setReport}

                        openWeekIndex={openWeekIndex}
                        setOpenWeekIndex={setOpenWeekIndex}
                        groupByDate={groupByDate}
                        getWeekday={getWeekday}
                        formatDateTime={formatDateTime}

                        openDayKey={openDayKey}
                        setOpenDayKey={setOpenDayKey}
                    />
                )}
                {mainTab === "plan" && (
                    <PlanForm />
                )}
            </div>
        </div>
    );
}