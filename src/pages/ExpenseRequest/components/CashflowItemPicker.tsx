import { useEffect, useMemo, useRef, useState } from "react";

import { expenseRequestApi } from "@/service/expenseRequest";
import {
  CASHFLOW_ITEM_STATUS_META,
  CASHFLOW_SOURCE_META,
  type CashflowItem,
  type CashflowItemStatus,
  type CashflowItemsResponse,
  type CashflowSource,
} from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import {
  DEFAULT_SCHOOL_YEAR,
  includeDefaultSchoolYear,
} from "@/constants/schoolYear";

const money = (value: number) => `${formatVnd(value) || "0"} đ`;

/** Khoản chọn được: còn tiền phải chi và không nằm trong đề xuất khác chưa xong. */
const selectable = (item: CashflowItem) =>
  item.status === "UNPAID" || item.status === "PARTIAL";

const periodLabel = (item: {
  periodName?: string | null;
  periodMonth?: number | null;
  periodYear?: number | null;
}) =>
  item.periodName ||
  (item.periodMonth && item.periodYear
    ? item.periodMonth <= 12
      ? `Tháng ${item.periodMonth}/${item.periodYear}`
      : `Kỳ ${item.periodMonth}/${item.periodYear}`
    : "Kỳ không rõ");

/**
 * Năm học của kỳ kế toán (kỳ không lưu năm học): tháng 8–12 thuộc năm học bắt
 * đầu năm đó, tháng 1–7 thuộc năm học trước. Kỳ tuỳ chỉnh (tháng > 12) không
 * biết rơi vào nửa nào nên tính cho cả hai năm học chạm năm của nó.
 */
const periodSchoolYears = (period: { month: number; year: number }) =>
  period.month > 12
    ? [`${period.year - 1}-${period.year}`, `${period.year}-${period.year + 1}`]
    : [
        period.month >= 8
          ? `${period.year}-${period.year + 1}`
          : `${period.year - 1}-${period.year}`,
      ];

/** Năm học của khoản: theo môn (như màn QL thu chi); thiếu thì theo kỳ. */
const itemSchoolYear = (item: CashflowItem) =>
  item.schoolYear ||
  (item.periodMonth && item.periodYear
    ? periodSchoolYears({ month: item.periodMonth, year: item.periodYear })[0]
    : "");

type StatusFilter = "PAYABLE" | "ALL" | CashflowItemStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "PAYABLE", label: "Còn phải chi" },
  { value: "ALL", label: "Tất cả trạng thái" },
  ...(Object.keys(CASHFLOW_ITEM_STATUS_META) as CashflowItemStatus[]).map(
    (status) => ({ value: status, label: CASHFLOW_ITEM_STATUS_META[status].label })
  ),
];

const selectClass =
  "w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700";

/**
 * Chọn khoản chi từ QL thu chi cho đề xuất Chi Ngoài / Chi Trường / Chi GV
 * trường: lọc trường, năm, tháng, trạng thái; nhóm theo tháng; mỗi khoản hiện
 * Phải chi / Đã chi / Còn lại. Mặc định chỉ hiện tháng còn khoản phải chi.
 * Khoản đã chi đủ hoặc đang nằm trong đề xuất khác thì không chọn được.
 */
