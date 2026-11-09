import { useEffect, useState } from "react";

import MobileSelect from "@/pages/Employee/Sales/Suggest/MobileSelect";
import { subjectApi } from "@/service/subject.api";
import { expensePeriodApi } from "@/service/expensePeriod";
import {
  DEFAULT_SCHOOL_YEAR,
  includeDefaultSchoolYear,
} from "@/constants/schoolYear";

type Option = { id: number | string; name: string };

/** Một dòng trường của đề xuất chi tháng. */
export type MonthlyRowValue = {
  key: string;
  schoolId: number | null;
  schoolYear: string | null;
  /** Một trường chi được cho nhiều môn trong cùng kỳ. */
  subjectIds: number[];
  expensePeriodId: number | null;
  /** "tháng/năm" của kỳ đã chọn — để dòng mới tự chọn cùng kỳ. */
  periodKey: string | null;
};

export const emptyMonthlyRow = (): MonthlyRowValue => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  schoolId: null,
  schoolYear: null,
  subjectIds: [],
  expensePeriodId: null,
  periodKey: null,
});

const listOf = (response: any): any[] =>
  Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
    ? response.data
    : [];

const periodLabel = (period: any) =>
  period.name ||
  (period.month <= 12
    ? `Tháng ${period.month}/${period.year}`
    : `Kỳ ${period.month}/${period.year}`);

/**
 * Trường → năm học → môn → kỳ kế toán của một dòng. Mỗi dòng tự tải lựa chọn
 * của trường mình; thay đổi đi qua `onPatch` để form gộp đúng dòng (tránh ghi
 * đè bằng giá trị cũ khi nhiều dòng tải cùng lúc).
 */
