import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { inputClass } from "@/pages/Teaching/components/Modal";
import { hrEmployeeApi, type HrEmployee } from "@/service/hr/hr.api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { SEARCH_DEBOUNCE_MS } from "../lib/hrEmployeeProfile";
import { describeHrError } from "../lib/hrErrors";

const PICKER_LIMIT = 20;

/**
 * Chọn hồ sơ nhân viên HR bằng tìm kiếm PHÍA SERVER (`GET /employees?q=`),
 * debounce 300 ms — không tải cả danh sách rồi lọc trên trình duyệt. Kết quả
 * luôn theo phạm vi EMPLOYEE_VIEW của người dùng (backend quyết định).
 */
export default function HrEmployeePicker({
  value,
  onChange,
  activeOnly = true,
}: {
  value: Pick<HrEmployee, "id" | "fullName" | "employeeCode"> | null;
  onChange: (employee: Pick<HrEmployee, "id" | "fullName" | "employeeCode"> | null) => void;
  activeOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const results = useQuery({
    queryKey: ["hr", "employees", "picker", q, activeOnly],
    queryFn: () => hrEmployeeApi.list({ q, status: activeOnly ? "ACTIVE" : undefined, limit: PICKER_LIMIT }),
    enabled: !value && q.length > 0,
    retry: false,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span className="truncate">
          {value.fullName} <span className="font-mono text-xs text-gray-500">({value.employeeCode})</span>
        </span>
        <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => onChange(null)} aria-label="Bỏ chọn">
          <X size={16} />
        </button>
      </div>
    );
  }

  const rows = results.data?.data ?? [];
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className={`${inputClass} pl-8`}
          value={query}
          maxLength={100}
          placeholder="Gõ mã NV, họ tên (không dấu cũng được), SĐT hoặc email"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {q.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border bg-white text-sm">
          {results.isFetching && !rows.length ? (
            <p className="px-3 py-2 text-gray-400">Đang tìm…</p>
          ) : results.isError ? (
            <p className="px-3 py-2 text-red-600">{describeHrError(results.error).message}</p>
          ) : !rows.length ? (
            <p className="px-3 py-2 text-gray-400">Không tìm thấy hồ sơ phù hợp trong phạm vi của bạn</p>
          ) : (
            <>
              {rows.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  className="block w-full px-3 py-2 text-left hover:bg-blue-50"
                  onClick={() => {
                    onChange({ id: e.id, fullName: e.fullName, employeeCode: e.employeeCode });
                    setQuery("");
                  }}
                >
                  {e.fullName} <span className="font-mono text-xs text-gray-500">({e.employeeCode})</span>
                </button>
              ))}
              {results.data && results.data.total > rows.length && (
                <p className="px-3 py-2 text-xs text-gray-400">
                  Hiển thị {rows.length}/{results.data.total} — gõ cụ thể hơn để thu hẹp.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
