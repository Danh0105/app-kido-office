/** Năm học mặc định thống nhất cho toàn bộ bộ lọc và form của hệ thống. */
export const DEFAULT_SCHOOL_YEAR = "2026-2027";
export const PREVIOUS_SCHOOL_YEAR = "2025-2026";

/** Đảm bảo select luôn có giá trị mặc định, kể cả backend chưa trả năm đó. */
export const includeDefaultSchoolYear = (years: string[]) =>
  Array.from(new Set([DEFAULT_SCHOOL_YEAR, ...years.filter(Boolean)]));
