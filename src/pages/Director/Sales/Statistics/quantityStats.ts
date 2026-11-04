export type QuantityPolicy = {
  schoolId?: number | string | null;
  schoolName?: string | null;
  subjectId?: number | string | null;
  studentCount?: number | string | null;
  totalLessons?: number | string | null;
};

export type AccountingRecord = {
  schoolId?: number | string | null;
  school?: { id?: number | string | null; name?: string | null } | null;
  summary?: any;
};

export type SchoolQuantitySummary = {
  schoolId: number;
  schoolName: string;
  policyStudents: number;
  policyPeriods: number;
  accountingStudents: number;
  accountingPeriods: number;
};

const numberValue = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRevenueItems = (record: AccountingRecord) => {
  const summary = record.summary?.summary || record.summary || {};
  return Array.isArray(summary.revenueItems) ? summary.revenueItems : [];
};

/**
 * Tổng hợp số lượng theo trường từ hai nguồn độc lập:
 * - chính sách đã duyệt do kinh doanh khai;
 * - dòng Doanh thu do kế toán nhập.
 *
 * Không cộng schoolExpenseItems/managementExpenseItems vì các bảng đó dùng lại
 * cùng số lượng của dòng Doanh thu và sẽ làm số liệu kế toán bị nhân ba.
 */
export const buildSchoolQuantitySummary = (
  policies: QuantityPolicy[],
  accountingRecords: AccountingRecord[],
): SchoolQuantitySummary[] => {
  const rows = new Map<number, SchoolQuantitySummary>();
  const allowedSubjectsBySchool = new Map<number, Set<number>>();

  policies.forEach((policy) => {
    const schoolId = numberValue(policy.schoolId);
    if (!schoolId) return;

    const current = rows.get(schoolId) || {
      schoolId,
      schoolName: policy.schoolName || `Trường #${schoolId}`,
      policyStudents: 0,
      policyPeriods: 0,
      accountingStudents: 0,
      accountingPeriods: 0,
    };

    current.policyStudents += numberValue(policy.studentCount);
    current.policyPeriods += numberValue(policy.totalLessons);
    rows.set(schoolId, current);

    const subjectId = numberValue(policy.subjectId);
    if (subjectId) {
      const subjects =
        allowedSubjectsBySchool.get(schoolId) || new Set<number>();
      subjects.add(subjectId);
      allowedSubjectsBySchool.set(schoolId, subjects);
    }
  });

  accountingRecords.forEach((record) => {
    const schoolId = numberValue(record.schoolId || record.school?.id);
    const current = rows.get(schoolId);
    if (!current) return;

    const allowedSubjects = allowedSubjectsBySchool.get(schoolId);
    getRevenueItems(record).forEach((item: any) => {
      const subjectId = numberValue(item?.subjectId);
      if (
        allowedSubjects?.size &&
        (!subjectId || !allowedSubjects.has(subjectId))
      ) {
        return;
      }

      current.accountingStudents += numberValue(item?.studentCount);
      current.accountingPeriods += numberValue(item?.totalPeriods);
    });
  });

  return Array.from(rows.values()).sort((left, right) =>
    left.schoolName.localeCompare(right.schoolName, "vi"),
  );
};
