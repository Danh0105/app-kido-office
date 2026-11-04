import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCheck2,
  FileWarning,
  School,
} from "lucide-react";
import {
  getCompanyUnit,
  getPolicyData,
  getPolicyId,
  hasContract,
  numberValue,
  type StatisticsPolicy,
} from "../statisticsDashboard";

type Props = {
  policies: StatisticsPolicy[];
  onOpenPolicy: (policy: StatisticsPolicy) => void;
};

type SortKey = "school" | "students" | "periods" | "companyUnit";

const PAGE_SIZE = 20;

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export default function PolicyAnalytics({ policies, onOpenPolicy }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("school");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [policies, sortKey, descending]);

  const sorted = useMemo(() => {
    const rows = [...policies];
    rows.sort((left, right) => {
      let comparison = 0;
      if (sortKey === "school") {
        comparison = String(left.schoolName || "").localeCompare(
          String(right.schoolName || ""),
          "vi"
        );
      } else if (sortKey === "students") {
        comparison =
          numberValue(left.studentCount) - numberValue(right.studentCount);
      } else if (sortKey === "periods") {
        comparison =
          numberValue(left.totalLessons) - numberValue(right.totalLessons);
      } else {
        comparison = getCompanyUnit(left) - getCompanyUnit(right);
      }
      return descending ? -comparison : comparison;
    });
    return rows;
  }, [policies, sortKey, descending]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const completeContracts = policies.filter(hasContract).length;
  const averageStudents = policies.length
    ? policies.reduce(
        (total, policy) => total + numberValue(policy.studentCount),
        0
      ) / policies.length
    : 0;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={FileCheck2}
          label="Chính sách"
          value={formatNumber(policies.length)}
          note="Trong phạm vi lọc"
          tone="blue"
        />
        <StatCard
          icon={School}
          label="Học sinh bình quân"
          value={formatNumber(averageStudents)}
          note="Trên mỗi chính sách"
          tone="emerald"
        />
        <StatCard
          icon={
            completeContracts === policies.length ? FileCheck2 : FileWarning
          }
          label="Đủ hồ sơ hợp đồng"
          value={`${completeContracts}/${policies.length}`}
          note={
            policies.length
              ? `${Math.round(
                  (completeContracts / policies.length) * 100
                )}% hoàn thiện`
              : "Chưa có dữ liệu"
          }
          tone={completeContracts === policies.length ? "teal" : "amber"}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Dữ liệu nguồn
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Chi tiết chính sách đã duyệt
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Bấm “Xem” để mở toàn bộ cơ cấu doanh thu, tiền mặt và thiết bị.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
              <ArrowDownAZ size={16} />
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="bg-transparent outline-none"
              >
                <option value="school">Tên trường</option>
                <option value="students">Số học sinh</option>
                <option value="periods">Số tiết</option>
                <option value="companyUnit">Đơn giá CTY thu</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setDescending((value) => !value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              {descending ? "Giảm dần" : "Tăng dần"}
            </button>
          </div>
        </div>

        {visible.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-5 py-3.5 text-left">Trường / địa bàn</th>
                    <th className="px-5 py-3.5 text-left">Môn học</th>
                    <th className="px-5 py-3.5 text-left">Năm học</th>
                    <th className="px-5 py-3.5 text-right">Học sinh</th>
                    <th className="px-5 py-3.5 text-right">Số tiết</th>
                    <th className="px-5 py-3.5 text-right">Học phí</th>
                    <th className="px-5 py-3.5 text-right">CTY thu</th>
                    <th className="px-5 py-3.5 text-center">Hợp đồng</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((policy, index) => {
                    const data = getPolicyData(policy);
                    const contractReady = hasContract(policy);
                    return (
                      <tr
                        key={
                          getPolicyId(policy) ||
                          `${policy.schoolId}-${policy.subjectId}-${index}`
                        }
                        className="transition hover:bg-blue-50/40"
                      >
                        <td className="px-5 py-4">
                          <p className="max-w-[260px] font-bold text-slate-900">
                            {policy.schoolName || "Chưa xác định"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[policy.wardName, policy.provinceName]
                              .filter(Boolean)
                              .join(", ") || "Chưa có địa bàn"}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700">
                          {policy.subjectName || "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {policy.schoolYear || "—"}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-blue-700">
                          {formatNumber(numberValue(policy.studentCount))}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-700">
                          {formatNumber(numberValue(policy.totalLessons))}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-700">
                          {formatNumber(numberValue(data.fee))}đ
                        </td>
                        <td
                          className={`px-5 py-4 text-right font-black ${
                            getCompanyUnit(policy) > 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {formatNumber(getCompanyUnit(policy))}đ
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                              contractReady
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {contractReady ? "Đã có" : "Còn thiếu"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenPolicy(policy)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                          >
                            <Eye size={15} /> Xem
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Hiển thị{" "}
                <strong className="text-slate-800">
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, sorted.length)}
                </strong>{" "}
                / {sorted.length} chính sách
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="min-w-[100px] text-center text-sm font-bold text-slate-700">
                  Trang {page}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-6 py-16 text-center text-sm text-slate-500">
            Không có chính sách phù hợp với bộ lọc hiện tại.
          </div>
        )}
      </section>
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
};

function StatCard({ icon: Icon, label, value, note, tone }: any) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONES[tone]}`}
        >
          <Icon size={21} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{note}</p>
        </div>
      </div>
    </article>
  );
}
