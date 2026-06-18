import React, { useEffect, useState } from "react";
import { policiesApi } from "../../../../service/policy";
import { formatDate } from "../../../../utils/formatDate";

import { PolicyStatus } from "../../../../pages/Director/enum/PolicyStatus";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getEmployeeName } from "@/utils/auth";
type Subject = {
    id: number;
    createdAt: string;
    status: number;
    note: string;
    action: string;
    diff: any;
    newData: any;
    oldData: any;
};
export default function PolicyList() {
    const navigate = useNavigate();
    const location = useLocation();
    const subjectID = location.state;
    const { policyId } = useParams();
    const [policy, setPolicy] = useState<Subject[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [open, setOpen] = useState(false);
    const [note, setNote] = useState();

    const handleSelect = (id: number) => {
        setSelectedId((prev) => (prev === id ? null : id));
    };
    // ================== HANDLE ==================
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await policiesApi.getHistoryByPolicy(Number(policyId));
                setPolicy(data);
            } catch (err) {
                console.error("Load policy failed", err);
            }
        };

        if (policyId) fetchData();
    }, [policyId]);
    const handleSubmit = async () => {
        if (!selectedId) {
            alert("Vui lòng chọn 1 bản ghi");
            return;
        }

        try {
            const selectedItem = policy.find(p => p.id === selectedId);

            if (!selectedItem) return;

            const userInfo = await getEmployeeName();

            const payload = {
                data: selectedItem.newData,
                employeeInfo: userInfo,
                subjectId: subjectID,
                name: userInfo,
                status: "PENDING"
            };
            await policiesApi.update(Number(policyId), payload);

            alert("Gửi duyệt thành công!");

        } catch (err) {
            console.error(err);
            alert("Có lỗi xảy ra");
        }
    };
    const showModalNote = (note) => {
        setOpen(true);
        setNote(note);
    }
    return (
        <div className="bg-gray-100 min-h-screen">
            <div className="fixed top-0 left-0 w-full h-14 bg-blue-500 flex items-center px-4 z-50">

                {/* Back button */}
                <button
                    onClick={() => navigate(-1)}
                    className="mr-3 text-white text-lg"
                >
                    ←
                </button>

                {/* Title */}
                <h1 className="text-white font-semibold text-sm">
                    {decodeURIComponent("Chính sách chi tiết")}
                </h1>
            </div>
            {/* LIST */}
            <div className="p-4 mt-[60px] space-y-3">
                <div className="p-4 space-y-3">
                    {policy.map((item) => {
                        const statusConfig = {
                            [PolicyStatus.PENDING]: {
                                label: "Chờ duyệt",
                                className: "bg-yellow-100 text-yellow-600",
                            },
                            [PolicyStatus.SALE_ADMIN_APPROVED]: {
                                label: "Sale Admin duyệt",
                                className: "bg-blue-100 text-blue-600",
                            },
                            [PolicyStatus.DIRECTOR_APPROVED]: {
                                label: "Giám đốc duyệt",
                                className: "bg-green-100 text-green-600",
                            },
                            [PolicyStatus.REJECTED]: {
                                label: "Từ chối",
                                className: "bg-red-100 text-red-600",
                            },
                            [PolicyStatus.DRAFT]: {
                                label: "Nháp",
                                className: "bg-gray-100 text-red-600 text-slate-600",
                            },
                        };
                        const config = statusConfig[item.status] || {
                            label: "Không xác định",
                            className: "bg-gray-100 text-gray-500",
                        };

                        return (
                            <div
                                key={item.id}
                                className={`bg-white dark:bg-gray-900
                                    rounded-2xl
                                    border border-gray-200 dark:border-gray-700
                                    p-4
                                    shadow-sm
                                    transition
                                    space-y-3
                                    ${selectedId === item.id ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-gray-300"}
                                `}

                            >
                                {/* ROW */}
                                <div className="flex items-center  gap-3">

                                    <div
                                        onClick={() => handleSelect(item.id)}
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center
                                                    ${selectedId === item.id ? "border-blue-500" : "border-gray-300"}
                                                `}
                                    >
                                        {selectedId === item.id && (
                                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                        )}
                                    </div>

                                    <div
                                        className="flex-1"
                                        onClick={() => navigate(`/employee/policy/view`, {
                                            state: {
                                                data: item.newData,
                                                diff: item.diff,
                                            },
                                        })}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">


                                                {/* Name */}
                                                <div>
                                                    <p className="font-semibold text-gray-900 text-[13px] dark:text-white">
                                                        {formatDate(item.createdAt)}
                                                    </p>
                                                    <p className="text-xs text-gray-400 dark:text-white">
                                                        {item?.action}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* STATUS */}
                                            <div className="flex flex-col items-end gap-2">

                                                {/* STATUS */}
                                                <p
                                                    className={`
                                                    text-xs px-3 py-1 rounded-full font-medium
                                                    ${config.className}
                                            `}
                                                >
                                                    {config.label}
                                                </p>

                                                {/* NOTE */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        showModalNote(item.note);
                                                    }}
                                                    className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                                                >
                                                    <span
                                                        className={`
                                                            text-lg
                                                            ${item.note ? "text-blue-500" : "text-gray-400"}
                                                        `}
                                                    >
                                                        📝
                                                    </span>

                                                    {/* Badge */}
                                                    {item.note && (
                                                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                                    )}
                                                </button>

                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <button
                disabled={!selectedId}
                onClick={handleSubmit}
                className={`
        fixed bottom-6 right-6 px-5 py-3 rounded-full text-white shadow-lg
        ${selectedId ? "bg-blue-500" : "bg-gray-300"}
    `}
            >
                Gửi duyệt
            </button>
            {open && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 w-80 shadow-lg">
                        <h3 className="font-semibold mb-2">Ghi chú</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            {note || "Chưa có ghi chú"}
                        </p>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setOpen(false)}
                                className="px-3 py-1 text-sm bg-blue-500 text-white rounded"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}