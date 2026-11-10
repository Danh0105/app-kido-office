import api from "./api";

/**
 * Lương giáo viên cộng tác viên theo trường / môn (chỉ đọc), tính từ chấm công:
 * buổi "Có mặt", đơn giá tiết × số tiết + chi phí khác của buổi.
 */
export type CollaboratorPayrollTotals = {
  teacherCount: number;
  presentSessions: number;
  payablePeriods: number;
  teachingAmount: number;
  otherCostsAmount: number;
  totalAmount: number;
  /** Buổi đã dạy mà chưa có đơn giá tiết. */
  missingRateSessions: number;
  /** Buổi đã tới ngày mà chưa chấm công. */
  uncheckedSessions: number;
};

export type CollaboratorPayrollTeacher = Omit<
  CollaboratorPayrollTotals,
  "teacherCount"
> & {
  teacherId: number;
  teacherName: string;
  minRate: number | null;
  maxRate: number | null;
};

export type CollaboratorPayrollSubject = CollaboratorPayrollTotals & {
  subjectId: number;
  subjectName: string;
  subjectCode: string | null;
  schoolYear: string | null;
  teachers: CollaboratorPayrollTeacher[];
};

export type CollaboratorPayrollSchool = CollaboratorPayrollTotals & {
  schoolId: number;
  schoolName: string;
  subjects: CollaboratorPayrollSubject[];
};

export type CollaboratorPayrollResult = {
  fromDate: string;
  toDate: string;
  schools: CollaboratorPayrollSchool[];
  grandTotal: CollaboratorPayrollTotals;
};

export type CollaboratorPayrollQuery = {
  fromDate: string;
  toDate: string;
  schoolId?: number;
  subjectId?: number;
};

/** Khớp `CASHFLOW_TEACHER_PAY_ROLES` ở backend (không gồm Sales Admin). */
export const COLLABORATOR_PAY_ROLES = [
  "accountant",
  "ketoan_congno",
  "ketoan_truong",
  "thuquy",
  "troly_gd",
  "director",
];

export const collaboratorPayrollApi = {
  summary: async (
    params: CollaboratorPayrollQuery,
  ): Promise<CollaboratorPayrollResult> => {
    const res = await api.get("/collaborator-payroll", { params });
    return res.data;
  },
};
