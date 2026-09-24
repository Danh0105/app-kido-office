import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import HeaderWithBack from "@/components/HeaderWithBack";
import SubjectFormModal, {
    type EditableSubject,
} from "@/components/subject/SubjectFormModal";
import { subjectApi } from "../../../../service/subject.api";
import { canManageSubjects } from "@/utils/auth";
import { getApiErrorMessage } from "@/utils/apiError";
import { isDirectorBrandUiEnabled } from "@/utils/directorUi";

type Subject = {
    id: number;
    name: string;
    /** Môn trong danh mục; null với dữ liệu cũ chưa map được. */
    catalogId: number | null;
    status: number;

    studentCount: number;
    classCount: number;
    totalLessons: number;
    contractDuration: number;
    appendixDuration: number;
    startDate: string;
    contractNumber: string;
    policyCount: number;
    note: string;
    schoolYear: string;
};

const ALL_YEARS = "";

/** Năm học hiện tại — mốc chuyển năm là tháng 8. */
const currentSchoolYear = () => {
    const now = new Date();
    const year = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${year + 1}`;
};

/** Các năm học chọn được: từ 2021 tới năm học hiện tại. */
const schoolYearOptions = () => {
    const last = Number(currentSchoolYear().split("-")[0]);
    const years: string[] = [];
    for (let y = last; y >= 2021; y--) years.push(`${y}-${y + 1}`);
    return years;
};

/**
 * Môn học của trường trong luồng Chính sách của giám đốc / sales admin.
 * Hai role này quản lý được (thêm/sửa/xoá); các role xem khác chỉ đọc.
 */
export default function SubjectList() {
    const navigate = useNavigate();
    const isBrand = isDirectorBrandUiEnabled();
    const location = useLocation();
    const data = location.state;
    const { id } = useParams();
    const schoolId = Number(id);

    const canManage = canManageSubjects();

    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [schoolYear, setSchoolYear] = useState<string>(ALL_YEARS);

    /** undefined = đóng, null = thêm mới, có giá trị = sửa. */
    const [formTarget, setFormTarget] = useState<
        EditableSubject | null | undefined
    >(undefined);
    const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
    const [deleting, setDeleting] = useState(false);

    const yearOptions = useMemo(schoolYearOptions, []);

    // ================== HANDLE ==================
    const load = useCallback(async () => {
        if (!schoolId) return;

        setLoading(true);
        try {
            const res = schoolYear
                ? await subjectApi.getBySchoolYear(schoolYear, schoolId)
                : await subjectApi.getBySchool(schoolId);
            setSubjects(Array.isArray(res) ? res : res?.data || []);
        } catch (err: any) {
            if (err?.response?.status !== 403) {
                toast.error(getApiErrorMessage(err, "Không tải được danh sách môn học"));
            }
            setSubjects([]);
        } finally {
            setLoading(false);
        }
    }, [schoolId, schoolYear]);

    useEffect(() => {
        load();
    }, [load]);

    const handleDelete = async () => {
        if (!deleteTarget) return;

        setDeleting(true);
        try {
            await subjectApi.remove(deleteTarget.id);
            toast.success("Đã xoá môn học");
            setDeleteTarget(null);
            load();
        } catch (err: any) {
            if (err?.response?.status !== 403) {
                toast.error(getApiErrorMessage(err, "Xoá môn học thất bại"));
            }
        } finally {
            setDeleting(false);
        }
    };

    // ================== UI ==================

    return (
        <>
        <div className={isBrand ? "bg-[#FFF8E6] min-h-screen text-[#0047B8]" : "bg-gray-100 min-h-screen"}>
            <HeaderWithBack title="Danh sách môn học" brandSidebarInset={isBrand} />

            <div className="mt-[60px] w-full md:max-w-4xl lg:max-w-6xl md:mx-auto px-4 pb-28 pt-3 space-y-3">
                {/* Bộ lọc năm học — cũng là năm học của môn tạo mới */}
                <div className={`bg-white rounded-2xl p-3 shadow-sm flex items-center gap-2 ${isBrand ? "border border-blue-900/10" : ""}`}>
                    <label className="text-sm text-gray-600 shrink-0">Năm học</label>
                    <select
                        value={schoolYear}
                        onChange={(e) => setSchoolYear(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm bg-white"
                    >
                        <option value={ALL_YEARS}>Tất cả năm học</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>

                    {canManage && (
                        <button
                            onClick={() => setFormTarget(null)}
                            className={`flex items-center gap-1 px-3 py-2 text-white rounded-xl text-sm font-medium active:scale-95 whitespace-nowrap ${isBrand ? "bg-[#005BEA]" : "bg-blue-500"}`}
                        >
                            <Plus size={16} /> Thêm môn
                        </button>
                    )}
                </div>

                {loading && (
                    <p className="text-center text-gray-400 text-sm py-10">Đang tải…</p>
                )}

                {!loading && subjects.length === 0 && (
                    <div className={`bg-white rounded-2xl shadow-sm py-12 px-4 text-center ${isBrand ? "border border-blue-900/10" : ""}`}>
                        <div className="text-3xl mb-2">📘</div>
                        <p className="text-sm font-medium text-gray-700">
                            Trường này chưa có môn học
                            {schoolYear ? ` năm ${schoolYear}` : ""}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {canManage
                                ? "Bấm “Thêm môn” để tạo môn học cho trường."
                                : "Đổi năm học để xem các môn đã tạo."}
                        </p>
                    </div>
                )}

                {!loading &&
                    subjects.map((item) => (
                        <div
                            key={item.id}
                            onClick={() =>
                                navigate(`/director/policy-list/${item.id}`, { state: data })
                            }
                            className={`bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3 cursor-pointer ${isBrand ? "border border-blue-900/10 hover:shadow-md" : ""}`}
                        >
                            {/* TOP */}
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                        📘
                                    </div>

                                    <div>
                                        <p className="font-semibold text-gray-900 text-sm dark:text-white">
                                            {item.name}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Số học sinh: {item.studentCount}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Số lớp: {item.classCount}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Tổng số tiết: {item.totalLessons}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Thời hạn HĐ: {item.contractDuration}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Thời hạn PL: {item.appendixDuration}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Ngày khai giảng:{" "}
                                            {item.startDate
                                                ? new Date(item.startDate).toLocaleDateString("vi-VN")
                                                : ""}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-white">
                                            Số HĐ: {item.contractNumber}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-2 shrink-0">
                                    <p className="text-xs text-center px-4 py-1 rounded-full font-medium inline-flex items-center justify-center bg-red-100 text-red-600">
                                        Tổng CS
                                    </p>
                                    <p className="text-xs text-center px-4 py-1 rounded-full font-medium inline-flex items-center justify-center text-red-600">
                                        {item.policyCount}
                                    </p>
                                </div>
                            </div>

                            <h1 className="text-dark font-semibold text-sm text-center flex-1">
                                Năm học: {item.schoolYear || "2024-2025"}
                            </h1>

                            {canManage && (
                                <div
                                    className="flex gap-2 pt-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => setFormTarget(item)}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium"
                                    >
                                        <Pencil size={14} /> Sửa
                                    </button>

                                    <button
                                        onClick={() => setDeleteTarget(item)}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium"
                                    >
                                        <Trash2 size={14} /> Xoá
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
            </div>

            {formTarget !== undefined && (
                <SubjectFormModal
                    schoolId={schoolId}
                    // Lọc "Tất cả năm học" thì môn mới rơi vào năm học hiện tại;
                    // modal hiện rõ năm để người dùng thấy trước khi lưu.
                    schoolYear={schoolYear || currentSchoolYear()}
                    subject={formTarget}
                    onClose={() => setFormTarget(undefined)}
                    onSaved={() => {
                        setFormTarget(undefined);
                        load();
                    }}
                />
            )}

            {deleteTarget && (
                <div
                    className="fixed inset-0 z-[70] bg-black/40 flex items-end md:items-center justify-center"
                    onClick={() => setDeleteTarget(null)}
                >
                    <div
                        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b">
                            <h2 className="font-semibold">Xoá môn học</h2>
                        </div>

                        <div className="p-4 space-y-2">
                            <p className="text-sm text-gray-700">
                                Xoá môn <b>{deleteTarget.name}</b> (năm học{" "}
                                {deleteTarget.schoolYear}) khỏi trường này?
                            </p>
                            {deleteTarget.policyCount > 0 && (
                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    Môn này đang có <b>{deleteTarget.policyCount}</b> chính sách.
                                    Xoá môn là xoá luôn dữ liệu chính sách gắn với nó.
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t flex gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-red-500 active:scale-95 disabled:opacity-60"
                            >
                                {deleting ? "Đang xoá…" : "Xoá"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
}
