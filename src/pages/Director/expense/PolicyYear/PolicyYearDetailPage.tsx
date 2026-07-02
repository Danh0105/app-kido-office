import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Filter,
  LockKeyhole,
  Plus,
  Save,
  School,
  Settings2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { PolicyMonthlyInput, PolicySubject, PolicyYear } from "./types";
import {
  calculatePolicyRow,
  calculatePolicySummary,
  exportPolicyYearCsv,
} from "./utils";
import PolicySummaryCards from "./components/PolicySummaryCards";
import PolicySubjectTabs from "./components/PolicySubjectTabs";
import PolicySubjectConfigCard from "./components/PolicySubjectConfigCard";
import PolicyMonthlyTable from "./components/PolicyMonthlyTable";
import PolicyMonthlyFormModal from "./components/PolicyMonthlyFormModal";
import PolicySubjectFormModal from "./components/PolicySubjectFormModal";
import StatusBadge from "./components/StatusBadge";

type PolicyYearDetailPageProps = {
  policy: PolicyYear;
  databaseFieldsReadonly?: boolean;
  onBack: () => void;
  onSave: (policy: PolicyYear) => void;
};

export default function PolicyYearDetailPage({
  policy,
  databaseFieldsReadonly = false,
  onBack,
  onSave,
}: PolicyYearDetailPageProps) {
  const [draft, setDraft] = useState<PolicyYear>(() => ({
    ...policy,
    subjects: policy.subjects.map((subject) => ({ ...subject })),
    monthlyRows: policy.monthlyRows.map((row) => ({ ...row })),
  }));
  const [subjectFilter, setSubjectFilter] = useState<number | "all">("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const [rowModalOpen, setRowModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PolicyMonthlyInput | null>(null);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<PolicySubject | null>(
    null,
  );

  const locked = draft.status === "LOCKED";
  const summary = useMemo(
    () => calculatePolicySummary(draft.monthlyRows, draft.subjects),
    [draft.monthlyRows, draft.subjects],
  );

  const months = useMemo(
    () =>
      [...new Set(draft.monthlyRows.map((row) => row.month))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [draft.monthlyRows],
  );

  const filteredRows = useMemo(() => {
    const subjectMap = new Map(
      draft.subjects.map((subject) => [subject.id, subject]),
    );

    return draft.monthlyRows.filter((row) => {
      if (subjectFilter !== "all" && row.subjectId !== subjectFilter) {
        return false;
      }
      if (monthFilter && row.month !== monthFilter) return false;
      if (onlyRemaining) {
        const subject = subjectMap.get(row.subjectId);
        if (!subject || calculatePolicyRow(row, subject).remainingAmount <= 0) {
          return false;
        }
      }
      return true;
    });
  }, [
    draft.monthlyRows,
    draft.subjects,
    subjectFilter,
    monthFilter,
    onlyRemaining,
  ]);

  const filteredSummary = useMemo(
    () => calculatePolicySummary(filteredRows, draft.subjects),
    [filteredRows, draft.subjects],
  );

  const nextRowId = Math.max(0, ...draft.monthlyRows.map((row) => row.id)) + 1;
  const nextSubjectId =
    Math.max(0, ...draft.subjects.map((subject) => subject.id)) + 1;

  const saveDraft = (nextDraft = draft) => {
    const saved = {
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    };
    setDraft(saved);
    onSave(saved);
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
              <button
                type="button"
                onClick={exportRows}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
              >
                <Download size={16} />
                Xuất Excel
              </button>
              {!locked && (
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

      {draft.status === "DRAFT" && (
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

      <PolicySummaryCards summary={summary} />

      <section className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Chi tiết chính sách theo tháng
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-400">
                Nhập trực tiếp trên bảng hoặc dùng biểu mẫu thêm dòng.
              </p>
            </div>
            <button
              type="button"
              disabled={
                locked || databaseFieldsReadonly || draft.subjects.length === 0
              }
              onClick={() => {
                setEditingRow(null);
                setRowModalOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Thêm dòng
            </button>
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
            <select
              value={subjectFilter}
              onChange={(event) =>
                setSubjectFilter(
                  event.target.value === "all"
                    ? "all"
                    : Number(event.target.value),
                )
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-400"
            >
              <option value="all">Tất cả môn học</option>
              {draft.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600">
              <input
                type="checkbox"
                checked={onlyRemaining}
                onChange={(event) => setOnlyRemaining(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-rose-600"
              />
              Chỉ xem còn lại chi &gt; 0
            </label>
            <span className="ml-auto text-sm font-bold text-slate-400">
              {filteredRows.length}/{draft.monthlyRows.length} dòng
            </span>
          </div>
        </div>

        <PolicyMonthlyTable
          rows={filteredRows}
          subjects={draft.subjects}
          summary={filteredSummary}
          disabled={locked}
          databaseFieldsReadonly={databaseFieldsReadonly}
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

      <PolicyMonthlyFormModal
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
      />
      <PolicySubjectFormModal
        open={subjectModalOpen}
        subject={editingSubject}
        nextId={nextSubjectId}
        databaseFieldsReadonly={databaseFieldsReadonly}
        onClose={() => {
          setSubjectModalOpen(false);
          setEditingSubject(null);
        }}
        onSubmit={handleSubjectSubmit}
      />
    </div>
  );
}
