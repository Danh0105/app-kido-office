export type PolicyYearStatus = "DRAFT" | "ACTIVE" | "LOCKED";

export type PolicySubject = {
  id: number;
  code: string;
  name: string;
  tuitionPrice: number;
  schoolRetainUnit: number;
  policyTotalAmount: number;
  policyStudentBase: number;
  policyMonthBase: number;
  taxPercent: number;
};

export type PolicyMonthlyInput = {
  id: number;
  subjectId: number;
  month: string;
  studentCount: number;
  unitPrice: number;
  monthsCount: number;
  principalPolicyAmount: number;
  cashPolicyAmount: number;
  equipmentPolicyAmount: number;
  paidCashAmount: number;
  paidEquipmentAmount: number;
  note: string;
};

export type CalculatedPolicyRow = PolicyMonthlyInput & {
  subject: PolicySubject;
  schoolRevenue: number;
  tkdAmount: number;
  schoolRetainAmount: number;
  companyPaymentAmount: number;
  totalInitialPolicyAmount: number;
  calculatedPolicyAmount: number;
  policyAfterTaxAmount: number;
  totalPaidAmount: number;
  remainingAmount: number;
};

export type PolicyYear = {
  id: number;
  schoolName: string;
  schoolYear: string;
  status: PolicyYearStatus;
  subjects: PolicySubject[];
  monthlyRows: PolicyMonthlyInput[];
  updatedAt: string;
};

export type PolicySummary = {
  totalStudents: number;
  totalRevenue: number;
  totalTkd: number;
  totalSchoolRetain: number;
  totalCompanyPayment: number;
  totalInitialPolicy: number;
  totalPolicyAfterTax: number;
  totalPaid: number;
  totalRemaining: number;
};

