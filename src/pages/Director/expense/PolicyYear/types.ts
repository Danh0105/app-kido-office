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
  companyProfitPerHS?: number;
  cashSupportAmount?: number;
  equipmentSupportAmount?: number;
  /** Loại tính học phí của chính sách được duyệt. */
  billingMode?: "HS" | "TIET";
  classCount?: number;
  declaredStudentCount?: number;
  declaredPeriods?: number;
};

export type PolicyMonthlyInput = {
  id: number;
  subjectId: number;
  month: string;
  /** Tên kỳ kế toán đã đổi (vd. "Lần 1 năm 2026") — hiển thị thay cho MM/YYYY */
  monthLabel?: string;
  totalPeriods: number;
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
  annualPolicyId?: number | null;
  schoolName: string;
  schoolYear: string;
  status: PolicyYearStatus;
  subjects: PolicySubject[];
  monthlyRows: PolicyMonthlyInput[];
  updatedAt: string;
  contractFileUrl?: string | null;
  contractFileName?: string | null;
  contractUploadedByName?: string | null;
  contractUploadedAt?: string | null;
  giftFlowersCompleted?: boolean;
  openingCeremonyCompleted?: boolean;
  teachersDayCompleted?: boolean;
};

export type PolicySummary = {
  totalPeriods: number;
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
