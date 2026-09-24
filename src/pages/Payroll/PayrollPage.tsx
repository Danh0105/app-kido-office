import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import SearchableSelect from "@/components/SearchableSelect";
import BottomNav from "@/layout/BottomNav";
import { employeeApi, type Employee } from "@/service/employee";
import { payrollApi } from "@/service/payroll";
import type {
  CreatePayrollPayload,
  Payroll,
  PayrollListResponse,
  UpdatePayrollPayload,
} from "@/types/payroll";
import { getApiErrorMessage } from "@/utils/apiError";
import { getEmployeeId, hasRole } from "@/utils/auth";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import PayrollFormModal from "./PayrollFormModal";
import PayrollPayslip from "./PayrollPayslip";
import {
  currentPayrollPeriod,
  formatPayrollMoney,
  isPayrollEmployeeOption,
  payrollYearOptions,
} from "./payroll.utils";
import "./payroll.css";

const LIMIT = 20;

const emptyResult = (): PayrollListResponse => ({
  data: [],
  meta: { page: 1, limit: LIMIT, total: 0, totalPages: 0 },
});

export default function PayrollPage() {
  const canViewAll = hasRole("nhansu", "ketoan_truong", "director", "director_la");
  const canManage = hasRole("nhansu", "ketoan_truong");
  const currentPeriod = currentPayrollPeriod();
  const requestId = useRef(0);

  const [month, setMonth] = useState(String(currentPeriod.month));
  const [year, setYear] = useState(String(currentPeriod.year));
  const [employeeId, setEmployeeId] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PayrollListResponse>(emptyResult);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [formTarget, setFormTarget] = useState<Payroll | null | undefined>();
  const [detail, setDetail] = useState<Payroll | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payroll | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"))
        .map((employee) => ({
          id: employee.id,
          name: employee.name || `Nhân viên #${employee.id}`,
        })),
    [employees],
  );
  const payrollEmployees = useMemo(
    () => employees.filter(isPayrollEmployeeOption),
    [employees],
  );
  const employeesById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const load = useCallback(async () => {
    const ownRequest = ++requestId.current;
    setLoading(true);
    setListError("");
    try {
      const data = await payrollApi.list({
        page,
        limit: LIMIT,
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        // Không bao giờ gửi employeeId cho tài khoản cá nhân. Backend vẫn là
        // nguồn bảo vệ chính, nhưng FE cũng không tạo cảm giác có thể đổi scope.
        employeeId: canViewAll && employeeId ? Number(employeeId) : undefined,
      });
      if (requestId.current === ownRequest) {
        setResult(data);
        setSelectedIds(new Set());
      }
    } catch (error: any) {
      if (requestId.current === ownRequest) {
        setListError(getApiErrorMessage(error, "Không tải được danh sách phiếu lương."));
        setResult(emptyResult());
      }
    } finally {
      if (requestId.current === ownRequest) setLoading(false);
    }
  }, [canViewAll, employeeId, month, page, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const employeeRequest = canViewAll
      ? employeeApi.getAll()
      : employeeApi.getById(getEmployeeId());

    void employeeRequest
      .then((data) => {
        const employeeData = Array.isArray(data) ? data : data?.data || data;
        setEmployees(Array.isArray(employeeData) ? employeeData : employeeData ? [employeeData] : []);
      })
      .catch((error) => {
        console.error("Không tải được danh sách nhân viên cho phiếu lương:", error);
        if (canManage) toast.error("Không tải được danh sách nhân viên để tạo phiếu.");
      });
  }, [canManage, canViewAll]);

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const openDetail = async (item: Payroll) => {
    setDetailLoadingId(item.id);
    try {
      setDetail(await payrollApi.get(item.id));
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không tải được chi tiết phiếu lương."));
    } finally {
      setDetailLoadingId(null);
    }
  };

  const submitForm = async (
    payload: CreatePayrollPayload | UpdatePayrollPayload,
  ) => {
    if (formTarget) {
      await payrollApi.update(formTarget.id, payload as UpdatePayrollPayload);
      toast.success("Đã cập nhật phiếu lương.");
    } else {
      await payrollApi.create(payload as CreatePayrollPayload);
      toast.success("Đã tạo phiếu lương.");
    }
    setFormTarget(undefined);
    await load();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await payrollApi.remove(deleteTarget.id);
      toast.success("Đã xoá phiếu lương.");
      setDeleteTarget(null);
      const isLastRow = result.data.length === 1 && page > 1;
      if (isLastRow) setPage((value) => value - 1);
      else await load();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không xoá được phiếu lương."));
      }
    } finally {
      setDeleting(false);
    }
  };

  // Chỉ phiếu nháp mới gửi được — phiếu đã gửi rồi thì bỏ qua trên checkbox.
  const draftRows = useMemo(
    () => result.data.filter((item) => item.status === "DRAFT"),
    [result.data],
  );
  const allDraftSelected = draftRows.length > 0 && draftRows.every((item) => selectedIds.has(item.id));
  const pageNetSalary = useMemo(
    () => result.data.reduce((total, item) => total + Number(item.netSalary || 0), 0),
    [result.data],
  );

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      if (allDraftSelected) return new Set();
      return new Set(draftRows.map((item) => item.id));
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendSelected = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    try {
      const sendResult = await payrollApi.send([...selectedIds]);
      toast.success(`Đã gửi ${sendResult.sent} phiếu lương.`);
      setSelectedIds(new Set());
      await load();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không gửi được phiếu lương."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-24 pt-[72px] text-slate-900">
      <HeaderWithBack title={canViewAll ? "Phiếu lương" : "Phiếu lương của tôi"} />

      <main className="mx-auto w-full max-w-7xl space-y-4 px-3 md:px-6">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 p-5 text-white shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                <Banknote size={24} />
              </div>
              <h1 className="text-xl font-bold md:text-2xl">
                {canViewAll ? "Quản lý phiếu lương" : "Phiếu lương của tôi"}
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                {canViewAll
                  ? "Tra cứu phiếu theo kỳ lương và nhân viên."
                  : "Thông tin lương là dữ liệu riêng tư và chỉ hiển thị cho bạn."}
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setFormTarget(null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffd84d] px-5 py-3 text-sm font-bold text-blue-950 shadow-sm hover:bg-yellow-300"
              >
                <Plus size={18} /> Tạo phiếu lương
              </button>
            )}
          </div>
        </section>

        <section className={`grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${canViewAll ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <label className="text-xs font-semibold text-slate-600">
            Tháng
            <select
              value={month}
              onChange={(event) => changeFilter(setMonth, event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
                <option key={item} value={item}>Tháng {item}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Năm
            <select
              value={year}
              onChange={(event) => changeFilter(setYear, event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Tất cả năm</option>
              {payrollYearOptions(year ? Number(year) : undefined).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          {canViewAll && (
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">
              Nhân viên
              <SearchableSelect
                value={employeeId}
                onChange={(value) => changeFilter(setEmployeeId, value)}
                options={employeeOptions}
                placeholder="Tất cả nhân viên"
                searchPlaceholder="Tìm tên nhân viên…"
                className="mt-1"
              />
            </label>
          )}
          {!canViewAll && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw size={15} /> Làm mới
              </button>
            </div>
          )}
        </section>

        {canManage && selectedIds.size > 0 && (
          <section className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm sm:flex-row sm:items-center">
            <span className="font-semibold text-blue-800">
              Đã chọn {selectedIds.size} phiếu nháp
            </span>
            <button
              type="button"
              disabled={sending}
              onClick={() => void sendSelected()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? "Đang gửi…" : "Gửi phiếu lương"}
            </button>
          </section>
        )}

        {listError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">
            <p>{listError}</p>
            <button type="button" onClick={() => void load()} className="mt-3 font-bold underline">
              Thử lại
            </button>
          </section>
        )}

        {!listError && loading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white py-16 text-sm text-slate-500">
            <Loader2 size={20} className="animate-spin" /> Đang tải phiếu lương…
          </div>
        )}

        {!listError && !loading && result.data.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
            <FileText size={42} className="mx-auto text-slate-300" />
            <h2 className="mt-3 font-bold text-slate-700">Chưa có phiếu lương</h2>
            <p className="mt-1 text-sm text-slate-400">Không có dữ liệu phù hợp với bộ lọc hiện tại.</p>
          </section>
        )}

        {!listError && !loading && result.data.length > 0 && (
          <>
            <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)] md:block">
              <div className="flex items-center justify-between gap-6 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <FileText size={19} />
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900">Danh sách phiếu lương</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Hiển thị {result.data.length} trong tổng số {result.meta.total} phiếu
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Tổng thực nhận trên trang
                  </p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums text-blue-700">
                    {formatPayrollMoney(pageNetSalary)} <span className="text-xs font-bold text-slate-400">VNĐ</span>
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    <tr>
                      {canManage && (
                        <th className="w-12 px-5 py-3.5">
                          <input
                            type="checkbox"
                            checked={allDraftSelected}
                            disabled={draftRows.length === 0}
                            onChange={toggleSelectAll}
                            aria-label="Chọn tất cả phiếu nháp"
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600 disabled:opacity-40"
                          />
                        </th>
                      )}
                      <th className="min-w-[270px] px-5 py-3.5">Nhân viên</th>
                      <th className="w-[120px] px-4 py-3.5">Kỳ lương</th>
                      <th className="w-[120px] px-4 py-3.5">Trạng thái</th>
                      <th className="px-4 py-3.5 text-right">Tổng thu nhập</th>
                      <th className="px-4 py-3.5 text-right">Khấu trừ</th>
                      <th className="px-4 py-3.5 text-right">Thực nhận</th>
                      <th className="w-[180px] px-5 py-3.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.data.map((item) => (
                      <tr
                        key={item.id}
                        className={`group transition-colors ${
                          selectedIds.has(item.id) ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                        }`}
                      >
                        {canManage && (
                          <td className="px-5 py-4 align-middle">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              disabled={item.status !== "DRAFT"}
                              onChange={() => toggleSelect(item.id)}
                              aria-label={`Chọn phiếu #${item.id}`}
                              className="h-4 w-4 rounded border-slate-300 accent-blue-600 disabled:opacity-40"
                            />
                          </td>
                        )}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar
                              name={item.employeeName}
                              src={getPayrollEmployeeAvatar(item, employeesById)}
                              className="h-10 w-10"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-900">{item.employeeName}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                {item.jobTitle || "Chưa cập nhật chức vụ"}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                {item.employee?.department?.name || `Mã nhân viên #${item.employeeId}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="inline-flex min-w-[82px] flex-col rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Tháng</span>
                            <span className="font-extrabold text-blue-800">
                              {String(item.month).padStart(2, "0")} <span className="font-medium text-blue-400">/ {item.year}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4"><PayrollStatusBadge status={item.status} /></td>
                        <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-700">
                          {formatPayrollMoney(item.totalIncome)}
                        </td>
                        <td className="px-4 py-4 text-right font-medium tabular-nums text-rose-600">
                          {formatPayrollMoney(item.totalDeduction)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex flex-col items-end rounded-xl bg-blue-50 px-3 py-2">
                            <span className="font-extrabold tabular-nums text-blue-800">{formatPayrollMoney(item.netSalary)}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">VNĐ</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={detailLoadingId === item.id}
                              onClick={() => void openDetail(item)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                            >
                              {detailLoadingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                              Xem
                            </button>
                            {canManage && <ActionButton label="Sửa" onClick={() => setFormTarget(item)}><Pencil size={16} /></ActionButton>}
                            {canManage && <ActionButton label="Xoá" danger onClick={() => setDeleteTarget(item)}><Trash2 size={16} /></ActionButton>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3 md:hidden">
              {canManage && draftRows.length > 0 && (
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                  <input
                    type="checkbox"
                    checked={allDraftSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  Chọn tất cả phiếu nháp
                </label>
              )}
              {result.data.map((item) => (
                <article
                  key={item.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                    selectedIds.has(item.id) ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
                  }`}
                >
                  <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {canManage && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            disabled={item.status !== "DRAFT"}
                            onChange={() => toggleSelect(item.id)}
                            aria-label={`Chọn phiếu #${item.id}`}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 disabled:opacity-40"
                          />
                        )}
                        <EmployeeAvatar
                          name={item.employeeName}
                          src={getPayrollEmployeeAvatar(item, employeesById)}
                          className="h-11 w-11"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-800">{item.employeeName}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{item.jobTitle || "Chưa cập nhật chức vụ"}</p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.employee?.department?.name || `Mã nhân viên #${item.employeeId}`}</p>
                        </div>
                      </div>
                      <PayrollStatusBadge status={item.status} />
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kỳ lương</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-700">Tháng {String(item.month).padStart(2, "0")} / {item.year}</p>
                      </div>
                      <span className="text-xs font-semibold text-slate-400">Phiếu #{item.id}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-slate-100 px-3 py-2.5">
                        <p className="text-[11px] text-slate-400">Tổng thu nhập</p>
                        <p className="mt-1 font-bold tabular-nums text-slate-700">{formatPayrollMoney(item.totalIncome)}</p>
                      </div>
                      <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5 text-right">
                        <p className="text-[11px] text-rose-400">Khấu trừ</p>
                        <p className="mt-1 font-bold tabular-nums text-rose-600">{formatPayrollMoney(item.totalDeduction)}</p>
                      </div>
                    </div>
                    <div className="mt-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 p-3 text-white shadow-sm shadow-blue-100">
                      <p className="text-xs text-blue-100">Lương thực nhận</p>
                      <p className="mt-1 text-xl font-black tabular-nums">{formatPayrollMoney(item.netSalary)} <span className="text-xs font-bold text-blue-100">VNĐ</span></p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void openDetail(item)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
                        {detailLoadingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Xem phiếu
                      </button>
                      {canManage && <ActionButton label="Sửa" onClick={() => setFormTarget(item)}><Pencil size={17} /></ActionButton>}
                      {canManage && <ActionButton label="Xoá" danger onClick={() => setDeleteTarget(item)}><Trash2 size={17} /></ActionButton>}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        {result.meta.totalPages > 1 && (
          <nav className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row">
            <span className="text-slate-500">
              Hiển thị <strong className="text-slate-700">{(result.meta.page - 1) * result.meta.limit + 1}–{Math.min(result.meta.page * result.meta.limit, result.meta.total)}</strong> trong {result.meta.total} phiếu
            </span>
            <div className="flex items-center gap-2">
              <button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft size={16} /> Trước
              </button>
              <span className="min-w-[92px] text-center font-semibold text-slate-600">{result.meta.page} / {result.meta.totalPages}</span>
              <button disabled={loading || page >= result.meta.totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
                Sau <ChevronRight size={16} />
              </button>
            </div>
          </nav>
        )}
      </main>

      <BottomNav />

      {formTarget !== undefined && (
        <PayrollFormModal
          payroll={formTarget}
          employees={payrollEmployees}
          onClose={() => setFormTarget(undefined)}
          onSubmit={submitForm}
        />
      )}
      {detail && <PayrollPayslip payroll={detail} onClose={() => setDetail(null)} />}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Xoá phiếu lương?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Phiếu tháng <strong>{deleteTarget.month}/{deleteTarget.year}</strong> của <strong>{deleteTarget.employeeName}</strong> sẽ bị xoá. Thao tác này không thể hoàn tác.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600">Huỷ</button>
              <button type="button" disabled={deleting} onClick={() => void remove()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {deleting && <Loader2 size={16} className="animate-spin" />} {deleting ? "Đang xoá…" : "Xoá phiếu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
  loading = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={loading}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
        danger
          ? "border-red-100 bg-white text-red-600 hover:border-red-200 hover:bg-red-50"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : children}
    </button>
  );
}

function PayrollStatusBadge({ status }: { status: Payroll["status"] }) {
  return status === "SENT" ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Đã gửi
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Nháp
    </span>
  );
}

function getEmployeeInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.slice(-2).map((word) => word.charAt(0)).join("") || "NV").toLocaleUpperCase("vi");
}

function getPayrollEmployeeAvatar(
  payroll: Payroll,
  employeesById: Map<number, Employee>,
) {
  const employee = employeesById.get(payroll.employeeId);
  const raw = payroll.employee?.avatarUrl
    || payroll.employee?.avatar
    || employee?.avatarUrl
    || employee?.avatar;

  return raw ? resolveApiFileUrl(raw) : null;
}

function EmployeeAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src: string | null;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-extrabold text-white shadow-sm shadow-blue-200 ${className}`}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={`Avatar ${name}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        getEmployeeInitials(name)
      )}
    </span>
  );
}
