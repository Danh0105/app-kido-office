import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  ClipboardList,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "react-hot-toast";

import DecimalInput from "@/components/DecimalInput";
import { financeApi } from "@/service/finance";
import type {
  FinanceDetail,
  FinanceItemInput,
  FinanceRequestInput,
  FinanceRequestType,
  InvoiceType,
  PaymentMethod,
} from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { Card, DecimalTextInput, ErrorState, LoadingState, Warnings } from "./components/FinanceUi";
import { useFinanceMeta } from "./FinanceRoutes";
import {
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  TYPE_DESCRIPTIONS,
  TYPE_LABELS,
  TYPE_TITLES,
  formatDate,
  formatMoney,
  inputClass,
  labelClass,
  previewLineAmount,
  primaryButton,
  secondaryButton,
  todayVN,
  useFinanceBase,
  vndToWords,
} from "./lib";

type ItemRow = FinanceItemInput & { key: string; attachmentCount?: number };

const newRow = (): ItemRow => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  categoryId: null,
  incurredDate: null,
  invoiceNumber: null,
  invoiceType: null,
  supplierName: null,
  note: null,
});

const TYPES: FinanceRequestType[] = ["ADVANCE", "SALARY_ADVANCE", "SETTLEMENT", "EXPENSE_PAYMENT"];

const currentPeriod = () => {
  const [y, m] = todayVN().split("-");
  return { year: Number(y), month: Number(m) };
};

