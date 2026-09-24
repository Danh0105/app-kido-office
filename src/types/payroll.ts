export type PayrollEmployee = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  department?: { id: number; name: string } | null;
};

export type PayrollStatus = "DRAFT" | "SENT";

export type Payroll = {
  id: number;
  employeeId: number;
  employeeName: string;
  employee?: PayrollEmployee;
  jobTitle: string | null;
  status: PayrollStatus;
  sentAt: string | null;
  sentById: number | null;
  sentByName: string | null;
  month: number;
  year: number;
  standardWorkingDays: number;
  probationWorkingDays: number;
  officialWorkingDays: number;
  annualLeaveDays: number;
  holidayDays: number;
  unpaidLeaveDays: number;
  leaveNote: string | null;
  excessPeriods: number;
  remainingLeavePreviousYear: number;
  remainingLeaveCurrentYear: number;
  baseSalary: number;
  officialWorkSalary: number;
  probationWorkSalary: number;
  fuelAllowance: number;
  overtimeAllowance: number;
  excessPeriodAllowance: number;
  otherSupport: number;
  bonus: number;
  totalIncome: number;
  socialInsurance: number;
  personalIncomeTax: number;
  adjustmentAmount: number;
  adjustmentNote: string | null;
  advancePayment: number;
  totalDeduction: number;
  netSalary: number;
  note: string | null;
  createdById: number;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export const PAYROLL_NUMBER_FIELDS = [
  "standardWorkingDays",
  "probationWorkingDays",
  "officialWorkingDays",
  "annualLeaveDays",
  "holidayDays",
  "unpaidLeaveDays",
  "excessPeriods",
  "remainingLeavePreviousYear",
  "remainingLeaveCurrentYear",
  "baseSalary",
  "officialWorkSalary",
  "probationWorkSalary",
  "fuelAllowance",
  "overtimeAllowance",
  "excessPeriodAllowance",
  "otherSupport",
  "bonus",
  "socialInsurance",
  "personalIncomeTax",
  "adjustmentAmount",
  "advancePayment",
] as const;

export type PayrollNumberField = (typeof PAYROLL_NUMBER_FIELDS)[number];

export type CreatePayrollPayload = Pick<Payroll, "employeeId" | "month" | "year"> &
  Partial<
    Pick<Payroll, PayrollNumberField> &
      Pick<Payroll, "jobTitle" | "leaveNote" | "adjustmentNote" | "note">
  >;

export type UpdatePayrollPayload = Partial<
  Pick<Payroll, PayrollNumberField> &
    Pick<Payroll, "jobTitle" | "leaveNote" | "adjustmentNote" | "note">
>;

export type PayrollQuery = {
  employeeId?: number;
  month?: number;
  year?: number;
  status?: PayrollStatus;
  page?: number;
  limit?: number;
};

export type PayrollListResponse = {
  data: Payroll[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
