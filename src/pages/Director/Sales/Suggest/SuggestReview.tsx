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

export default function SuggestReview() {
    const suggestId = useParams().suggestId;
    const [openSchoolPopup, setOpenSchoolPopup] = useState(false);
    const [data, setData] = useState<Suggest | null>(null);
    const [loading, setLoading] = useState(false);
    const role = getEmployeeRole();
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await suggestApi.getById(Number(suggestId));
            console.log("Suggest ID:", res);
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
                {!loading && data === null && (
                    <div className="text-center text-gray-400 text-sm py-16">
                        📭 Chưa có đề xuất
                    </div>
                )}

                {/* LIST */}
                {data && (
                    <div
                        key={data.id}
                        className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition"
                    >
                        {/* STATUS BADGE */}
                        <div className="flex justify-between items-start">
                            <span className={`text-[10px] px-2 py-[2px] rounded-full font-medium
                ${data.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : ""}
                ${data.status === "REVIEWED" ? "bg-green-100 text-green-700" : ""}
                ${data.status === "APPROVED" ? "bg-blue-100 text-blue-700" : ""}
                ${data.status === "REJECTED" ? "bg-red-100 text-red-700" : ""}
            `}>
                                {data.status}
                            </span>
                        </div>

                        {/* TITLE */}
                        <p className="mt-2 font-semibold text-gray-900 text-[15px] leading-snug line-clamp-2">
                            {data.content}
                        </p>

                        {/* DESCRIPTION */}
                        {data.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {data.description}
                            </p>
                        )}

                        {/* META */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                            {data.component && <span>🧩 {data.component}</span>}
                            {data.issueDate && <span>📅 {data.issueDate}</span>}
                        </div>

                        {/* FILE */}
                        {data.fileUrl && (
                            <a
                                href={`https://sales.kidoedu.vn${data.fileUrl}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-500 font-medium"
                            >
                                📎 Xem file
                            </a>
                        )}
                        {/* BADGES */}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {data.policy?.subject?.school?.name && (
                                <button
                                    onClick={() => setOpenSchoolPopup(true)}
                                    className="
                                        px-2 py-[3px]
                                        text-[10px]
                                        bg-purple-100
                                        text-purple-700
                                        rounded-full
                                        font-medium
                                        active:scale-95
                                        transition
                                    "
                                >
                                    🏫 {data.policy.subject.school.name}
                                </button>
                            )}

                            {data.policy?.subject?.name && (
                                <span className="px-2 py-[3px] text-[10px] bg-blue-100 text-blue-700 rounded-full font-medium">
                                    📘 {data.policy.subject.name}
                                </span>
                            )}

                            {data.policy?.subject?.schoolYear && (
                                <span className="px-2 py-[3px] text-[10px] bg-green-100 text-green-700 rounded-full font-medium">
                                    🎓 {data.policy.subject.schoolYear}
                                </span>
                            )}
                        </div>
                        {/* ACTION */}
                        <div className="flex gap-2 mt-4">
                            {/* SALEADMIN */}
                            {role === "saleadmin" && data.status === "PENDING" && (
                                <>
                                    <button
                                        onClick={() => handleReview(data.id, "REVIEWED")}
                                        className="flex-1 py-2 text-xs bg-green-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ✔️ Kiểm tra
                                    </button>

                                    <button
                                        onClick={() => handleReview(data.id, "REJECTED")}
                                        className="flex-1 py-2 text-xs bg-red-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ❌ Từ chối
                                    </button>
                                </>
                            )}

                            {/* DIRECTOR */}
                            {role === "director" && (data.status === "PENDING" || data.status === "REVIEWED") && (
                                <>
                                    <button
                                        onClick={() => handleApprove(data.id, "APPROVED")}
                                        className="flex-1 py-2 text-xs bg-blue-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ✔️ Duyệt
                                    </button>

                                    <button
                                        onClick={() => handleApprove(data.id, "REJECTED")}
                                        className="flex-1 py-2 text-xs bg-red-500 text-white rounded-xl font-medium active:scale-95"
                                    >
                                        ❌ Không duyệt
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {openSchoolPopup && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">

                    <div className="bg-white w-full max-w-lg rounded-3xl p-5 relative">

                        {/* CLOSE */}
                        <button
                            onClick={() => setOpenSchoolPopup(false)}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100"
                        >
                            ✕
                        </button>

                        {/* TITLE */}
                        <h2 className="text-lg font-bold text-gray-900 mb-4">
                            🏫 Thống kê trường
                        </h2>

                        {/* SCHOOL INFO */}
                        <div className="space-y-3 text-sm">

                            <div className="bg-gray-50 rounded-2xl p-3">
                                <div className="text-gray-400 text-xs">
                                    Tên trường
                                </div>

                                <div className="font-semibold text-gray-800">
                                    {data?.policy?.subject?.school?.name || "-"}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">

                                <div className="bg-blue-50 rounded-2xl p-3">
                                    <div className="text-xs text-gray-500">
                                        Môn học
                                    </div>

                                    <div className="font-bold text-blue-700 mt-1">
                                        {data?.policy?.subject?.name || "-"}
                                    </div>
                                </div>

                                <div className="bg-green-50 rounded-2xl p-3">
                                    <div className="text-xs text-gray-500">
                                        Năm học
                                    </div>

                                    <div className="font-bold text-green-700 mt-1">
                                        {data?.policy?.subject?.schoolYear || "-"}
                                    </div>
                                </div>

                            </div>

                            <div className="bg-purple-50 rounded-2xl p-4">
                                <div className="text-xs text-gray-500 mb-1">
                                    Nội dung đề xuất
                                </div>

                                <div className="font-medium text-gray-800">
                                    {data?.content}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}