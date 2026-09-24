import type { Paged } from "../../types/teaching";

/** Tải đầy đủ dữ liệu cho lưới lịch, theo kích thước trang thực tế từ API. */
export async function fetchAllPages<T, Q extends { page?: number; limit?: number }>(
  fetcher: (query: Q) => Promise<Paged<T>>,
  query: Q,
): Promise<Paged<T>> {
  const first = await fetcher({ ...query, page: 1 });
  const data = [...first.data];
  const { limit, totalPages } = first.pagination;

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await fetcher({ ...query, page, limit });
    data.push(...next.data);
  }

  return {
    data,
    pagination: { page: 1, limit: Math.max(1, data.length), total: data.length, totalPages: 1 },
  };
}
