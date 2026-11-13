// Báo cáo "Lương giáo viên trường" — thay tab "Lương GV CTV" ở QL thu chi.
// - Có `schoolExpenseId`: một bảng thu chi (trường × kỳ) + quản lý danh sách
//   giáo viên của trường.
// - Không có: mọi trường theo tháng (màn QL thu chi tổng).
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  UserX,
  Users,
} from "lucide-react";

import {
  schoolTeacherApi,
  type SchoolTeacher,
  type SchoolTeacherPayrollReport as Report,
  type SchoolTeacherPayrollSheet,
} from "@/service/schoolExpense";
import { getApiErrorMessage } from "@/utils/apiError";
import { vndToWords } from "@/pages/Finance/lib";
import SchoolTeacherFormModal from "./SchoolTeacherFormModal";
import { periodLabel, printSchoolTeacherPayroll } from "./printSchoolTeacherPayroll";

type Props = {
  schoolExpenseId?: number | null;
  /** Có thì hiện phần Danh sách giáo viên trường. */
  schoolId?: number | null;
  schoolName?: string;
};

// Tối đa 2 số lẻ — đơn giá / thành tiền có thể có phần lẻ.
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value || 0);
const num = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value || 0);

const vnNow = () => {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year, month };
};

function Kpis({ totals }: { totals: { teacherCount: number; gross: number; tax: number; net: number; paidNet: number } }) {
  const items: [string, string, string][] = [
    ["Giáo viên", num(totals.teacherCount), "text-slate-800"],
    ["Tổng thù lao", money(totals.gross), "text-slate-800"],
    ["Thuế TNCN", money(totals.tax), "text-rose-600"],
    ["Thực thanh toán", money(totals.net), "text-blue-700"],
    ["Đã trả", money(totals.paidNet), "text-emerald-700"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map(([label, value, color]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className={`mt-1 text-lg font-extrabold ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function SheetCard({ sheet, showSchool }: { sheet: SchoolTeacherPayrollSheet; showSchool: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const missingAccount = sheet.teachers.filter((t) => t.teacherId && !t.bankAccount).length;
  const missingTax = sheet.teachers.filter((t) => t.teacherId && !t.taxCode).length;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-amber-50/60 px-5 py-3">
        <div>
          <div className="font-bold text-slate-800">
            {showSchool ? `${sheet.schoolName} — ` : ""}
            {periodLabel(sheet.period)}
          </div>
          <div className="text-xs text-slate-500">
            {sheet.totals.teacherCount} giáo viên · Thù lao {money(sheet.totals.gross)} · Thuế {money(sheet.totals.tax)} · Thực thanh toán{" "}
            <b className="text-blue-700">{money(sheet.totals.net)}</b>
          </div>
        </div>
        <button
          type="button"
          onClick={() => printSchoolTeacherPayroll([sheet]) || toast.error("Trình duyệt chặn cửa sổ in")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Printer size={15} /> In / Lưu PDF
        </button>
      </div>

      {(sheet.totals.unassignedRows > 0 || missingAccount > 0 || missingTax > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5" />
          {sheet.totals.unassignedRows > 0 && <span>{sheet.totals.unassignedRows} dòng chưa chọn giáo viên</span>}
          {missingAccount > 0 && <span>{missingAccount} giáo viên chưa có số tài khoản</span>}
          {missingTax > 0 && <span>{missingTax} giáo viên chưa có MST</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Giáo viên</th>
              <th className="px-4 py-3">Lớp</th>
              <th className="px-4 py-3">Tài khoản · MST</th>
              <th className="px-4 py-3 text-right">Thù lao</th>
              <th className="px-4 py-3 text-right">Thuế TNCN</th>
              <th className="px-4 py-3 text-right">Thực thanh toán</th>
              <th className="px-4 py-3 text-right">Đã trả</th>
            </tr>
          </thead>
          <tbody>
            {sheet.teachers.map((t) => {
              const key = `${t.teacherId ?? "none"}`;
              const expanded = !!open[key];
              return [
                <tr key={key} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
                      className="flex items-center gap-1.5 text-left font-bold text-slate-800"
                    >
                      {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      {t.name ?? <span className="italic text-amber-700">Chưa chọn giáo viên</span>}
                    </button>
                    <div className="pl-5 text-xs text-slate-500">{t.activities.length} dòng · {new Set(t.activities.map((a) => a.subjectId)).size} môn</div>
                  </td>
                  <td className="px-4 py-3">{t.classes.join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-mono">
                      {t.bankAccount || <span className="italic text-rose-500">Chưa có STK</span>}
                      {t.bankName ? ` · ${t.bankName}` : ""}
                    </div>
                    <div className="text-slate-500">MST: {t.taxCode || "chưa nhập"}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(t.gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-600">{money(t.tax)}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-blue-700">{money(t.net)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(t.paidNet)}</td>
                </tr>,
                expanded && (
                  <tr key={`${key}-detail`} className="bg-slate-50/70">
                    <td colSpan={7} className="px-4 pb-3 pt-1">
                      <table className="w-full text-xs">
                        <thead className="text-slate-500">
                          <tr>
                            <th className="py-1 text-left">Môn</th>
                            <th className="py-1 text-left">Lớp</th>
                            <th className="py-1 text-right">HS / tiết</th>
                            <th className="py-1 text-right">Tháng</th>
                            <th className="py-1 text-right">Đơn giá</th>
                            <th className="py-1 text-right">Thành tiền</th>
                            <th className="py-1 text-right">Thuế</th>
                            <th className="py-1 text-right">Thực nhận</th>
                            <th className="py-1 text-right">Ngày chi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.activities.map((a) => (
                            <tr key={a.itemId} className="border-t border-slate-200">
                              <td className="py-1">{a.subjectName}</td>
                              <td className="py-1">{a.className || "—"}</td>
                              <td className="py-1 text-right">
                                {a.studentCount > 0 ? `${num(a.studentCount)} HS` : `${num(a.totalPeriods)} tiết`}
                              </td>
                              <td className="py-1 text-right">{num(a.monthsCount)}</td>
                              <td className="py-1 text-right">{money(a.unitPrice)}</td>
                              <td className="py-1 text-right">{money(a.amount)}</td>
                              <td className="py-1 text-right text-rose-600">{money(a.pitAmount)}</td>
                              <td className="py-1 text-right font-semibold">{money(a.netAmount)}</td>
                              <td className="py-1 text-right">
                                {a.paid ? `${a.expenseDate?.split("-").reverse().join("/")} · ${a.cashAccount}` : "Chưa trả"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
          <tfoot className="bg-blue-50/60 font-bold">
            <tr>
              <td className="px-4 py-3" colSpan={3}>TỔNG CỘNG</td>
              <td className="px-4 py-3 text-right tabular-nums">{money(sheet.totals.gross)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-rose-600">{money(sheet.totals.tax)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-blue-700">{money(sheet.totals.net)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(sheet.totals.paidNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-600">
        <b>Thực thanh toán bằng chữ:</b> {vndToWords(sheet.totals.net)}
      </div>
    </div>
  );
}

function TeacherDirectory({ schoolId }: { schoolId: number }) {
  const [teachers, setTeachers] = useState<SchoolTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<SchoolTeacher | null | undefined>(undefined);

  const load = async () => {
    setLoading(true);
    try {
      setTeachers(await schoolTeacherApi.list(schoolId));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tải được danh sách giáo viên"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [schoolId]);

  const toggle = async (teacher: SchoolTeacher) => {
    try {
      if (teacher.isActive) await schoolTeacherApi.deactivate(teacher.id);
      else await schoolTeacherApi.update(teacher.id, { isActive: true });
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không đổi được trạng thái giáo viên"));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Users size={17} /> Danh sách giáo viên trường
          {loading && <Loader2 size={15} className="animate-spin text-slate-400" />}
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          <Plus size={15} /> Thêm giáo viên
        </button>
      </div>
      {teachers.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-500">
          Chưa có giáo viên nào. Thêm giáo viên rồi chọn ở cột "Giáo viên" của bảng Giáo viên trường.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Họ tên</th>
                <th className="px-4 py-2">Số tài khoản</th>
                <th className="px-4 py-2">Ngân hàng</th>
                <th className="px-4 py-2">MST</th>
                <th className="px-4 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className={`border-t border-slate-100 ${teacher.isActive ? "" : "text-slate-400"}`}>
                  <td className="px-4 py-2 font-semibold">
                    {teacher.name}
                    {!teacher.isActive && <span className="ml-2 text-xs font-normal">(ngừng dùng)</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{teacher.bankAccount || "—"}</td>
                  <td className="px-4 py-2">{teacher.bankName || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{teacher.taxCode || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => setEditing(teacher)} className="mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Sửa">
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(teacher)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      title={teacher.isActive ? "Ẩn khỏi ô chọn; kỳ cũ vẫn hiện tên" : "Dùng lại"}
                    >
                      {teacher.isActive ? (
                        <span className="inline-flex items-center gap-1"><UserX size={14} /> Ngừng dùng</span>
                      ) : (
                        "Dùng lại"
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SchoolTeacherFormModal
        open={editing !== undefined}
        schoolId={schoolId}
        teacher={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={() => load()}
      />
    </div>
  );
}

export default function SchoolTeacherPayrollReport({ schoolExpenseId, schoolId, schoolName }: Props) {
  const now = vnNow();
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [keyword, setKeyword] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bySheet = !!schoolExpenseId;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(
        await schoolTeacherApi.payrollReport(
          bySheet ? { schoolExpenseId: schoolExpenseId! } : { year, month },
        ),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Không tải được báo cáo lương giáo viên trường"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [schoolExpenseId, year, month]);

  const sheets = useMemo(() => {
    const q = keyword.trim().toLocaleLowerCase("vi");
    if (!q || !report) return report?.sheets ?? [];
    return report.sheets
      .map((sheet) => ({
        ...sheet,
        teachers: sheet.schoolName.toLocaleLowerCase("vi").includes(q)
          ? sheet.teachers
          : sheet.teachers.filter((t) =>
              `${t.name ?? ""} ${t.classes.join(" ")}`.toLocaleLowerCase("vi").includes(q),
            ),
      }))
      .filter((sheet) => sheet.teachers.length > 0);
  }, [report, keyword]);

  const years = [now.year - 1, now.year, now.year + 1];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="text-lg font-extrabold text-slate-800">Lương giáo viên trường</div>
          <div className="text-xs text-slate-500">
            {bySheet ? `${schoolName ?? "Trường"} — kỳ thu chi đang xem` : "Mọi trường theo tháng"} · Theo bảng Giáo
            viên trường (dưới Chi Ngoài), từ kỳ 11/2026. Thuế TNCN 10% khi tổng tháng của giáo viên từ 5.000.000đ.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!bySheet && (
            <>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          )}
          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search size={15} className="text-slate-400" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={bySheet ? "Tìm giáo viên, lớp…" : "Tìm trường, giáo viên…"} className="w-44 text-sm outline-none" />
          </div>
          <button type="button" onClick={load} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={15} /> Tải lại
          </button>
          {sheets.length > 1 && (
            <button
              type="button"
              onClick={() => printSchoolTeacherPayroll(sheets) || toast.error("Trình duyệt chặn cửa sổ in")}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Printer size={15} /> In tất cả
            </button>
          )}
        </div>
      </div>

      {report && <Kpis totals={report.totals} />}

      {loading && !report ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Đang tải…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
      ) : sheets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
          Chưa có lương giáo viên trường{bySheet ? " ở kỳ này" : ` tháng ${month}/${year}`}. Nhập ở bảng "Giáo viên
          trường" dưới Chi Ngoài của từng môn rồi Lưu tất cả.
        </div>
      ) : (
        sheets.map((sheet) => <SheetCard key={sheet.schoolExpenseId} sheet={sheet} showSchool={!bySheet} />)
      )}

      {schoolId ? <TeacherDirectory schoolId={schoolId} /> : null}
    </div>
  );
}