export default function CashflowItemPicker({
  source,
  selected,
  onChange,
  initialKeys,
  excludeSuggestId,
}: {
  source: CashflowSource;
  selected: CashflowItem[];
  onChange: (items: CashflowItem[]) => void;
  /** Sửa đề xuất: khoá các khoản đang có để chọn sẵn khi tải xong. */
  initialKeys?: string[];
  excludeSuggestId?: number;
}) {
  const meta = CASHFLOW_SOURCE_META[source];
  const [data, setData] = useState<CashflowItemsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [schoolId, setSchoolId] = useState("");
  // Mặc định năm học hiện tại; kỳ kế toán = các kỳ kế toán đã tạo (gom theo tên kỳ).
  const [schoolYear, setSchoolYear] = useState(DEFAULT_SCHOOL_YEAR);
  const [periodKey, setPeriodKey] = useState("");
  const [status, setStatus] = useState<StatusFilter>("PAYABLE");
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const preselected = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    expenseRequestApi
      .cashflowItems({ source, excludeSuggestId })
      .then((response) => {
        if (!active) return;
        setData(response);
        if (!preselected.current && initialKeys?.length) {
          preselected.current = true;
          const byKey = new Map(response.items.map((item) => [item.key, item]));
          const picked = initialKeys
            .map((key) => byKey.get(key))
            .filter((item): item is CashflowItem => !!item && selectable(item));
          onChange(picked);
          // Sửa đề xuất: mở đúng năm học của các khoản đang chọn.
          if (picked.length) setSchoolYear(itemSchoolYear(picked[0]));
          setMissingKeys(
            initialKeys.filter((key) => {
              const item = byKey.get(key);
              return !item || !selectable(item);
            })
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err?.response?.data?.message ||
            `Không tải được khoản chi của bảng ${meta.table}`
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, excludeSuggestId]);

  const items = data?.items ?? [];
  const schools = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach((item) =>
      map.set(item.schoolId, item.schoolName || `Trường #${item.schoolId}`)
    );
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [items]);
  const schoolYears = useMemo(
    () =>
      includeDefaultSchoolYear([
        ...items.map(itemSchoolYear),
        ...(data?.periods ?? [])
          .filter((period) => period.month <= 12)
          .flatMap(periodSchoolYears),
      ]).sort((a, b) => b.localeCompare(a)),
    [items, data]
  );
  // Kỳ kế toán đã tạo của trường đang lọc, thuộc năm học đang lọc (hoặc có
  // khoản của năm học đó). Nhiều trường cùng một kỳ (vd. "Tháng 11/2026") gom
  // thành một lựa chọn.
  const periodOptions = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; year: number; month: number; ids: Set<number> }
    >();
    for (const period of data?.periods ?? []) {
      if (schoolId && period.schoolId !== Number(schoolId)) continue;
      if (
        schoolYear &&
        !periodSchoolYears(period).includes(schoolYear) &&
        !items.some(
          (item) =>
            item.expensePeriodId === period.id &&
            itemSchoolYear(item) === schoolYear
        )
      ) {
        continue;
      }
      const label = periodLabel({
        periodName: period.name,
        periodMonth: period.month,
        periodYear: period.year,
      });
      const key = `${period.year}|${period.month}|${label}`;
      const group = groups.get(key) ?? {
        label,
        year: period.year,
        month: period.month,
        ids: new Set<number>(),
      };
      group.ids.add(period.id);
      groups.set(key, group);
    }
    return [...groups.entries()].sort(
      ([, a], [, b]) => b.year - a.year || b.month - a.month
    );
  }, [data, items, schoolId, schoolYear]);
  const periodIds = periodKey
    ? periodOptions.find(([key]) => key === periodKey)?.[1].ids ?? new Set<number>()
    : null;

  const visible = items.filter(
    (item) =>
      (!schoolId || item.schoolId === Number(schoolId)) &&
      (!schoolYear || itemSchoolYear(item) === schoolYear) &&
      (!periodIds || periodIds.has(item.expensePeriodId)) &&
      (status === "ALL" ||
        (status === "PAYABLE" ? selectable(item) : item.status === status))
  );
  // Nhóm theo tháng (kỳ); tháng không còn khoản nào khớp lọc thì không hiện.
  const months = useMemo(() => {
    const groups = new Map<string, { label: string; items: CashflowItem[] }>();
    for (const item of visible) {
      const key = `${item.periodYear ?? 0}-${String(item.periodMonth ?? 0).padStart(2, "0")}`;
      const group = groups.get(key) ?? { label: periodLabel(item), items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  const selectedKeys = new Set(selected.map((item) => item.key));
  const toggle = (item: CashflowItem) => {
    if (selectedKeys.has(item.key)) {
      onChange(selected.filter((entry) => entry.key !== item.key));
    } else if (selectable(item)) {
      onChange([...selected, item]);
    }
  };
  const selectedTotal = selected.reduce(
    (sum, item) => sum + Math.max(0, item.remainingAmount),
    0
  );
  const unassigned = (data?.unassigned ?? []).filter(
    (row) =>
      (!schoolId || row.schoolId === Number(schoolId)) &&
      (!schoolYear ||
        !row.periodMonth ||
        !row.periodYear ||
        periodSchoolYears({ month: row.periodMonth, year: row.periodYear }).includes(
          schoolYear
        )) &&
      (!periodIds || periodIds.has(row.expensePeriodId))
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          className={`${selectClass} col-span-2`}
          value={schoolId}
          onChange={(e) => {
            setSchoolId(e.target.value);
            setPeriodKey("");
          }}
          aria-label="Lọc trường"
        >
          <option value="">Tất cả trường</option>
          {schools.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={schoolYear}
          onChange={(e) => {
            setSchoolYear(e.target.value);
            setPeriodKey("");
          }}
          aria-label="Lọc năm học"
        >
          {schoolYears.map((value) => (
            <option key={value} value={value}>
              Năm học {value}
            </option>
          ))}
          <option value="">Mọi năm học</option>
        </select>
        <select
          className={selectClass}
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
          aria-label="Lọc kỳ kế toán"
        >
          <option value="">Mọi kỳ kế toán</option>
          {periodOptions.map(([key, option]) => (
            <option key={key} value={key}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className={`${selectClass} col-span-2`}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Lọc trạng thái thanh toán"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {missingKeys.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {missingKeys.length} khoản đang có trong đề xuất không còn chọn được
          (đã chi đủ, đang ở đề xuất khác hoặc bảng {meta.table} đã đổi) — sẽ bị
          bỏ khi lưu.
        </p>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-gray-400">
          Đang tải khoản chi từ bảng {meta.table}…
        </p>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      ) : months.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
          {items.length === 0
            ? `Các trường bạn phụ trách chưa có khoản nào ở bảng ${meta.table}.`
            : "Không có khoản nào khớp bộ lọc."}
        </p>
      ) : (
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {months.map(([key, group]) => (
            <div key={key}>
              <div className="sticky top-0 z-10 bg-white py-1 text-xs font-semibold text-gray-700">
                {group.label}
              </div>
              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const checked = selectedKeys.has(item.key);
                  const canPick = checked || selectable(item);
                  const statusMeta = CASHFLOW_ITEM_STATUS_META[item.status];
                  return (
                    <li key={item.key}>
                      <label
                        className={`flex gap-2 rounded-xl border px-3 py-2 text-xs ${
                          checked
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200 bg-white"
                        } ${canPick ? "cursor-pointer" : "opacity-70"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0"
                          checked={checked}
                          disabled={!canPick}
                          onChange={() => toggle(item)}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-medium text-gray-900">
                              {item.schoolName || `Trường #${item.schoolId}`}
                            </span>
                            <span className="text-gray-500">
                              ·{" "}
                              {source === "SCHOOL_TEACHER"
                                ? `GV ${item.teacherName || `#${item.schoolTeacherId}`}`
                                : item.subjectName || `Môn #${item.subjectId}`}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-[1px] text-[10px] font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[11px]">
                            <span className="text-gray-500">
                              Phải chi
                              <br />
                              <b className="text-gray-800">{money(item.totalAmount)}</b>
                            </span>
                            <span className="text-gray-500">
                              Đã chi
                              <br />
                              <b className="text-gray-800">{money(item.paidAmount)}</b>
                            </span>
                            <span className="text-gray-500">
                              Còn lại
                              <br />
                              <b className="text-orange-600">
                                {money(Math.max(0, item.remainingAmount))}
                              </b>
                            </span>
                          </div>
                          {item.openRequest && !checked && (
                            <p className="text-[11px] text-amber-700">
                              Đang ở đề xuất{" "}
                              {item.openRequest.code || `#${item.openRequest.id}`}
                            </p>
                          )}
                          {item.finalized && (
                            <p className="text-[11px] text-gray-500">
                              Kỳ đã kết thúc ở QL thu chi
                            </p>
                          )}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {source === "SCHOOL_TEACHER" && unassigned.length > 0 && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          {unassigned
            .map(
              (row) =>
                `${row.schoolName || `Trường #${row.schoolId}`} · ${periodLabel(row)}: ${row.rowCount} dòng (${money(row.amount)})`
            )
            .join("; ")}{" "}
          chưa chọn giáo viên — chọn giáo viên ở QL thu chi rồi mới đề xuất được.
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
        <span>Đã chọn {selected.length} khoản</span>
        <span className="font-semibold">Còn phải chi: {money(selectedTotal)}</span>
      </div>
    </div>
  );
}

/** Khoá khoản của một dòng đề xuất đã lưu — khớp `CashflowItem.key` của API. */
export const cashflowItemKeyOf = (
  source: CashflowSource,
  item: {
    schoolId: number | null;
    expensePeriodId: number | null;
    subjectId?: number | null;
    schoolTeacherId?: number | null;
  }
) =>
  `${item.schoolId ?? 0}:${item.expensePeriodId ?? 0}:${
    source === "SCHOOL_TEACHER"
      ? `t${item.schoolTeacherId ?? 0}`
      : `s${item.subjectId ?? 0}`
  }`;
