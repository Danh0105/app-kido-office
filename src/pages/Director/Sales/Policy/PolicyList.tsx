import React, { useEffect, useState } from "react";
import { policiesApi } from "../../../../service/policy";
import { formatDate } from "../../../../utils/formatDate";
import { PolicyStatus } from "../../enum/PolicyStatus";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import { isDirectorBrandUiEnabled } from "@/utils/directorUi";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { FileText, ExternalLink, X } from "lucide-react";
import type { PolicyContractFile } from "@/types/policy";
type Subject = {
    id: number;
    createdAt: string;
    status: number;
    data: any;
    note: string;
    subjectId: number;
    currentHistoryId: number;
    contractFiles?: PolicyContractFile[];
    contractFileUrl?: string | null;
    contractFileName?: string | null;
};

/** Gom `contractFiles` (nhiều file) và `contractFileUrl` cũ (1 file) về cùng một danh sách để hiển thị. */
const getContractFiles = (item: Subject): PolicyContractFile[] => {
    if (item.contractFiles?.length) return item.contractFiles;
    if (item.contractFileUrl) {
        return [{
            id: "legacy",
            url: item.contractFileUrl,
            originalName: item.contractFileName || "Hợp đồng PDF",
            size: 0,
            uploadedById: 0,
            uploadedAt: "",
        }];
    }
    return [];
};

export default function PolicyList() {
    const navigate = useNavigate();
    const isBrand = isDirectorBrandUiEnabled();
    const { subject } = useParams();
    const location = useLocation();
    const data = location.state;
    const subjectID = Number(subject);
    const [policy, setPolicy] = useState<Subject[]>([]);
    const [filesModal, setFilesModal] = useState<Subject | null>(null);
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

    return (
        <>
        <div className={isBrand ? "bg-[#FFF8E6] min-h-screen text-[#0047B8]" : "bg-gray-100 min-h-screen"}>
            <HeaderWithBack title="Danh sách chính sách" brandSidebarInset={isBrand} />
            {/* LIST */}
            <div className={`p-4 mt-[60px] space-y-3 ${isBrand ? "lg:max-w-5xl lg:mx-auto" : ""}`}>
                <div className="p-4 space-y-3">
                    {policy.map((item, index) => {
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
                        };
                        const config = statusConfig[item.status] || {
                            label: "Không xác định",
                            className: "bg-gray-100 text-gray-500",
                        };
                        const isLatest = index === 0;
                        const contractFiles = getContractFiles(item);
                        return (
                            <div
                                key={item.id}
                                onClick={() => navigate(`/director/policy/${item.id}`, {
                                    state: {
                                        data: item.data,
                                        user: Number(data),
                                        subjectId: item.subjectId,
                                        currentHistoryId: item.currentHistoryId,
                                        status: item.status,
                                    }
                                })}
                                className={`
                rounded-2xl p-4 shadow-sm transition space-y-3

                ${isLatest
                                        ? isBrand ? "bg-white border-2 border-[#005BEA] shadow-md" : "bg-blue-50 border-2 border-blue-400 shadow-md"
                                        : isBrand ? "bg-white border border-blue-900/10" : "bg-white dark:bg-gray-900"
                                    }

                active:scale-95
            `}
                            >
                                {/* TOP */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                            📘
                                        </div>

                                        {/* Name */}
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm dark:text-white">
                                                {formatDate(item.createdAt)}
                                            </p>

                                            {isLatest && (
                                                <span className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded-full">
                                                    Mới nhất
                                                </span>
                                            )}
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

                                    {/*             <button
                                        onClick={() => handleDelete(item.id)}
                                        className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium"
                                    >
                                        🗑️ Xóa
                                    </button> */}

                                    <button
                                        onClick={() => navigate(`/director/policy-history-list/${item.id}`)}
                                        className="flex-1 py-2 rounded-xl bg-yellow-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium"
                                    >
                                        🕘 Lịch sử
                                    </button>

                                    {contractFiles.length > 0 && (
                                        <button
                                            onClick={() => setFilesModal(item)}
                                            className="flex-1 py-2 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-medium"
                                        >
                                            📎 File ({contractFiles.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>



        </div>

        {filesModal && (
            <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                onClick={() => setFilesModal(null)}
            >
                <div
                    className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h2 className="text-base font-bold text-gray-900">File Sale Admin đã up</h2>
                        <button
                            type="button"
                            onClick={() => setFilesModal(null)}
                            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
                            aria-label="Đóng"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <ul className="mt-3 flex flex-col gap-2">
                        {getContractFiles(filesModal).map((file) => (
                            <li key={file.id}>
                                <a
                                    href={resolveApiFileUrl(file.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={file.originalName}
                                    className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                                >
                                    <FileText size={16} className="shrink-0" />
                                    <span className="truncate">{file.originalName}</span>
                                    <ExternalLink size={14} className="ml-auto shrink-0" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        )}
        </>
    );
}
