import { useEffect, useMemo, useRef, useState } from "react";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  matchesPeriodFilter,
  toPeriod,
  type ExpensePeriodInfo,
} from "../expenseStats";

/** Một bảng thu chi (trường × kỳ) kèm kết quả `/school-expenses/:id/summary`. */
export type SheetSummary = { record: any; summary: any };

type Options = {
  enabled: boolean;
  /** Chỉ tải bảng của các trường này; null = mọi trường. */
  schoolIds: number[] | null;
  schoolYear: string;
  selectedPeriod: ExpensePeriodInfo | null;
  subjectId?: number | null;
  reloadKey: number;
};

const listFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

/** Kỳ thu chi đang chọn ở bộ lọc trang → ExpensePeriodInfo ổn định giữa các lần render. */
export function useSelectedPeriod(period: any): ExpensePeriodInfo | null {
  const id = Number(period?.id || 0);
  const month = Number(period?.month || 0);
  const year = Number(period?.year || 0);
  const name = period?.name ?? null;
  return useMemo(
    () => (id ? toPeriod({ id, month, year, name }) : null),
    [id, month, year, name],
  );
}

/** Chạy tối đa `limit` request cùng lúc để không dồn hàng trăm request. */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) => {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
};

/**
 * Tải danh sách bảng thu chi rồi `/summary` của những bảng nằm trong bộ lọc
 * (trường, năm học, kỳ), 6 request cùng lúc; bảng đã tải thì dùng lại khi
 * đổi bộ lọc. Dùng khi không có API tổng hợp, hoặc cần từng dòng của bảng.
 */
export function useSheetSummaries({
  enabled,
  schoolIds,
  schoolYear,
  selectedPeriod,
  subjectId,
  reloadKey,
}: Options) {
  const [records, setRecords] = useState<any[] | null>(null);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [failedCount, setFailedCount] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const cache = useRef(new Map<string, any>());

  const schoolKey = schoolIds
    ? [...new Set(schoolIds.filter(Boolean))].sort((a, b) => a - b).join(",")
    : "*";

  useEffect(() => {
    if (!enabled) {
      setRecords(null);
      setSheets([]);
      setLoading(false);
      return;
    }
    let active = true;

    setLoading(true);
    setError("");
    setRecords(null);
    cache.current.clear();
    schoolExpenseApi
      .getAll()
      .then((response) => {
        if (active) setRecords(listFromResponse(response));
      })
      .catch((fetchError: any) => {
        if (!active) return;
        setSheets([]);
        setLoading(false);
        setError(
          getApiErrorMessage(
            fetchError,
            "Không thể tải dữ liệu Quản lý thu chi",
          ),
        );
      });

    return () => {
      active = false;
    };
  }, [enabled, reloadKey]);

  useEffect(() => {
    if (!enabled || !records) return;
    let active = true;
    const allowedSchools =
      schoolKey === "*"
        ? null
        : new Set(schoolKey ? schoolKey.split(",").map(Number) : []);
    const scoped = records.filter(
      (record: any) =>
        record?.id &&
        (!allowedSchools ||
          allowedSchools.has(Number(record?.school?.id ?? record?.schoolId))) &&
        matchesPeriodFilter(
          { period: toPeriod(record?.period) },
          schoolYear,
          selectedPeriod,
        ),
    );
    const cacheKey = (record: any) => `${record.id}:${subjectId || 0}`;
    const missing = scoped.filter(
      (record) => !cache.current.has(cacheKey(record)),
    );

    const run = async () => {
      setLoading(true);
      setError("");
      let failed = 0;
      let done = 0;
      setProgress({ done, total: missing.length });

      await mapWithConcurrency(missing, 6, async (record: any) => {
        try {
          const summary = await schoolExpenseApi.getSummary(
            Number(record.id),
            subjectId || undefined,
          );
          cache.current.set(cacheKey(record), summary);
        } catch {
          failed += 1;
        }
        done += 1;
        if (active) setProgress({ done, total: missing.length });
      });

      if (!active) return;
      setFailedCount(failed);
      setSheets(
        scoped
          .filter((record) => cache.current.has(cacheKey(record)))
          .map((record) => ({
            record,
            summary: cache.current.get(cacheKey(record)),
          })),
      );
      setProgress(undefined);
      setLoading(false);
    };

    run();
    return () => {
      active = false;
    };
  }, [enabled, records, schoolKey, schoolYear, selectedPeriod, subjectId]);

  return { sheets, loading, error, failedCount, progress };
}
