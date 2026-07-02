import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { MOCK_POLICY_SUBJECTS, MOCK_POLICY_YEARS } from "./mockData";
import { PolicyYear, PolicyYearStatus } from "./types";
import {
  calculatePolicyRow,
  calculatePolicySummary,
  exportPolicyYearCsv,
  exportPolicyYearsCsv,
  formatCurrency,
} from "./utils";
import StatusBadge from "./components/StatusBadge";
import PolicyYearDetailPage from "./PolicyYearDetailPage";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { revenueItemApi } from "@/service/revenueItem";
import { getApiErrorMessage } from "@/utils/apiError";

type PolicyYearListPageProps = {
  schoolId?: number | null;
  schoolName?: string;
  schoolYear?: string;
  databaseSubjects?: any[];
};

const listFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const mapDatabaseSubjects = (subjects: any[]) =>
  subjects.map((subject, index) => {
    const policyData = subject?.policies?.[0]?.data || {};
    const fallback = MOCK_POLICY_SUBJECTS[index] || MOCK_POLICY_SUBJECTS[0];

    return {
      id: Number(subject.id),
      code: subject.code || `MON-${subject.id}`,
      name: subject.name || `Môn ${subject.id}`,
      tuitionPrice: Number(policyData.fee ?? fallback?.tuitionPrice ?? 0),
      schoolRetainUnit: Number(
        policyData.schoolRetainUnit ?? fallback?.schoolRetainUnit ?? 0,
      ),
      policyTotalAmount: Number(
        policyData.policyTotalAmount ?? fallback?.policyTotalAmount ?? 0,
      ),
      policyStudentBase: Number(
        policyData.policyStudentBase ?? fallback?.policyStudentBase ?? 1000,
      ),
      policyMonthBase: Number(
        policyData.policyMonthBase ?? fallback?.policyMonthBase ?? 9,
      ),
      taxPercent: Number(
        policyData.taxPercent ?? fallback?.taxPercent ?? 10,
      ),
    };
  });

const getRecordPeriod = (record: any) =>
  record?.period || record?.expensePeriod || {};

const isPeriodInSchoolYear = (
  month: number,
  year: number,
  schoolYear?: string,
) => {
  if (!schoolYear) return true;
  const years = schoolYear.match(/\d{4}/g)?.map(Number) || [];
  if (!years.length) return true;
  const startYear = years[0];
  const endYear = years[1] || startYear + 1;
  return month >= 8 ? year === startYear : year === endYear;
};

const clonePolicies = (
  schoolName?: string,
  schoolYear?: string,
  databaseMode = false,
) => {
  const sourcePolicies = schoolName
    ? [
        {
          ...MOCK_POLICY_YEARS[0],
          schoolName,
          schoolYear: schoolYear || MOCK_POLICY_YEARS[0].schoolYear,
        },
      ]
    : MOCK_POLICY_YEARS;
  const startYear = Number(schoolYear?.match(/\d{4}/)?.[0] || 0);

  return sourcePolicies.map((policy) => ({
      ...policy,
      subjects: policy.subjects.map((subject) => ({ ...subject })),
      monthlyRows: databaseMode
        ? []
        : policy.monthlyRows.map((row) => ({
            ...row,
            month: startYear
              ? row.month.replace(/^\d{4}/, String(startYear))
              : row.month,
          })),
    }));
};

