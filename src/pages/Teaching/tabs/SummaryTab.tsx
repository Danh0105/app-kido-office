import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type {
  AttendanceGrandTotal,
  AttendanceSummaryRow,
  Teacher,
} from "@/types/teaching";

import {
  EmptyState,
  FilterCard,
  Loading,
  selectClass,
} from "../components/Shared";
import SearchableSelect from "@/components/SearchableSelect";
import ClassSelect from "../components/ClassSelect";
import {
  useClassesOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import type { AttendanceFilter } from "./AttendanceTab";
import type { TravelReviewFilter } from "./TravelReviewTab";
import {
  endOfMonth,
  endOfWeek,
  formatMoney,
  isDateOrderValid,
  startOfMonth,
  startOfWeek,
  TEACHER_COLLABORATOR_ROLE,
  TEACHER_STAFF_ROLE,
  todayISO,
} from "../lib";

/** 12 tháng gần nhất để chọn nhanh, mới nhất trước. */
const RECENT_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { value, label: `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` };
});

/** Bộ lọc hiện cả lớp đã ngừng dùng — lớp cũ vẫn còn buổi dạy để xem tổng hợp. */
const ALL_CLASSES = { activeOnly: false };

type Props = {
  teachers: Teacher[];
  schools: RefOption[];
  /** Click vào ô số → mở tab chấm công với bộ lọc tương ứng. */
  onDrillDown: (filter: AttendanceFilter) => void;
  /** Click vào số km → mở lộ trình di chuyển chi tiết. */
  onReviewTravel?: (filter: TravelReviewFilter) => void;
};

