import type { Paged } from "../../types/teaching";

export type TimetableWeek = { from: string; to: string };

const DAY_MS = 86_400_000;
const isoToTime = (value: string) => Date.parse(`${value}T00:00:00Z`);
const timeToIso = (time: number) => new Date(time).toISOString().slice(0, 10);

/**
 * Chia khoảng [from, to] (`YYYY-MM-DD`) thành các tuần Thứ Hai → Chủ Nhật,
 * cắt hai đầu theo khoảng lọc — lưới TKB tải và vẽ từng tuần một.
 */
export const splitIntoWeeks = (from: string, to: string): TimetableWeek[] => {
  const weeks: TimetableWeek[] = [];
  const end = isoToTime(to);
  let start = isoToTime(from);

  while (start <= end) {
    const day = new Date(start).getUTCDay(); // 0 = Chủ Nhật
    const sunday = start + ((7 - day) % 7) * DAY_MS;
    const weekEnd = Math.min(sunday, end);
    weeks.push({ from: timeToIso(start), to: timeToIso(weekEnd) });
    start = weekEnd + DAY_MS;
  }

  return weeks;
};

/**
 * Nối trang vừa tải vào danh sách đang hiện, bỏ dòng đã có. Phân trang theo
 * offset: giữa hai lần cuộn mà có buổi mới chen vào khoảng lọc thì dòng cuối
 * trang trước bị đẩy sang trang sau — không lọc là hiện một buổi hai lần.
 */
export const appendUnique = <T extends { id: number }>(prev: T[], next: T[]): T[] => {
  const seen = new Set(prev.map((item) => item.id));
  return [...prev, ...next.filter((item) => !seen.has(item.id))];
};

/**
 * Chạy `fn` cho từng phần tử, tối đa `concurrency` lượt cùng lúc. Kết quả
 * giữ đúng thứ tự đầu vào dù lượt sau xong trước; một lượt lỗi là cả hàm lỗi.
 */
export async function mapWithConcurrency<I, R>(
  inputs: I[],
  concurrency: number,
  fn: (input: I) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(inputs.length);
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const index = next++;
      results[index] = await fn(inputs[index]);
    }
  };
  const workers = Math.min(Math.max(1, concurrency), inputs.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

/**
 * Tải đầy đủ dữ liệu cho lưới lịch, theo kích thước trang thực tế từ API.
 *
 * `concurrency` > 1 thì sau trang đầu (để biết tổng số trang) tải tối đa
 * chừng ấy trang cùng lúc — thứ tự dữ liệu trả về vẫn đúng thứ tự trang.
 */
export async function fetchAllPages<T, Q extends { page?: number; limit?: number }>(
  fetcher: (query: Q) => Promise<Paged<T>>,
  query: Q,
  concurrency = 1,
): Promise<Paged<T>> {
  const first = await fetcher({ ...query, page: 1 });
  const { limit, totalPages } = first.pagination;

  const restPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
  const rest = await mapWithConcurrency(restPages, concurrency, async (page) =>
    (await fetcher({ ...query, page, limit })).data,
  );

  const data = [...first.data, ...rest.flat()];

  return {
    data,
    pagination: { page: 1, limit: Math.max(1, data.length), total: data.length, totalPages: 1 },
  };
}
