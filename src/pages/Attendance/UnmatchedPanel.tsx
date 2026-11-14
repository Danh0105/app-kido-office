import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { attendanceApi, attendanceError } from "@/service/attendance";
import { EmployeeFormModal } from "./EmployeesPanel";
import { fmtDateTime } from "./lib";
import { Empty, ErrorBox, Spinner, secondaryBtn } from "./ui";

/** Mã NV đã chấm công nhưng chưa có trong danh sách nhân viên. */
export default function UnmatchedPanel({ isAdmin }: { isAdmin: boolean }) {
  const [adding, setAdding] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["attendance", "unmatched"], queryFn: attendanceApi.unmatched });
  const items = q.data?.unmatched ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Các mã dưới đây đã chấm công trên máy nhưng chưa có trong danh sách nhân viên. Lần chấm vẫn được lưu; khi thêm
        nhân viên có đúng mã này, hệ thống tự gắn lại toàn bộ lần chấm cũ.
      </p>
      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBox message={attendanceError(q.error)} onRetry={() => q.refetch()} />}
      {q.data && items.length === 0 && <Empty>Không có mã nào chưa khớp.</Empty>}
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-amber-200 bg-white">
          {items.map((u) => (
            <li key={u.employee_no} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="w-24 font-mono text-sm font-bold text-slate-900">{u.employee_no}</span>
              <span className="flex-1 text-xs text-slate-500">
                {u.count} lần chấm · từ {fmtDateTime(u.first)} đến {fmtDateTime(u.last)}
              </span>
              {isAdmin && (
                <button type="button" onClick={() => setAdding(u.employee_no)} className={`${secondaryBtn} h-8 px-3`}>
                  <Plus className="h-3.5 w-3.5" /> Thêm nhân viên mã này
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && <EmployeeFormModal presetNo={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}
