/** datetime-local is entered in recruitment's Vietnam timezone, independent of device timezone. */
export function recruitmentDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Vui lòng nhập ngày giờ hợp lệ");
  const iso = `${value}:00+07:00`;
  if (!Number.isFinite(Date.parse(iso)))
    throw new Error("Ngày giờ không hợp lệ");
  if (localRecruitmentTime(iso) !== value)
    throw new Error("Ngày giờ không tồn tại");
  return iso;
}

export function interviewRange(start: string, end: string, future = true) {
  const from = recruitmentDateTime(start);
  const to = recruitmentDateTime(end);
  if (Date.parse(to) <= Date.parse(from))
    throw new Error("Giờ kết thúc phải sau giờ bắt đầu");
  if (future && Date.parse(from) <= Date.now())
    throw new Error("Lịch mới phải ở tương lai");
  return { from, to };
}

export function localRecruitmentTime(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 16);
}

export const uniqueList = (text: string) => [
  ...new Set(
    text
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
  )
];

export function profileChanges<T extends Record<string, unknown>>(
  before: T,
  after: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(after).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key])
    )
  ) as Partial<T>;
}
