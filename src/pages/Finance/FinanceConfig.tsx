import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, GitBranch, ImageUp, Plus, Shield, SlidersHorizontal, Tags, Trash2, UserPlus, UserRoundCog } from "lucide-react";
import { toast } from "react-hot-toast";

import DecimalInput from "@/components/DecimalInput";
import SearchableSelect from "@/components/SearchableSelect";
import { financeApi, financeConfigApi } from "@/service/finance";
import type {
  ApproverType,
  FinanceConfigOverview,
  FinancePolicy,
  FinanceRequestType,
  FinanceRole,
  FinanceWorkflow,
  SelfApprovalMode,
  SignatureSlot,
  WorkflowStepInput,
} from "@/types/finance";
import { getApiErrorMessage } from "@/utils/apiError";
import { Badge, Card, ErrorState, LoadingState, Modal } from "./components/FinanceUi";
import { FINANCE_META_KEY, useFinanceMeta } from "./FinanceRoutes";
import {
  ROLE_LABELS,
  SELF_MODE_LABELS,
  SLOT_LABELS,
  TYPE_LABELS,
  formatDateTime,
  formatMoney,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "./lib";

type Section = "companies" | "categories" | "workflows" | "assignments" | "policies" | "delegations";

const SECTIONS: { key: Section; label: string; icon: ReactNode }[] = [
  { key: "companies", label: "Công ty", icon: <Building2 size={15} /> },
  { key: "categories", label: "Danh mục chi phí", icon: <Tags size={15} /> },
  { key: "workflows", label: "Quy trình duyệt", icon: <GitBranch size={15} /> },
  { key: "assignments", label: "Phân quyền", icon: <Shield size={15} /> },
  { key: "policies", label: "Chính sách", icon: <SlidersHorizontal size={15} /> },
  { key: "delegations", label: "Uỷ quyền", icon: <UserRoundCog size={15} /> },
];

const TYPES = Object.keys(TYPE_LABELS) as FinanceRequestType[];
const ROLES = Object.keys(ROLE_LABELS) as FinanceRole[];

export default function FinanceConfig() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("companies");
  const query = useQuery({ queryKey: ["finance-config"], queryFn: financeConfigApi.overview });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["finance-config"] });
    await queryClient.invalidateQueries({ queryKey: FINANCE_META_KEY });
  };

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast.success(message);
      await refresh();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không lưu được."));
      return false;
    }
  };

  if (query.isLoading) return <LoadingState text="Đang tải cấu hình…" />;
  if (query.isError || !query.data)
    return <ErrorState message={getApiErrorMessage(query.error, "Không tải được cấu hình.")} onRetry={() => void query.refetch()} />;
  const data = query.data;

  return (
    <div className="space-y-4">
      <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-1.5">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                section === item.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {section === "companies" && <Companies data={data} run={run} />}
      {section === "categories" && <Categories data={data} run={run} />}
      {section === "workflows" && <Workflows data={data} run={run} />}
      {section === "assignments" && <Assignments data={data} run={run} />}
      {section === "policies" && <Policies data={data} run={run} />}
      {section === "delegations" && <Delegations data={data} run={run} />}
    </div>
  );
}

type SectionProps = { data: FinanceConfigOverview; run: (action: () => Promise<unknown>, message: string) => Promise<boolean> };

// ---------------------------------------------------------------------------

function LogoPreview({ companyId, version }: { companyId: number; version: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    financeApi
      .companyLogo(companyId)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [companyId, version]);
  return url ? <img src={url} alt="Logo" className="h-12 w-12 rounded-lg border object-contain" /> : null;
}

