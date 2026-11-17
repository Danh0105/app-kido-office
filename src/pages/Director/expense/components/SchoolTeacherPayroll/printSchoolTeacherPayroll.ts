// In / Lưu PDF bảng thanh toán lương giáo viên trường (mỗi trường × kỳ một trang).
import type { SchoolTeacherPayrollSheet } from "@/service/schoolExpense";
import { vndToWords } from "@/pages/Finance/lib";

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value || 0);
const num = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value || 0);

export const periodLabel = (period: SchoolTeacherPayrollSheet["period"]) =>
  period.name || `Tháng ${String(period.month).padStart(2, "0")}/${period.year}`;

const sheetHtml = (sheet: SchoolTeacherPayrollSheet) => {
  const teacherRows = sheet.teachers
    .map(
      (t, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td><b>${esc(t.name || "Chưa chọn giáo viên")}</b></td>
        <td>${esc(t.classes.join(", "))}</td>
        <td>${esc(t.bankAccount || "")}${t.bankName ? ` – ${esc(t.bankName)}` : ""}</td>
        <td>${esc(t.taxCode || "")}</td>
        <td class="r">${money(t.gross)}</td>
        <td class="r">${money(t.tax)}</td>
        <td class="r"><b>${money(t.net)}</b></td>
        <td></td>
      </tr>`,
    )
    .join("");
  const detailRows = sheet.teachers
    .flatMap((t) =>
      t.activities.map(
        (a) => `<tr>
          <td>${esc(t.name || "Chưa chọn giáo viên")}</td>
          <td>${esc(a.subjectName)}</td>
          <td>${esc(a.className || "")}</td>
          <td class="r">${num(a.studentCount > 0 ? a.studentCount : a.totalPeriods)}${a.studentCount > 0 ? "" : " tiết"}</td>
          <td class="r">${num(a.monthsCount)}</td>
          <td class="r">${money(a.unitPrice)}</td>
          <td class="r">${money(a.amount)}</td>
          <td class="r">${money(a.pitAmount)}</td>
          <td class="r">${money(a.netAmount)}</td>
        </tr>`,
      ),
    )
    .join("");
  return `<section class="sheet">
    <div class="head">
      <div>
        <div class="eyebrow">Bảng thanh toán thù lao giáo viên trường</div>
        <h1>${esc(sheet.schoolName)} – ${esc(periodLabel(sheet.period))}</h1>
      </div>
      <div class="kpi">Tổng thù lao <b>${money(sheet.totals.gross)}</b> · Thuế TNCN <b>${money(sheet.totals.tax)}</b> · Thực thanh toán <b>${money(sheet.totals.net)}</b></div>
    </div>
    <table>
      <thead><tr><th>STT</th><th>Giáo viên</th><th>Lớp</th><th>Số tài khoản</th><th>MST</th><th class="r">Thù lao</th><th class="r">Thuế TNCN</th><th class="r">Thực thanh toán</th><th>Ký nhận</th></tr></thead>
      <tbody>${teacherRows}</tbody>
      <tfoot><tr><th colspan="5">TỔNG ${sheet.teachers.length} DÒNG</th><th class="r">${money(sheet.totals.gross)}</th><th class="r">${money(sheet.totals.tax)}</th><th class="r">${money(sheet.totals.net)}</th><th></th></tr></tfoot>
    </table>
    <p class="words"><b>Tổng thực thanh toán bằng chữ:</b> ${esc(vndToWords(sheet.totals.net))}</p>
    <h2>Chi tiết theo môn</h2>
    <table>
      <thead><tr><th>Giáo viên</th><th>Môn</th><th>Lớp</th><th class="r">HS</th><th class="r">Tháng</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th><th class="r">Thuế</th><th class="r">Thực nhận</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>
    <div class="sign"><div>Người lập biểu</div><div>Kế toán trưởng</div><div>Giám đốc</div></div>
  </section>`;
};

export function printSchoolTeacherPayroll(sheets: SchoolTeacherPayrollSheet[]) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>Lương giáo viên trường</title>
<style>
@page{size:A4 landscape;margin:10mm}
body{font:11px/1.45 system-ui,"Segoe UI",Roboto,Arial,sans-serif;color:#111;margin:0}
.sheet{page-break-after:always;padding:4px}.sheet:last-child{page-break-after:auto}
.head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:8px}
.eyebrow{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555}
h1{font-size:17px;margin:2px 0}h2{font-size:13px;margin:14px 0 6px}
.kpi{font-size:11px;text-align:right}
table{width:100%;border-collapse:collapse;margin-top:4px}
th,td{border:1px solid #999;padding:4px 5px;vertical-align:top}
th{background:#eee;text-align:left}tfoot th{background:#f5f5f5}
.r{text-align:right;white-space:nowrap}.c{text-align:center}
.words{margin:6px 0}
.sign{display:grid;grid-template-columns:repeat(3,1fr);text-align:center;font-weight:700;margin-top:24px;min-height:80px}
</style></head><body>${sheets.map(sheetHtml).join("")}
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
  return true;
}
