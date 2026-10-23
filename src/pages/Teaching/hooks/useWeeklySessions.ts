import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type { SessionQuery, TeachingSession } from "@/types/teaching";

import { fetchAllPages, splitIntoWeeks, type TimetableWeek } from "../pagedList";

/** API trả tối đa 200 buổi/trang. */
const PAGE_LIMIT = 200;
/** Số trang tải song song trong một tuần — đủ nhanh mà không dồn tải lên BE. */
const PAGE_CONCURRENCY = 4;

type Options = {
  /** Bộ lọc của tab — `fromDate`/`toDate` là cả khoảng, hook tự chia tuần. */
  query: SessionQuery;
  enabled?: boolean;
  errorMessage?: string;
};

/**
 * Buổi dạy cho lưới TKB, tải **từng tuần một** thay vì cả khoảng lọc.
 *
 * Lọc 01/09–10/10 cả khu vực HCM trước đây phải tải tuần tự 34 trang
 * (~11MB, ~9 giây) rồi mới vẽ được gì. Giờ chỉ tải tuần đầu; tab gọi
 * `loadMore` khi người dùng cuộn tới cuối để lấy tuần kế tiếp.
 */
export function useWeeklySessions({
  query,
  enabled = true,
  errorMessage = "Không tải được thời khoá biểu",
}: Options) {
  const queryKey = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  const weeks = useMemo(
    () =>
      enabled && query.fromDate && query.toDate
        ? splitIntoWeeks(query.fromDate, query.toDate)
        : [],
    [enabled, query.fromDate, query.toDate],
  );
  const weeksRef = useRef(weeks);
  weeksRef.current = weeks;

  /**
   * `data[i]` = buổi dạy của `weeks[i]`, chỉ gồm các tuần đã tải. Gắn với
   * `key` của bộ lọc đã sinh ra nó: ngay sau khi đổi lọc, dữ liệu cũ bị coi
   * là rỗng luôn, không vẽ nhầm buổi tuần cũ vào tuần mới dù chỉ một lần.
   */
  const [state, setState] = useState<{ key: string; data: TeachingSession[][] }>(
    { key: "", data: [] },
  );
  const loaded = state.key === queryKey ? state.data : [];
  const [loading, setLoading] = useState(false);
  // Lỗi thì ngừng tự tải khi cuộn — không thì cuộn tới đâu bắn toast tới đó.
  const [failed, setFailed] = useState(false);

  // Ref đồng bộ cho `loadMore`: observer có thể gọi lại trước khi React kịp
  // vẽ lại với state mới, dựa vào state là tải trùng một tuần hai lần.
  const loadedCountRef = useRef(0);
  const busyRef = useRef(false);
  // Chỉ nhận kết quả của lượt gọi mới nhất — đổi lọc giữa chừng không bị đè ngược.
  const requestId = useRef(0);

  const run = useCallback(
    async (indexes: number[], mode: "replace" | "append") => {
      const current = ++requestId.current;
      const key = queryKeyRef.current;
      busyRef.current = true;
      setLoading(true);
      try {
        const data = await Promise.all(
          indexes.map(async (index) => {
            const week = weeksRef.current[index];
            const res = await fetchAllPages<TeachingSession, SessionQuery>(
              teachingSessionApi.list,
              { ...queryRef.current, fromDate: week.from, toDate: week.to, limit: PAGE_LIMIT },
              PAGE_CONCURRENCY,
            );
            return res.data;
          }),
        );
        if (current !== requestId.current) return;

        loadedCountRef.current =
          mode === "append" ? loadedCountRef.current + data.length : data.length;
        setState((prev) => ({
          key,
          data: mode === "append" && prev.key === key ? [...prev.data, ...data] : data,
        }));
        setFailed(false);
      } catch (error: any) {
        if (current !== requestId.current) return;
        setFailed(true);
        // 401/403 đã được interceptor của axios xử lý.
        if (error?.response?.status !== 403) {
          toast.error(getApiErrorMessage(error, errorMessage));
        }
      } finally {
        if (current === requestId.current) {
          busyRef.current = false;
          setLoading(false);
        }
      }
    },
    [errorMessage],
  );

  // Đổi bộ lọc → bỏ hết, tải lại từ tuần đầu.
  useEffect(() => {
    loadedCountRef.current = 0;
    setFailed(false);
    if (weeksRef.current.length === 0) {
      ++requestId.current;
      busyRef.current = false;
      setLoading(false);
      return;
    }
    void run([0], "replace");
  }, [queryKey, enabled, run]);

  const loadMore = useCallback(() => {
    if (busyRef.current) return;
    const next = loadedCountRef.current;
    if (next >= weeksRef.current.length) return;
    void run([next], "append");
  }, [run]);

  /** Tải lại đúng các tuần đang hiện (không thu về tuần đầu, giữ chỗ đang cuộn). */
  const reload = useCallback(async () => {
    const total = weeksRef.current.length;
    if (total === 0) return;
    const count = Math.min(Math.max(1, loadedCountRef.current), total);
    await run(
      Array.from({ length: count }, (_, index) => index),
      "replace",
    );
  }, [run]);

  /** Cập nhật lạc quan — `update` chạy trên danh sách buổi của từng tuần. */
  const setItems = useCallback(
    (update: (prev: TeachingSession[]) => TeachingSession[]) =>
      setState((prev) => ({ ...prev, data: prev.data.map(update) })),
    [],
  );

  const loadedWeeks = useMemo(
    () =>
      loaded
        .slice(0, weeks.length)
        .map((items, index) => ({ ...weeks[index], items })),
    [loaded, weeks],
  );

  return {
    weeks,
    loadedWeeks,
    hasMore: loaded.length < weeks.length,
    nextWeek: weeks[loaded.length] as TimetableWeek | undefined,
    /**
     * Đang tải tuần đầu — chưa có gì để vẽ. Không dựa vào `loading`: ngay
     * sau khi đổi lọc, effect chưa kịp bật `loading` mà dữ liệu cũ đã bị bỏ.
     */
    initialLoading: weeks.length > 0 && loaded.length === 0 && !failed,
    loading,
    failed,
    loadMore,
    reload,
    setItems,
  };
}
