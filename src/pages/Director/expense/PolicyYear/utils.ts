import {
  CalculatedPolicyRow,
  PolicyMonthlyInput,
  PolicySubject,
  PolicySummary,
  PolicyYear,
} from "./types";

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const parseCurrency = (value: string) => {
  const normalized = value.replace(/[^\d-]/g, "");
  return Number(normalized || 0);
};

export const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  return month && year ? `${month}/${year}` : value;
};

export const getSchoolYearFromMonth = (value: string) => {
  const [yearPart, monthPart] = value.split("-").map(Number);
  if (!yearPart || !monthPart) return "";
  return monthPart >= 8
    ? `${yearPart}-${yearPart + 1}`
    : `${yearPart - 1}-${yearPart}`;
};

export const calculatePolicyRow = (
  row: PolicyMonthlyInput,
  subject: PolicySubject,
): CalculatedPolicyRow => {
  const studentCount = Number(row.studentCount || 0);
  const monthsCount = Number(row.monthsCount || 0);
  const unitPrice = Number(row.unitPrice || 0);
  const schoolRevenue = studentCount * unitPrice * monthsCount;
  const tkdAmount = studentCount * monthsCount * 420;
  const schoolRetainAmount =
    Number(subject.schoolRetainUnit || 0) * studentCount * monthsCount;
  const companyPaymentAmount = schoolRevenue - schoolRetainAmount;
  const totalInitialPolicyAmount =
    Number(row.cashPolicyAmount || 0) +
    Number(row.equipmentPolicyAmount || 0);
  const policyDivisor = Number(subject.companyProfitPerHS || 0) === 0 ? 9 : 35;
  const calculatedPolicyAmount =
    (Number(row.cashPolicyAmount || 0) / 1000 / policyDivisor) *
    studentCount *
    monthsCount;
  const policyAfterTaxAmount = calculatedPolicyAmount * 0.9;
  const totalPaidAmount =
    Number(row.paidCashAmount || 0) + Number(row.paidEquipmentAmount || 0);

  return {
    ...row,
    subject,
    schoolRevenue,
    tkdAmount,
    schoolRetainAmount,
    companyPaymentAmount,
    totalInitialPolicyAmount,
    calculatedPolicyAmount,
    policyAfterTaxAmount,
    totalPaidAmount,
    remainingAmount: policyAfterTaxAmount - totalPaidAmount,
  };
};

export const calculatePolicySummary = (
  rows: PolicyMonthlyInput[],
  subjects: PolicySubject[],
): PolicySummary => {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const calculatedRows = rows.flatMap((row) => {
    const subject = subjectMap.get(row.subjectId);
    return subject ? [calculatePolicyRow(row, subject)] : [];
  });

  return calculatedRows.reduce<PolicySummary>(
    (summary, row) => ({
      totalStudents: summary.totalStudents + row.studentCount,
      totalRevenue: summary.totalRevenue + row.schoolRevenue,
      totalTkd: summary.totalTkd + row.tkdAmount,
      totalSchoolRetain: summary.totalSchoolRetain + row.schoolRetainAmount,
      totalCompanyPayment:
        summary.totalCompanyPayment + row.companyPaymentAmount,
      totalInitialPolicy:
        summary.totalInitialPolicy + row.totalInitialPolicyAmount,
      totalPolicyAfterTax:
        summary.totalPolicyAfterTax + row.policyAfterTaxAmount,
      totalPaid: summary.totalPaid + row.totalPaidAmount,
      totalRemaining: summary.totalRemaining + row.remainingAmount,
    }),
    {
      totalStudents: 0,
      totalRevenue: 0,
      totalTkd: 0,
      totalSchoolRetain: 0,
      totalCompanyPayment: 0,
      totalInitialPolicy: 0,
      totalPolicyAfterTax: 0,
      totalPaid: 0,
      totalRemaining: 0,
    },
  );
};