export default function PolicyYearListPage({
  schoolId,
  schoolName,
  schoolYear: scopedSchoolYear,
  databaseSubjects = [],
}: PolicyYearListPageProps) {
  const [policies, setPolicies] = useState<PolicyYear[]>(() =>
    clonePolicies(schoolName, scopedSchoolYear, Boolean(schoolId)),
  );
  const [activePolicyId, setActivePolicyId] = useState<number | null>(
    schoolName ? MOCK_POLICY_YEARS[0].id : null,
  );
  const [keyword, setKeyword] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [status, setStatus] = useState<PolicyYearStatus | "">("");
  const [databaseLoading, setDatabaseLoading] = useState(Boolean(schoolId));
  const [databaseError, setDatabaseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!schoolId) return;
    let active = true;

    const loadDatabaseRows = async () => {
      try {
        setDatabaseLoading(true);
        setDatabaseError("");

        const response = await schoolExpenseApi.getAll({
          page: 1,
          limit: 500,
          schoolId,
        });
        const records = listFromResponse(response).filter((record) => {
          const recordSchoolId = Number(
            record?.schoolId || record?.school?.id || 0,
          );
          return !recordSchoolId || recordSchoolId === Number(schoolId);
        });
        const rows = (
          await Promise.all(
            records.map(async (record, recordIndex) => {
              const period = getRecordPeriod(record);
              const month = Number(period?.month || 0);
              const year = Number(period?.year || 0);

              if (
                !record?.id ||
                !month ||
                !year ||
                !isPeriodInSchoolYear(month, year, scopedSchoolYear)
              ) {
                return [];
              }

              let revenueItems: any[] = [];
              try {
                revenueItems = listFromResponse(
                  await revenueItemApi.getAll({
                    schoolExpenseId: Number(record.id),
                  }),
                );
              } catch {
                revenueItems = [];
              }

              return revenueItems.flatMap((item: any, itemIndex: number) => {
                const subjectId = Number(
                  item?.subjectId || item?.subject?.id || 0,
                );
                if (!subjectId) return [];

                return [
                  {
                    id:
                      Number(item?.id || 0) ||
                      (recordIndex + 1) * 1000 + itemIndex,
                    subjectId,
                    month: `${year}-${String(month).padStart(2, "0")}`,
                    studentCount: Number(item?.studentCount || 0),
                    unitPrice: Number(item?.unitPrice || 0),
                    monthsCount: Number(item?.monthsCount ?? 1),
                    principalPolicyAmount: 0,
                    cashPolicyAmount: 0,
                    equipmentPolicyAmount: 0,
                    paidCashAmount: 0,
                    paidEquipmentAmount: 0,
                    note: item?.note || item?.content || "",
                  },
                ];
              });
            }),
          )
        ).flat();
        const mappedSubjects = mapDatabaseSubjects(databaseSubjects);

        if (active) {
          setPolicies((current) =>
            current.map((policy) =>
              policy.id === MOCK_POLICY_YEARS[0].id
                ? {
                    ...policy,
                    schoolName: schoolName || policy.schoolName,
                    schoolYear: scopedSchoolYear || policy.schoolYear,
                    subjects: mappedSubjects,
                    monthlyRows: rows,
                  }
                : policy,
            ),
          );
        }
      } catch (error: any) {
        if (active) {
          setDatabaseError(
            getApiErrorMessage(
              error,
              "Không thể tải dữ liệu thu chi từ database",
            ),
          );
        }
      } finally {
        if (active) setDatabaseLoading(false);
      }
    };

    loadDatabaseRows();

    return () => {
      active = false;
    };
  }, [
    schoolId,
    schoolName,
    scopedSchoolYear,
    databaseSubjects,
  ]);

  const activePolicy = policies.find((policy) => policy.id === activePolicyId);
  const schoolYears = [...new Set(policies.map((policy) => policy.schoolYear))];
  const filteredPolicies = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("vi");

    return policies.filter((policy) => {
      if (
        normalizedKeyword &&
        !policy.schoolName.toLocaleLowerCase("vi").includes(normalizedKeyword)
      ) {
        return false;
      }
      if (schoolYear && policy.schoolYear !== schoolYear) return false;
      if (status && policy.status !== status) return false;
      return true;
    });
  }, [policies, keyword, schoolYear, status]);

  const exportOne = (policy: PolicyYear) => {
    const subjectMap = new Map(
      policy.subjects.map((subject) => [subject.id, subject]),
    );
    const rows = policy.monthlyRows.flatMap((row) => {
      const subject = subjectMap.get(row.subjectId);
      return subject ? [calculatePolicyRow(row, subject)] : [];
    });
    exportPolicyYearCsv(policy.schoolName, policy.schoolYear, rows);
    toast.success("Đã xuất báo cáo chính sách năm");
  };

  if (schoolId && databaseLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2
            size={34}
            className="mx-auto animate-spin text-blue-600"
          />
          <p className="mt-3 font-bold text-slate-600">
            Đang tải dữ liệu thu chi từ database...
          </p>
        </div>
      </div>
    );
  }

  if (schoolId && databaseError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle size={34} className="mx-auto text-rose-500" />
        <p className="mt-3 font-black text-rose-700">
          Không thể tải chính sách năm
        </p>
        <p className="mt-1 text-sm font-semibold text-rose-600">
          {databaseError}
        </p>
      </div>
    );
  }

  if (activePolicy) {
    return (
      <PolicyYearDetailPage
        policy={activePolicy}
        databaseFieldsReadonly={Boolean(schoolId)}
        onBack={() => setActivePolicyId(null)}
        onSave={(savedPolicy) =>
          setPolicies((current) =>
            current.map((policy) =>
              policy.id === savedPolicy.id ? savedPolicy : policy,
            ),
          )
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 px-5 py-6 text-white sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-100">
                <FileSpreadsheet size={19} />
                <p className="text-xs font-black uppercase tracking-[0.2em]">
                  Quản trị tài chính
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Quản lý chính sách năm
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium text-blue-100">
                Quản lý doanh thu, chính sách phải chi và tình hình thanh toán
                theo trường, năm học, môn học và từng tháng.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  toast.success(`Đã nhận file ${file.name} để nhập dữ liệu mẫu`);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
              >
                <FileUp size={16} />
                Import Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  exportPolicyYearsCsv(filteredPolicies);
                  toast.success("Đã xuất báo cáo tổng hợp");
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
              >
                <FileDown size={16} />
                Xuất báo cáo
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextId =
                    Math.max(0, ...policies.map((policy) => policy.id)) + 1;
                  const newPolicy: PolicyYear = {
                    id: nextId,
                    schoolName: schoolName || "CHÍNH SÁCH NĂM MỚI",
                    schoolYear: scopedSchoolYear || "2026-2027",
                    status: "DRAFT",
                    subjects: MOCK_POLICY_SUBJECTS.slice(0, 2).map(
                      (subject) => ({ ...subject }),
                    ),
                    monthlyRows: [],
                    updatedAt: new Date().toISOString(),
                  };
                  setPolicies((current) => [newPolicy, ...current]);
                  setActivePolicyId(nextId);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50"
              >
                <Plus size={16} />
                Thêm chính sách năm
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(260px,1fr)_220px_220px]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm kiếm theo tên trường..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
            />
          </label>
          <select
            value={schoolYear}
            onChange={(event) => setSchoolYear(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="">Tất cả năm học</option>
            {schoolYears.map((item) => (
              <option key={item} value={item}>
                Năm học {item}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PolicyYearStatus | "")
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="LOCKED">Đã khóa</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-black text-slate-900">
              Danh sách chính sách năm
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              {filteredPolicies.length} kết quả
            </p>
          </div>
          {(keyword || schoolYear || status) && (
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                setSchoolYear("");
                setStatus("");
              }}
              className="text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1680px] w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-xs font-black uppercase tracking-wide text-white">
                <th className="px-4 py-3 text-center">STT</th>
                <th className="min-w-[300px] px-4 py-3 text-left">Trường</th>
                <th className="px-4 py-3 text-center">Năm học</th>
                <th className="px-4 py-3 text-right">Tổng HS</th>
                <th className="px-4 py-3 text-right">Tổng doanh thu</th>
                <th className="px-4 py-3 text-right">Để lại trường</th>
                <th className="px-4 py-3 text-right">Công ty nhận</th>
                <th className="px-4 py-3 text-right">Tổng chính sách</th>
                <th className="px-4 py-3 text-right">Đã chi</th>
                <th className="px-4 py-3 text-right">Còn lại chi</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.map((policy, index) => {
                const summary = calculatePolicySummary(
                  policy.monthlyRows,
                  policy.subjects,
                );

                return (
                  <tr
                    key={policy.id}
                    className="border-b border-slate-100 transition hover:bg-blue-50/40"
                  >
                    <td className="px-4 py-4 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setActivePolicyId(policy.id)}
                        className="text-left"
                      >
                        <p className="font-black leading-snug text-slate-800 hover:text-blue-700">
                          {policy.schoolName}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {policy.subjects.length} môn • cập nhật{" "}
                          {new Date(policy.updatedAt).toLocaleDateString(
                            "vi-VN",
                          )}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-600">
                      {policy.schoolYear}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-700">
                      {formatCurrency(summary.totalStudents)}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-emerald-700">
                      {formatCurrency(summary.totalRevenue)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-blue-700">
                      {formatCurrency(summary.totalSchoolRetain)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-violet-700">
                      {formatCurrency(summary.totalCompanyPayment)}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-orange-700">
                      {formatCurrency(
                        Math.round(summary.totalPolicyAfterTax),
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-slate-700">
                      {formatCurrency(summary.totalPaid)}
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-black ${
                        summary.totalRemaining > 0
                          ? "text-rose-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {formatCurrency(Math.round(summary.totalRemaining))}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StatusBadge status={policy.status} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setActivePolicyId(policy.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                          title="Xem chi tiết"
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActivePolicyId(policy.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                          title="Sửa"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => exportOne(policy)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                          title="Xuất Excel"
                        >
                          <Download size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPolicies.length === 0 && (
          <div className="py-16 text-center">
            <Search size={34} className="mx-auto text-slate-300" />
            <p className="mt-3 font-bold text-slate-500">
              Không tìm thấy chính sách năm
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Hãy thử thay đổi từ khóa hoặc bộ lọc.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
