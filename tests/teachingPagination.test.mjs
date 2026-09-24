import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAllPages } from '../src/pages/Teaching/pagedList.ts';

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
