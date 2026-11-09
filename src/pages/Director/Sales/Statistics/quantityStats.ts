import {
  matchesPeriodFilter,
  toPeriod,
  type ExpensePeriodInfo,
} from "./expenseStats";

export type QuantityPolicy = {
  policyId?: number | string | null;
  id?: number | string | null;
  schoolId?: number | string | null;
  schoolName?: string | null;
  subjectId?: number | string | null;
  subjectName?: string | null;
  employeeId?: number | string | null;
  studentCount?: number | string | null;
  totalLessons?: number | string | null;
};

/** Bảng thu chi (trường × kỳ) kèm kết quả `/school-expenses/:id/summary`. */
export type QuantitySheet = { record: any; summary: any };

/** Các bảng của QL thu chi có số học sinh, theo thứ tự hiển thị. */
export const QUANTITY_TABLES = [
  { key: "revenue", label: "Doanh Thu" },
  { key: "invoice", label: "Hóa Đơn" },
  { key: "school", label: "Chi Trường" },
  { key: "management", label: "Chi Ngoài" },
] as const;

export type QuantityTableKey = (typeof QUANTITY_TABLES)[number]["key"];

export type QuantityCell = {
  students: number;
  periods: number;
  /** Kỳ đã lấy số (kỳ mới nhất có dòng nhập); null = chưa có dòng nào. */
  period: ExpensePeriodInfo | null;
};

export type QuantityTotals = Record<
  QuantityTableKey,
  { students: number; periods: number }
>;

export type PolicyRef = {
  policyId: number;
  subjectName: string;
  studentCount: number;
  employeeId: number;
};

export type SubjectQuantity = {
  subjectId: number;
  subjectName: string;
  policyStudents: number;
  policyPeriods: number;
  policies: PolicyRef[];
  tables: Record<QuantityTableKey, QuantityCell>;
};

export type SchoolQuantitySummary = {
  schoolId: number;
  schoolName: string;
  policyStudents: number;
  policyPeriods: number;
  /** HS / số tiết kế toán dùng để so với kinh doanh = bảng Doanh Thu. */
  accountingStudents: number;
  accountingPeriods: number;
  tables: QuantityTotals;
  subjects: SubjectQuantity[];
  policies: PolicyRef[];
};

const numberValue = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const itemsOf = (summary: any, key: string): any[] => {
  const payload =
    summary?.data && !Array.isArray(summary.data) ? summary.data : summary;
  const source = payload?.summary || payload || {};
  return Array.isArray(source?.[key]) ? source[key] : [];
};

/** Khớp `invoiceTypeOf` + `isInvoiceIssued` của bảng Hóa Đơn. */
const INVOICE_ISSUED_TYPES = new Set(["company", "student", "other"]);
export const isInvoiceIssued = (item: any) =>
  INVOICE_ISSUED_TYPES.has(item?.invoiceType || (item?.invoiced ? "company" : ""));

/**
 * Thứ tự "mới nhất": tháng thật theo năm/tháng; dòng tuỳ chỉnh (tháng ảo > 12,
 * thường là bản nhân bản) xếp sau mọi tháng thật, chỉ dùng khi không có tháng
 * thật nào có số.
 */
const periodRank = (period: ExpensePeriodInfo) =>
  period.month >= 1 && period.month <= 12
    ? period.year * 100 + period.month
    : period.year * 100 + period.month - 100_000_000;

const emptyTotals = (): QuantityTotals => ({
  revenue: { students: 0, periods: 0 },
  invoice: { students: 0, periods: 0 },
  school: { students: 0, periods: 0 },
  management: { students: 0, periods: 0 },
});

const emptyCells = (): Record<QuantityTableKey, QuantityCell> => ({
  revenue: { students: 0, periods: 0, period: null },
  invoice: { students: 0, periods: 0, period: null },
  school: { students: 0, periods: 0, period: null },
  management: { students: 0, periods: 0, period: null },
});

type Snapshot = {
  period: ExpensePeriodInfo;
  rank: number;
  sheetId: number;
  totals: QuantityTotals;
};

type BuildOptions = {
  schoolYear: string;
  selectedPeriod: ExpensePeriodInfo | null;
};

/**
 * Tổng hợp số học sinh / số tiết theo trường từ hai nguồn:
 * - chính sách đã duyệt do kinh doanh khai;
 * - các bảng kế toán nhập trong QL thu chi: Doanh Thu, Hóa Đơn (HS của dòng
 *   đã xuất hóa đơn), Chi Trường, Chi Ngoài.
 *
 * HS là sĩ số nên không cộng dồn các kỳ: với từng môn và từng bảng, lấy số của
 * kỳ mới nhất có dòng nhập (trong năm học / kỳ đang lọc), cộng các dòng trong
 * kỳ đó; số của trường = tổng các môn.
 */
