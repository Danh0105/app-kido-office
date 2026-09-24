import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import type { Paged, Pagination } from "@/types/teaching";

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

type Options<T, Q> = {
  /** Hàm gọi API — nhận query kèm page/limit, trả `{ data, pagination }`. */
  fetcher: (query: Q & { page: number; limit: number }) => Promise<Paged<T>>;
  /** Bộ lọc hiện tại; đổi filter → tự về trang 1 và tải lại. */
  query: Q;
  limit?: number;
  /** Tắt tải tự động (ví dụ chờ user chọn khoảng ngày). */
  enabled?: boolean;
  errorMessage?: string;
  /** 404 = chưa có dữ liệu → hiện empty state thay vì toast lỗi. */
  treat404AsEmpty?: boolean;
};

/**
 * Hook phân trang dùng chung cho cả 3 màn của module Giảng dạy
 * (danh sách nào của BE cũng trả `{ data, pagination }`).
 */
export function usePagedList<T, Q extends Record<string, any>>({
  fetcher,
  query,
  limit = 20,
  enabled = true,
  errorMessage = "Không tải được dữ liệu",
  treat404AsEmpty = false,
}: Options<T, Q>) {
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    ...EMPTY_PAGINATION,
    limit,
  });
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Giữ tham chiếu mới nhất để `load` không đổi identity mỗi lần render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const queryKey = JSON.stringify(query);
  // Số dòng/trang cũng xác định một tập trang khác. Gắn `limit` vào key để đổi
  // 20 → 50 luôn tải page 1, không phát request thừa tới page cũ.
  const pageKey = `${queryKey}|limit=${limit}`;
  const queryRef = useRef(query);
  queryRef.current = query;

  // Trang gắn liền với bộ lọc: đổi bộ lọc là tự về trang 1 ngay trong cùng lần
  // render, không cần effect phụ (tránh gọi API 2 lần với 2 số trang khác nhau).
  const [pageState, setPageState] = useState({ key: pageKey, page: 1 });
  const page = pageState.key === pageKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: pageKey, page: next });

  // Chỉ nhận kết quả của request mới nhất — đổi lọc nhanh không bị đè ngược.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    const current = ++requestId.current;
    setLoading(true);
    try {
      const res = await fetcherRef.current({
        ...queryRef.current,
        page,
        limit,
      } as Q & { page: number; limit: number });

      if (current !== requestId.current) return;

      setItems(res?.data || []);
      setPagination(res?.pagination || { ...EMPTY_PAGINATION, limit });
      setNotFound(false);
    } catch (error: any) {
      if (current !== requestId.current) return;

      if (treat404AsEmpty && error?.response?.status === 404) {
        setItems([]);
        setPagination({ ...EMPTY_PAGINATION, limit });
        setNotFound(true);
      } else {
        // 401/403 đã được interceptor của axios xử lý.
        if (error?.response?.status !== 403) {
          toast.error(getApiErrorMessage(error, errorMessage));
        }
        setItems([]);
      }
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [enabled, page, limit, queryKey, errorMessage, treat404AsEmpty]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    items,
    setItems,
    pagination,
    page,
    setPage,
    loading,
    /** true khi BE trả 404 và `treat404AsEmpty` bật. */
    notFound,
    reload: load,
  };
}