export default function FinanceRequestForm() {
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const [params, setParams] = useSearchParams();
  const meta = useFinanceMeta();
  const base = useFinanceBase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<number | null>(null);

  const [loaded, setLoaded] = useState<FinanceDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(!!editingId);
  const [saving, setSaving] = useState<"" | "draft" | "submit">("");
  const [uploadingItem, setUploadingItem] = useState<number | null>(null);

  const [type, setType] = useState<FinanceRequestType | null>(
    (params.get("type") as FinanceRequestType) || null,
  );
  const [companyId, setCompanyId] = useState<number | "">(
    meta.companies.length === 1 ? meta.companies[0].id : "",
  );
  const [form, setForm] = useState<FinanceRequestInput>({
    requestDate: todayVN(),
    title: "",
    paymentMethod: "BANK_TRANSFER",
    payeeName: meta.me.name,
    bankAccountHolder: meta.me.name,
    bankName: meta.me.bankName,
    bankAccountNumber: meta.me.bankAccountNumber,
    salaryYear: currentPeriod().year,
    salaryMonth: currentPeriod().month,
    deductionPeriods: 1,
  });
  const [items, setItems] = useState<ItemRow[]>([newRow()]);
  const [allocations, setAllocations] = useState<Record<number, number>>({});

  const set = <K extends keyof FinanceRequestInput>(key: K, value: FinanceRequestInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ---- Nạp phiếu khi sửa ----
  useEffect(() => {
    if (!editingId) return;
    setLoading(true);
    financeApi
      .get(editingId)
      .then((detail) => {
        if (!detail.permissions.canEdit) {
          setLoadError("Phiếu này không còn sửa được (chỉ bản nháp hoặc phiếu bị trả về).");
          return;
        }
        setLoaded(detail);
        setType(detail.type);
        setCompanyId(detail.companyId);
        setForm({
          version: detail.version,
          requestDate: detail.requestDate,
          title: detail.title,
          purpose: detail.purpose,
          projectName: detail.projectName,
          expectedUseDate: detail.expectedUseDate,
          settlementDueDate: detail.settlementDueDate,
          location: detail.location,
          tripStartDate: detail.tripStartDate,
          tripEndDate: detail.tripEndDate,
          directManagerId: detail.directManagerId,
          salaryYear: detail.salaryYear ?? undefined,
          salaryMonth: detail.salaryMonth ?? undefined,
          requestedAmount: detail.type === "SALARY_ADVANCE" ? detail.totalAmount : undefined,
          deductionStartYear: detail.deductionStartYear ?? undefined,
          deductionStartMonth: detail.deductionStartMonth ?? undefined,
          deductionPeriods: detail.deductionPeriods ?? 1,
          payeeName: detail.payeeName,
          bankAccountHolder: detail.bankAccountHolder,
          bankName: detail.bankName,
          bankAccountNumber: detail.bankAccountNumber,
          paymentMethod: detail.paymentMethod,
          paymentNote: detail.paymentNote,
        });
        setItems(
          detail.items.length
            ? detail.items.map((item) => ({
                key: `i${item.id}`,
                id: item.id,
                description: item.description,
                categoryId: item.categoryId,
                unit: item.unit,
                quantity: item.quantity.replace(/\.?0+$/, "") || "0",
                unitPrice: item.unitPrice.replace(/\.?0+$/, "") || "0",
                incurredDate: item.incurredDate,
                invoiceNumber: item.invoiceNumber,
                invoiceType: item.invoiceType,
                supplierName: item.supplierName,
                note: item.note,
                attachmentCount: item.attachmentCount,
              }))
            : [newRow()],
        );
        setAllocations(Object.fromEntries(detail.allocations.map((a) => [a.advanceId, a.amount])));
      })
      .catch((error) => setLoadError(getApiErrorMessage(error, "Không tải được phiếu.")))
      .finally(() => setLoading(false));
  }, [editingId]);

  const managersQuery = useQuery({
    queryKey: ["finance-managers", companyId],
    queryFn: () => financeApi.managers(Number(companyId)),
    enabled: !!companyId,
  });

  const advancesQuery = useQuery({
    queryKey: ["finance-available-advances", companyId, editingId],
    queryFn: () => financeApi.availableAdvances(Number(companyId), editingId ?? undefined),
    enabled: !!companyId && (type === "SETTLEMENT" || type === "EXPENSE_PAYMENT"),
  });

  const salaryCheck = useQuery({
    queryKey: ["finance-salary-check", companyId, form.salaryYear, form.salaryMonth, editingId],
    queryFn: () =>
      financeApi.salaryAdvanceCheck({
        companyId: Number(companyId),
        year: Number(form.salaryYear),
        month: Number(form.salaryMonth),
        excludeRequestId: editingId ?? undefined,
      }),
    enabled: type === "SALARY_ADVANCE" && !!companyId && !!form.salaryYear && !!form.salaryMonth,
  });

  // Mở form hoàn ứng từ một phiếu tạm ứng: chọn sẵn phiếu đó.
  useEffect(() => {
    const advanceId = Number(params.get("advanceId"));
    if (!advanceId || editingId || !advancesQuery.data) return;
    const advance = advancesQuery.data.find((a) => a.id === advanceId);
    if (advance && allocations[advanceId] === undefined) {
      setAllocations((prev) => ({ ...prev, [advanceId]: advance.available }));
      if (!form.title) set("title", `Hoàn ứng ${advance.code}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancesQuery.data]);

  const lineAmounts = useMemo(
    () => items.map((item) => previewLineAmount(item.quantity, item.unitPrice)),
    [items],
  );
  const total =
    type === "SALARY_ADVANCE"
      ? Number(form.requestedAmount || 0)
      : lineAmounts.reduce((sum, value) => sum + value, 0);
  const offset = Object.values(allocations).reduce((sum, value) => sum + (value || 0), 0);
  const difference = total - offset;
  const categories = meta.categories;
  const showExpenseFields = type === "SETTLEMENT" || type === "EXPENSE_PAYMENT";

  const chooseType = (next: FinanceRequestType) => {
    setType(next);
    const nextParams = new URLSearchParams(params);
    nextParams.set("type", next);
    setParams(nextParams, { replace: true });
  };

  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const payload = (): FinanceRequestInput => {
    const body: FinanceRequestInput = {
      ...form,
      companyId: Number(companyId),
      title: form.title?.trim(),
    };
    if (type === "SALARY_ADVANCE") {
      delete body.items;
    } else {
      body.items = items
        .filter((item) => item.description.trim() || item.unitPrice)
        .map(({ key: _key, attachmentCount: _count, ...item }) => ({
          ...item,
          description: item.description.trim(),
          quantity: item.quantity || "0",
          unitPrice: item.unitPrice || "0",
          unit: item.unit || null,
        }));
      delete body.requestedAmount;
    }
    if (type === "SETTLEMENT") {
      body.allocations = Object.entries(allocations)
        .filter(([, amount]) => amount > 0)
        .map(([advanceId, amount]) => ({ advanceId: Number(advanceId), amount }));
    }
    if (!editingId) body.type = type!;
    return body;
  };

  const validate = () => {
    if (!companyId) return "Chọn công ty";
    if (!form.title?.trim()) return "Nhập nội dung đề nghị";
    if (type === "SALARY_ADVANCE" && !(Number(form.requestedAmount) > 0)) return "Nhập số tiền đề nghị ứng";
    if (type !== "SALARY_ADVANCE") {
      const rows = items.filter((item) => item.description.trim() || item.unitPrice);
      if (!rows.length) return "Thêm ít nhất một khoản tiền";
      if (rows.some((item) => !item.description.trim())) return "Mỗi dòng phải có nội dung";
    }
    if (type === "SETTLEMENT" && offset <= 0) return "Chọn phiếu tạm ứng cần đối trừ";
    return "";
  };

  const save = async (submit: boolean) => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      const saved = editingId
        ? await financeApi.update(editingId, payload())
        : await financeApi.create(payload());
      if (submit) {
        await financeApi.submit(saved.id);
        toast.success(`Đã gửi duyệt ${saved.code}`);
        await queryClient.invalidateQueries({ queryKey: ["finance-list"] });
        navigate(`${base}/requests/${saved.id}`, { replace: true });
        return;
      }
      toast.success(editingId ? "Đã lưu thay đổi" : `Đã lưu nháp ${saved.code} — có thể đính kèm hoá đơn cho từng dòng`);
      await queryClient.invalidateQueries({ queryKey: ["finance-list"] });
      if (!editingId) {
        navigate(`${base}/requests/${saved.id}/edit`, { replace: true });
      } else {
        setLoaded(saved);
        setForm((prev) => ({ ...prev, version: saved.version }));
        setItems(
          saved.items.map((item) => ({
            key: `i${item.id}`,
            id: item.id,
            description: item.description,
            categoryId: item.categoryId,
            unit: item.unit,
            quantity: item.quantity.replace(/\.?0+$/, "") || "0",
            unitPrice: item.unitPrice.replace(/\.?0+$/, "") || "0",
            incurredDate: item.incurredDate,
            invoiceNumber: item.invoiceNumber,
            invoiceType: item.invoiceType,
            supplierName: item.supplierName,
            note: item.note,
            attachmentCount: item.attachmentCount,
          })),
        );
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được đề nghị."));
    } finally {
      setSaving("");
    }
  };

  const pickFiles = (itemId: number) => {
    uploadTarget.current = itemId;
    fileInput.current?.click();
  };

  const uploadForItem = async (files: FileList | null) => {
    const itemId = uploadTarget.current;
    if (!files?.length || !editingId || !itemId) return;
    setUploadingItem(itemId);
    try {
      const detail = await financeApi.uploadAttachments(editingId, Array.from(files), {
        kind: "INVOICE",
        itemId,
      });
      const count = detail.items.find((item) => item.id === itemId)?.attachmentCount ?? 0;
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, attachmentCount: count } : item)));
      toast.success("Đã đính kèm chứng từ cho dòng");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tải lên được tệp."));
    } finally {
      setUploadingItem(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (loading) return <LoadingState text="Đang tải phiếu…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => navigate(-1)} />;

  if (!type) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Chọn loại đề nghị</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => chooseType(value)}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                {value === "SALARY_ADVANCE" ? <Wallet size={20} /> : value === "SETTLEMENT" ? <ClipboardList size={20} /> : <Banknote size={20} />}
              </span>
              <p className="font-bold text-slate-900">{TYPE_TITLES[value]}</p>
              <p className="mt-1 text-sm text-slate-500">{TYPE_DESCRIPTIONS[value]}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const check = salaryCheck.data;
  const salaryWarnings: string[] = [];
  if (type === "SALARY_ADVANCE" && check) {
    if (check.pendingCount) salaryWarnings.push(`Bạn đang có ${check.pendingCount} phiếu ứng lương kỳ này đang chờ xử lý.`);
    if (check.policy.maxPerMonth && check.countInPeriod >= check.policy.maxPerMonth)
      salaryWarnings.push(`Đã đạt số lần ứng tối đa trong tháng (${check.policy.maxPerMonth}).`);
    if (check.policy.maxAmount && total > check.policy.maxAmount)
      salaryWarnings.push(`Vượt hạn mức ứng ${formatMoney(check.policy.maxAmount)} đ.`);
    if (check.policy.maxPercent && check.expectedSalary) {
      const limit = Math.floor((check.expectedSalary * check.policy.maxPercent) / 100);
      if (total + check.approvedInPeriod > limit)
        salaryWarnings.push(`Tổng ứng trong kỳ vượt ${check.policy.maxPercent}% lương dự kiến (${formatMoney(limit)} đ).`);
    }
  }
  const openAdvances = (advancesQuery.data ?? []).filter((a) => a.available > 0);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={() => navigate(-1)} className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft size={15} /> Quay lại
          </button>
          <h2 className="text-lg font-bold text-slate-900">
            {editingId ? `Sửa ${loaded?.code ?? ""}` : TYPE_TITLES[type]}
          </h2>
          {!editingId && (
            <button type="button" onClick={() => setType(null)} className="text-xs font-semibold text-blue-700 hover:underline">
              Đổi loại đề nghị
            </button>
          )}
        </div>
        {loaded?.approvalStatus === "RETURNED" && (
          <span className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
            Phiếu bị trả về — sửa rồi gửi duyệt lại
          </span>
        )}
      </div>

      {loaded && <Warnings items={loaded.warnings} />}
      {type === "EXPENSE_PAYMENT" && openAdvances.length > 0 && (
        <Warnings
          items={[
            `Bạn còn ${openAdvances.length} khoản tạm ứng chưa hoàn ứng (${formatMoney(openAdvances.reduce((s, a) => s + a.available, 0))} đ). Nếu chi phí này dùng tiền tạm ứng, hãy lập Giấy đề nghị hoàn ứng để không thanh toán trùng.`,
          ]}
        />
      )}

      <Card title="Thông tin chung" icon={<ClipboardList size={16} />}>
        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>
            Công ty *
            <select
              className={inputClass}
              value={String(companyId)}
              onChange={(e) => {
                setCompanyId(e.target.value ? Number(e.target.value) : "");
                set("directManagerId", null);
                setAllocations({});
              }}
            >
              <option value="">Chọn công ty</option>
              {meta.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {meta.companies.length === 0 && (
              <span className="mt-1 block text-[11px] font-normal text-rose-600">
                Chưa có công ty nào — quản trị cần khai báo ở Cấu hình.
              </span>
            )}
          </label>
          <label className={labelClass}>
            Ngày đề nghị
            <input type="date" className={inputClass} value={form.requestDate ?? ""} onChange={(e) => set("requestDate", e.target.value)} />
          </label>
          <label className={labelClass}>
            Quản lý trực tiếp
            <select
              className={inputClass}
              value={form.directManagerId ? String(form.directManagerId) : ""}
              onChange={(e) => set("directManagerId", e.target.value ? Number(e.target.value) : null)}
              disabled={!companyId}
            >
              <option value="">{managersQuery.isLoading ? "Đang tải…" : "Chọn quản lý"}</option>
              {(managersQuery.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {companyId && managersQuery.data?.length === 0 && (
              <span className="mt-1 block text-[11px] font-normal text-amber-600">
                Chưa phân quyền quản lý trực tiếp cho phòng ban của bạn.
              </span>
            )}
          </label>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 md:col-span-3">
            Người đề nghị: <b>{loaded?.requesterName ?? meta.me.name}</b>
            {(loaded?.departmentName ?? meta.me.departmentName) && <> · Phòng ban: <b>{loaded?.departmentName ?? meta.me.departmentName}</b></>}
            {(loaded?.requesterPosition ?? meta.me.position) && <> · Chức vụ: <b>{loaded?.requesterPosition ?? meta.me.position}</b></>}
          </div>
          <label className={`${labelClass} md:col-span-3`}>
            Nội dung đề nghị *
            <input className={inputClass} value={form.title ?? ""} maxLength={500} onChange={(e) => set("title", e.target.value)} placeholder="VD: Tạm ứng chi phí tổ chức hội thảo tháng 11" />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Mục đích sử dụng / diễn giải
            <textarea className={inputClass} rows={2} value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} />
          </label>
          <label className={labelClass}>
            Dự án / sự kiện liên quan
            <input className={inputClass} value={form.projectName ?? ""} onChange={(e) => set("projectName", e.target.value)} />
          </label>

          {type === "ADVANCE" && (
            <>
              <label className={labelClass}>
                Ngày dự kiến sử dụng tiền
                <input type="date" className={inputClass} value={form.expectedUseDate ?? ""} onChange={(e) => set("expectedUseDate", e.target.value || null)} />
              </label>
              <label className={labelClass}>
                Hạn hoàn ứng dự kiến
                <input type="date" className={inputClass} value={form.settlementDueDate ?? ""} onChange={(e) => set("settlementDueDate", e.target.value || null)} />
                <span className="mt-1 block text-[11px] font-normal text-slate-400">Bỏ trống = tự tính theo chính sách công ty.</span>
              </label>
            </>
          )}

          {type === "EXPENSE_PAYMENT" && (
            <>
              <label className={labelClass}>
                Địa điểm công tác
                <input className={inputClass} value={form.location ?? ""} onChange={(e) => set("location", e.target.value || null)} />
              </label>
              <label className={labelClass}>
                Bắt đầu công tác
                <input type="date" className={inputClass} value={form.tripStartDate ?? ""} onChange={(e) => set("tripStartDate", e.target.value || null)} />
              </label>
              <label className={labelClass}>
                Kết thúc công tác
                <input type="date" className={inputClass} value={form.tripEndDate ?? ""} onChange={(e) => set("tripEndDate", e.target.value || null)} />
              </label>
            </>
          )}
        </div>
      </Card>

      {type === "SALARY_ADVANCE" && (
        <Card title="Tạm ứng lương" icon={<Wallet size={16} />}>
          <div className="grid gap-3 md:grid-cols-4">
            <label className={labelClass}>
              Tháng lương
              <select className={inputClass} value={form.salaryMonth ?? ""} onChange={(e) => set("salaryMonth", Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Năm
              <input type="number" className={inputClass} value={form.salaryYear ?? ""} onChange={(e) => set("salaryYear", Number(e.target.value))} />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Số tiền đề nghị ứng (đ) *
              <DecimalInput
                allowDecimal={false}
                value={form.requestedAmount ?? 0}
                onValueChange={(value) => set("requestedAmount", value || undefined)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Khấu trừ từ tháng
              <select
                className={inputClass}
                value={form.deductionStartMonth ?? form.salaryMonth ?? ""}
                onChange={(e) => set("deductionStartMonth", Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Năm khấu trừ
              <input
                type="number"
                className={inputClass}
                value={form.deductionStartYear ?? form.salaryYear ?? ""}
                onChange={(e) => set("deductionStartYear", Number(e.target.value))}
              />
            </label>
            <label className={labelClass}>
              Số kỳ khấu trừ
              <input
                type="number"
                min={1}
                max={check?.policy.maxDeductionPeriods ?? 24}
                className={inputClass}
                value={form.deductionPeriods ?? 1}
                onChange={(e) => set("deductionPeriods", Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p>Lương dự kiến: <b>{check?.expectedSalary ? `${formatMoney(check.expectedSalary)} đ` : "chưa có dữ liệu"}</b></p>
              <p>Đã ứng trong kỳ: <b>{formatMoney(check?.approvedInPeriod ?? 0)} đ</b></p>
              {check?.policy.maxPerMonth && <p>Tối đa {check.policy.maxPerMonth} lần/tháng</p>}
            </div>
          </div>
          <div className="mt-3">
            <Warnings items={salaryWarnings} />
          </div>
        </Card>
      )}

      {type === "SETTLEMENT" && (
        <Card title="Phiếu tạm ứng được đối trừ" icon={<Banknote size={16} />}>
          {!companyId && <p className="text-sm text-slate-500">Chọn công ty để xem các khoản tạm ứng đã chi.</p>}
          {companyId && advancesQuery.isLoading && <LoadingState text="Đang tải tạm ứng…" />}
          {companyId && advancesQuery.data?.length === 0 && (
            <p className="text-sm text-slate-500">Bạn không có khoản tạm ứng nào đã chi còn số dư tại công ty này.</p>
          )}
          {(advancesQuery.data ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Chọn</th>
                    <th className="px-3 py-2">Mã phiếu</th>
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Nội dung</th>
                    <th className="px-3 py-2 text-right">Đã chi</th>
                    <th className="px-3 py-2 text-right">Đã phân bổ</th>
                    <th className="px-3 py-2 text-right">Còn được hoàn ứng</th>
                    <th className="px-3 py-2 text-right">Đối trừ lần này</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(advancesQuery.data ?? []).map((advance) => {
                    const selected = allocations[advance.id] !== undefined;
                    const max = advance.available;
                    return (
                      <tr key={advance.id}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) =>
                              setAllocations((prev) => {
                                const next = { ...prev };
                                if (e.target.checked) next[advance.id] = max;
                                else delete next[advance.id];
                                return next;
                              })
                            }
                            className="h-4 w-4 accent-blue-600"
                          />
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{advance.code}</td>
                        <td className="px-3 py-2">{formatDate(advance.requestDate)}</td>
                        <td className="px-3 py-2">{advance.title}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(advance.paidAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(advance.allocatedElsewhere)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-blue-700">{formatMoney(max)}</td>
                        <td className="px-3 py-2">
                          <DecimalInput
                            allowDecimal={false}
                            disabled={!selected}
                            value={allocations[advance.id] ?? 0}
                            max={max}
                            onValueChange={(value) => setAllocations((prev) => ({ ...prev, [advance.id]: value }))}
                            className={`${inputClass} mt-0 text-right`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {type !== "SALARY_ADVANCE" && (
        <Card
          title={type === "SETTLEMENT" ? "Bảng chi phí thực tế" : "Bảng chi tiết"}
          icon={<ClipboardList size={16} />}
          action={
            <button type="button" onClick={() => setItems((prev) => [...prev, newRow()])} className={secondaryButton}>
              <Plus size={16} /> Thêm dòng
            </button>
          }
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"
            className="hidden"
            onChange={(e) => void uploadForItem(e.target.files)}
          />
          <div className="space-y-3">
            {items.map((item, index) => {
              const category = categories.find((c) => c.id === item.categoryId);
              const amount = lineAmounts[index];
              const overLimit = !!category?.limitAmount && amount > category.limitAmount;
              return (
                <div key={item.key} className="rounded-xl border border-slate-200 p-3">
                  <div className="grid gap-2 md:grid-cols-12">
                    <div className="flex items-center gap-2 md:col-span-5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <input
                        className={`${inputClass} mt-0`}
                        placeholder="Nội dung *"
                        value={item.description}
                        onChange={(e) => updateItem(item.key, { description: e.target.value })}
                      />
                    </div>
                    <select
                      className={`${inputClass} mt-0 md:col-span-3`}
                      value={item.categoryId ?? ""}
                      onChange={(e) => updateItem(item.key, { categoryId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Nhóm chi phí</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.limitAmount ? ` (định mức ${formatMoney(c.limitAmount)})` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`${inputClass} mt-0 md:col-span-1`}
                      placeholder="ĐVT"
                      value={item.unit ?? ""}
                      onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                    />
                    <DecimalTextInput
                      className={`${inputClass} mt-0 text-right md:col-span-1`}
                      maxFraction={4}
                      value={item.quantity}
                      placeholder="SL"
                      onChange={(value) => updateItem(item.key, { quantity: value })}
                    />
                    <DecimalTextInput
                      className={`${inputClass} mt-0 text-right md:col-span-2`}
                      maxFraction={2}
                      value={item.unitPrice}
                      placeholder="Đơn giá"
                      onChange={(value) => updateItem(item.key, { unitPrice: value })}
                    />
                  </div>
                  {showExpenseFields && (
                    <div className="mt-2 grid gap-2 md:grid-cols-12">
                      <input
                        type="date"
                        title={type === "SETTLEMENT" ? "Ngày chi" : "Ngày phát sinh"}
                        className={`${inputClass} mt-0 md:col-span-2`}
                        value={item.incurredDate ?? ""}
                        onChange={(e) => updateItem(item.key, { incurredDate: e.target.value || null })}
                      />
                      <input
                        className={`${inputClass} mt-0 md:col-span-2`}
                        placeholder="Số hoá đơn"
                        value={item.invoiceNumber ?? ""}
                        onChange={(e) => updateItem(item.key, { invoiceNumber: e.target.value || null })}
                      />
                      <select
                        className={`${inputClass} mt-0 md:col-span-2`}
                        value={item.invoiceType ?? ""}
                        onChange={(e) => updateItem(item.key, { invoiceType: (e.target.value || null) as InvoiceType | null })}
                      >
                        <option value="">Loại chứng từ</option>
                        {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        className={`${inputClass} mt-0 md:col-span-3`}
                        placeholder="Nhà cung cấp"
                        value={item.supplierName ?? ""}
                        onChange={(e) => updateItem(item.key, { supplierName: e.target.value || null })}
                      />
                      <div className="md:col-span-3" />
                    </div>
                  )}
                  <div className="mt-2 grid gap-2 md:grid-cols-12">
                    <input
                      className={`${inputClass} mt-0 md:col-span-7`}
                      placeholder={showExpenseFields ? "Ghi chú / giải trình chi phí" : "Ghi chú"}
                      value={item.note ?? ""}
                      onChange={(e) => updateItem(item.key, { note: e.target.value || null })}
                    />
                    <div className="flex items-center justify-end gap-2 md:col-span-5">
                      {overLimit && (
                        <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Vượt định mức</span>
                      )}
                      <span className="text-sm text-slate-500">Thành tiền</span>
                      <span className="min-w-[110px] text-right font-bold tabular-nums text-slate-900">{formatMoney(amount)} đ</span>
                      <button
                        type="button"
                        title={item.id ? "Đính kèm hoá đơn cho dòng này" : "Lưu nháp trước để đính kèm"}
                        disabled={!item.id || !editingId || uploadingItem === item.id}
                        onClick={() => item.id && pickFiles(item.id)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                      >
                        {uploadingItem === item.id ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
                        {item.attachmentCount ? item.attachmentCount : ""}
                      </button>
                      <button
                        type="button"
                        aria-label="Xoá dòng"
                        disabled={items.length === 1}
                        onClick={() => setItems((prev) => prev.filter((row) => row.key !== item.key))}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-30"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!editingId && (
            <p className="mt-3 text-xs text-slate-400">Lưu nháp để đính kèm hoá đơn, hình ảnh cho từng dòng.</p>
          )}
        </Card>
      )}

      <Card title="Thông tin nhận tiền" icon={<Banknote size={16} />}
        action={
          <button
            type="button"
            className="text-xs font-semibold text-blue-700 hover:underline"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                payeeName: meta.me.name,
                bankAccountHolder: meta.me.name,
                bankName: meta.me.bankName,
                bankAccountNumber: meta.me.bankAccountNumber,
              }))
            }
          >
            Dùng tài khoản trong hồ sơ
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>
            Phương thức nhận tiền
            <select className={inputClass} value={form.paymentMethod ?? ""} onChange={(e) => set("paymentMethod", (e.target.value || null) as PaymentMethod | null)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Người thụ hưởng
            <input className={inputClass} value={form.payeeName ?? ""} onChange={(e) => set("payeeName", e.target.value)} />
          </label>
          {form.paymentMethod === "BANK_TRANSFER" && (
            <>
              <label className={labelClass}>
                Chủ tài khoản
                <input className={inputClass} value={form.bankAccountHolder ?? ""} onChange={(e) => set("bankAccountHolder", e.target.value)} />
              </label>
              <label className={labelClass}>
                Ngân hàng
                <input className={inputClass} value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
              </label>
              <label className={labelClass}>
                Số tài khoản
                <input className={inputClass} inputMode="numeric" value={form.bankAccountNumber ?? ""} onChange={(e) => set("bankAccountNumber", e.target.value)} />
              </label>
            </>
          )}
          <label className={`${labelClass} md:col-span-3`}>
            Ghi chú thanh toán
            <input className={inputClass} value={form.paymentNote ?? ""} onChange={(e) => set("paymentNote", e.target.value)} />
          </label>
        </div>
      </Card>

      {/* sticky trong cột nội dung: không đè sidebar brand trên desktop */}
      <div className="sticky bottom-16 z-30 lg:bottom-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:flex-row md:items-center md:justify-between md:px-5">
          <div className="text-sm">
            <p className="text-slate-500">
              {TYPE_LABELS[type]} · Tổng cộng{" "}
              <b className="text-lg tabular-nums text-blue-700">{formatMoney(total)} đ</b>
              {type === "SETTLEMENT" && (
                <>
                  {" "}· Tạm ứng đối trừ <b className="tabular-nums">{formatMoney(offset)} đ</b> ·{" "}
                  {difference >= 0 ? (
                    <span className="font-semibold text-amber-700">Công ty trả thêm {formatMoney(difference)} đ</span>
                  ) : (
                    <span className="font-semibold text-violet-700">Nhân viên hoàn lại {formatMoney(-difference)} đ</span>
                  )}
                </>
              )}
            </p>
            <p className="text-xs italic text-slate-500">Bằng chữ: {vndToWords(total)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} disabled={!!saving} onClick={() => void save(false)}>
              {saving === "draft" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu nháp
            </button>
            <button type="button" className={primaryButton} disabled={!!saving} onClick={() => void save(true)}>
              {saving === "submit" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Lưu & gửi duyệt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
