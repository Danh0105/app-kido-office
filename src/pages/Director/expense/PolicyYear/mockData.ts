import { PolicyMonthlyInput, PolicySubject, PolicyYear } from "./types";

export const MOCK_POLICY_SUBJECTS: PolicySubject[] = [
  {
    id: 1,
    code: "STEM",
    name: "STEM",
    tuitionPrice: 96000,
    schoolRetainUnit: 11520,
    policyTotalAmount: 110000000,
    policyStudentBase: 1000,
    policyMonthBase: 9,
    taxPercent: 10,
  },
  {
    id: 2,
    code: "KNS",
    name: "Kỹ năng sống",
    tuitionPrice: 75000,
    schoolRetainUnit: 6280,
    policyTotalAmount: 80000000,
    policyStudentBase: 1000,
    policyMonthBase: 9,
    taxPercent: 10,
  },
  {
    id: 3,
    code: "CDS",
    name: "Công Dân Số",
    tuitionPrice: 85000,
    schoolRetainUnit: 8500,
    policyTotalAmount: 90000000,
    policyStudentBase: 1000,
    policyMonthBase: 9,
    taxPercent: 10,
  },
];

const createMonthlyRow = (
  id: number,
  subjectId: number,
  month: string,
  studentCount: number,
  unitPrice: number,
  values: Partial<PolicyMonthlyInput> = {},
): PolicyMonthlyInput => ({
  id,
  subjectId,
  month,
  studentCount,
  unitPrice,
  monthsCount: 1,
  principalPolicyAmount: 2500000,
  cashPolicyAmount: 3500000,
  equipmentPolicyAmount: 2000000,
  paidCashAmount: 3000000,
  paidEquipmentAmount: 1500000,
  note: "",
  ...values,
});

const activeRows: PolicyMonthlyInput[] = [
  createMonthlyRow(1, 1, "2025-09", 800, 96000, {
    principalPolicyAmount: 3000000,
    cashPolicyAmount: 4200000,
    equipmentPolicyAmount: 2600000,
    paidCashAmount: 5000000,
    paidEquipmentAmount: 2000000,
    note: "Đợt thu đầu năm",
  }),
  createMonthlyRow(2, 1, "2025-10", 790, 96000, {
    principalPolicyAmount: 2800000,
    cashPolicyAmount: 4000000,
    paidCashAmount: 6500000,
    paidEquipmentAmount: 1800000,
  }),
  createMonthlyRow(3, 1, "2025-11", 785, 96000, {
    principalPolicyAmount: 2800000,
    cashPolicyAmount: 3900000,
    equipmentPolicyAmount: 1800000,
    paidCashAmount: 7000000,
    paidEquipmentAmount: 1500000,
  }),
  createMonthlyRow(4, 2, "2025-09", 820, 75000, {
    principalPolicyAmount: 2500000,
    cashPolicyAmount: 3200000,
    equipmentPolicyAmount: 1500000,
    paidCashAmount: 4300000,
    paidEquipmentAmount: 1200000,
  }),
  createMonthlyRow(5, 2, "2025-10", 815, 75000, {
    principalPolicyAmount: 2500000,
    cashPolicyAmount: 3200000,
    equipmentPolicyAmount: 1500000,
    paidCashAmount: 5200000,
    paidEquipmentAmount: 1200000,
  }),
  createMonthlyRow(6, 2, "2025-11", 810, 75000, {
    principalPolicyAmount: 2500000,
    cashPolicyAmount: 3000000,
    equipmentPolicyAmount: 1400000,
    paidCashAmount: 5600000,
    paidEquipmentAmount: 1300000,
    note: "Đã đối soát",
  }),
];

export const MOCK_POLICY_YEARS: PolicyYear[] = [
  {
    id: 1,
    schoolName: "TRƯỜNG TRUNG HỌC CƠ SỞ NGUYỄN VĂN BỨA",
    schoolYear: "2025-2026",
    status: "ACTIVE",
    subjects: MOCK_POLICY_SUBJECTS,
    monthlyRows: activeRows,
    updatedAt: "2026-06-29T08:00:00.000Z",
  },
  {
    id: 2,
    schoolName: "TRƯỜNG TIỂU HỌC PHAN VĂN HỚN",
    schoolYear: "2025-2026",
    status: "DRAFT",
    subjects: MOCK_POLICY_SUBJECTS.slice(0, 2),
    monthlyRows: activeRows.slice(0, 2).map((row, index) => ({
      ...row,
      id: 20 + index,
      studentCount: Math.round(row.studentCount * 0.7),
    })),
    updatedAt: "2026-06-27T03:00:00.000Z",
  },
  {
    id: 3,
    schoolName: "TRƯỜNG THCS TÂN XUÂN",
    schoolYear: "2024-2025",
    status: "LOCKED",
    subjects: MOCK_POLICY_SUBJECTS.slice(0, 2),
    monthlyRows: activeRows.slice(2, 6).map((row, index) => ({
      ...row,
      id: 30 + index,
      month: row.month.replace("2025", "2024"),
      studentCount: Math.round(row.studentCount * 0.8),
    })),
    updatedAt: "2025-06-30T03:00:00.000Z",
  },
];