export default function MonthlySchoolRow({
  index,
  value,
  schools,
  schoolsLoading,
  preferredPeriodKey,
  canRemove,
  onPatch,
  onRemove,
}: {
  index: number;
  value: MonthlyRowValue;
  schools: Option[];
  schoolsLoading: boolean;
  /** Kỳ của dòng đầu: dòng sau tự chọn kỳ cùng tháng nếu trường có. */
  preferredPeriodKey: string | null;
  canRemove: boolean;
  onPatch: (patch: Partial<MonthlyRowValue>) => void;
  onRemove: () => void;
}) {
  const { schoolId, schoolYear } = value;
  const [schoolYears, setSchoolYears] = useState<Option[]>([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [periods, setPeriods] = useState<(Option & { key: string })[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);

  // Năm học có môn của trường; chọn sẵn năm hiện tại nếu có.
  useEffect(() => {
    setSchoolYears([]);
    if (!schoolId) return;
    let active = true;
    setYearsLoading(true);
    subjectApi
      .getFinanceBySchool(schoolId)
      .then((response: any) => {
        if (!active) return;
        const values: string[] = listOf(response)
          .map((subject: any) => String(subject?.schoolYear || "").trim())
          .filter(Boolean);
        const options = includeDefaultSchoolYear(values)
          .sort((first, second) => second.localeCompare(first))
          .map((year) => ({ id: year, name: year }));
        setSchoolYears(options);
        if (options.length > 0 && !options.some((o) => o.id === schoolYear)) {
          const preferred =
            options.find((o) => o.id === DEFAULT_SCHOOL_YEAR) || options[0];
          onPatch({ schoolYear: String(preferred.id), subjectIds: [] });
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) setSchoolYears([]);
      })
      .finally(() => {
        if (active) setYearsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // Môn của trường trong năm học đã chọn.
  useEffect(() => {
    setSubjects([]);
    if (!schoolId || !schoolYear) return;
    let active = true;
    setSubjectsLoading(true);
    subjectApi
      .getBySchool(schoolId, schoolYear)
      .then((response: any) => {
        if (!active) return;
        const options = listOf(response).map((subject: any) => ({
          id: Number(subject.id),
          name: subject.catalog?.name || subject.name,
        }));
        setSubjects(options);
        // Giữ các môn còn hợp lệ; chưa chọn môn nào mà trường chỉ có 1 môn thì chọn sẵn.
        const valid = value.subjectIds.filter((id) =>
          options.some((o) => Number(o.id) === id)
        );
        const next =
          valid.length === 0 && options.length === 1
            ? [Number(options[0].id)]
            : valid;
        if (
          next.length !== value.subjectIds.length ||
          next.some((id, index) => id !== value.subjectIds[index])
        ) {
          onPatch({ subjectIds: next });
        }
      })
      .catch((error) => {
        console.error(error);
        if (active) setSubjects([]);
      })
      .finally(() => {
        if (active) setSubjectsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, schoolYear]);

  // Kỳ kế toán quản lý riêng theo từng trường.
  useEffect(() => {
    setPeriods([]);
    if (!schoolId) return;
    let active = true;
    setPeriodsLoading(true);
    expensePeriodApi
      .getAll({ schoolId })
      .then((list) => {
        if (!active) return;
        const options = list.map((period) => ({
          id: period.id,
          name: periodLabel(period),
          key: `${period.month}/${period.year}`,
        }));
        setPeriods(options);
        const current = options.find(
          (o) => Number(o.id) === value.expensePeriodId
        );
        if (current) {
          if (current.key !== value.periodKey) onPatch({ periodKey: current.key });
          return;
        }
        const pick =
          (preferredPeriodKey &&
            options.find((o) => o.key === preferredPeriodKey)) ||
          (options.length === 1 ? options[0] : null);
        onPatch({
          expensePeriodId: pick ? Number(pick.id) : null,
          periodKey: pick ? pick.key : null,
        });
      })
      .catch((error) => {
        console.error(error);
        if (active) setPeriods([]);
      })
      .finally(() => {
        if (active) setPeriodsLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700">
          Trường {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-500 px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Xoá
          </button>
        )}
      </div>

      <MobileSelect
        label="Trường *"
        placeholder={schoolsLoading ? "Đang tải trường..." : "Chọn trường"}
        value={schoolId}
        options={schools}
        onChange={(next) =>
          onPatch({
            schoolId: next ? Number(next) : null,
            schoolYear: null,
            subjectIds: [],
            expensePeriodId: null,
            periodKey: null,
          })
        }
        disabled={schoolsLoading}
      />

      {schoolId && (
        <MobileSelect
          label="Năm học *"
          placeholder={yearsLoading ? "Đang tải năm học..." : "Chọn năm học"}
          value={schoolYear}
          options={schoolYears}
          onChange={(next) =>
            onPatch({ schoolYear: next ? String(next) : null, subjectIds: [] })
          }
          disabled={yearsLoading || schoolYears.length === 0}
        />
      )}

      {schoolId && schoolYear && (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Môn học * <span className="text-xs text-gray-400">(chọn được nhiều môn)</span>
            </p>
            {subjects.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onPatch({
                    subjectIds:
                      value.subjectIds.length === subjects.length
                        ? []
                        : subjects.map((o) => Number(o.id)),
                  })
                }
                className="text-xs font-medium text-indigo-600"
              >
                {value.subjectIds.length === subjects.length
                  ? "Bỏ chọn tất cả"
                  : "Chọn tất cả"}
              </button>
            )}
          </div>
          {subjectsLoading ? (
            <p className="mt-1 text-xs text-gray-400">Đang tải môn học...</p>
          ) : subjects.length === 0 ? (
            <p className="mt-1 text-xs text-amber-600">
              Trường chưa có môn học trong năm học này
            </p>
          ) : (
            <div className="mt-1 grid grid-cols-1 gap-1 rounded-lg border border-gray-200 bg-white p-2 sm:grid-cols-2">
              {subjects.map((option) => {
                const id = Number(option.id);
                const on = value.subjectIds.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      on ? "bg-indigo-50 text-indigo-800" : "text-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={on}
                      onChange={() =>
                        onPatch({
                          subjectIds: on
                            ? value.subjectIds.filter((item) => item !== id)
                            : [...value.subjectIds, id],
                        })
                      }
                    />
                    {option.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {schoolId && (
        <>
          <MobileSelect
            label="Kỳ kế toán *"
            placeholder={
              periodsLoading ? "Đang tải kỳ kế toán..." : "Chọn kỳ kế toán"
            }
            value={value.expensePeriodId}
            options={periods}
            onChange={(next) => {
              const picked = periods.find((o) => Number(o.id) === Number(next));
              onPatch({
                expensePeriodId: next ? Number(next) : null,
                periodKey: picked?.key ?? null,
              });
            }}
            disabled={periodsLoading || periods.length === 0}
          />
          {!periodsLoading && periods.length === 0 && (
            <p className="-mt-1 text-xs text-amber-600">
              Trường chưa có kỳ kế toán
            </p>
          )}
        </>
      )}
    </div>
  );
}
