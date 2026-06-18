import React, { useEffect, useState } from "react";
import { policiesApi } from "../../../../service/policy";
import { formatDate } from "../../../../utils/formatDate";
import FormCreate from "./FormCreate";
import { PolicyStatus } from "../../../../pages/Director/enum/PolicyStatus";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import { getEmployeeId } from "@/utils/auth";

type Subject = {
    id: number;
    createdAt: string;
    status: number;
    data: any;
    note: string;
    dataF: any;
    subjectId: number;
    currentHistoryId: number;
};


export default function PolicyList() {
    const navigate = useNavigate();
    const { subject } = useParams();
    const location = useLocation();
    const data = location.state;
    const subjectID = Number(subject);
    const [policy, setPolicy] = useState<Subject[]>([]);
    const [open, setOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [note, setNote] = useState();
    const [editingItem, setEditingItem] = useState<Subject | null>(null);

    // ================== HANDLE ==================
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await policiesApi.getBySubject(subjectID);
                setPolicy(data);
            } catch (err) {
                console.error("Load policy failed", err);
            }
        };

        if (subjectID) fetchData();
    }, [subjectID]);


    const handleEdit = (item: Subject) => {
        setEditingItem(item);
        setShowModal(true);
    };
    const showModalNote = (note) => {
        setOpen(true);
        setNote(note);
    }




    return (
        <div className="bg-gray-100 min-h-screen">

            <HeaderWithBack title="Danh sach chính sách" />
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
                                label: "SA đã kiểm",
                                className: "bg-blue-100 text-blue-600",
                            },
                            [PolicyStatus.DIRECTOR_APPROVED]: {
                                label: "GD duyệt",
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
                                onClick={() =>
                                    navigate(`/employee/policy/view`, {
                                        state: {
                                            data: item.data,
                                            user: getEmployeeId(),
                                            subjectId: item.subjectId,
                                            currentHistoryId: item.currentHistoryId,
                                        }
                                    })
                                }
                                className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3"
                            >
                                {/* TOP */}
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">

                                        {/* Name */}
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm dark:text-white">
                                                {formatDate(item.createdAt)}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Ngày tạo
                                            </p>

                                        </div>
                                    </div>

                                    {/* STATUS BADGE */}
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

                                {/* ACTION */}
                                <div
                                    className="flex gap-2 pt-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="flex-1 py-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium"
                                    >
                                        ✏️ Sửa
                                    </button>

                                    {/*             <button
                                        onClick={() => handleDelete(item.id)}
                                        className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium"
                                    >
                                        🗑️ Xóa
                                    </button> */}

                                    <button
                                        onClick={() => navigate(`/employee/policy-history-list/${item.id}`, { state: subjectID })}
                                        className="flex-1 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium"
                                    >
                                        🕘 Lịch sử
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BUTTON ADD */}
            <button
                onClick={() => {
                    setShowModal(true);
                }}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white text-2xl shadow-lg active:scale-90"
            >
                +
            </button>

            {/* MODAL */}
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
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-end z-50">
                    <div className="bg-white dark:bg-gray-900 w-full p-4 rounded-t-2xl max-h-[90vh] overflow-y-auto">
                        <FormCreate setShowModal={setShowModal} subjectId={subjectID} setPolicy={setPolicy} defaultData={editingItem?.data} id={editingItem?.id} />
                    </div>
                </div>
            )}
        </div>
    );
}