export const buildPolicyYearSavePayload = (policy: PolicyYear) => {
  const summary = calculatePolicySummary(policy.monthlyRows, policy.subjects);
  const subjectMap = new Map(policy.subjects.map((subject) => [subject.id, subject]));

  return {
    id: policy.id,
    schoolName: policy.schoolName,
    schoolYear: policy.schoolYear,
    status: policy.status,
    subjects: policy.subjects.map((subject) => ({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      tuitionPrice: Number(subject.tuitionPrice || 0),
      schoolRetainUnit: Number(subject.schoolRetainUnit || 0),
      policyTotalAmount: Number(subject.policyTotalAmount || 0),
      policyStudentBase: Number(subject.policyStudentBase || 0),
      policyMonthBase: Number(subject.policyMonthBase || 0),
      taxPercent: Number(subject.taxPercent || 0),
      companyProfitPerHS: Number(subject.companyProfitPerHS || 0),
      cashSupportAmount: Number(subject.cashSupportAmount || 0),
      equipmentSupportAmount: Number(subject.equipmentSupportAmount || 0),
    })),
    monthlyRows: policy.monthlyRows.map((row, index) => {
      const subject = subjectMap.get(row.subjectId);
      const calculated = subject ? calculatePolicyRow(row, subject) : null;

      return {
        id: row.id,
        rowIndex: index,
        subjectId: row.subjectId,
        month: row.month,
        studentCount: Number(row.studentCount || 0),
        unitPrice: Number(row.unitPrice || 0),
        monthsCount: Number(row.monthsCount || 0),
        principalPolicyAmount: Number(row.principalPolicyAmount || 0),
        cashPolicyAmount: Number(row.cashPolicyAmount || 0),
        equipmentPolicyAmount: Number(row.equipmentPolicyAmount || 0),
        paidCashAmount: Number(row.paidCashAmount || 0),
        paidEquipmentAmount: Number(row.paidEquipmentAmount || 0),
        calculatedPolicyAmount: Math.round(
          calculated?.calculatedPolicyAmount || 0,
        ),
        policyAfterTaxAmount: Math.round(calculated?.policyAfterTaxAmount || 0),
        note: row.note || "",
      };
    }),
    summary: {
      totalStudents: Number(summary.totalStudents || 0),
      totalRevenue: Math.round(summary.totalRevenue || 0),
      totalTkd: Math.round(summary.totalTkd || 0),
      totalSchoolRetain: Math.round(summary.totalSchoolRetain || 0),
      totalCompanyPayment: Math.round(summary.totalCompanyPayment || 0),
      totalInitialPolicy: Math.round(summary.totalInitialPolicy || 0),
      totalPolicyAfterTax: Math.round(summary.totalPolicyAfterTax || 0),
      totalPaid: Math.round(summary.totalPaid || 0),
      totalRemaining: Math.round(summary.totalRemaining || 0),
    },
  };
};

const escapeCsvCell = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

export const exportPolicyYearCsv = (
  schoolName: string,
  schoolYear: string,
  rows: CalculatedPolicyRow[],
) => {
  const headers = [
    "Trường",
    "Năm học",
    "Môn học",
    "Tháng",
    "SL HS",
    "Đơn giá",
    "Số tháng",
    "Doanh thu",
    "TKD",
    "Để lại trường",
    "Công ty nhận",
    "Chính sách sau thuế",
    "Đã chi",
    "Còn lại chi",
    "Ghi chú",
  ];
  const body = rows.map((row) => [
    schoolName,
    schoolYear,
    row.subject.name,
    formatMonth(row.month),
    row.studentCount,
    row.unitPrice,
    row.monthsCount,
    row.schoolRevenue,
    row.tkdAmount,
    row.schoolRetainAmount,
    row.companyPaymentAmount,
    Math.round(row.policyAfterTaxAmount),
    row.totalPaidAmount,
    Math.round(row.remainingAmount),
    row.note,
  ]);
  const csv = [headers, ...body]
    .map((line) => line.map(escapeCsvCell).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chinh-sach-nam-${schoolYear}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportPolicyYearsCsv = (policies: PolicyYear[]) => {
  const rows = policies.flatMap((policy) => {
    const subjectMap = new Map(
      policy.subjects.map((subject) => [subject.id, subject]),
    );

    return policy.monthlyRows.flatMap((row) => {
      const subject = subjectMap.get(row.subjectId);
      if (!subject) return [];

      const calculated = calculatePolicyRow(row, subject);
      return [
        [
          policy.schoolName,
          policy.schoolYear,
          calculated.subject.name,
          formatMonth(calculated.month),
          calculated.studentCount,
          calculated.schoolRevenue,
          calculated.schoolRetainAmount,
          calculated.companyPaymentAmount,
          Math.round(calculated.policyAfterTaxAmount),
          calculated.totalPaidAmount,
          Math.round(calculated.remainingAmount),
        ],
      ];
    });
  });
  const headers = [
    "Trường",
    "Năm học",
    "Môn học",
    "Tháng",
    "SL HS",
    "Doanh thu",
    "Để lại trường",
    "Công ty nhận",
    "Chính sách sau thuế",
    "Đã chi",
    "Còn lại chi",
  ];
  const csv = [headers, ...rows]
    .map((line) => line.map(escapeCsvCell).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bao-cao-chinh-sach-nam.csv";
  anchor.click();
  URL.revokeObjectURL(url);
};
