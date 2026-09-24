import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Filter,
  FileText,
  LockKeyhole,
  Loader2,
  Save,
  School,
  Upload,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PolicyMonthlyInput, PolicySubject, PolicyYear } from "./types";
import {
  calculatePolicyRow,
  calculatePolicySummary,
  exportPolicyYearCsv,
  buildPolicyYearSavePayload,
} from "./utils";
import PolicySubjectTabs from "./components/PolicySubjectTabs";
import PolicySubjectConfigCard from "./components/PolicySubjectConfigCard";
import PolicyMonthlyTable from "./components/PolicyMonthlyTable";
import PolicyMonthlyFormModal from "./components/PolicyMonthlyFormModal";
import PolicySubjectFormModal from "./components/PolicySubjectFormModal";
import StatusBadge from "./components/StatusBadge";
import SpentExpenseRequestsSection from "./components/SpentExpenseRequestsSection";
import SearchableSelect from "@/components/SearchableSelect";
import { annualPolicyApi } from "@/service/annualPolicy";
import { policiesApi } from "@/service/policy";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasRole } from "@/utils/auth";
import { resolveApiFileUrl } from "@/utils/fileUrl";

type PolicyYearDetailPageProps = {
  policy: PolicyYear;
  schoolId?: number | null;
  databaseFieldsReadonly?: boolean;
  readOnly?: boolean;
  onBack: () => void;
  onSave: (policy: PolicyYear, payload: ReturnType<typeof buildPolicyYearSavePayload>) => void;
  onContractUpdated?: (policy: PolicyYear) => void;
};

const getSubjectEquipmentPolicyAmount = (rows: PolicyMonthlyInput[]) => {
  const amount = rows.find((row) => Number(row.equipmentPolicyAmount || 0) > 0)
    ?.equipmentPolicyAmount;

  return Number(amount || rows[0]?.equipmentPolicyAmount || 0);
};

const getEquipmentPolicyTotal = (rows: PolicyMonthlyInput[]) => {
  const rowsBySubject = rows.reduce<Map<number, PolicyMonthlyInput[]>>(
    (map, row) => {
      const subjectRows = map.get(row.subjectId) || [];
      subjectRows.push(row);
      map.set(row.subjectId, subjectRows);

      return map;
    },
    new Map(),
  );

  return [...rowsBySubject.values()].reduce(
    (total, subjectRows) =>
      total + getSubjectEquipmentPolicyAmount(subjectRows),
    0,
  );
};

