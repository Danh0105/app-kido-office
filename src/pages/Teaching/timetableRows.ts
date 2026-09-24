import type { TimetableRow } from "./lib";

/** API có thể trả HH:mm:ss; lưới và ô nhập giờ dùng HH:mm. */
export const timetableSlotKey = (startTime: string, endTime: string) =>
  `${startTime.slice(0, 5)}|${endTime.slice(0, 5)}`;

/** Nối giờ với dòng liền sau trong cùng buổi, kể cả dòng ra chơi. */
export function updateTimetableRowTime(
  rows: TimetableRow[],
  rowKey: string,
  patch: Partial<Pick<TimetableRow, "startTime" | "endTime">>,
): TimetableRow[] {
  const index = rows.findIndex((row) => row.key === rowKey);
  if (index < 0) return rows;
  const current = rows[index];
  const nextIndex = patch.endTime && patch.endTime !== current.endTime
    ? rows.findIndex((row, position) => position > index && row.session === current.session)
    : -1;

  return rows.map((row, position) => {
    if (position === index) return { ...row, ...patch };
    if (position === nextIndex) return { ...row, startTime: patch.endTime! };
    return row;
  });
}

/** Giữ thứ tự người dùng đã xếp, mỗi khung giờ chỉ có một dòng tiết. */
export function normalizeTimetableRows(list: TimetableRow[]): TimetableRow[] {
  const seen = new Set<string>();
  const unique = list.map((row) => ({
    ...row,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
  })).filter((row) => {
    if (!row.isPeriod || !row.startTime || !row.endTime) return true;
    const key = timetableSlotKey(row.startTime, row.endTime);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (["SANG", "CHIEU"] as const).flatMap((session) => {
    let index = 0;
    return unique.filter((row) => row.session === session)
      .map((row) => row.isPeriod ? { ...row, label: String(++index) } : row);
  });
}

/** Bổ sung lịch ngoài khung, so cả giờ kết thúc để không ghép nhầm tiết. */
export function appendMissingTimetableRows(
  rows: TimetableRow[],
  schedules: { startTime: string; endTime: string }[],
): TimetableRow[] {
  const known = new Set(rows.filter((row) => row.isPeriod)
    .map((row) => timetableSlotKey(row.startTime, row.endTime)));
  const added: TimetableRow[] = [];
  schedules.forEach((item) => {
    const slot = timetableSlotKey(item.startTime, item.endTime);
    if (known.has(slot)) return;
    known.add(slot);
    const startTime = item.startTime.slice(0, 5);
    added.push({
      key: `auto-${slot}`,
      session: startTime < "12:00" ? "SANG" : "CHIEU",
      isPeriod: true,
      label: "?",
      startTime,
      endTime: item.endTime.slice(0, 5),
    });
  });
  return added.length ? normalizeTimetableRows([...rows, ...added]) : rows;
}
