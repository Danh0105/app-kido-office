import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { CollaboratorPayrollSubject } from "@/service/collaboratorPayroll";
import TeacherPayrollTable from "./TeacherPayrollTable";

type Props = {
  title: string;
  subtitle?: string;
  subjects: CollaboratorPayrollSubject[];
  onClose: () => void;
};

/**
 * Popup lương từng giáo viên CTV của một môn (hoặc nhiều môn). Gắn vào
 * `document.body` để không bị khung cha có transform / backdrop-filter cắt.
 */
export default function CollaboratorPayrollModal({
  title,
  subtitle,
  subjects,
  onClose,
}: Props) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-indigo-800">{title}</h2>
            {subtitle && (
              <p className="text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {subjects.length === 0 && (
            <p className="text-sm text-slate-500">
              Chưa có buổi dạy nào của giáo viên cộng tác viên.
            </p>
          )}
          {subjects.map((subject) => (
            <section
              key={subject.subjectId}
              className="overflow-hidden rounded-xl border border-slate-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50 px-3 py-2">
                <span className="font-semibold text-indigo-900">
                  {[subject.subjectCode, subject.subjectName]
                    .filter(Boolean)
                    .join(" • ")}
                  {subject.schoolYear ? ` (${subject.schoolYear})` : ""}
                </span>
                <span className="text-sm text-indigo-800">
                  {subject.teacherCount} giáo viên
                </span>
              </div>
              <TeacherPayrollTable
                teachers={subject.teachers}
                total={subject}
              />
            </section>
          ))}
          <p className="text-xs text-slate-500">
            Tính từ chấm công: chỉ buổi "Có mặt", tiền dạy = đơn giá tiết × số
            tiết, cộng chi phí khác của buổi. Không gồm giáo viên công ty. Số
            này chỉ để xem, không cộng vào Tổng chi trường.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
