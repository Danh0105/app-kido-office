import { useEffect, useState } from "react";
import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";

import { DecimalTextInput, Modal } from "@/pages/Finance/components/FinanceUi";
import {
  formatMoney,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "@/pages/Finance/lib";
import { schoolApi } from "@/service/school.api";
import { otherCashflowApi } from "@/service/otherCashflow";
import type {
  OtherCashflowCost,
  OtherCashflowDetail,
  OtherCashflowForm as Form,
  OtherCashflowInput,
  OtherCashflowItem,
} from "@/types/otherCashflow";
import { getApiErrorMessage } from "@/utils/apiError";
import { getEmployeeId } from "@/utils/auth";
import { ACCEPTED_FILES, previewLine, VAT_OPTIONS, vatLabel } from "../lib";

type SchoolOption = { id: number; name: string };
/** Một dòng khoản thu / khoản chi đang nhập; `payee` chỉ dùng cho khoản chi. */
type LineRow = {
  name: string;
  itemCode: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  vatRate: number | null;
  payee: string;
};
type Header = Omit<OtherCashflowInput, "items" | "costs">;

const EMPTY: Header = {
  form: "STANDARD",
  title: "",
  documentNo: "",
  partnerName: "",
  schoolId: null,
  signedDate: null,
  expectedDate: null,
  note: "",
};

const EMPTY_LINE: LineRow = { name: "", itemCode: "", unit: "", quantity: "1", unitPrice: "", vatRate: null, payee: "" };

/** "2.5000" → "2.5", "35000.00" → "35000" (ô nhập hiển thị kiểu vi-VN). */
const trimDecimal = (value: string) =>
  value.includes(".") ? value.replace(/\.?0+$/, "") : value;

const toRow = (line: OtherCashflowItem | OtherCashflowCost): LineRow => ({
  name: "itemName" in line ? line.itemName : line.description,
  itemCode: line.itemCode ?? "",
  unit: line.unit ?? "",
  quantity: trimDecimal(line.quantity),
  unitPrice: trimDecimal(line.unitPrice),
  vatRate: line.vatRate,
  payee: "payee" in line ? line.payee ?? "" : "",
});

/** Dòng chưa nhập gì (SL mặc định 1 vẫn tính là trống) — bỏ qua khi gửi. */
const isBlank = (row: LineRow) =>
  !row.name.trim() &&
  !row.itemCode.trim() &&
  !row.unit.trim() &&
  !row.payee.trim() &&
  !row.unitPrice &&
  (row.quantity === "" || row.quantity === "1");

const totals = (rows: LineRow[]) =>
  rows.reduce(
    (sum, row) => {
      const money = previewLine(row.quantity, row.unitPrice, row.vatRate);
      return { net: sum.net + money.net, vat: sum.vat + money.vat, total: sum.total + money.total };
    },
    { net: 0, vat: 0, total: 0 },
  );

const cellInput = `${inputClass} !mt-0`;

/**
 * Bảng nhập khoản thu hoặc khoản chi — cùng cấu trúc: nội dung, mã hàng, ĐVT,
 * SL × đơn giá (chưa thuế), thuế VAT → thành tiền gồm thuế. Khoản chi có thêm
 * người nhận.
 */
function LinesEditor({
  kind,
  rows,
  onChange,
}: {
  kind: "IN" | "OUT";
  rows: LineRow[];
  onChange: (rows: LineRow[]) => void;
}) {
  const cost = kind === "OUT";
  const noun = cost ? "khoản chi" : "khoản thu";
  // Modal rộng tối đa ~856px nội dung — cột cố định gọn để ô Nội dung còn chỗ.
  const columns = cost
    ? "lg:grid-cols-[minmax(0,1fr)_120px_72px_56px_64px_100px_92px_104px_24px]"
    : "lg:grid-cols-[minmax(0,1fr)_72px_56px_64px_100px_92px_104px_24px]";
  const update = (index: number, patch: Partial<LineRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div>
          <span className={`${labelClass} ${cost ? "!text-rose-700" : "!text-emerald-700"}`}>
            {cost ? "Khoản chi (công ty trả tiền)" : "Khoản thu (công ty nhận tiền)"}
          </span>
          <span className="block text-[11px] text-slate-400">Đơn giá chưa thuế · thành tiền đã gồm thuế</span>
        </div>
        <button
          type="button"
          className={`${secondaryButton} !px-3 !py-1.5 text-xs`}
          onClick={() => onChange([...rows, { ...EMPTY_LINE }])}
        >
          <Plus size={14} /> Thêm {noun}
        </button>
      </div>
      <div className={`hidden gap-2 px-1 pb-1 text-[11px] font-semibold text-slate-500 lg:grid ${columns}`}>
        <span>Nội dung</span>
        {cost && <span>Người nhận</span>}
        <span>Mã hàng</span>
        <span>ĐVT</span>
        <span className="text-right">SL</span>
        <span className="text-right">Đơn giá</span>
        <span>Thuế VAT</span>
        <span className="text-right">Thành tiền</span>
        <span />
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const money = previewLine(row.quantity, row.unitPrice, row.vatRate);
            const label = `${noun} ${index + 1}`;
            return (
              <div
                key={index}
                className={`grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 lg:items-center lg:border-0 lg:p-0 ${columns}`}
              >
                <input
                  className={`${cellInput} col-span-2 lg:col-span-1`}
                  placeholder={cost ? "Nội dung (mua hàng, vận chuyển, hoa hồng…)" : "Nội dung (bán hàng, học phí, dịch vụ…)"}
                  aria-label={`Nội dung ${label}`}
                  maxLength={255}
                  value={row.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
                {cost && (
                  <input
                    className={`${cellInput} col-span-2 lg:col-span-1`}
                    placeholder="Người nhận"
                    aria-label={`Người nhận ${label}`}
                    maxLength={255}
                    value={row.payee}
                    onChange={(e) => update(index, { payee: e.target.value })}
                  />
                )}
                <input
                  className={cellInput}
                  placeholder="Mã hàng"
                  aria-label={`Mã hàng ${label}`}
                  maxLength={50}
                  value={row.itemCode}
                  onChange={(e) => update(index, { itemCode: e.target.value })}
                />
                <input
                  className={cellInput}
                  placeholder="ĐVT"
                  aria-label={`Đơn vị tính ${label}`}
                  maxLength={30}
                  value={row.unit}
                  onChange={(e) => update(index, { unit: e.target.value })}
                />
                <DecimalTextInput
                  value={row.quantity}
                  onChange={(value) => update(index, { quantity: value })}
                  maxFraction={4}
                  placeholder="SL"
                  className={`${cellInput} text-right tabular-nums`}
                />
                <DecimalTextInput
                  value={row.unitPrice}
                  onChange={(value) => update(index, { unitPrice: value })}
                  maxFraction={2}
                  placeholder="Đơn giá"
                  className={`${cellInput} text-right tabular-nums`}
                />
                <select
                  className={cellInput}
                  aria-label={`Thuế VAT ${label}`}
                  value={row.vatRate ?? ""}
                  onChange={(e) => update(index, { vatRate: e.target.value === "" ? null : Number(e.target.value) })}
                >
                  {VAT_OPTIONS.map((rate) => (
                    <option key={rate ?? "none"} value={rate ?? ""}>
                      {vatLabel(rate)}
                    </option>
                  ))}
                </select>
                <span className="self-center text-right tabular-nums">
                  <span className="block text-sm font-semibold text-slate-800">{formatMoney(money.total)} đ</span>
                  {money.vat > 0 && <span className="block text-[11px] text-slate-500">VAT {formatMoney(money.vat)}</span>}
                </span>
                <button
                  type="button"
                  className="col-span-2 justify-self-end text-slate-400 hover:text-rose-600 lg:col-span-1"
                  aria-label={`Xoá ${label}`}
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Không có {noun}.</p>
      )}
    </section>
  );
}

/**
 * Lập mới hoặc sửa (khi chờ duyệt / bị từ chối — lưu là gửi duyệt lại). Một
 * hợp đồng có nhiều khoản thu và nhiều khoản chi, mỗi khoản thuế riêng; số
 * tiền và lợi nhuận backend tính lại. Hình thức chỉ quyết định luồng tiền sau
 * khi duyệt. Tệp hợp đồng chọn lúc lập được tải lên ngay sau khi tạo; khi sửa
 * thì quản lý tệp ở màn chi tiết.
 */
export default function OtherCashflowForm({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing?: OtherCashflowDetail | null;
  onClose: () => void;
  onSaved: (detail: OtherCashflowDetail) => void;
}) {
  const [form, setForm] = useState<Header>(EMPTY);
  const [items, setItems] = useState<LineRow[]>([{ ...EMPTY_LINE }]);
  const [costs, setCosts] = useState<LineRow[]>([{ ...EMPTY_LINE }]);
  const [files, setFiles] = useState<File[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        form: editing.form,
        title: editing.title,
        documentNo: editing.documentNo ?? "",
        partnerName: editing.partnerName,
        schoolId: editing.schoolId,
        signedDate: editing.signedDate,
        expectedDate: editing.expectedDate,
        note: editing.note ?? "",
      });
      setItems(editing.items.map(toRow));
      setCosts(editing.costs.map(toRow));
    } else {
      setForm(EMPTY);
      setItems([{ ...EMPTY_LINE }]);
      setCosts([{ ...EMPTY_LINE }]);
    }
    setFiles([]);
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const employeeId = getEmployeeId();
    if (!employeeId) return;
    let alive = true;
    schoolApi
      .getByEmployee(employeeId)
      .then((response: any) => {
        if (!alive) return;
        const rows = Array.isArray(response) ? response : response?.data || [];
        setSchools(
          rows
            .map((row: any) => ({ id: Number(row.id), name: String(row.name ?? "") }))
            .sort((a: SchoolOption, b: SchoolOption) => a.name.localeCompare(b.name, "vi")),
        );
      })
      .catch(() => alive && setSchools([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const set = <K extends keyof Header>(key: K, value: Header[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const filledItems = items.filter((row) => !isBlank(row));
  const filledCosts = costs.filter((row) => !isBlank(row));
  const income = totals(filledItems);
  const expense = totals(filledCosts);
  const profit = income.net - expense.net;
  // Trường hiện tại có thể không còn do NV này phụ trách — vẫn giữ để không mất khi sửa.
  const schoolOptions =
    editing?.school && !schools.some((s) => s.id === editing.school!.id)
      ? [editing.school, ...schools]
      : schools;

  const validate = (): string | null => {
    if (!form.title.trim()) return "Vui lòng nhập tên/nội dung hợp đồng";
    if (!form.partnerName.trim()) return "Vui lòng nhập khách hàng / đối tác";
    if (!filledItems.length && !filledCosts.length) return "Cần ít nhất một khoản thu hoặc khoản chi";
    const check = (rows: LineRow[], noun: string, positive: boolean) => {
      for (const [index, row] of rows.entries()) {
        const line = `${noun} ${index + 1}`;
        if (!row.name.trim()) return `${line}: thiếu nội dung`;
        if (!Number(row.quantity)) return `${line}: số lượng phải lớn hơn 0`;
        if (row.unitPrice === "") return `${line}: thiếu đơn giá`;
        if (positive && previewLine(row.quantity, row.unitPrice, row.vatRate).total <= 0) {
          return `${line}: số tiền phải lớn hơn 0`;
        }
      }
      return null;
    };
    const problem = check(filledItems, "Khoản thu", false) ?? check(filledCosts, "Khoản chi", true);
    if (problem) return problem;
    if (income.total + expense.total <= 0) return "Tổng tiền hợp đồng phải lớn hơn 0";
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    const line = (row: LineRow) => ({
      itemCode: row.itemCode.trim(),
      unit: row.unit.trim(),
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      vatRate: row.vatRate,
    });
    const payload: OtherCashflowInput = {
      ...form,
      title: form.title.trim(),
      documentNo: form.documentNo.trim(),
      partnerName: form.partnerName.trim(),
      items: filledItems.map((row) => ({ ...line(row), itemName: row.name.trim() })),
      costs: filledCosts.map((row) => ({ ...line(row), description: row.name.trim(), payee: row.payee.trim() })),
      note: form.note.trim(),
    };
    setSaving(true);
    try {
      let detail = editing
        ? await otherCashflowApi.update(editing.id, payload)
        : await otherCashflowApi.create(payload);
      if (!editing && files.length) {
        try {
          detail = await otherCashflowApi.uploadAttachments(detail.id, files);
        } catch (err) {
          toast.error(
            `Đã gửi duyệt nhưng chưa tải được tệp: ${getApiErrorMessage(err, "lỗi tải tệp")}. Bổ sung lại ở màn chi tiết.`,
          );
        }
      }
      toast.success(editing ? "Đã lưu và gửi duyệt lại" : `Đã gửi duyệt ${detail.code}`);
      onSaved(detail);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được hợp đồng"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      wide
      onClose={() => !saving && onClose()}
      title={editing ? `Sửa ${editing.code}` : "Lập hợp đồng thu chi ngoài"}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose} disabled={saving}>
            Huỷ
          </button>
          <button type="button" className={primaryButton} onClick={submit} disabled={saving}>
            {saving ? "Đang gửi…" : editing ? "Lưu & gửi duyệt lại" : "Gửi giám đốc duyệt"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {editing?.status === "REJECTED" && editing.reviewNote && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Lý do từ chối: {editing.reviewNote}
          </p>
        )}

        <div>
          <span className={labelClass}>Hình thức *</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(
              [
                ["STANDARD", "Thông thường", "Thủ quỹ thu/chi trực tiếp"],
                ["COMMERCIAL", "Thương mại", "Đơn đặt hàng / hợp đồng bán hàng, qua kế toán công nợ"],
              ] as [Form, string, string][]
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => set("form", value)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  form.form === value
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[11px] text-slate-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Tên / nội dung hợp đồng *</span>
            <input
              className={inputClass}
              value={form.title}
              maxLength={255}
              onChange={(e) => set("title", e.target.value)}
              placeholder="VD: Liên kết dạy kỹ năng sống học kỳ I"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Số hợp đồng / đơn hàng</span>
            <input
              className={inputClass}
              value={form.documentNo}
              maxLength={100}
              onChange={(e) => set("documentNo", e.target.value)}
              placeholder="VD: HĐ-2026-015"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Khách hàng / đối tác *</span>
            <input
              className={inputClass}
              value={form.partnerName}
              maxLength={255}
              onChange={(e) => set("partnerName", e.target.value)}
              placeholder="Tên công ty / cá nhân"
            />
          </label>

          <label className="block">
            <span className={labelClass}>Trường liên quan (không bắt buộc)</span>
            <select
              className={inputClass}
              value={form.schoolId ?? ""}
              onChange={(e) => set("schoolId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Không gắn trường —</option>
              {schoolOptions.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <LinesEditor kind="IN" rows={items} onChange={setItems} />
        <LinesEditor kind="OUT" rows={costs} onChange={setCosts} />

        <dl className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Tổng thu (gồm thuế)</dt>
            <dd className="font-bold tabular-nums text-emerald-700">{formatMoney(income.total)} đ</dd>
            <dd className="text-[11px] text-slate-500">
              chưa thuế {formatMoney(income.net)} · VAT {formatMoney(income.vat)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Tổng chi (gồm thuế)</dt>
            <dd className="font-bold tabular-nums text-rose-700">{formatMoney(expense.total)} đ</dd>
            <dd className="text-[11px] text-slate-500">
              chưa thuế {formatMoney(expense.net)} · VAT {formatMoney(expense.vat)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">VAT phải nộp (ra − vào)</dt>
            <dd className="font-bold tabular-nums text-slate-700">{formatMoney(income.vat - expense.vat)} đ</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Lợi nhuận dự kiến</dt>
            <dd className={`text-base font-extrabold tabular-nums ${profit < 0 ? "text-rose-700" : "text-slate-900"}`}>
              {formatMoney(profit)} đ
            </dd>
            <dd className="text-[11px] text-slate-500">= thu chưa thuế − chi chưa thuế</dd>
          </div>
        </dl>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Ngày ký</span>
            <input
              type="date"
              className={inputClass}
              value={form.signedDate ?? ""}
              onChange={(e) => set("signedDate", e.target.value || null)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Ngày dự kiến thu/chi</span>
            <input
              type="date"
              className={inputClass}
              value={form.expectedDate ?? ""}
              onChange={(e) => set("expectedDate", e.target.value || null)}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Ghi chú</span>
          <textarea
            className={`${inputClass} min-h-[72px]`}
            value={form.note}
            maxLength={2000}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Điều khoản giao hàng, thanh toán, số đợt…"
          />
        </label>

        {!editing && (
          <div>
            <span className={labelClass}>File hợp đồng / đơn hàng (PDF hoặc ảnh, tối đa 10 tệp × 10MB)</span>
            <label className={`${secondaryButton} mt-1 cursor-pointer`}>
              <Paperclip size={16} /> Chọn tệp
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILES}
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...picked].slice(0, 10));
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600"
                      aria-label={`Bỏ ${file.name}`}
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
