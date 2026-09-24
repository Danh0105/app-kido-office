import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendMissingTimetableRows,
  normalizeTimetableRows,
  timetableSlotKey,
  updateTimetableRowTime,
} from '../src/pages/Teaching/timetableRows.ts';

const period = (key, startTime, endTime, extra = {}) => ({
  key, startTime, endTime, session: 'CHIEU', isPeriod: true, label: key, ...extra,
});

test('duplicate periods from the screenshot become one row with the same schedule', () => {
  const rows = normalizeTimetableRows([
    period('C3', '15:20', '16:00'),
    period('C4', '16:20:00', '17:05:00'),
    period('C5', '16:20', '17:05'),
  ]);
  const schedule = { dayOfWeek: 3, startTime: '16:20:00', endTime: '17:05:00' };
  const matchingRows = rows.filter((row) =>
    timetableSlotKey(row.startTime, row.endTime) ===
    timetableSlotKey(schedule.startTime, schedule.endTime));
  assert.equal(matchingRows.length, 1);
  assert.equal(matchingRows[0].key, 'C4');
  assert.equal(matchingRows[0].startTime, '16:20');
  assert.deepEqual(rows.map((row) => row.label), ['1', '2']);
});

test('seconds in the school frame do not create an extra automatic period', () => {
  const rows = [period('C4', '16:20:00', '17:05:00')];
  assert.equal(appendMissingTimetableRows(rows, [
    { startTime: '16:20', endTime: '17:05' },
  ]), rows);
});

test('same start but different end times keep their own rows and cell keys', () => {
  const rows = appendMissingTimetableRows([
    period('C4', '16:20', '17:05'),
  ], [{ startTime: '16:20:00', endTime: '17:50:00' }]);
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => timetableSlotKey(row.startTime, row.endTime))).size, 2);
});

test('multiple schedules and repeated loads add only one missing period', () => {
  const schedules = [
    { startTime: '16:20', endTime: '17:05' },
    { startTime: '16:20:00', endTime: '17:05:00' },
  ];
  const rows = appendMissingTimetableRows([], schedules);
  assert.equal(rows.length, 1);
  assert.equal(appendMissingTimetableRows(rows, schedules), rows);
});

test('normalization preserves breaks, manual order and independent session numbering', () => {
  const rows = normalizeTimetableRows([
    period('C2', '14:10', '14:45'),
    period('CB', '14:50', '15:20', { isPeriod: false, label: 'RA CHƠI' }),
    period('C1', '13:30', '14:05'),
    period('S1', '07:30', '08:10', { session: 'SANG' }),
  ]);
  assert.deepEqual(rows.map((row) => row.key), ['S1', 'C2', 'CB', 'C1']);
  assert.deepEqual(rows.map((row) => row.label), ['1', '1', 'RA CHƠI', '2']);
});

test('a break cannot absorb a scheduled teaching period in the same time range', () => {
  const rows = appendMissingTimetableRows([
    period('CB', '14:50', '15:20', { isPeriod: false }),
  ], [{ startTime: '14:50', endTime: '15:20' }]);
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((row) => row.isPeriod).length, 1);
});

test('editing an end time fills the next row in display order, preserving its end and key', () => {
  const rows = [
    period('C2', '14:10', '14:45'),
    period('C1', '13:30', '14:05'),
    period('C3', '15:20', '16:00'),
  ];
  const updated = updateTimetableRowTime(rows, 'C2', { endTime: '14:00' });
  assert.deepEqual(updated[1], { ...rows[1], startTime: '14:00' });
  assert.equal(updated[2], rows[2]);
  assert.equal(rows[0].endTime, '14:45');
  assert.equal(rows[1].startTime, '13:30');
});

test('time linking keeps the break between lessons and stops at the session boundary', () => {
  const rows = [
    period('S1', '07:30', '08:10', { session: 'SANG' }),
    period('SB', '08:10', '08:30', { session: 'SANG', isPeriod: false }),
    period('S2', '08:30', '09:10', { session: 'SANG' }),
    period('C1', '13:30', '14:05'),
  ];
  const beforeBreak = updateTimetableRowTime(rows, 'S1', { endTime: '08:15' });
  assert.equal(beforeBreak[1].startTime, '08:15');
  assert.equal(beforeBreak[2], rows[2]);
  const afterBreak = updateTimetableRowTime(beforeBreak, 'SB', { endTime: '08:35' });
  assert.equal(afterBreak[2].startTime, '08:35');
  const endOfMorning = updateTimetableRowTime(afterBreak, 'S2', { endTime: '09:15' });
  assert.equal(endOfMorning[3], rows[3]);
});

test('editing a start time or clearing an end time leaves the next lesson alone', () => {
  const rows = [period('C1', '13:30', '14:05'), period('C2', '14:10', '14:45')];
  for (const patch of [{ startTime: '13:35' }, { endTime: '' }, { endTime: '14:05' }]) {
    assert.equal(updateTimetableRowTime(rows, 'C1', patch)[1], rows[1]);
  }
});
