import { use, useEffect, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { suggestApi } from "@/service/suggest";
import { useParams } from "react-router-dom";
import { getEmployeeRole } from "@/utils/auth";

type Suggest = {
    id: number;
    content: string;
    component?: string;
    description?: string;
    issueDate?: string;
    fileUrl?: string;
    status: "DRAFT" | "PENDING" | "REVIEWED" | "APPROVED" | "REJECTED";
    policy?: {
        id: number;
        subject?: {
            schoolYear?: string;

            id: number;
            name: string;
            school?: {
                id: number;
                name: string;
            };
        };
    };
};

export default function SuggestPage() {
    const employeeId = useParams().employeeId;
    const [data, setData] = useState<Suggest[]>([]);
    const [loading, setLoading] = useState(false);
    const role = getEmployeeRole();
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await suggestApi.getByEmployeeId(Number(employeeId));
            console.log(res);
            setData(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleReview = async (id: number, status: "REVIEWED" | "REJECTED") => {
        try {
            let rejectReason = "";

            if (status === "REJECTED") {
                rejectReason = prompt("Nhập lý do từ chối") || "";
                if (!rejectReason) return;
            }

            await suggestApi.review(id, { status, rejectReason });

            alert("Xử lý thành công");
            fetchData();

        } catch (err: any) {
            const message =
                err?.response?.data?.message || "Có lỗi xảy ra";

            alert(message);
            console.error("Review error:", err);
        }
    };

    const handleApprove = async (id: number, status: "APPROVED" | "REJECTED") => {
        try {
            let rejectReason = "";

            if (status === "REJECTED") {
                rejectReason = prompt("Nhập lý do từ chối") || "";
                if (!rejectReason) return;
            }

            await suggestApi.approve(id, { status, rejectReason });

            alert("Duyệt thành công");
            fetchData();

        } catch (err: any) {
            const message =
                err?.response?.data?.message || "Có lỗi xảy ra";

            alert(message);
            console.error("Approve error:", err);
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex flex-col">

            {/* HEADER */}
            <HeaderWithBack title="Đề xuất" />

            {/* CONTENT */}
            <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">

                {/* LOADING */}
                {loading && (
                    <div className="text-center text-gray-400 text-sm py-10">
                        Đang tải...
                    </div>
                )}

                {/* EMPTY */}
                {!loading && data.length === 0 && (
                    <div className="text-center text-gray-400 text-sm py-16">
                        📭 Chưa có đề xuất
                    </div>
                )}

                {/* LIST */}
                {data.map((item) => (
                    <div
                        key={item.id}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition"
                    >
                        {/* STATUS BADGE */}
                        <div className="flex justify-between items-start">
                            <span className={`text-[10px] px-2 py-[2px] rounded-full font-medium
                ${item.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : ""}
                ${item.status === "REVIEWED" ? "bg-green-100 text-green-700" : ""}
                ${item.status === "APPROVED" ? "bg-blue-100 text-blue-700" : ""}
                ${item.status === "REJECTED" ? "bg-red-100 text-red-700" : ""}
            `}>
                                {item.status}
                            </span>
                        </div>

                        {/* TITLE */}
                        <p className="mt-2 font-semibold text-gray-900 text-[15px] leading-snug line-clamp-2">
                            {item.content}
                        </p>

                        {/* DESCRIPTION */}
                        {item.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {item.description}
                            </p>
                        )}

                        {/* META */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                            {item.component && <span>🧩 {item.component}</span>}
                            {item.issueDate && <span>📅 {item.issueDate}</span>}
                        </div>

                        {/* FILE */}
                        {item.fileUrl && (
                            <a
                                href={`https://sales.kidoedu.vn${item.fileUrl}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-500 font-medium"
                            >
                                📎 Xem file
                            </a>
                        )}
                        {/* BADGES */}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {item.policy?.subject?.school?.name && (
                                <span className="px-2 py-[3px] text-[10px] bg-purple-100 text-purple-700 rounded-full font-medium">
                                    🏫 {item.policy.subject.school.name}
                                </span>
                            )}

                            {item.policy?.subject?.name && (
                                <span className="px-2 py-[3px] text-[10px] bg-blue-100 text-blue-700 rounded-full font-medium">
                                    📘 {item.policy.subject.name}
                                </span>
                            )}

                            {item.policy?.subject?.schoolYear && (
                                <span className="px-2 py-[3px] text-[10px] bg-green-100 text-green-700 rounded-full font-medium">
                                    🎓 {item.policy.subject.schoolYear}
                                </span>
                            )}
                        </div>
                        {/* ACTION */}
                        <div className="flex gap-2 mt-4">
                            {/* SALEADMIN */}
                            {role === "saleadmin" && item.status === "PENDING" && (
                                <>
                                    <button
                                        onClick={() => handleReview(item.id, "REVIEWED")}
                                        className="flex-1 py-2 text-xs bg-green-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ✔️ Kiểm tra
                                    </button>

                                    <button
                                        onClick={() => handleReview(item.id, "REJECTED")}
                                        className="flex-1 py-2 text-xs bg-red-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ❌ Từ chối
                                    </button>
                                </>
                            )}

                            {/* DIRECTOR */}
                            {role === "director" && item.status === "PENDING" && (
                                <>
                                    <button
                                        onClick={() => handleApprove(item.id, "APPROVED")}
                                        className="flex-1 py-2 text-xs bg-blue-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ✔️ Duyệt
                                    </button>

                                    <button
                                        onClick={() => handleApprove(item.id, "REJECTED")}
                                        className="flex-1 py-2 text-xs bg-red-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ❌ Không duyệt
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>




        </div>
    );
}