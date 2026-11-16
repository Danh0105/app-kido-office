import { useCallback, useEffect, useState } from "react";

import PolicySupportTables from "@/pages/ExpenseRequest/components/PolicySupportTables";
import { useExpenseSocket } from "@/pages/ExpenseRequest/useExpenseSocket";
import { expenseRequestApi } from "@/service/expenseRequest";
import type { PolicySupport } from "@/types/expenseRequest";

/**
 * Chính sách năm: Đã chi / đang đề xuất / còn chi của từng dòng hỗ trợ tiền
 * mặt / thiết bị, theo số kinh doanh nhập ở các Đề xuất chi Năm đã hoàn thành.
 */
export default function PolicySupportUsageSection({
  schoolId,
  schoolYear,
}: {
  schoolId: number;
  schoolYear: string;
}) {
  const [support, setSupport] = useState<PolicySupport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!schoolId || !schoolYear) return;
    setLoading(true);
    setError("");
    expenseRequestApi
      .policySupport(schoolId, schoolYear)
      .then(setSupport)
      .catch((err) =>
        setError(err?.response?.data?.message || "Không tải được hỗ trợ trong chính sách")
      )
      .finally(() => setLoading(false));
  }, [schoolId, schoolYear]);

  useEffect(() => {
    load();
  }, [load]);

  useExpenseSocket(() => {
    load();
  });

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-blue-50 px-5 py-4">
        <h3 className="font-black text-blue-900">
          Hỗ trợ tiền mặt / thiết bị — Đã chi &amp; Còn chi
        </h3>
        <p className="mt-0.5 text-xs font-semibold text-blue-700">
          Năm học {schoolYear} • theo số tiền kinh doanh đề xuất cho từng dòng,
          ghi Đã chi khi đề xuất hoàn thành
        </p>
      </div>
      <div className="p-4">
        <PolicySupportTables support={support} loading={loading} error={error} />
      </div>
    </section>
  );
}
