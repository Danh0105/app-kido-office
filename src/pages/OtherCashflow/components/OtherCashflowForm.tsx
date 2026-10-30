import { useEffect, useState } from "react";
import { Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";

import { DecimalTextInput, Modal } from "@/pages/Finance/components/FinanceUi";
import {
  formatMoney,
  inputClass,
  labelClass,
  previewLineAmount,
  primaryButton,
  secondaryButton,
  vndToWords,
} from "@/pages/Finance/lib";
import { schoolApi } from "@/service/school.api";
import { otherCashflowApi } from "@/service/otherCashflow";
import type {
  CashflowDirection,
  OtherCashflowDetail,
  OtherCashflowForm as Form,
  OtherCashflowInput,
} from "@/types/otherCashflow";
import { getApiErrorMessage } from "@/utils/apiError";
import { getEmployeeId } from "@/utils/auth";
import { ACCEPTED_FILES, DIRECTION_LABELS } from "../lib";

type SchoolOption = { id: number; name: string };
type ItemRow = { itemCode: string; itemName: string; unit: string; quantity: string; unitPrice: string };
type CostRow = { description: string; payee: string; amount: string };

const EMPTY: OtherCashflowInput = {
  direction: "IN",
  form: "STANDARD",
  title: "",
  documentNo: "",
  partnerName: "",
  schoolId: null,
  amount: 0,
  items: [],
  costs: [],
  signedDate: null,
  expectedDate: null,
  note: "",
};

const EMPTY_ITEM: ItemRow = { itemCode: "", itemName: "", unit: "", quantity: "", unitPrice: "" };
const EMPTY_COST: CostRow = { description: "", payee: "", amount: "" };

/** "2.5000" → "2.5", "35000.00" → "35000" (ô nhập hiển thị kiểu vi-VN). */
const trimDecimal = (value: string) =>
  value.includes(".") ? value.replace(/\.?0+$/, "") : value;

const cellInput = `${inputClass} !mt-0`;

/**
 * Lập mới hoặc sửa (khi chờ duyệt / bị từ chối — lưu là gửi duyệt lại).
 * Thu có hình thức Thương mại: đơn đặt hàng/hợp đồng với dòng hàng + chi phí,
 * số tiền = tổng thành tiền (backend tính lại). Tệp hợp đồng chọn lúc lập
 * được tải lên ngay sau khi tạo; khi sửa thì quản lý tệp ở màn chi tiết.
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
  const [form, setForm] = useState<OtherCashflowInput>(EMPTY);
  const [amountText, setAmountText] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        direction: editing.direction,
        form: editing.form,
        title: editing.title,
        documentNo: editing.documentNo ?? "",
        partnerName: editing.partnerName,
        schoolId: editing.schoolId,
        amount: editing.amount,
        items: [],
        costs: [],
        signedDate: editing.signedDate,
        expectedDate: editing.expectedDate,
        note: editing.note ?? "",
      });
      setAmountText(String(editing.amount));
      setItems(
        editing.items.length
          ? editing.items.map((item) => ({
              itemCode: item.itemCode,
              itemName: item.itemName,
              unit: item.unit ?? "",
              quantity: trimDecimal(item.quantity),
              unitPrice: trimDecimal(item.unitPrice),
            }))
          : [{ ...EMPTY_ITEM }],
      );
      setCosts(
        editing.costs.map((cost) => ({
          description: cost.description,
          payee: cost.payee ?? "",
          amount: String(cost.amount),
        })),
      );
    } else {
      setForm(EMPTY);
      setAmountText("");
      setItems([{ ...EMPTY_ITEM }]);
      setCosts([]);
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

  const set = <K extends keyof OtherCashflowInput>(key: K, value: OtherCashflowInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const commercial = form.form === "COMMERCIAL";
  const goodsTotal = items.reduce((sum, item) => sum + previewLineAmount(item.quantity, item.unitPrice), 0);
  const costTotal = costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  const amount = commercial ? goodsTotal : Number(amountText || 0);
  // Trường hiện tại có thể không còn do NV này phụ trách — vẫn giữ để không mất khi sửa.
  const schoolOptions =
    editing?.school && !schools.some((s) => s.id === editing.school!.id)
      ? [editing.school, ...schools]
      : schools;

  const setDirection = (direction: CashflowDirection) =>
    setForm((prev) => ({
      ...prev,
      direction,
      // Thương mại chỉ cho Thu.
      form: direction === "OUT" ? "STANDARD" : prev.form,
    }));

  const updateItem = (index: number, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateCost = (index: number, patch: Partial<CostRow>) =>
    setCosts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const validate = (): string | null => {
    if (!form.title.trim()) return "Vui lòng nhập tên/nội dung hợp đồng";
    if (!form.partnerName.trim()) return commercial ? "Vui lòng nhập khách hàng" : "Vui lòng nhập đối tác";
    if (commercial) {
      for (const [index, item] of items.entries()) {
        const line = `Dòng hàng ${index + 1}`;
        if (!item.itemCode.trim()) return `${line}: thiếu mã hàng`;
        if (!item.itemName.trim()) return `${line}: thiếu tên hàng`;
        if (!Number(item.quantity)) return `${line}: số lượng phải lớn hơn 0`;
        if (item.unitPrice === "") return `${line}: thiếu đơn giá`;
      }
      for (const [index, cost] of costs.entries()) {
        if (!cost.description.trim()) return `Chi phí ${index + 1}: thiếu nội dung`;
        if (!Number(cost.amount)) return `Chi phí ${index + 1}: số tiền phải lớn hơn 0`;
      }
    }
    if (!amount || amount <= 0) return commercial ? "Tổng tiền hàng phải lớn hơn 0" : "Số tiền phải lớn hơn 0";
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    const payload: OtherCashflowInput = {
      ...form,
      title: form.title.trim(),
      documentNo: form.documentNo.trim(),
      partnerName: form.partnerName.trim(),
      amount,
      items: commercial
        ? items.map((item) => ({
            itemCode: item.itemCode.trim(),
            itemName: item.itemName.trim(),
            unit: item.unit.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        : [],
      costs: commercial
        ? costs.map((cost) => ({
            description: cost.description.trim(),
            payee: cost.payee.trim(),
            amount: Number(cost.amount),
          }))
        : [],
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
      wide={commercial}
      onClose={() => !saving && onClose()}
      title={editing ? `Sửa ${editing.code}` : commercial ? "Lập đơn đặt hàng / hợp đồng thương mại" : "Lập hợp đồng thu chi ngoài"}
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
          <span className={labelClass}>Loại hợp đồng *</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["IN", "OUT"] as CashflowDirection[]).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => setDirection(direction)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  form.direction === direction
                    ? direction === "IN"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-rose-500 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {DIRECTION_LABELS[direction]} {direction === "IN" ? "(công ty nhận tiền)" : "(công ty trả tiền)"}
              </button>
            ))}
          </div>
        </div>

        {form.direction === "IN" && (
          <div>
            <span className={labelClass}>Hình thức thu *</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  ["STANDARD", "Thông thường", "Thủ quỹ ghi nhận thu trực tiếp"],
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
        )}

        <div className={`grid grid-cols-1 gap-3 ${commercial ? "sm:grid-cols-2" : ""}`}>
          <label className="block">
            <span className={labelClass}>{commercial ? "Nội dung đơn hàng *" : "Tên / nội dung hợp đồng *"}</span>
            <input
              className={inputClass}
              value={form.title}
              maxLength={255}
              onChange={(e) => set("title", e.target.value)}
              placeholder={commercial ? "VD: Bán sách Tin học học kỳ I" : "VD: Cho thuê sân bóng học kỳ I"}
            />
          </label>
          {commercial && (
            <label className="block">
              <span className={labelClass}>Số đơn đặt hàng / hợp đồng</span>
              <input
                className={inputClass}
                value={form.documentNo}
                maxLength={100}
                onChange={(e) => set("documentNo", e.target.value)}
                placeholder="VD: DDH-2026-015"
              />
            </label>
          )}
        </div>

        <div className={`grid grid-cols-1 gap-3 ${commercial ? "sm:grid-cols-2" : ""}`}>
          <label className="block">
            <span className={labelClass}>{commercial ? "Khách hàng *" : "Đối tác *"}</span>
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

        {commercial ? (
          <>
            <section>
              <div className="mb-1 flex items-center justify-between">
                <span className={labelClass}>Hàng hoá *</span>
                <button
                  type="button"
                  className={`${secondaryButton} !px-3 !py-1.5 text-xs`}
                  onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
                >
                  <Plus size={14} /> Thêm dòng hàng
                </button>
              </div>
              <div className="hidden grid-cols-[110px_1fr_70px_90px_120px_120px_32px] gap-2 px-1 pb-1 text-[11px] font-semibold text-slate-500 md:grid">
                <span>Mã hàng</span>
                <span>Tên hàng</span>
                <span>ĐVT</span>
                <span className="text-right">Số lượng</span>
                <span className="text-right">Đơn giá</span>
                <span className="text-right">Thành tiền</span>
                <span />
              </div>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[110px_1fr_70px_90px_120px_120px_32px] md:items-center md:border-0 md:p-0"
                  >
                    <input
                      className={cellInput}
                      placeholder="Mã hàng"
                      aria-label={`Mã hàng dòng ${index + 1}`}
                      maxLength={50}
                      value={item.itemCode}
                      onChange={(e) => updateItem(index, { itemCode: e.target.value })}
                    />
                    <input
                      className={`${cellInput} col-span-1`}
                      placeholder="Tên hàng"
                      aria-label={`Tên hàng dòng ${index + 1}`}
                      maxLength={255}
                      value={item.itemName}
                      onChange={(e) => updateItem(index, { itemName: e.target.value })}
                    />
                    <input
                      className={cellInput}
                      placeholder="ĐVT"
                      aria-label={`Đơn vị tính dòng ${index + 1}`}
                      maxLength={30}
                      value={item.unit}
                      onChange={(e) => updateItem(index, { unit: e.target.value })}
                    />
                    <DecimalTextInput
                      value={item.quantity}
                      onChange={(value) => updateItem(index, { quantity: value })}
                      maxFraction={4}
                      placeholder="SL"
                      className={`${cellInput} text-right tabular-nums`}
                    />
                    <DecimalTextInput
                      value={item.unitPrice}
                      onChange={(value) => updateItem(index, { unitPrice: value })}
                      maxFraction={2}
                      placeholder="Đơn giá"
                      className={`${cellInput} text-right tabular-nums`}
                    />
                    <span className="self-center text-right text-sm font-semibold tabular-nums text-slate-800">
                      {formatMoney(previewLineAmount(item.quantity, item.unitPrice))} đ
                    </span>
                    <button
                      type="button"
                      className="col-span-2 justify-self-end text-slate-400 hover:text-rose-600 disabled:opacity-30 md:col-span-1"
                      aria-label={`Xoá dòng hàng ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-1 flex items-center justify-between">
                <span className={labelClass}>Các khoản chi phí (công ty chi qua quỹ)</span>
                <button
                  type="button"
                  className={`${secondaryButton} !px-3 !py-1.5 text-xs`}
                  onClick={() => setCosts((prev) => [...prev, { ...EMPTY_COST }])}
                >
                  <Plus size={14} /> Thêm chi phí
                </button>
              </div>
              {costs.length ? (
                <div className="space-y-2">
                  {costs.map((cost, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 md:grid-cols-[1fr_200px_140px_32px] md:items-center md:border-0 md:p-0"
                    >
                      <input
                        className={`${cellInput} col-span-2 md:col-span-1`}
                        placeholder="Nội dung (vận chuyển, hoa hồng…)"
                        aria-label={`Nội dung chi phí ${index + 1}`}
                        maxLength={255}
                        value={cost.description}
                        onChange={(e) => updateCost(index, { description: e.target.value })}
                      />
                      <input
                        className={cellInput}
                        placeholder="Người nhận"
                        aria-label={`Người nhận chi phí ${index + 1}`}
                        maxLength={255}
                        value={cost.payee}
                        onChange={(e) => updateCost(index, { payee: e.target.value })}
                      />
                      <DecimalTextInput
                        value={cost.amount}
                        onChange={(value) => updateCost(index, { amount: value })}
                        maxFraction={0}
                        placeholder="Số tiền"
                        className={`${cellInput} text-right tabular-nums`}
                      />
                      <button
                        type="button"
                        className="col-span-2 justify-self-end text-slate-400 hover:text-rose-600 md:col-span-1"
                        aria-label={`Xoá chi phí ${index + 1}`}
                        onClick={() => setCosts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Không có chi phí.</p>
              )}
            </section>

            <dl className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Tổng tiền hàng (phải thu)</dt>
                <dd className="font-bold tabular-nums text-emerald-700">{formatMoney(goodsTotal)} đ</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Tổng chi phí</dt>
                <dd className="font-bold tabular-nums text-rose-700">{formatMoney(costTotal)} đ</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Lãi gộp dự kiến</dt>
                <dd className="font-bold tabular-nums text-slate-900">{formatMoney(goodsTotal - costTotal)} đ</dd>
              </div>
              {goodsTotal > 0 && (
                <dd className="text-xs italic text-slate-500 sm:col-span-3">{vndToWords(goodsTotal)}</dd>
              )}
            </dl>
          </>
        ) : (
          <label className="block">
            <span className={labelClass}>Số tiền (đồng) *</span>
            <DecimalTextInput
              value={amountText}
              onChange={setAmountText}
              maxFraction={0}
              className={`${inputClass} text-right tabular-nums`}
            />
            {amount > 0 && <span className="mt-1 block text-xs italic text-slate-500">{vndToWords(amount)}</span>}
          </label>
        )}

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
            <span className={labelClass}>Ngày dự kiến {form.direction === "IN" ? "thu" : "chi"}</span>
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
            placeholder={commercial ? "Điều khoản giao hàng, thanh toán…" : "Điều khoản thanh toán, số đợt…"}
          />
        </label>

        {!editing && (
          <div>
            <span className={labelClass}>File {commercial ? "đơn hàng / hợp đồng" : "hợp đồng"} (PDF hoặc ảnh, tối đa 10 tệp × 10MB)</span>
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