export default function SummaryTab({
  teachers,
  schools,
  onDrillDown,
  onReviewTravel,
}: Props) {
  const [fromDate, setFromDate] = useState(startOfWeek(todayISO()));
  const [toDate, setToDate] = useState(endOfWeek(todayISO()));
  const [teacherId, setTeacherId] = useState("");
  const [teacherRole, setTeacherRole] = useState<
    "" | typeof TEACHER_STAFF_ROLE | typeof TEACHER_COLLABORATOR_ROLE
  >("");
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");

  const [rows, setRows] = useState<AttendanceSummaryRow[]>([]);
  // Tiền công do backend cộng — FE không tự cộng lại để hai bên không lệch nhau.
  const [grandTotal, setGrandTotal] = useState<AttendanceGrandTotal | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const { classes, loading: loadingClasses } = useClassesOfSchool(
    schoolId,
    ALL_CLASSES,
  );

  // Đổi trường → bỏ lớp đang lọc (lớp thuộc về trường).
  const changeSchool = (value: string) => {
    setSchoolId(value);
    setClassId("");
  };

  const rangeValid = isDateOrderValid(fromDate, toDate);

  // Chọn nhanh cả tháng → set luôn khoảng ngày; chỉ để lọc nhanh, không giữ
  // trạng thái riêng vì fromDate/toDate mới là nguồn sự thật gọi API.
  const changeMonth = (value: string) => {
    if (!value) return;
    setFromDate(startOfMonth(`${value}-01`));
    setToDate(endOfMonth(`${value}-01`));
  };

  const load = useCallback(async () => {
    if (!fromDate || !toDate || !rangeValid) return;

    setLoading(true);
    try {
      const res = await teachingSessionApi.summary({
        fromDate,
        toDate,
        teacherRole: teacherRole || undefined,
        teacherId: teacherId ? Number(teacherId) : undefined,
        schoolId: schoolId ? Number(schoolId) : undefined,
        classId: classId ? Number(classId) : undefined,
      });
      setRows(res?.data || []);
      setGrandTotal(res?.grandTotal || null);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không tải được bảng tổng hợp"));
      }
      setRows([]);
      setGrandTotal(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, teacherRole, teacherId, schoolId, classId, rangeValid]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Ô số bấm được để mở tab Chấm công với đúng bộ lọc.
   * `tabular-nums` cho các cột số thẳng hàng khi đọc dọc theo cột.
   */
  const cell = (
    value: number,
    filter: AttendanceFilter,
    className = "text-gray-800",
  ) => (
    <button
      onClick={() => value > 0 && onDrillDown({ ...filter, fromDate, toDate })}
      disabled={value === 0}
      className={`text-lg font-bold tabular-nums leading-none ${
        value > 0
          ? `${className} underline decoration-dotted underline-offset-4 hover:opacity-70`
          : "text-gray-300"
      }`}
    >
      {value.toLocaleString("vi-VN")}
    </button>
  );

  /** Số không bấm được (tiết, tiền) — cùng cỡ chữ với `cell` cho đều hàng. */
  const num = (value: number, className = "text-gray-800") => (
    <span
      className={`text-lg font-bold tabular-nums ${
        value ? className : "text-gray-300"
      }`}
    >
      {value.toLocaleString("vi-VN")}
    </span>
  );

  /** Số km bấm được → xem lộ trình từng ngày (cả bảng hoặc 1 giáo viên). */
  const kmDetail = (
    value: number,
    teacher: AttendanceSummaryRow | undefined,
    className: string,
  ) => (
    <button
      type="button"
      disabled={value <= 0 || !onReviewTravel}
      onClick={() =>
        onReviewTravel?.({ fromDate, toDate, teacherId: teacher?.teacherId })
      }
      title={value > 0 ? "Xem lộ trình di chuyển" : undefined}
      className={`tabular-nums ${className} ${
        value > 0 && onReviewTravel
          ? "underline decoration-dotted underline-offset-4 hover:opacity-70"
          : ""
      }`}
    >
      {value.toLocaleString("vi-VN")} km
    </button>
  );

  const costDetail = (value: number, teacher?: AttendanceSummaryRow) => (
    <button
      type="button"
      disabled={value <= 0}
      onClick={() =>
        value > 0 &&
        onDrillDown({
          ...(teacher ? { teacherId: teacher.teacherId } : {}),
          status: "PRESENT",
          fromDate,
          toDate,
        })
      }
      title={value > 0 ? "Xem các buổi có chi phí khác" : undefined}
      className={`font-semibold tabular-nums ${
        value > 0
          ? "text-blue-700 underline decoration-dotted underline-offset-4 hover:opacity-70"
          : "text-gray-300"
      }`}
    >
      {formatMoney(value)}
    </button>
  );

  /** Sáu ô đếm buổi — dùng chung cho thẻ mobile và bảng desktop. */
  const counters = (row: AttendanceSummaryRow) => [
    {
      key: "total",
      label: "Tổng buổi",
      node: cell(row.totalSessions, { teacherId: row.teacherId }),
    },
    {
      key: "present",
      label: "Có dạy",
      node: cell(
        row.present,
        { teacherId: row.teacherId, status: "PRESENT" },
        "text-green-700",
      ),
    },
    {
      key: "absent",
      label: "Vắng",
      node: cell(
        row.absent,
        { teacherId: row.teacherId, status: "ABSENT" },
        "text-red-600",
      ),
    },
    {
      key: "cancelled",
      label: "Huỷ",
      node: cell(
        row.cancelled,
        { teacherId: row.teacherId, status: "CANCELLED" },
        "text-gray-600",
      ),
    },
    {
      key: "unchecked",
      label: "Chưa chấm",
      node: cell(
        row.unchecked,
        { teacherId: row.teacherId, unchecked: true },
        "text-blue-700",
      ),
    },
    {
      key: "makeup",
      label: "Dạy bù",
      node: cell(
        row.makeup,
        { teacherId: row.teacherId, onlyMakeup: true },
        "text-purple-700",
      ),
    },
  ];

  const total = rows.reduce(
    (acc, row) => ({
      totalSessions: acc.totalSessions + row.totalSessions,
      present: acc.present + row.present,
      absent: acc.absent + row.absent,
      cancelled: acc.cancelled + row.cancelled,
      unchecked: acc.unchecked + row.unchecked,
      makeup: acc.makeup + row.makeup,
      // `?? 0`: backend cũ chưa trả nhóm field tiền công — cộng undefined ra NaN.
      totalPeriods: acc.totalPeriods + (row.totalPeriods ?? 0),
      totalDistanceKm: acc.totalDistanceKm + (row.totalDistanceKm ?? 0),
    }),
    {
      totalSessions: 0,
      present: 0,
      absent: 0,
      cancelled: 0,
      unchecked: 0,
      makeup: 0,
      totalPeriods: 0,
      totalDistanceKm: 0,
    },
  );

  // Buổi đã dạy nhưng chưa khai đơn giá = bảng công còn thiếu tiền, phải báo
  // trước khi Nhân sự chốt lương.
  const missingRate = grandTotal?.missingRateSessions || 0;

  return (
    <div className="space-y-3">
      <FilterCard>
        <div className="flex gap-2 items-center md:col-span-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
          />
        </div>

        <select
          defaultValue=""
          onChange={(e) => changeMonth(e.target.value)}
          className={selectClass}
          title="Chọn nhanh cả tháng"
        >
          <option value="" disabled>
            Chọn nhanh theo tháng…
          </option>
          {RECENT_MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {!rangeValid && (
          <p className="text-xs text-red-500 md:col-span-4">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc
          </p>
        )}

        <div className="flex gap-2 md:contents">
          <select
            value={teacherRole}
            onChange={(event) => {
              setTeacherRole(event.target.value as typeof teacherRole);
              setTeacherId("");
            }}
            className={`flex-1 min-w-0 ${selectClass}`}
          >
            <option value="">Tất cả loại giáo viên</option>
            <option value={TEACHER_STAFF_ROLE}>Giáo viên công ty</option>
            <option value={TEACHER_COLLABORATOR_ROLE}>
              Giáo viên cộng tác viên
            </option>
          </select>

          <SearchableSelect
            value={teacherId}
            onChange={setTeacherId}
            options={teachers}
            placeholder="Tất cả giáo viên"
            searchPlaceholder="Tìm giáo viên…"
            className="flex-1 min-w-0"
          />

          <SearchableSelect
            value={schoolId}
            onChange={changeSchool}
            options={schools}
            placeholder="Tất cả trường"
            searchPlaceholder="Tìm trường…"
            className="flex-1 min-w-0"
          />

          <ClassSelect
            value={classId}
            onChange={setClassId}
            classes={classes}
            loading={loadingClasses}
            schoolPicked={!!schoolId}
            placeholder="Tất cả lớp"
            className={`flex-1 min-w-0 ${selectClass}`}
          />
        </div>
      </FilterCard>

      {loading && <Loading />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="📊"
          title="Chưa có dữ liệu công trong khoảng này"
          description="Chọn khoảng ngày khác hoặc kiểm tra lại bộ lọc giáo viên / trường."
        />
      )}

      {/* Con số cần nhìn đầu tiên: tổng tiền phải trả của cả bảng. */}
      {!loading && rows.length > 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
            <Money label="Tiền tiết dạy" value={grandTotal?.payableAmount ?? 0} />
            <Money label="Phụ cấp xăng" value={grandTotal?.fuelAllowanceAmount ?? 0} />
            <div>
              <p className="text-[11px] font-medium text-emerald-800">Số km</p>
              <p className="text-lg font-bold leading-tight text-emerald-700">
                {kmDetail(grandTotal?.totalDistanceKm ?? 0, undefined, "")}
              </p>
            </div>
            <Money label="Chi phí khác" value={grandTotal?.otherCostsAmount ?? 0} />
            <Money label="Tổng thanh toán" value={grandTotal?.totalPayableAmount ?? 0} primary />
          </div>
          <p className="text-sm text-gray-600">
            <b className="text-gray-800">{rows.length}</b> giáo viên ·{" "}
            <b className="text-gray-800">
              {(grandTotal?.payablePeriods ?? 0).toLocaleString("vi-VN")}
            </b>{" "}
            tiết tính công / {total.totalPeriods.toLocaleString("vi-VN")} tiết
          </p>
        </div>
      )}

      {!loading && missingRate > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
          <b>{missingRate} buổi đã dạy chưa khai đơn giá</b> — số tiền trên đang
          thiếu phần này. Khai đơn giá cho giáo viên hoặc sửa từng buổi trước
          khi chốt lương.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <>
          {/* Mobile: mỗi giáo viên một thẻ — nhồi 10 cột vào màn hẹp thì chữ
              phải thu nhỏ tới mức không đọc được. */}
          <div className="space-y-2 md:hidden">
            {rows.map((row) => (
              <div
                key={row.teacherId}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-bold leading-snug text-gray-900">
                    {row.teacherName}
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-bold leading-none text-emerald-700 tabular-nums">{formatMoney(row.totalPayableAmount ?? 0)}</p>
                    <p className="mt-1 text-[11px] text-gray-500">Tiết {formatMoney(row.payableAmount ?? 0)}</p>
                    <p className="mt-1 text-[11px] text-gray-500">Xăng {formatMoney(row.fuelAllowanceAmount ?? 0)}</p>
                    {(row.totalDistanceKm ?? 0) > 0 && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        {kmDetail(row.totalDistanceKm, row, "")}
                      </p>
                    )}
                    <div className="mt-1 text-[11px]">Chi phí khác: {costDetail(row.otherCostsAmount ?? 0, row)}</div>
                    <p className="mt-1 text-xs text-gray-500">
                      {(row.payablePeriods ?? 0).toLocaleString("vi-VN")}/
                      {(row.totalPeriods ?? 0).toLocaleString("vi-VN")} tiết
                      tính công
                    </p>
                  </div>
                </div>

                {row.missingRateSessions > 0 && (
                  <p className="mt-2 text-xs font-medium text-amber-600">
                    {row.missingRateSessions} buổi chưa khai đơn giá
                  </p>
                )}

                <div className="mt-3 grid grid-cols-3 gap-y-3 border-t border-gray-100 pt-3">
                  {counters(row).map((item) => (
                    <div key={item.key} className="text-center">
                      {item.node}
                      <p className="mt-1 text-[11px] text-gray-500">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-base font-bold text-gray-900">
                  Tổng cộng {rows.length} giáo viên
                </p>
                <p className="text-xl font-bold leading-none text-emerald-700 tabular-nums">
                  {formatMoney(grandTotal?.totalPayableAmount ?? 0)}
                </p>
              </div>
              <div className="mt-2 text-right text-xs text-gray-600">
                Tiền tiết: {formatMoney(grandTotal?.payableAmount ?? 0)} · Xăng: {formatMoney(grandTotal?.fuelAllowanceAmount ?? 0)} · {(grandTotal?.totalDistanceKm ?? 0).toLocaleString("vi-VN")} km · Chi phí khác: {costDetail(grandTotal?.otherCostsAmount ?? 0)}
              </div>
            </div>
          </div>

          {/* Desktop: tiêu đề 2 tầng để tách rõ "đếm buổi" và "tiền". */}
          <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table
                className="w-full whitespace-nowrap"
                style={{ minWidth: 1080 }}
              >
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th
                      rowSpan={2}
                      className="px-4 py-3 text-left text-sm font-bold text-slate-700"
                    >
                      Giáo viên
                    </th>
                    <th
                      colSpan={6}
                      className="border-l border-slate-200 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider"
                    >
                      Buổi dạy
                    </th>
                    <th
                      colSpan={7}
                      className="border-l border-slate-200 bg-emerald-50 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-emerald-800"
                    >
                      Công &amp; tiền
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-600">
                    {[
                      "Tổng buổi",
                      "Có dạy",
                      "Vắng",
                      "Huỷ",
                      "Chưa chấm",
                      "Dạy bù",
                    ].map((label, index) => (
                      <th
                        key={label}
                        className={`px-4 py-2 text-right text-sm font-semibold ${
                          index === 0 ? "border-l border-slate-200" : ""
                        }`}
                      >
                        {label}
                      </th>
                    ))}
                    <th className="border-l border-slate-200 bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Tổng tiết
                    </th>
                    <th className="bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Tiết tính công
                    </th>
                    <th className="bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Tiền tiết dạy
                    </th>
                    <th className="bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Phụ cấp xăng
                    </th>
                    <th className="bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Số km
                    </th>
                    <th className="bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Chi phí khác
                    </th>
                    <th className="bg-emerald-50/60 px-4 py-2 text-right text-sm font-semibold text-emerald-900">
                      Tổng thanh toán
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.teacherId}
                      className="border-t border-slate-100 hover:bg-blue-50/60"
                    >
                      <td className="px-4 py-4 text-base font-semibold text-gray-900">
                        {row.teacherName}
                      </td>
                      {counters(row).map((item, index) => (
                        <td
                          key={item.key}
                          className={`px-4 py-4 text-right ${
                            index === 0 ? "border-l border-slate-100" : ""
                          }`}
                        >
                          {item.node}
                        </td>
                      ))}
                      <td className="border-l border-slate-100 bg-emerald-50/30 px-4 py-4 text-right">
                        {num(row.totalPeriods ?? 0, "text-gray-600")}
                      </td>
                      <td className="bg-emerald-50/30 px-4 py-4 text-right">
                        {num(row.payablePeriods ?? 0)}
                      </td>
                      <td className="bg-emerald-50/30 px-4 py-4 text-right">
                        <span className="text-lg font-bold tabular-nums text-emerald-700">
                          {(row.payableAmount ?? 0).toLocaleString("vi-VN")} ₫
                        </span>
                        {/* Thiếu giá thì con số bên trên chưa phải tiền thật. */}
                        {row.missingRateSessions > 0 && (
                          <span className="mt-0.5 block text-xs font-medium text-amber-600">
                            thiếu giá {row.missingRateSessions} buổi
                          </span>
                        )}
                      </td>
                      <td className="bg-emerald-50/30 px-4 py-4 text-right font-semibold text-emerald-700">{formatMoney(row.fuelAllowanceAmount ?? 0)}</td>
                      <td className="bg-emerald-50/30 px-4 py-4 text-right">
                        {kmDetail(
                          row.totalDistanceKm ?? 0,
                          row,
                          `text-lg font-bold ${(row.totalDistanceKm ?? 0) ? "text-gray-600" : "text-gray-300"}`,
                        )}
                      </td>
                      <td className="bg-emerald-50/30 px-4 py-4 text-right">{costDetail(row.otherCostsAmount ?? 0, row)}</td>
                      <td className="bg-emerald-50/30 px-4 py-4 text-right font-bold text-emerald-700">{formatMoney(row.totalPayableAmount ?? 0)}</td>
                    </tr>
                  ))}

                  <tr className="border-t-2 border-slate-300 bg-slate-100">
                    <td className="px-4 py-4 text-base font-bold text-gray-900">
                      Tổng cộng
                    </td>
                    <td className="border-l border-slate-200 px-4 py-4 text-right">
                      {num(total.totalSessions)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {num(total.present, "text-green-700")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {num(total.absent, "text-red-600")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {num(total.cancelled, "text-gray-600")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {num(total.unchecked, "text-blue-700")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {num(total.makeup, "text-purple-700")}
                    </td>
                    <td className="border-l border-slate-200 bg-emerald-50/60 px-4 py-4 text-right">
                      {num(total.totalPeriods, "text-gray-600")}
                    </td>
                    <td className="bg-emerald-50/60 px-4 py-4 text-right">
                      {num(grandTotal?.payablePeriods ?? 0)}
                    </td>
                    <td className="bg-emerald-50/60 px-4 py-4 text-right">
                      <span className="text-xl font-bold tabular-nums text-emerald-700">
                        {formatMoney(grandTotal?.payableAmount ?? 0)}
                      </span>
                      {missingRate > 0 && (
                        <span className="mt-0.5 block text-xs font-medium text-amber-600">
                          thiếu giá {missingRate} buổi
                        </span>
                      )}
                    </td>
                    <td className="bg-emerald-50/60 px-4 py-4 text-right text-xl font-bold text-emerald-700">{formatMoney(grandTotal?.fuelAllowanceAmount ?? 0)}</td>
                    <td className="bg-emerald-50/60 px-4 py-4 text-right">
                      {num(total.totalDistanceKm, "text-gray-600")} km
                    </td>
                    <td className="bg-emerald-50/60 px-4 py-4 text-right">{costDetail(grandTotal?.otherCostsAmount ?? 0)}</td>
                    <td className="bg-emerald-50/60 px-4 py-4 text-right text-xl font-bold text-emerald-700">{formatMoney(grandTotal?.totalPayableAmount ?? 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="px-1 text-xs text-gray-400">
            Bấm vào số buổi hoặc Chi phí khác để mở đúng danh sách ở tab Chấm công;
            bấm “Xem/Sửa” tại từng buổi để xem tên khoản và ghi chú.
          </p>
        </>
      )}
    </div>
  );
}

function Money({ label, value, primary }: { label: string; value: number; primary?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-emerald-800">{label}</p>
      <p className={`${primary ? "text-2xl" : "text-lg"} font-bold leading-tight text-emerald-700 tabular-nums`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}
