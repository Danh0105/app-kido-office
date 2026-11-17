import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUnique, fetchAllPages, mapWithConcurrency, splitIntoWeeks } from '../src/pages/Teaching/pagedList.ts';

function pagedApi(items, maxLimit) {
  const calls = [];
  return {
    calls,
    fetcher: async (query) => {
      calls.push(query);
      const limit = Math.min(query.limit ?? 20, maxLimit);
      return {
        data: items.slice((query.page - 1) * limit, query.page * limit),
        pagination: {
          page: query.page, limit, total: items.length,
          totalPages: Math.ceil(items.length / limit),
        },
      };
    },
  };
}

test('the weekly timetable includes later weekdays beyond the API page cap', async () => {
  const sessions = Array.from({ length: 630 }, (_, id) => ({
    id: id + 1, dayOfWeek: 2 + Math.floor(id / 90),
  }));
  const api = pagedApi(sessions, 200);
  const query = { fromDate: '2026-09-07', toDate: '2026-09-13', teacherId: 7, region: 'VUNG_TAU', unchecked: true, page: 3, limit: 500 };
  const result = await fetchAllPages(api.fetcher, query);
  assert.deepEqual(result.data, sessions);
  assert.equal(result.data.at(-1).dayOfWeek, 8);
  assert.deepEqual(api.calls.map(({ page, limit }) => [page, limit]), [[1, 500], [2, 200], [3, 200], [4, 200]]);
  for (const call of api.calls) {
    assert.deepEqual(call, { ...query, page: call.page, limit: call.limit });
  }
  assert.equal(query.page, 3);
  assert.equal(result.pagination.total, 630);
});

test('pending schedules beyond the first 100 are included', async () => {
  const schedules = Array.from({ length: 235 }, (_, id) => ({ id: id + 1 }));
  const api = pagedApi(schedules, 100);
  const result = await fetchAllPages(api.fetcher, { confirmationStatus: 'PENDING', schoolId: 12, limit: 100 });
  assert.deepEqual(result.data, schedules);
  assert.equal(api.calls.length, 3);
  assert.ok(api.calls.every((call) => call.confirmationStatus === 'PENDING' && call.schoolId === 12));
});

test('empty and single-page results do not request extra pages', async () => {
  for (const items of [[], [{ id: 1 }]]) {
    const api = pagedApi(items, 200);
    assert.deepEqual((await fetchAllPages(api.fetcher, { limit: 200 })).data, items);
    assert.equal(api.calls.length, 1);
  }
});

test('a failed later page raises an error instead of returning an incomplete week', async () => {
  const api = pagedApi(Array.from({ length: 201 }, (_, id) => ({ id })), 200);
  await assert.rejects(fetchAllPages(async (query) => {
    if (query.page === 2) throw new Error('Page failed');
    return api.fetcher(query);
  }, { limit: 200 }), /Page failed/);
});

test('parallel loading keeps page order even when later pages answer first', async () => {
  const sessions = Array.from({ length: 1050 }, (_, id) => ({ id: id + 1 }));
  const api = pagedApi(sessions, 200);
  let inFlight = 0;
  let peak = 0;
  const result = await fetchAllPages(async (query) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    // Trang sau trả về trước trang trước.
    await new Promise((resolve) => setTimeout(resolve, 30 - query.page * 4));
    inFlight -= 1;
    return api.fetcher(query);
  }, { fromDate: '2026-09-28', toDate: '2026-10-04', limit: 200 }, 4);

  assert.deepEqual(result.data, sessions);
  assert.equal(api.calls.length, 6);
  assert.equal(peak, 4);
});

test('a failed page also rejects the parallel load', async () => {
  const api = pagedApi(Array.from({ length: 900 }, (_, id) => ({ id })), 200);
  await assert.rejects(fetchAllPages(async (query) => {
    if (query.page === 3) throw new Error('Page failed');
    return api.fetcher(query);
  }, { limit: 200 }, 4), /Page failed/);
});

test('the attendance range 01/09–10/10/2026 splits into Monday–Sunday weeks clipped to the range', () => {
  const weeks = splitIntoWeeks('2026-09-01', '2026-10-10');
  assert.deepEqual(weeks[0], { from: '2026-09-01', to: '2026-09-06' }); // 01/09 là Thứ Ba
  assert.deepEqual(weeks[1], { from: '2026-09-07', to: '2026-09-13' });
  assert.deepEqual(weeks.at(-1), { from: '2026-10-05', to: '2026-10-10' });
  assert.equal(weeks.length, 6);
  // Liền mạch: không sót, không trùng ngày nào giữa hai tuần.
  for (let i = 1; i < weeks.length; i += 1) {
    const prevEnd = Date.parse(`${weeks[i - 1].to}T00:00:00Z`);
    assert.equal(Date.parse(`${weeks[i].from}T00:00:00Z`) - prevEnd, 86_400_000);
  }
});

test('a single day, a Sunday and an empty range', () => {
  assert.deepEqual(splitIntoWeeks('2026-10-01', '2026-10-01'), [{ from: '2026-10-01', to: '2026-10-01' }]);
  assert.deepEqual(splitIntoWeeks('2026-10-04', '2026-10-05'), [
    { from: '2026-10-04', to: '2026-10-04' },
    { from: '2026-10-05', to: '2026-10-05' },
  ]);
  assert.deepEqual(splitIntoWeeks('2026-10-05', '2026-10-01'), []);
});

test('"Xem tất cả": a session pushed onto the next page is not shown twice', () => {
  // Trang 1 tải xong thì có buổi mới chen vào khoảng lọc: buổi #100 (cuối
  // trang 1) bị đẩy sang đầu trang 2.
  const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const page2 = [{ id: 100 }, ...Array.from({ length: 99 }, (_, i) => ({ id: 101 + i }))];
  const shown = appendUnique(page1, page2);
  assert.equal(shown.length, 199);
  assert.equal(new Set(shown.map((s) => s.id)).size, 199);
  assert.deepEqual(shown.slice(98, 101).map((s) => s.id), [99, 100, 101]);
});

test('reloading the loaded pages keeps page order and caps concurrency', async () => {
  let inFlight = 0;
  let peak = 0;
  const pages = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 4, async (page) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 40 - page * 5));
    inFlight -= 1;
    return page;
  });
  assert.deepEqual(pages, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(peak, 4);
  assert.deepEqual(await mapWithConcurrency([], 4, async (x) => x), []);
});
