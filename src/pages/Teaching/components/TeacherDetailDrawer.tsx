import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Pencil, Trash2, X } from "lucide-react";

import type { Teacher } from "@/types/teaching";
import { TeacherProfileSections } from "@/pages/Director/components/TeacherDetailModal";

import { ActiveBadge } from "./SessionStatusBadge";

type Props = {
  teacher: Teacher;
  /** Nhãn loại giáo viên — cùng badge đang dùng trong bảng. */
  roleBadge: ReactNode;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Chi tiết một giáo viên khi bấm vào dòng ở danh sách giáo viên. */
export default function TeacherDetailDrawer({
  teacher,
  roleBadge,
  canManage,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-gray-50 w-full sm:w-[92%] max-w-md rounded-t-3xl sm:rounded-3xl shadow-lg max-h-[88vh] flex flex-col">
        <div className="flex items-start gap-3 p-4 pb-3 bg-white rounded-t-3xl border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-2xl shrink-0">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 leading-tight">
              {teacher.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {teacher.phone || "—"}
              {teacher.employeeName && ` · TK: ${teacher.employeeName}`}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              {roleBadge}
              <ActiveBadge active={teacher.isActive} />
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <TeacherProfileSections teacher={teacher} />
        </div>

        <div className="p-3 bg-white border-t border-gray-100 flex gap-2 rounded-b-3xl">
          <Link
            to={`/nhan-su/lich-day?teacherId=${teacher.id}`}
            className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-medium"
          >
            <CalendarDays size={15} /> Lịch dạy
          </Link>
          {canManage && (
            <>
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-1 bg-blue-500 text-white py-3 rounded-xl text-sm font-medium"
              >
                <Pencil size={15} /> Sửa
              </button>
              <button
                onClick={onDelete}
                className="px-4 flex items-center justify-center border border-red-100 text-red-500 rounded-xl"
                title="Xoá"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