export const buildSchoolQuantitySummary = (
  policies: QuantityPolicy[],
  sheets: QuantitySheet[],
  { schoolYear, selectedPeriod }: BuildOptions = {
    schoolYear: "",
    selectedPeriod: null,
  },
): SchoolQuantitySummary[] => {
  type SchoolBucket = {
    schoolId: number;
    schoolName: string;
    subjects: Map<number, SubjectQuantity>;
    policies: PolicyRef[];
  };
  const schools = new Map<number, SchoolBucket>();

  policies.forEach((policy) => {
    const schoolId = numberValue(policy.schoolId);
    if (!schoolId) return;
    const school = schools.get(schoolId) || {
      schoolId,
      schoolName: policy.schoolName || `Trường #${schoolId}`,
      subjects: new Map<number, SubjectQuantity>(),
      policies: [],
    };
    const subjectId = numberValue(policy.subjectId);
    const subject = school.subjects.get(subjectId) || {
      subjectId,
      subjectName:
        policy.subjectName || (subjectId ? `Môn #${subjectId}` : "Chưa rõ môn"),
      policyStudents: 0,
      policyPeriods: 0,
      policies: [],
      tables: emptyCells(),
    };
    subject.policyStudents += numberValue(policy.studentCount);
    subject.policyPeriods += numberValue(policy.totalLessons);

    const policyId = numberValue(policy.policyId || policy.id);
    if (policyId && !school.policies.some((ref) => ref.policyId === policyId)) {
      const ref: PolicyRef = {
        policyId,
        subjectName: subject.subjectName,
        studentCount: numberValue(policy.studentCount),
        employeeId: numberValue(policy.employeeId),
      };
      subject.policies.push(ref);
      school.policies.push(ref);
    }

    school.subjects.set(subjectId, subject);
    schools.set(schoolId, school);
  });

  // school → subject → các kỳ có dòng nhập
  const snapshots = new Map<number, Map<number, Snapshot[]>>();

  sheets.forEach(({ record, summary }) => {
    const schoolId = numberValue(record?.school?.id ?? record?.schoolId);
    const school = schools.get(schoolId);
    if (!school) return;
    const period = toPeriod(record?.period);
    if (!matchesPeriodFilter({ period }, schoolYear, selectedPeriod)) return;

    // Chính sách có môn thì chỉ tính đúng các môn đó (như trước).
    const restrictSubjects = Array.from(school.subjects.keys()).some(Boolean);
    const perSubject = new Map<number, QuantityTotals>();
    const add = (table: QuantityTableKey, item: any) => {
      const subjectId = numberValue(item?.subjectId);
      if (restrictSubjects && !school.subjects.has(subjectId)) return;
      const totals = perSubject.get(subjectId) || emptyTotals();
      totals[table].students += numberValue(item?.studentCount);
      totals[table].periods += numberValue(item?.totalPeriods);
      perSubject.set(subjectId, totals);
    };

    itemsOf(summary, "revenueItems").forEach((item) => {
      add("revenue", item);
      if (isInvoiceIssued(item)) add("invoice", item);
    });
    itemsOf(summary, "schoolExpenseItems").forEach((item) =>
      add("school", item),
    );
    itemsOf(summary, "managementExpenseItems").forEach((item) =>
      add("management", item),
    );

    const bySubject = snapshots.get(schoolId) || new Map<number, Snapshot[]>();
    perSubject.forEach((totals, subjectId) => {
      bySubject.set(subjectId, [
        ...(bySubject.get(subjectId) || []),
        {
          period,
          rank: periodRank(period),
          sheetId: numberValue(record?.id),
          totals,
        },
      ]);
    });
    snapshots.set(schoolId, bySubject);
  });

  return Array.from(schools.values())
    .map((school) => {
      const bySubject = snapshots.get(school.schoolId);
      bySubject?.forEach((list, subjectId) => {
        if (!school.subjects.has(subjectId)) {
          school.subjects.set(subjectId, {
            subjectId,
            subjectName: subjectId ? `Môn #${subjectId}` : "Chưa rõ môn",
            policyStudents: 0,
            policyPeriods: 0,
            policies: [],
            tables: emptyCells(),
          });
        }
        const subject = school.subjects.get(subjectId)!;
        QUANTITY_TABLES.forEach(({ key }) => {
          const latest = list
            .filter(
              (item) => item.totals[key].students || item.totals[key].periods,
            )
            .sort(
              (left, right) =>
                right.rank - left.rank || right.sheetId - left.sheetId,
            )[0];
          if (latest) {
            subject.tables[key] = { ...latest.totals[key], period: latest.period };
          }
        });
      });

      const subjects = Array.from(school.subjects.values()).sort(
        (left, right) => left.subjectName.localeCompare(right.subjectName, "vi"),
      );
      const tables = emptyTotals();
      subjects.forEach((subject) => {
        QUANTITY_TABLES.forEach(({ key }) => {
          tables[key].students += subject.tables[key].students;
          tables[key].periods += subject.tables[key].periods;
        });
      });

      return {
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        policyStudents: subjects.reduce((sum, s) => sum + s.policyStudents, 0),
        policyPeriods: subjects.reduce((sum, s) => sum + s.policyPeriods, 0),
        accountingStudents: tables.revenue.students,
        accountingPeriods: tables.revenue.periods,
        tables,
        subjects,
        policies: school.policies,
      };
    })
    .sort((left, right) => left.schoolName.localeCompare(right.schoolName, "vi"));
};
