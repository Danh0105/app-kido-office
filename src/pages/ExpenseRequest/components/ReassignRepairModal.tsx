import { useEffect, useState } from "react";

import SearchableSelect from "@/components/SearchableSelect";
import { employeeApi, type Employee } from "@/service/employee";

const TECHNICAL_ROLE = "ky_thuat";

const employeeLabel = (e: Employee) =>
  [e.name || `NV #${e.id}`, e.phone].filter(Boolean).join(" · ");

/**
 * Chọn người thay thế cho người đã từ chối việc được giao: người bàn giao (chỉ
 * phòng kỹ thuật — họ giữ bước lên lệnh xuất kho/sửa chữa) hoặc người hỗ trợ
 * (bất kỳ nhân viên nào).
 */
export default function ReassignRepairModal({
  title = "Chọn người thay thế",
  label = "Người bàn giao",
  declinedName,
  rejectReason,
  technicalOnly = true,
  excludeIds = [],
  loading,
  onClose,
  onSubmit,
}: {
  title?: string;
  label?: string;
  /** Tên người đã từ chối — hiện kèm lý do. */
  declinedName?: string;
  rejectReason?: string | null;
  /** `true` = chỉ chọn nhân viên phòng kỹ thuật (thay người bàn giao). */
  technicalOnly?: boolean;
  /** Người đã có mặt trong danh sách giao việc — không chọn lại được. */
  excludeIds?: number[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (employeeId: number) => void;
}) {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    employeeApi
      .getAll()
      .then((list: Employee[]) => {
        setEmployees(
          (list || []).filter(
            (e) =>
              (!technicalOnly || e.roles?.includes(TECHNICAL_ROLE)) &&
              !excludeIds.includes(e.id),
          ),
        );
      })
      .catch(() => setError("Không tải được danh sách nhân viên"))
      .finally(() => setLoadingEmployees(false));
    // excludeIds chỉ cần lấy lúc mở modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicalOnly]);

  const handleSubmit = () => {
    if (!employeeId) {
      setError("Vui lòng chọn người thay thế");
      return;
    }
    onSubmit(employeeId);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rejectReason && (
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <span className="font-medium">
                {declinedName ? `${declinedName} từ chối: ` : "Lý do từ chối trước đó: "}
              </span>
              {rejectReason}
            </div>
          )}

          <div>
            <label className="text-sm text-gray-600">
              {label} <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={employeeId ? String(employeeId) : ""}
              onChange={(v) => setEmployeeId(v ? Number(v) : null)}
              options={employees.map((e) => ({ id: e.id, name: employeeLabel(e) }))}
              placeholder={loadingEmployees ? "Đang tải…" : "Chọn nhân viên…"}
              searchPlaceholder="Tìm theo tên hoặc SĐT…"
              emptyLabel="Không tìm thấy nhân viên"
              disabled={loadingEmployees}
              className="mt-1"
              portal
            />
            {!loadingEmployees && employees.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {technicalOnly
                  ? "Không tìm thấy nhân viên phòng kỹ thuật"
                  : "Không tìm thấy nhân viên"}
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-blue-500 active:scale-95 disabled:opacity-60"
          >
            {loading ? "Đang xử lý…" : "Chỉ định"}
          </button>
        </div>
      </div>
    </div>
  );
}