export default function PolicyYearDetailPage({
  policy,
  schoolId,
  databaseFieldsReadonly = false,
  readOnly = false,
  onBack,
  onSave,
  onContractUpdated,
}: PolicyYearDetailPageProps) {
  const [draft, setDraft] = useState<PolicyYear>(() => ({
    ...policy,
    subjects: policy.subjects.map((subject) => ({ ...subject })),
    monthlyRows: policy.monthlyRows.map((row) => ({ ...row })),
  }));
  const [subjectFilter, setSubjectFilter] = useState<number | "all">("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [spentExpenseTotal, setSpentExpenseTotal] = useState(0);
  const [rowModalOpen, setRowModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PolicyMonthlyInput | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<PolicySubject | null>(
    null,
  );
  const [contractLoading, setContractLoading] = useState(false);
  const [contractUploading, setContractUploading] = useState(false);
  const [subjectContracts, setSubjectContracts] = useState<Array<{
    policyId: number;
    subjectName: string;
    fileUrl: string;
    fileName: string;
  }>>([]);
  const contractInputRef = useRef<HTMLInputElement>(null);

  const locked = draft.status === "LOCKED";
  const canUploadContract = hasRole("saleadmin", "salesadmin", "salesadmin_la");
  const contractUrl = draft.contractFileUrl
    ? resolveApiFileUrl(draft.contractFileUrl)
    : "";
  const summary = useMemo(
    () => calculatePolicySummary(draft.monthlyRows, draft.subjects),
    [draft.monthlyRows, draft.subjects],
  );
  const equipmentPolicyTotal = useMemo(
    () => getEquipmentPolicyTotal(draft.monthlyRows),
    [draft.monthlyRows],
  );

  const months = useMemo(
    () =>
      [...new Set(draft.monthlyRows.map((row) => row.month))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [draft.monthlyRows],
  );

  const filteredRows = useMemo(() => {
    return draft.monthlyRows.filter((row) => {
      if (subjectFilter !== "all" && row.subjectId !== subjectFilter) {
        return false;
      }
      if (monthFilter && row.month !== monthFilter) return false;
      return true;
    });
  }, [draft.monthlyRows, subjectFilter, monthFilter]);

  const filteredSummary = useMemo(
    () => calculatePolicySummary(filteredRows, draft.subjects),
    [filteredRows, draft.subjects],
  );
  const tableSummary = useMemo(
    () =>
      schoolId
        ? {
            ...filteredSummary,
            totalPaid: spentExpenseTotal,
          }
        : filteredSummary,
    [filteredSummary, schoolId, spentExpenseTotal],
  );

  const nextRowId = Math.max(0, ...draft.monthlyRows.map((row) => row.id)) + 1;
  const nextSubjectId =
    Math.max(0, ...draft.subjects.map((subject) => subject.id)) + 1;

  useEffect(() => {
    setDraft({
      ...policy,
      subjects: policy.subjects.map((subject) => ({ ...subject })),
      monthlyRows: policy.monthlyRows.map((row) => ({ ...row })),
    });
  }, [policy]);

  useEffect(() => {
    if (!schoolId || !draft.schoolYear) return;
    let active = true;

    const loadContract = async () => {
      try {
        setContractLoading(true);
        const items = await annualPolicyApi.getAll({
          schoolId,
          schoolYear: draft.schoolYear,
        });
        const annualPolicy = items[0];
        if (!active || !annualPolicy) return;

        setDraft((current) => ({
          ...current,
          annualPolicyId: annualPolicy.id,
          contractFileUrl: annualPolicy.contractFileUrl,
          contractFileName: annualPolicy.contractFileName,
          contractUploadedByName: annualPolicy.contractUploadedByName,
          contractUploadedAt: annualPolicy.contractUploadedAt,
        }));
      } catch (error) {
        if (active) {
          toast.error(getApiErrorMessage(error, "Không thể tải hợp đồng"));
        }
      } finally {
        if (active) setContractLoading(false);
      }
    };

    loadContract();

    return () => {
      active = false;
    };
  }, [schoolId, draft.schoolYear]);

  useEffect(() => {
    setSubjectContracts([]);
    if (!schoolId || !draft.schoolYear) return;
    let active = true;

    policiesApi.getStatsBySchool({ schoolId, schoolYear: draft.schoolYear })
      .then((rows) => {
        if (!active) return;
        setSubjectContracts((Array.isArray(rows) ? rows : []).flatMap((row: any) =>
          row.contractFileUrl ? [{
            policyId: Number(row.policyId),
            subjectName: String(row.subjectName || "Môn học"),
            fileUrl: String(row.contractFileUrl),
            fileName: String(row.contractFileName || "Hợp đồng PDF"),
          }] : [],
        ));
      })
      .catch(() => {
        if (active) setSubjectContracts([]);
      });

    return () => { active = false; };
  }, [schoolId, draft.schoolYear]);

  const uploadContract = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Vui lòng chọn file PDF");
      return;
    }
    if (!draft.annualPolicyId) {
      toast.error("Chưa có yêu cầu chính sách năm để gắn hợp đồng");
      return;
    }

    try {
      setContractUploading(true);
      const updated = await annualPolicyApi.uploadContract(draft.annualPolicyId, file);
      setDraft((current) => {
        const next = {
          ...current,
          annualPolicyId: updated.id,
          contractFileUrl: updated.contractFileUrl,
          contractFileName: updated.contractFileName,
          contractUploadedByName: updated.contractUploadedByName,
          contractUploadedAt: updated.contractUploadedAt,
          updatedAt: new Date().toISOString(),
        };
        onContractUpdated?.(next);
        return next;
      });
      toast.success("Đã upload hợp đồng PDF");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể upload hợp đồng"));
    } finally {
      setContractUploading(false);
      if (contractInputRef.current) contractInputRef.current.value = "";
    }
  };

  const saveDraft = (nextDraft = draft) => {
    const saved = {
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    };
    setDraft(saved);
    onSave(saved, buildPolicyYearSavePayload(saved));
    toast.success("Đã lưu chính sách năm");
  };

  const exportRows = () => {
    const subjectMap = new Map(
      draft.subjects.map((subject) => [subject.id, subject]),
    );
    const calculatedRows = draft.monthlyRows.flatMap((row) => {
      const subject = subjectMap.get(row.subjectId);
      return subject ? [calculatePolicyRow(row, subject)] : [];
    });
    exportPolicyYearCsv(draft.schoolName, draft.schoolYear, calculatedRows);
    toast.success("Đã xuất báo cáo chính sách năm");
  };

  const handleRowSubmit = (row: PolicyMonthlyInput) => {
    setDraft((current) => {
      const exists = current.monthlyRows.some((item) => item.id === row.id);
      return {
        ...current,
        monthlyRows: exists
          ? current.monthlyRows.map((item) => (item.id === row.id ? row : item))
          : [...current.monthlyRows, row],
      };
    });
    setRowModalOpen(false);
    setEditingRow(null);
  };

  const handleSubjectSubmit = (subject: PolicySubject) => {
    setDraft((current) => {
      const exists = current.subjects.some((item) => item.id === subject.id);
      return {
        ...current,
        subjects: exists
          ? current.subjects.map((item) =>
              item.id === subject.id ? subject : item,
            )
          : [...current.subjects, subject],
      };
    });
    setSubjectModalOpen(false);
    setEditingSubject(null);
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-blue-900 px-5 py-6 text-white sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onBack}
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                aria-label="Quay lại"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                    Chính sách năm • {draft.schoolYear}
                  </p>
                  <StatusBadge status={draft.status} />
                </div>
                <h2 className="mt-2 max-w-4xl text-xl font-black leading-tight sm:text-2xl">
                  {draft.schoolName}
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-300">
                  {draft.subjects.length} môn học • {draft.monthlyRows.length}{" "}
                  dòng dữ liệu tháng
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={contractInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => uploadContract(event.target.files?.[0])}
              />
              {contractUrl && (
                <a
                  href={contractUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
                >
                  <ExternalLink size={16} />
                  Mở hợp đồng
                </a>
              )}
              {canUploadContract && (
                <button
                  type="button"
                  disabled={contractUploading || !draft.annualPolicyId}
                  onClick={() => contractInputRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {contractUploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  Upload PDF
                </button>
              )}
              <button
                type="button"
                onClick={exportRows}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
              >
                <Download size={16} />
                Xuất Excel
              </button>
              {!locked && !readOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Khóa chính sách sẽ không cho phép sửa dữ liệu. Bạn tiếp tục?",
                        )
                      ) {
                        return;
                      }
                      const lockedDraft: PolicyYear = {
                        ...draft,
                        status: "LOCKED",
                      };
                      saveDraft(lockedDraft);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-amber-950 hover:bg-amber-300"
                  >
                    <LockKeyhole size={16} />
                    Khóa chính sách
                  </button>
                  <button
                    type="button"
                    onClick={() => saveDraft()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-400"
                  >
                    <Save size={16} />
                    Lưu thay đổi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900">Hợp đồng chính sách</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {contractLoading
                  ? "Đang kiểm tra hợp đồng..."
                  : draft.contractFileName || "Chưa có hợp đồng PDF"}
              </p>
              {draft.contractUploadedAt && (
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Upload bởi {draft.contractUploadedByName || "Sales Admin"} •{" "}
                  {new Date(draft.contractUploadedAt).toLocaleString("vi-VN")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {contractUrl && (
              <a
                href={contractUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink size={16} />
                Xem PDF
              </a>
            )}
            {canUploadContract && (
              <button
                type="button"
                disabled={contractUploading || !draft.annualPolicyId}
                onClick={() => contractInputRef.current?.click()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {contractUploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {draft.contractFileUrl ? "Thay PDF" : "Upload PDF"}
              </button>
            )}
          </div>
        </div>
        {subjectContracts.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">Hợp đồng theo môn học</p>
            <div className="flex flex-wrap gap-2">
              {subjectContracts.map((contract) => (
                <a
                  key={contract.policyId}
                  href={resolveApiFileUrl(contract.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={contract.fileName}
                  className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                >
                  <FileText size={16} className="shrink-0" />
                  <span className="truncate">{contract.subjectName}: {contract.fileName}</span>
                  <ExternalLink size={14} className="shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {draft.status === "DRAFT" && !readOnly && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <School size={19} className="text-blue-600" />
            <h3 className="font-black text-slate-900">Thông tin chung</h3>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
            <label>
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Tên trường
              </span>
              <input
                value={draft.schoolName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    schoolName: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                Năm học
              </span>
              <input
                value={draft.schoolYear}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    schoolYear: event.target.value,
                  }))
                }
                placeholder="2026-2027"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </section>
      )}

      {schoolId && (
        <SpentExpenseRequestsSection
          schoolId={schoolId}
          schoolYear={draft.schoolYear}
          policyAfterTaxAmount={summary.totalPolicyAfterTax}
          equipmentInputAmount={equipmentPolicyTotal}
          onTotalChange={setSpentExpenseTotal}
        />
      )}

      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Chi tiết chính sách theo tháng
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-400">
                Dữ liệu được đồng bộ từ thông tin thu chi và cấu hình chính sách năm.
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <PolicySubjectTabs
              subjects={draft.subjects}
              value={subjectFilter}
              onChange={setSubjectFilter}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
              <Filter size={15} />
              Bộ lọc
            </div>
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-400"
            >
              <option value="">Tất cả tháng</option>
              {months.map((month) => {
                const [year, number] = month.split("-");
                return (
                  <option key={month} value={month}>
                    Tháng {number}/{year}
                  </option>
                );
              })}
            </select>
            <SearchableSelect
              value={subjectFilter === "all" ? "" : String(subjectFilter)}
              onChange={(value) => setSubjectFilter(value ? Number(value) : "all")}
              options={draft.subjects}
              placeholder="Tất cả môn học"
              searchPlaceholder="Tìm môn học…"
            />
            <span className="ml-auto text-sm font-bold text-slate-400">
              {filteredRows.length}/{draft.monthlyRows.length} dòng
            </span>
          </div>
        </div>

        <PolicyMonthlyTable
          rows={filteredRows}
          subjects={draft.subjects}
          summary={tableSummary}
          disabled={locked || readOnly}
          databaseFieldsReadonly={databaseFieldsReadonly || readOnly}
          onChange={(row) =>
            setDraft((current) => ({
              ...current,
              monthlyRows: current.monthlyRows.map((item) =>
                item.id === row.id ? row : item,
              ),
            }))
          }
          onEdit={(row) => {
            setEditingRow(row);
            setRowModalOpen(true);
          }}
          onDelete={(rowId) => {
            if (!window.confirm("Xóa dòng chi tiết tháng này?")) return;
            setDraft((current) => ({
              ...current,
              monthlyRows: current.monthlyRows.filter(
                (row) => row.id !== rowId,
              ),
            }));
          }}
        />
      </section>

      {!readOnly && <PolicyMonthlyFormModal
        open={rowModalOpen}
        row={editingRow}
        subjects={draft.subjects}
        nextId={nextRowId}
        databaseFieldsReadonly={databaseFieldsReadonly}
        onClose={() => {
          setRowModalOpen(false);
          setEditingRow(null);
        }}
        onSubmit={handleRowSubmit}
      />}
      {!readOnly && <PolicySubjectFormModal
        open={subjectModalOpen}
        subject={editingSubject}
        nextId={nextSubjectId}
        databaseFieldsReadonly={databaseFieldsReadonly}
        onClose={() => {
          setSubjectModalOpen(false);
          setEditingSubject(null);
        }}
        onSubmit={handleSubjectSubmit}
      />}
    </div>
  );
}