function Companies({ data, run }: SectionProps) {
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);
  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name,
      shortName: editing.shortName || null,
      taxCode: editing.taxCode || null,
      address: editing.address || null,
      phone: editing.phone || null,
      email: editing.email || null,
      formCodes: editing.formCodes ?? {},
      isActive: editing.isActive ?? true,
    };
    const ok = await run(
      () => (editing.id ? financeConfigApi.updateCompany(editing.id, payload) : financeConfigApi.createCompany({ ...payload, code: editing.code })),
      "Đã lưu công ty",
    );
    if (ok) setEditing(null);
  };
  return (
    <Card
      title="Hồ sơ công ty in trên chứng từ"
      action={
        <button type="button" className={primaryButton} onClick={() => setEditing({ isActive: true, formCodes: {} })}>
          <Plus size={16} /> Thêm công ty
        </button>
      }
    >
      {data.companies.length === 0 && <p className="text-sm text-slate-500">Chưa có công ty — thêm ít nhất một công ty để nhân viên lập đề nghị.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {data.companies.map((company) => (
          <div key={company.id} className="flex gap-3 rounded-xl border border-slate-200 p-3">
            {company.hasLogo ? <LogoPreview companyId={company.id} version={logoVersion} /> : <div className="h-12 w-12 rounded-lg bg-slate-100" />}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold text-slate-900">
                {company.name} <span className="text-xs font-normal text-slate-400">({company.code})</span>
              </p>
              <p className="text-xs text-slate-500">MST: {company.taxCode || "—"} · {company.address || "Chưa có địa chỉ"}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {!company.isActive && <Badge tone="slate">Ngừng sử dụng</Badge>}
                {Object.entries(company.formCodes ?? {}).map(([type, code]) => (
                  <Badge key={type} tone="blue">
                    {TYPE_LABELS[type as FinanceRequestType]}: {code}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => setEditing({ ...company })}>
                  Sửa
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-blue-700">
                  <ImageUp size={13} /> Tải logo
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (await run(() => financeConfigApi.uploadLogo(company.id, file), "Đã cập nhật logo")) setLogoVersion((v) => v + 1);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal
          open
          wide
          title={editing.id ? `Sửa ${editing.name}` : "Thêm công ty"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Đóng</button>
              <button type="button" className={primaryButton} onClick={() => void save()}>Lưu</button>
            </>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Mã công ty *
              <input className={inputClass} disabled={!!editing.id} value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
            </label>
            <label className={labelClass}>
              Tên viết tắt
              <input className={inputClass} value={editing.shortName ?? ""} onChange={(e) => setEditing({ ...editing, shortName: e.target.value })} />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Tên công ty *
              <input className={inputClass} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className={labelClass}>
              Mã số thuế
              <input className={inputClass} value={editing.taxCode ?? ""} onChange={(e) => setEditing({ ...editing, taxCode: e.target.value })} />
            </label>
            <label className={labelClass}>
              Điện thoại
              <input className={inputClass} value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Địa chỉ
              <input className={inputClass} value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </label>
            <label className={labelClass}>
              Email
              <input className={inputClass} value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
              Đang sử dụng
            </label>
            <p className="text-xs font-semibold text-slate-600 md:col-span-2">Mã biểu mẫu in trên phiếu</p>
            {TYPES.map((type) => (
              <label key={type} className={labelClass}>
                {TYPE_LABELS[type]}
                <input
                  className={inputClass}
                  value={editing.formCodes?.[type] ?? ""}
                  onChange={(e) => setEditing({ ...editing, formCodes: { ...(editing.formCodes ?? {}), [type]: e.target.value } })}
                />
              </label>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Categories({ data, run }: SectionProps) {
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name,
      description: editing.description || null,
      limitAmount: editing.limitAmount ? Number(editing.limitAmount) : null,
      sortOrder: Number(editing.sortOrder ?? 0),
      isActive: editing.isActive ?? true,
    };
    const ok = await run(
      () => (editing.id ? financeConfigApi.updateCategory(editing.id, payload) : financeConfigApi.createCategory({ ...payload, code: editing.code })),
      "Đã lưu danh mục",
    );
    if (ok) setEditing(null);
  };
  return (
    <Card
      title="Danh mục chi phí và định mức"
      action={
        <button type="button" className={primaryButton} onClick={() => setEditing({ isActive: true, sortOrder: (data.categories.length + 1) * 10 })}>
          <Plus size={16} /> Thêm danh mục
        </button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2 text-right">Định mức / dòng</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.categories.map((category) => (
              <tr key={category.id}>
                <td className="px-3 py-2 font-mono text-xs">{category.code}</td>
                <td className="px-3 py-2">{category.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{category.limitAmount ? `${formatMoney(category.limitAmount)} đ` : "Không giới hạn"}</td>
                <td className="px-3 py-2">{category.isActive ? <Badge tone="emerald">Đang dùng</Badge> : <Badge>Ngừng</Badge>}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => setEditing({ ...category })}>
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal
          open
          title={editing.id ? `Sửa ${editing.name}` : "Thêm danh mục"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Đóng</button>
              <button type="button" className={primaryButton} onClick={() => void save()}>Lưu</button>
            </>
          }
        >
          <div className="grid gap-3">
            <label className={labelClass}>
              Mã (chữ in hoa) *
              <input className={inputClass} disabled={!!editing.id} value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} />
            </label>
            <label className={labelClass}>
              Tên *
              <input className={inputClass} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className={labelClass}>
              Định mức tối đa mỗi dòng (đ) — bỏ trống = không giới hạn
              <DecimalInput allowDecimal={false} value={editing.limitAmount ?? 0} onValueChange={(v) => setEditing({ ...editing, limitAmount: v || null })} className={inputClass} />
            </label>
            <label className={labelClass}>
              Thứ tự
              <input type="number" className={inputClass} value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
              Đang sử dụng
            </label>
          </div>
        </Modal>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

type WorkflowDraft = Omit<FinanceWorkflow, "id" | "steps"> & { id?: number; steps: WorkflowStepInput[] };

const emptyStep = (): WorkflowStepInput => ({
  name: "",
  approverType: "ROLE",
  approverRole: "ACCOUNTANT",
  signatureSlot: null,
  minAmount: null,
  canAdjustAmounts: false,
  skippable: false,
});

function Workflows({ data, run }: SectionProps) {
  const [editing, setEditing] = useState<WorkflowDraft | null>(null);
  const companyName = (id: number | null) => (id ? data.companies.find((c) => c.id === id)?.name ?? `#${id}` : "Mọi công ty");
  const employeeName = (id?: number | null) => data.employees.find((e) => e.id === id)?.name ?? `#${id}`;

  const updateStep = (index: number, patch: Partial<WorkflowStepInput>) =>
    setEditing((prev) => prev && { ...prev, steps: prev.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const move = (index: number, delta: number) =>
    setEditing((prev) => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return prev;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps };
    });

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name,
      companyId: editing.companyId ?? null,
      requestType: editing.requestType ?? null,
      isActive: editing.isActive,
      isSequential: editing.isSequential,
      selfApprovalMode: editing.selfApprovalMode,
      allowWithdraw: editing.allowWithdraw,
      description: editing.description || null,
      steps: editing.steps.map((step) => ({
        name: step.name,
        approverType: step.approverType,
        approverRole: step.approverType === "ROLE" ? step.approverRole : null,
        approverEmployeeId: step.approverType === "EMPLOYEE" ? step.approverEmployeeId : null,
        signatureSlot: step.signatureSlot || null,
        minAmount: step.minAmount || null,
        canAdjustAmounts: !!step.canAdjustAmounts,
        skippable: !!step.skippable,
      })),
    };
    const ok = await run(
      () => (editing.id ? financeConfigApi.updateWorkflow(editing.id, payload) : financeConfigApi.createWorkflow(payload)),
      "Đã lưu quy trình",
    );
    if (ok) setEditing(null);
  };

  return (
    <Card
      title="Quy trình phê duyệt"
      action={
        <button
          type="button"
          className={primaryButton}
          onClick={() =>
            setEditing({
              name: "",
              companyId: null,
              requestType: null,
              isActive: true,
              isSequential: true,
              selfApprovalMode: "BLOCK",
              allowWithdraw: true,
              description: "",
              steps: [{ ...emptyStep(), name: "Quản lý trực tiếp", approverType: "DIRECT_MANAGER", approverRole: null, signatureSlot: "MANAGER" }],
            })
          }
        >
          <Plus size={16} /> Thêm quy trình
        </button>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Khi gửi duyệt, hệ thống chọn quy trình cụ thể nhất: công ty + loại → công ty → loại → mặc định. Sửa quy trình chỉ áp dụng cho phiếu gửi sau.
      </p>
      <div className="space-y-3">
        {data.workflows.map((workflow) => (
          <div key={workflow.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{workflow.name}</p>
                <p className="text-xs text-slate-500">
                  {companyName(workflow.companyId)} · {workflow.requestType ? TYPE_LABELS[workflow.requestType] : "Mọi loại chứng từ"} ·{" "}
                  {workflow.isSequential ? "Tuần tự" : "Song song"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {workflow.isActive ? <Badge tone="emerald">Đang áp dụng</Badge> : <Badge>Tắt</Badge>}
                <button type="button" className="text-xs font-semibold text-blue-700" onClick={() => setEditing({ ...workflow, steps: workflow.steps.map((s) => ({ ...s })) })}>
                  Sửa
                </button>
              </div>
            </div>
            <ol className="mt-2 flex flex-wrap gap-2">
              {workflow.steps.map((step) => (
                <li key={step.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                  <b>{step.stepOrder}. {step.name}</b>
                  <span className="text-slate-500">
                    {" "}— {step.approverType === "DIRECT_MANAGER" ? "Quản lý trên phiếu" : step.approverType === "EMPLOYEE" ? employeeName(step.approverEmployeeId) : ROLE_LABELS[step.approverRole as FinanceRole]}
                    {step.minAmount ? ` · từ ${formatMoney(step.minAmount)} đ` : ""}
                    {step.canAdjustAmounts ? " · điều chỉnh số tiền" : ""}
                    {step.skippable ? " · được bỏ qua" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          open
          wide
          title={editing.id ? `Sửa quy trình ${editing.name}` : "Thêm quy trình"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Đóng</button>
              <button type="button" className={primaryButton} onClick={() => void save()}>Lưu quy trình</button>
            </>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className={`${labelClass} md:col-span-3`}>
              Tên quy trình *
              <input className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className={labelClass}>
              Công ty
              <select className={inputClass} value={editing.companyId ?? ""} onChange={(e) => setEditing({ ...editing, companyId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Mọi công ty</option>
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Loại chứng từ
              <select className={inputClass} value={editing.requestType ?? ""} onChange={(e) => setEditing({ ...editing, requestType: (e.target.value || null) as FinanceRequestType | null })}>
                <option value="">Mọi loại</option>
                {TYPES.map((type) => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Người đề nghị trùng người duyệt
              <select className={inputClass} value={editing.selfApprovalMode} onChange={(e) => setEditing({ ...editing, selfApprovalMode: e.target.value as SelfApprovalMode })}>
                {(Object.keys(SELF_MODE_LABELS) as SelfApprovalMode[]).map((mode) => (
                  <option key={mode} value={mode}>{SELF_MODE_LABELS[mode]}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600 md:col-span-3">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Đang áp dụng</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={editing.isSequential} onChange={(e) => setEditing({ ...editing, isSequential: e.target.checked })} /> Duyệt tuần tự</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-blue-600" checked={editing.allowWithdraw} onChange={(e) => setEditing({ ...editing, allowWithdraw: e.target.checked })} /> Cho thu hồi khi chưa duyệt xong</label>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Các cấp duyệt</p>
              <button type="button" className={secondaryButton} onClick={() => setEditing({ ...editing, steps: [...editing.steps, emptyStep()] })}>
                <Plus size={15} /> Thêm cấp
              </button>
            </div>
            {editing.steps.map((step, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
                <div className="flex items-center gap-1 md:col-span-3">
                  <span className="text-xs font-bold text-slate-500">{index + 1}.</span>
                  <input className={`${inputClass} mt-0`} placeholder="Tên cấp *" value={step.name} onChange={(e) => updateStep(index, { name: e.target.value })} />
                </div>
                <select className={`${inputClass} mt-0 md:col-span-2`} value={step.approverType} onChange={(e) => updateStep(index, { approverType: e.target.value as ApproverType })}>
                  <option value="DIRECT_MANAGER">Quản lý trực tiếp</option>
                  <option value="ROLE">Theo vai trò</option>
                  <option value="EMPLOYEE">Người cụ thể</option>
                </select>
                {step.approverType === "ROLE" && (
                  <select className={`${inputClass} mt-0 md:col-span-2`} value={step.approverRole ?? ""} onChange={(e) => updateStep(index, { approverRole: e.target.value as FinanceRole })}>
                    {ROLES.filter((r) => !["ADMIN", "VIEWER", "MANAGER"].includes(r)).map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                )}
                {step.approverType === "EMPLOYEE" && (
                  <div className="md:col-span-2">
                    <SearchableSelect
                      value={step.approverEmployeeId ? String(step.approverEmployeeId) : ""}
                      onChange={(value) => updateStep(index, { approverEmployeeId: value ? Number(value) : null })}
                      options={data.employees.map((e) => ({ id: e.id, name: e.name }))}
                      placeholder="Chọn người duyệt"
                      className={`${inputClass} mt-0`}
                    />
                  </div>
                )}
                {step.approverType === "DIRECT_MANAGER" && <div className="md:col-span-2" />}
                <select className={`${inputClass} mt-0 md:col-span-2`} value={step.signatureSlot ?? ""} onChange={(e) => updateStep(index, { signatureSlot: (e.target.value || null) as SignatureSlot | null })}>
                  <option value="">Ô ký trên phiếu: không</option>
                  {(Object.keys(SLOT_LABELS) as SignatureSlot[]).map((slot) => (
                    <option key={slot} value={slot}>Ô ký: {SLOT_LABELS[slot]}</option>
                  ))}
                </select>
                <div className="md:col-span-2">
                  <DecimalInput allowDecimal={false} value={step.minAmount ?? 0} placeholder="Áp dụng từ (đ)" onValueChange={(v) => updateStep(index, { minAmount: v || null })} className={`${inputClass} mt-0`} />
                </div>
                <div className="flex items-center justify-end gap-1 md:col-span-1">
                  <button type="button" aria-label="Lên" onClick={() => move(index, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Xuống" onClick={() => move(index, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><ArrowDown size={14} /></button>
                  <button type="button" aria-label="Xoá cấp" disabled={editing.steps.length === 1} onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, i) => i !== index) })} className="rounded p-1 text-rose-500 hover:bg-rose-50 disabled:opacity-30"><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-600 md:col-span-12">
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-blue-600" checked={!!step.canAdjustAmounts} onChange={(e) => updateStep(index, { canAdjustAmounts: e.target.checked })} /> Được ghi nhận số tiền chấp nhận theo dòng</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-blue-600" checked={!!step.skippable} onChange={(e) => updateStep(index, { skippable: e.target.checked })} /> Quản trị được bỏ qua (phải ghi lý do)</label>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** "Nhân viên" không phải vai trò tài chính: chọn nó là xếp nhân viên vào phòng ban. */
const STAFF = "STAFF";
type AssignRole = FinanceRole | typeof STAFF;

const EMPTY_ACCOUNT = { name: "", phone: "", email: "", password: "", departmentId: "" };

function Assignments({ data, run }: SectionProps) {
  // Nhân sự cấu hình được nhưng vai trò quản trị và vai trò của chính mình do quản trị thao tác — backend cũng chặn.
  const isAdmin = useFinanceMeta().capabilities.isAdmin;
  const assignableRoles = isAdmin ? ROLES : ROLES.filter((role) => role !== "ADMIN");
  const canRevoke = (a: { role: FinanceRole; employeeId: number }) =>
    isAdmin || (a.role !== "ADMIN" && a.employeeId !== data.me.id);
  const [form, setForm] = useState<{ employeeId: string; role: AssignRole; companyId: string; departmentId: string; approvalLimit: number; note: string }>({
    employeeId: "",
    role: "MANAGER",
    companyId: "",
    departmentId: "",
    approvalLimit: 0,
    note: "",
  });
  const [account, setAccount] = useState<typeof EMPTY_ACCOUNT | null>(null);
  const isStaff = form.role === STAFF;
  const department = data.departments.find((d) => String(d.id) === form.departmentId);
  const company = data.companies.find((c) => String(c.id) === form.companyId);
  const selected = data.employees.find((e) => String(e.id) === form.employeeId);
  /** Vai trò Nhân viên: điền sẵn phòng ban + công ty hiện tại của nhân viên để sửa tiếp. */
  const placementOf = (employeeId: string) => {
    const employee = data.employees.find((e) => String(e.id) === employeeId);
    return employee
      ? {
          departmentId: employee.departmentId ? String(employee.departmentId) : "",
          companyId: employee.companyId ? String(employee.companyId) : "",
        }
      : {};
  };

  const add = async () => {
    if (!form.employeeId) {
      toast.error("Chọn nhân viên");
      return;
    }
    if (isStaff) {
      if (!company) {
        toast.error("Chọn công ty nhân viên thuộc về");
        return;
      }
      if (!department) {
        toast.error("Chọn phòng ban cho nhân viên");
        return;
      }
      const ok = await run(
        () => financeConfigApi.setEmployeeDepartment(Number(form.employeeId), department.id, company.id),
        `Đã xếp ${selected?.name ?? "nhân viên"} vào phòng ${department.name} — ${company.shortName || company.name}`,
      );
      if (ok) setForm({ ...form, employeeId: "" });
      return;
    }
    const ok = await run(
      () =>
        financeConfigApi.createAssignment({
          employeeId: Number(form.employeeId),
          role: form.role,
          companyId: form.companyId ? Number(form.companyId) : null,
          departmentId: form.departmentId ? Number(form.departmentId) : null,
          approvalLimit: form.approvalLimit || null,
          note: form.note || null,
        }),
      "Đã phân quyền",
    );
    if (ok) setForm({ ...form, employeeId: "", note: "", approvalLimit: 0 });
  };

  const createAccount = async () => {
    if (!account) return;
    if (!account.name.trim() || !account.phone.trim() || !account.password || !account.departmentId) {
      toast.error("Nhập họ tên, số điện thoại, mật khẩu và chọn phòng ban");
      return;
    }
    const created: { id?: number } = {};
    const ok = await run(async () => {
      const result = await financeConfigApi.createAccount({
        name: account.name.trim(),
        phone: account.phone.trim(),
        email: account.email.trim() || null,
        password: account.password,
        departmentId: Number(account.departmentId),
      });
      created.id = result.id;
    }, `Đã tạo tài khoản ${account.name.trim()}`);
    if (!ok) return;
    setAccount(null);
    // Chọn sẵn tài khoản vừa tạo để gán tiếp vai trò nếu cần.
    if (created.id) setForm((prev) => ({ ...prev, employeeId: String(created.id) }));
  };

  const active = data.assignments.filter((a) => a.isActive);
  return (
    <div className="space-y-4">
      <Card
        title="Gán vai trò tài chính theo phạm vi"
        action={
          data.canCreateAccount && (
            <button type="button" className={secondaryButton} onClick={() => setAccount({ ...EMPTY_ACCOUNT, departmentId: form.departmentId })}>
              <UserPlus size={16} /> Tạo tài khoản
            </button>
          )
        }
      >
        <div className="grid gap-3 md:grid-cols-6">
          <label className={`${labelClass} md:col-span-2`}>
            Nhân viên
            <SearchableSelect
              value={form.employeeId}
              onChange={(value) => setForm({ ...form, employeeId: value, ...(isStaff ? placementOf(value) : {}) })}
              options={data.employees.map((e) => ({
                id: e.id,
                name: `${e.name}${e.departmentName ? ` — ${e.departmentName}` : ""}${e.companyName ? ` · ${e.companyName}` : ""}`,
              }))}
              placeholder="Chọn nhân viên"
              searchPlaceholder="Tìm tên…"
              className="mt-1"
            />
          </label>
          <label className={labelClass}>
            Vai trò
            <select
              className={inputClass}
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as AssignRole;
                setForm({ ...form, role, ...(role === STAFF && form.employeeId ? placementOf(form.employeeId) : {}) });
              }}
            >
              <option value={STAFF}>Nhân viên</option>
              {assignableRoles.map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {isStaff ? "Công ty *" : "Công ty"}
            <select className={inputClass} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">{isStaff ? "Chọn công ty" : "Mọi công ty"}</option>
              {data.companies
                .filter((c) => !isStaff || c.isActive || String(c.id) === form.companyId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
                ))}
            </select>
          </label>
          <label className={`${labelClass} ${isStaff ? "md:col-span-2" : ""}`}>
            {isStaff ? "Phòng ban *" : "Phòng ban"}
            <select className={inputClass} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">{isStaff ? "Chọn phòng ban" : "Mọi phòng ban"}</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          {!isStaff && (
            <label className={labelClass}>
              Hạn mức duyệt (đ)
              <DecimalInput allowDecimal={false} value={form.approvalLimit} placeholder="Không giới hạn" onValueChange={(v) => setForm({ ...form, approvalLimit: v })} className={inputClass} />
            </label>
          )}
          {isStaff ? (
            <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-700 md:col-span-5">
              {selected && (
                <p>
                  {selected.name} đang ở: <b>{selected.departmentName ?? "chưa có phòng ban"}</b> ·{" "}
                  <b>{selected.companyName ?? "chưa xếp công ty"}</b>
                </p>
              )}
              {!department ? (
                <p>Chọn công ty và phòng ban — đề nghị tài chính của nhân viên tự chọn công ty này và quản lý trực tiếp của phòng.</p>
              ) : department.managers?.length ? (
                <p>
                  Quản lý trực tiếp chọn sẵn khi lập đề nghị: <b>{department.managers[0].name}</b>
                  {department.managers.length > 1 && <> (kế tiếp: {department.managers.slice(1).map((m) => m.name).join(", ")})</>}
                </p>
              ) : (
                <p className="text-amber-700">
                  Phòng {department.name} chưa có quản lý trực tiếp — gán vai trò "Quản lý trực tiếp" cho phòng này (hoặc chức danh trưởng/phó phòng) để đề nghị tự chọn người duyệt.
                </p>
              )}
            </div>
          ) : (
            <label className={`${labelClass} md:col-span-5`}>
              Ghi chú
              <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
          )}
          <div className="flex items-end">
            <button type="button" className={`${primaryButton} w-full`} onClick={() => void add()}>
              <Plus size={16} /> {isStaff ? "Lưu" : "Gán quyền"}
            </button>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Vai trò mặc định theo chức danh hệ thống (mọi công ty):{" "}
          {Object.entries(data.implicitRoles)
            .map(([role, roles]) => `${role} → ${roles.map((r) => ROLE_LABELS[r]).join(", ")}`)
            .join(" · ")}
          . Quản lý trực tiếp, kiểm soát, kế toán viên… phải gán ở đây. Quản lý trực tiếp gán riêng cho một phòng ban được chọn sẵn
          khi nhân viên phòng đó lập đề nghị (không có thì trưởng/phó phòng thuộc phòng ban).
        </div>
        {account && (
          <Modal
            open
            title="Tạo tài khoản nhân viên"
            onClose={() => setAccount(null)}
            footer={
              <>
                <button type="button" className={secondaryButton} onClick={() => setAccount(null)}>Đóng</button>
                <button type="button" className={primaryButton} onClick={() => void createAccount()}>Tạo tài khoản</button>
              </>
            }
          >
            <div className="grid gap-3">
              <label className={labelClass}>
                Họ tên *
                <input className={inputClass} value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
              </label>
              <label className={labelClass}>
                Số điện thoại (dùng để đăng nhập) *
                <input className={inputClass} inputMode="tel" autoComplete="off" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} />
              </label>
              <label className={labelClass}>
                Mật khẩu * (tối thiểu 6 ký tự)
                <input className={inputClass} autoComplete="new-password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
              </label>
              <label className={labelClass}>
                Email
                <input type="email" className={inputClass} autoComplete="off" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
              </label>
              <label className={labelClass}>
                Phòng ban *
                <select className={inputClass} value={account.departmentId} onChange={(e) => setAccount({ ...account, departmentId: e.target.value })}>
                  <option value="">Chọn phòng ban</option>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-slate-500">
                Tài khoản mang vai trò hệ thống <b>Nhân viên</b>, đăng nhập bằng số điện thoại + mật khẩu và lập được đề nghị tài chính. Quyền khác cấp ở màn Nhân viên.
              </p>
            </div>
          </Modal>
        )}
      </Card>
      <Card title={`Phân quyền đang hiệu lực (${active.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Vai trò</th>
                <th className="px-3 py-2">Công ty</th>
                <th className="px-3 py-2">Phòng ban</th>
                <th className="px-3 py-2 text-right">Hạn mức</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{a.employeeName}</td>
                  <td className="px-3 py-2"><Badge tone="blue">{ROLE_LABELS[a.role]}</Badge></td>
                  <td className="px-3 py-2">{a.companyName ?? "Mọi công ty"}</td>
                  <td className="px-3 py-2">{a.departmentName ?? "Mọi phòng ban"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.approvalLimit ? formatMoney(a.approvalLimit) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {canRevoke(a) && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600"
                        onClick={() => window.confirm(`Thu hồi quyền ${ROLE_LABELS[a.role]} của ${a.employeeName}?`) && void run(() => financeConfigApi.removeAssignment(a.id), "Đã thu hồi quyền")}
                      >
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PolicyForm({ policy, companyId, run }: { policy?: FinancePolicy; companyId: number | null; run: SectionProps["run"] }) {
  const [value, setValue] = useState({
    salaryAdvanceMaxPerMonth: policy?.salaryAdvanceMaxPerMonth ?? null,
    salaryAdvanceMaxAmount: policy?.salaryAdvanceMaxAmount ?? null,
    salaryAdvanceMaxPercent: policy?.salaryAdvanceMaxPercent ?? null,
    maxDeductionPeriods: policy?.maxDeductionPeriods ?? 1,
    advanceDueDays: policy?.advanceDueDays ?? 30,
    reminderDaysBefore: policy?.reminderDaysBefore ?? 3,
    expenseOverLimitMode: policy?.expenseOverLimitMode ?? "WARN",
  });
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <label className={labelClass}>
        Số lần ứng lương tối đa / tháng
        <input type="number" min={1} className={inputClass} value={value.salaryAdvanceMaxPerMonth ?? ""} onChange={(e) => setValue({ ...value, salaryAdvanceMaxPerMonth: num(e.target.value) })} />
      </label>
      <label className={labelClass}>
        Hạn mức mỗi lần ứng lương (đ)
        <DecimalInput allowDecimal={false} value={value.salaryAdvanceMaxAmount ?? 0} placeholder="Không giới hạn" onValueChange={(v) => setValue({ ...value, salaryAdvanceMaxAmount: v || null })} className={inputClass} />
      </label>
      <label className={labelClass}>
        Tối đa % lương dự kiến
        <input type="number" min={1} max={100} step="0.01" className={inputClass} value={value.salaryAdvanceMaxPercent ?? ""} onChange={(e) => setValue({ ...value, salaryAdvanceMaxPercent: num(e.target.value) })} />
      </label>
      <label className={labelClass}>
        Số kỳ khấu trừ tối đa
        <input type="number" min={1} max={24} className={inputClass} value={value.maxDeductionPeriods} onChange={(e) => setValue({ ...value, maxDeductionPeriods: Number(e.target.value) || 1 })} />
      </label>
      <label className={labelClass}>
        Hạn hoàn ứng mặc định (ngày)
        <input type="number" min={1} className={inputClass} value={value.advanceDueDays} onChange={(e) => setValue({ ...value, advanceDueDays: Number(e.target.value) || 30 })} />
      </label>
      <label className={labelClass}>
        Nhắc trước hạn (ngày)
        <input type="number" min={0} className={inputClass} value={value.reminderDaysBefore} onChange={(e) => setValue({ ...value, reminderDaysBefore: Number(e.target.value) })} />
      </label>
      <label className={labelClass}>
        Dòng chi vượt định mức
        <select className={inputClass} value={value.expenseOverLimitMode} onChange={(e) => setValue({ ...value, expenseOverLimitMode: e.target.value as "WARN" | "BLOCK" })}>
          <option value="WARN">Cảnh báo, vẫn cho gửi</option>
          <option value="BLOCK">Chặn gửi duyệt</option>
        </select>
      </label>
      <div className="flex items-end">
        <button type="button" className={`${primaryButton} w-full`} onClick={() => void run(() => financeConfigApi.savePolicy({ ...value, companyId }), "Đã lưu chính sách")}>
          Lưu
        </button>
      </div>
    </div>
  );
}

function Policies({ data, run }: SectionProps) {
  const [companyId, setCompanyId] = useState("");
  const scopeKey = companyId ? `COMPANY:${companyId}` : "GLOBAL";
  const policy = data.policies.find((p) => p.scopeKey === scopeKey);
  return (
    <Card title="Chính sách tạm ứng / ứng lương">
      <label className={`${labelClass} mb-4 max-w-sm`}>
        Phạm vi
        <select className={inputClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Mặc định (mọi công ty)</option>
          {data.companies.map((c) => (
            <option key={c.id} value={c.id}>Riêng {c.name}</option>
          ))}
        </select>
      </label>
      {companyId && !policy && <p className="mb-3 text-xs text-amber-600">Công ty này đang dùng chính sách mặc định. Lưu để tạo chính sách riêng.</p>}
      <PolicyForm key={scopeKey} policy={policy ?? (companyId ? data.policies.find((p) => p.scopeKey === "GLOBAL") : undefined)} companyId={companyId ? Number(companyId) : null} run={run} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Delegations({ data, run }: SectionProps) {
  const [form, setForm] = useState({ delegatorId: "", delegateId: "", days: 7, reason: "" });
  const create = async () => {
    if (!form.delegatorId || !form.delegateId) {
      toast.error("Chọn người uỷ quyền và người được uỷ quyền");
      return;
    }
    const start = new Date();
    const ok = await run(
      () =>
        financeApi.createDelegation({
          delegatorId: Number(form.delegatorId),
          delegateId: Number(form.delegateId),
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + form.days * 86_400_000).toISOString(),
          reason: form.reason || null,
        }),
      "Đã tạo uỷ quyền",
    );
    if (ok) setForm({ ...form, delegatorId: "", delegateId: "", reason: "" });
  };
  const options = data.employees.map((e) => ({ id: e.id, name: e.name }));
  const now = Date.now();
  return (
    <div className="space-y-4">
      <Card title="Tạo uỷ quyền thay cho người duyệt">
        <div className="grid gap-3 md:grid-cols-5">
          <label className={`${labelClass} md:col-span-2`}>
            Người uỷ quyền
            <SearchableSelect value={form.delegatorId} onChange={(v) => setForm({ ...form, delegatorId: v })} options={options} placeholder="Chọn" className="mt-1" />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Người được uỷ quyền
            <SearchableSelect value={form.delegateId} onChange={(v) => setForm({ ...form, delegateId: v })} options={options} placeholder="Chọn" className="mt-1" />
          </label>
          <label className={labelClass}>
            Số ngày
            <input type="number" min={1} max={180} className={inputClass} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 1 })} />
          </label>
          <label className={`${labelClass} md:col-span-4`}>
            Lý do
            <input className={inputClass} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          <div className="flex items-end">
            <button type="button" className={`${primaryButton} w-full`} onClick={() => void create()}>Tạo</button>
          </div>
        </div>
      </Card>
      <Card title="Uỷ quyền gần đây">
        <div className="space-y-2">
          {data.delegations.map((d) => {
            const active = !d.revokedAt && new Date(d.startsAt).getTime() <= now && new Date(d.endsAt).getTime() > now;
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-semibold">{d.delegatorName} → {d.delegateName}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(d.startsAt)} – {formatDateTime(d.endsAt)} {d.reason ? `· ${d.reason}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={d.revokedAt ? "slate" : active ? "emerald" : "amber"}>{d.revokedAt ? "Đã thu hồi" : active ? "Đang hiệu lực" : "Chưa/hết hiệu lực"}</Badge>
                  {!d.revokedAt && (
                    <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => void run(() => financeApi.revokeDelegation(d.id), "Đã thu hồi")}>Thu hồi</button>
                  )}
                </div>
              </div>
            );
          })}
          {data.delegations.length === 0 && <p className="text-sm text-slate-400">Chưa có uỷ quyền.</p>}
        </div>
      </Card>
    </div>
  );
}
