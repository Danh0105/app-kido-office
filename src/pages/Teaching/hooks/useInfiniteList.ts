import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import type { Paged } from "@/types/teaching";

import { appendUnique, mapWithConcurrency } from "../pagedList";

/** Tải lại nhiều trang đã hiện cùng lúc, như lưới TKB. */
const RELOAD_CONCURRENCY = 4;

type Options<T, Q> = {
  fetcher: (query: Q & { page: number; limit: number }) => Promise<Paged<T>>;
  /** Bộ lọc hiện tại; đổi filter → bỏ hết, tải lại từ trang 1. */
  query: Q;
  /** Số dòng mỗi lần tải thêm. */
  limit: number;
  enabled?: boolean;
  errorMessage?: string;
};

type State<T> = {
  key: string;
  items: T[];
  /** Số trang đã nối vào `items`. */
  pages: number;
  total: number;
  totalPages: number;
};

const emptyState = <T,>(key: string): State<T> => ({
  key,
  items: [],
  pages: 0,
  total: 0,
  totalPages: 0,
});

/**
 * Danh sách cuộn tới đâu tải tới đó: giữ các trang đã tải và nối trang kế
 * tiếp khi gọi `loadMore`, thay vì thay cả bảng như `usePagedList`.
 */
export function useInfiniteList<T extends { id: number }, Q extends Record<string, any>>({
  fetcher,
  query,
  limit,
  enabled = true,
  errorMessage = "Không tải được dữ liệu",
}: Options<T, Q>) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const queryRef = useRef(query);
  queryRef.current = query;

  // Dữ liệu gắn với bộ lọc đã sinh ra nó: đổi lọc là dữ liệu cũ thôi hiện
  // ngay, không đợi effect dọn — giống `useWeeklySessions`.
  const key = `${JSON.stringify(query)}|limit=${limit}|${enabled}`;
  const keyRef = useRef(key);
  keyRef.current = key;

  const [state, setState] = useState<State<T>>(() => emptyState<T>(""));
  const current = state.key === key ? state : emptyState<T>(key);
  const [loading, setLoading] = useState(false);
  // Lỗi thì ngừng tự tải khi cuộn, chờ người dùng bấm "Thử lại".
  const [failed, setFailed] = useState(false);

  // Ref đồng bộ cho `loadMore` — observer có thể gọi lại trước khi React vẽ
  // xong với state mới, dựa vào state là tải trùng một trang hai lần.
  const pagesRef = useRef(0);
  const totalPagesRef = useRef(Number.POSITIVE_INFINITY);
  const busyRef = useRef(false);
  // Chỉ nhận kết quả của lượt gọi mới nhất.
  const requestId = useRef(0);

  const run = useCallback(
    async (mode: "next" | "reload") => {
      const id = ++requestId.current;
      const runKey = keyRef.current;
      const fetchPage = (page: number) =>
        fetcherRef.current({
          ...queryRef.current,
          page,
          limit,
        } as Q & { page: number; limit: number });

      busyRef.current = true;
      setLoading(true);
      try {
        if (mode === "next") {
          const page = pagesRef.current + 1;
          const res = await fetchPage(page);
          if (id !== requestId.current) return;

          pagesRef.current = page;
          totalPagesRef.current = res.pagination.totalPages;
          setState((prev) => ({
            key: runKey,
            items: appendUnique(prev.key === runKey ? prev.items : [], res.data),
            pages: page,
            total: res.pagination.total,
            totalPages: res.pagination.totalPages,
          }));
        } else {
          // Tải lại đúng số trang đang hiện — không thu bảng về trang đầu,
          // người dùng đang cuộn ở đâu vẫn ở đó.
          const count = Math.max(1, pagesRef.current);
          const results = await mapWithConcurrency(
            Array.from({ length: count }, (_, index) => index + 1),
            RELOAD_CONCURRENCY,
            fetchPage,
          );
          if (id !== requestId.current) return;

          const { total, totalPages } = results[results.length - 1].pagination;
          pagesRef.current = count;
          totalPagesRef.current = totalPages;
          setState({
            key: runKey,
            items: results.reduce<T[]>((all, res) => appendUnique(all, res.data), []),
            pages: count,
            total,
            totalPages,
          });
        }
        setFailed(false);
      } catch (error: any) {
        if (id !== requestId.current) return;
        setFailed(true);
        // 401/403 đã được interceptor của axios xử lý.
        if (error?.response?.status !== 403) {
          toast.error(getApiErrorMessage(error, errorMessage));
        }
      } finally {
        if (id === requestId.current) {
          busyRef.current = false;
          setLoading(false);
        }
      }
    },
    [limit, errorMessage],
  );

  useEffect(() => {
    pagesRef.current = 0;
    totalPagesRef.current = Number.POSITIVE_INFINITY;
    setFailed(false);
    if (!enabled) {
      ++requestId.current;
      busyRef.current = false;
      setLoading(false);
      return;
    }
    void run("next");
  }, [key, enabled, run]);

  const loadMore = useCallback(() => {
    if (busyRef.current || pagesRef.current >= totalPagesRef.current) return;
    void run("next");
  }, [run]);

  const reload = useCallback(async () => {
    if (!enabled) return;
    await run("reload");
  }, [enabled, run]);

  /** Cập nhật lạc quan, cùng chữ ký với setter của `usePagedList`. */
  const setItems = useCallback(
    (update: SetStateAction<T[]>) =>
      setState((prev) => ({
        ...prev,
        items: typeof update === "function" ? update(prev.items) : update,
      })),
    [],
  );

  return {
    items: current.items,
    total: current.total,
    hasMore: current.pages < current.totalPages,
    /** Chưa có trang nào — bảng chưa có gì để vẽ. */
    initialLoading: enabled && current.pages === 0 && !failed,
    loading,
    failed,
    loadMore,
    reload,
    setItems,
  };
}
