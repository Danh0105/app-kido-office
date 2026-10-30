import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Scale } from "lucide-react";
import { toast } from "react-hot-toast";

import { financeApi } from "@/service/finance";
import type { FinanceRequestType } from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { EXCEL_FILE_TYPE, saveBlob } from "@/utils/saveBlob";
import { Card, EmptyState, ErrorState, Kpi, LoadingState } from "./components/FinanceUi";
import { useFinanceMeta } from "./FinanceRoutes";
import { TYPE_LABELS, formatMoney, inputClass, labelClass, primaryButton, todayVN, useFinanceBase } from "./lib";

export default function FinanceReports() {
  const meta = useFinanceMeta();
  const base = useFinanceBase();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState("");
  const [exportFilters, setExportFilters] = useState({
    type: "",
    dateFrom: `${todayVN().slice(0, 7)}-01`,
    dateTo: todayVN(),
    approvalStatus: "",
  });
  const [exporting, setExporting] = useState(false);

  const balances = useQuery({
    queryKey: ["finance-balances", companyId],
    queryFn: () => financeApi.balances({ companyId: companyId ? Number(companyId) : "" }),
  });

  const exportExcel = async () => {
    setExporting(true);
    try {
      const blob = await financeApi.exportExcel({
        scope: "all",
        companyId: companyId ? Number(companyId) : "",
        type: exportFilters.type as FinanceRequestType | "",
        dateFrom: exportFilters.dateFrom,
        dateTo: exportFilters.dateTo,
        approvalStatus: exportFilters.approvalStatus,
      });
      await saveBlob(blob, `bao-cao-de-nghi-tai-chinh-${exportFilters.dateFrom}-${exportFilters.dateTo}.xlsx`, EXCEL_FILE_TYPE);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xuất được Excel."));
    } finally {
      setExporting(false);
    }
  };

  const totals = balances.data?.totals;
  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className={labelClass}>
          Công ty
          <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">Tất cả</option>
            {meta.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <Card title="Xuất báo cáo Excel" icon={<FileSpreadsheet size={16} />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className={labelClass}>
            Loại chứng từ
            <select className={inputClass} value={exportFilters.type} onChange={(e) => setExportFilters((p) => ({ ...p, type: e.target.value }))}>
              <option value="">Tất cả</option>
              {(Object.keys(TYPE_LABELS) as FinanceRequestType[]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Từ ngày
            <input type="date" className={inputClass} value={exportFilters.dateFrom} onChange={(e) => setExportFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Đến ngày
            <input type="date" className={inputClass} value={exportFilters.dateTo} onChange={(e) => setExportFilters((p) => ({ ...p, dateTo: e.target.value }))} />
          </label>
          <label className={labelClass}>
            Trạng thái duyệt
            <select className={inputClass} value={exportFilters.approvalStatus} onChange={(e) => setExportFilters((p) => ({ ...p, approvalStatus: e.target.value }))}>
              <option value="">Tất cả (trừ nháp người khác)</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="PENDING,RETURNED">Đang duyệt</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className={`${primaryButton} w-full`} disabled={exporting} onClick={() => void exportExcel()}>
              <FileSpreadsheet size={16} /> {exporting ? "Đang xuất…" : "Xuất Excel"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tệp gồm 2 sheet: danh sách đề nghị (số tiền, đã chi, còn phải chi/thu) và chi tiết từng dòng chi phí.
        </p>
      </Card>

      <Card title="Công nợ theo nhân viên" icon={<Scale size={16} />}>
        {balances.isError && <ErrorState message={getApiErrorMessage(balances.error, "Không tải được công nợ.")} onRetry={() => void balances.refetch()} />}
        {balances.isLoading && <LoadingState />}
        {totals && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Tạm ứng chưa hoàn" value={`${formatMoney(totals.advanceOutstanding)} đ`} tone="amber" />
            <Kpi label="Trong đó quá hạn" value={`${formatMoney(totals.advanceOverdue)} đ`} tone="rose" />
            <Kpi label="Phải thu hồi" value={`${formatMoney(totals.receivable)} đ`} tone="violet" />
            <Kpi label="Phải trả nhân viên" value={`${formatMoney(totals.payable)} đ`} tone="blue" />
            <Kpi label="Ứng lương chưa trừ" value={`${formatMoney(totals.salaryAdvanceOutstanding)} đ`} tone="violet" />
          </div>
        )}
        {balances.data && balances.data.rows.length === 0 && <EmptyState title="Không có công nợ" hint="Mọi khoản đã chi, đã hoàn ứng và đã khấu trừ." />}
        {balances.data && balances.data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nhân viên</th>
                  <th className="px-3 py-2 text-right">Tạm ứng chưa hoàn</th>
                  <th className="px-3 py-2 text-right">Quá hạn</th>
                  <th className="px-3 py-2 text-right">Phải thu hồi</th>
                  <th className="px-3 py-2 text-right">Phải trả NV</th>
                  <th className="px-3 py-2 text-right">Ứng lương chưa trừ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.data.rows.map((row) => (
                  <tr key={row.employeeId}>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{row.employeeName}</p>
                      <p className="text-xs text-slate-500">{row.departmentName}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.advanceOutstanding)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${row.advanceOverdue ? "font-semibold text-rose-600" : ""}`}>
                      {formatMoney(row.advanceOverdue)}
                      {row.overdueCount > 0 && <span className="text-[11px]"> ({row.overdueCount} phiếu)</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.receivable)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.payable)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(row.salaryAdvanceOutstanding)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-700 hover:underline"
                        onClick={() => navigate(`${base}/list?q=${encodeURIComponent(row.employeeName)}&approvalStatus=APPROVED`)}
                      >
                        Xem phiếu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
