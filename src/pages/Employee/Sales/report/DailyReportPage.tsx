import { useEffect, useState } from "react";
import { getEmployeeId } from "@/utils/auth";
import HeaderWithBack from "@/components/HeaderWithBack";
import ReportForm from "./ReportPage";
import PlanForm from "./PlanPage";
import ReportCalendar from "@/pages/Director/Sales/Report/DailyReportPage";
import { ClipboardList, FileText, X } from "lucide-react";




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

    const [composer, setComposer] = useState<"plan" | "report" | null>(null);
    const [calendarVersion, setCalendarVersion] = useState(0);

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
    }, [composer]);

    const handleSaved = () => {
        setCalendarVersion((version) => version + 1);
        setComposer(null);
    };

    // ================= TASK =================


    // ================= UI =================
    return (
        <div className="min-h-screen bg-gray-100 pb-24">

            {/* HEADER */}
            <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-2 shadow-sm">
                <HeaderWithBack title="Báo cáo | Kế hoạch" />
            </div>



            <div className="mx-auto max-w-[1500px] space-y-5 px-4 pt-6">
                <div className="mt-[60px] rounded-xl bg-white p-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setComposer(composer === "plan" ? null : "plan")}
                            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-medium ${composer === "plan"
                                ? "bg-green-500 text-white"
                                : "bg-green-50 text-green-700"}`}
                        >
                            <ClipboardList className="h-4 w-4" />
                            Tạo kế hoạch
                        </button>

                        <button
                            type="button"
                            onClick={() => setComposer(composer === "report" ? null : "report")}
                            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 font-medium ${composer === "report"
                                ? "bg-blue-500 text-white"
                                : "bg-blue-50 text-blue-700"}`}
                        >
                            <FileText className="h-4 w-4" />
                            Tạo báo cáo
                        </button>
                    </div>
                </div>

                {composer && (
                    <section className="relative rounded-2xl border border-slate-200 bg-slate-50 pt-2 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setComposer(null)}
                            aria-label="Đóng biểu mẫu"
                            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow transition hover:bg-slate-100"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {composer === "report" && (
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
                                onSaved={handleSaved}
                            />
                        )}
                        {composer === "plan" && <PlanForm onSaved={handleSaved} />}
                    </section>
                )}

                <ReportCalendar
                    key={calendarVersion}
                    employeeIdOverride={Number(getEmployeeId())}
                    embedded
                />
            </div>
        </div>
    );
}
