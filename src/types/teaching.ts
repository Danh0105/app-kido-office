// Types & metadata for the "Giảng dạy" module (Nhân sự quản lý lịch dạy + chấm công).
// Chấm công nằm ngay trên buổi dạy — không có bảng chấm công riêng.

export type SessionStatus =
  | "SCHEDULED"
  | "PRESENT"
  | "ABSENT"
  | "EXCUSED"
  | "CANCELLED";

/** Phản hồi của giáo viên sau khi Nhân sự gửi lịch (khác trạng thái chấm công). */
export type ScheduleResponseStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export type ScheduleConfirmationStatus = "PENDING" | "CONFIRMED" | "REJECTED";

/** Mục danh mục backend trả kèm để FE hiển thị tên mà không phải gọi thêm API. */
export interface TeachingRefItem {
  id: number;
  name: string;
  /** Chỉ có ở danh mục môn. */
  code?: string | null;
}

export type TeacherRole = "giaovien_congty" | "giaovien_ctv";

export interface Teacher {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  employeeId: number | null;
  employeeName: string | null;
  /** Loại do backend trả; null là hồ sơ cũ/thuê ngoài chưa phân loại. */
  teacherRole: TeacherRole | null;
  isActive: boolean;
  note: string | null;
  /** ID Zalo Mini App của giáo viên; null = chưa khai. */
  zaloUid: string | null;
  /** ID Zalo OA của giáo viên, dùng để gửi thông báo; null = chưa khai. */
  zaloUserId: string | null;

  // ---- Dữ liệu phục vụ gợi ý lịch dạy ----
  /** Link vị trí Google Maps của giáo viên; null = chưa khai. */
  googleMapsUrl: string | null;
  /** Toạ độ backend giải ra từ `googleMapsUrl`; null = chưa biết vị trí. */
  latitude?: number | null;
  longitude?: number | null;
  /** Xã/phường giáo viên nhận dạy; mảng rỗng = chưa giới hạn xã/phường. */
  wardIds: number[];
  /** Tên các xã/phường ở `wardIds` — dùng để hiển thị, payload vẫn gửi ID. */
  allowedWards: TeachingRefItem[];
  /**
   * Trường thuộc các xã/phường ở `wardIds` — suy ra động từ backend, KHÔNG
   * phải danh sách chốt cứng. Chỉ để hiển thị (vd. lọc gợi ý giáo viên theo
   * trường); muốn đổi phạm vi trường thì sửa `wardIds`, không sửa trực tiếp.
   */
  schoolIds: number[];
  allowedSchools: TeachingRefItem[];
  /**
   * Môn giáo viên có thể dạy — ID của **danh mục môn dùng chung**
   * (`/subject-catalogs`), không phải môn riêng của từng trường (`/subjects`).
   */
  subjectCatalogIds: number[];
  teachableSubjects: TeachingRefItem[];

  // ---- Giáo viên xin rút khỏi buổi đã được phân công ----
  /** Thời điểm giáo viên từ chối buổi; null = không có yêu cầu thay thế. */
  declinedAt?: string | null;
  /** Lý do bắt buộc do giáo viên nhập. */
  declineReason?: string | null;
  /** Giữ tên người vừa từ chối sau khi teacherId được gỡ khỏi buổi. */
  declinedTeacherName?: string | null;
  /** Định mức tiết mỗi tuần; null = không giới hạn. */
  maxPeriodsPerWeek: number | null;
  /** Đơn giá mặc định mỗi tiết; null = chưa khai, 0 = dạy không công. */
  defaultRatePerPeriod: number | null;
}

export type TeacherLocationChangeStatus = "pending" | "approved" | "rejected";

export interface TeacherLocationChangeRequest {
  id: number;
  teacherId: number;
  teacherName: string | null;
  latitude: number;
  longitude: number;
  previousLatitude: number | null;
  previousLongitude: number | null;
  status: TeacherLocationChangeStatus;
  reviewedBy: number | null;
  reviewerName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/**
 * Lớp học của một trường — Nhân sự tạo lớp trước, rồi mới xếp lịch dạy cho lớp.
 * Cùng tên lớp ở năm học khác là hai lớp khác nhau (khoá sau).
 */
export interface SchoolClass {
  id: number;
  schoolId: number;
  schoolName: string;
  /** null = lớp thuộc thẳng trường, trường chưa/không chia điểm trường. */
  schoolLocationId?: number | null;
  locationName?: string | null;
  name: string;
  /** null với mầm non / lớp không khai báo khối. */
  gradeLevel: number | null;
  schoolYear: string;
  studentCount: number;
  /** GVCN phía trường — không phải hồ sơ giáo viên của hệ thống. */
  homeroomTeacher: string | null;
  isActive: boolean;
  note: string | null;
  /** Lớp đang được dùng ở bao nhiêu mẫu lịch / buổi dạy — >0 thì không xoá được. */
  scheduleCount: number;
  sessionCount: number;
  /** Các môn riêng của trường đã gắn với lớp này. */
  subjectIds: number[];
  subjects: SchoolClassSubject[];
}

/** Môn của lớp; backend có thể trả thêm giáo viên phù hợp để gợi ý phân công. */
export interface SchoolClassSubject extends TeachingRefItem {
  catalogId: number | null;
  recommendedTeachers?: TeachingRefItem[];
}

export interface TeachingSchedule {
  id: number;
  teacherId: number;
  teacherName: string;
  schoolId: number;
  schoolName: string;
  /** Điểm trường suy từ lớp; null = trường không chia cơ sở. */
  schoolLocationId?: number | null;
  locationName?: string | null;
  /** null với mẫu lịch tạo trước khi có module lớp học. */
  classId: number | null;
  className: string | null;
  classGradeLevel: number | null;
  subjectId: number;
  subjectName: string;
  schoolYear: string | null;
  dayOfWeek: number;
  dayOfWeekLabel: string | null;
  startTime: string; // "07:30"
  endTime: string; // "09:00"
  /** Số tiết của mỗi buổi sinh ra từ mẫu lịch này. */
  periods: number | null;
  /**
   * Đơn giá hiện tại của môn học — chỉ để tham khảo, không lưu ở mẫu lịch.
   * Buổi sinh ra từ mẫu chốt theo giá môn học tại đúng thời điểm sinh, có thể
   * khác giá trị này nếu Nhân sự đổi giá môn sau đó.
   */
  subjectRatePerPeriod: number | null;
  effectiveFrom: string; // "2026-08-01"
  effectiveTo: string | null;
  isActive: boolean;
  note: string | null;
  /** Phản hồi của giáo viên với mẫu lịch đã gửi. */
  confirmationStatus?: ScheduleConfirmationStatus | string | null;
  confirmedAt?: string | null;
  rejectionReason?: string | null;
}

export type LessonImage = {
  id: number;
  url: string;
  /** API thư viện ảnh trả thumbnail nhỏ; dữ liệu cũ chỉ có `url`. */
  thumbnailUrl?: string | null;
};

export interface TeachingSession {
  id: number;
  scheduleId: number | null; // null = buổi lẻ / dạy bù
  /** null = tiết đang mở, chưa phân công giáo viên. */
  teacherId: number | null;
  teacherName: string | null;
  schoolId: number;
  schoolName: string;
  /** Điểm trường của buổi dạy; null = trường không chia cơ sở. */
  schoolLocationId?: number | null;
  locationName?: string | null;
  /** null với buổi tạo trước khi có module lớp học. */
  classId: number | null;
  className: string | null;
  classGradeLevel: number | null;
  /** Sĩ số của lớp (đăng ký) — khác `actualStudentCount` (thực tế có mặt buổi này). */
  classStudentCount?: number | null;
  subjectId: number;
  subjectName: string;
  schoolYear: string | null;
  date: string; // "2026-08-04"
  dayOfWeek: number;
  dayOfWeekLabel: string | null;
  startTime: string;
  endTime: string;
  /** Số tiết của buổi dạy — căn cứ tính công cho giáo viên. */
  periods: number | null;
  /**
   * Đơn giá mỗi tiết **đã chốt** cho buổi này — nguồn duy nhất để tính tiền.
   * Chốt lúc tạo buổi nên bảng công tháng cũ không đổi khi giáo viên tăng giá.
   * null = chưa khai giá.
   */
  ratePerPeriod: number | null;
  /**
   * Tiền công của buổi = `ratePerPeriod × periods`, do backend tính.
   * `null` = **chưa khai đơn giá**, khác hẳn `0` = dạy không công.
   */
  amount: number | null;
  /** Khoảng cách tới trường và phụ cấp xăng đã chốt lúc tạo buổi. */
  distanceToSchoolKm: number | null;
  gasAllowance: number | null;
  /** Các khoản phát sinh của buổi; dữ liệu cũ có thể chưa trả field này. */
  otherCosts?: AttendanceOtherCost[];
  otherCostsTotal?: number;
  /** Tiền tiết dạy + chi phí khác; backend tính sẵn. */
  totalAmount?: number;
  /** Trạng thái phân công giáo viên (khác với chấm công `status`). */
  assignmentStatus: AssignmentStatus;
  /** Số giáo viên đã đăng ký nhận tiết này. */
  applicationCount: number;
  /** Giáo viên đang đăng nhập đã đăng ký chưa (chỉ có ở API của giáo viên). */
  hasApplied?: boolean;
  myApplicationStatus?: ApplicationStatus | null;
  status: SessionStatus;
  statusLabel: string | null;
  /** Trạng thái xác nhận lịch. Optional để vẫn đọc được dữ liệu từ BE phiên bản cũ. */
  scheduleResponseStatus?: ScheduleResponseStatus | string | null;
  /** Một số phiên bản API dùng tên rút gọn này. */
  responseStatus?: ScheduleResponseStatus | string | null;
  scheduleNotifiedAt?: string | null;
  respondedAt?: string | null;
  acceptedAt?: string | null;
  isMakeup: boolean;
  makeupForSessionId: number | null;
  attendanceNote: string | null;

  // ---- Giáo viên xin rút khỏi buổi đã được phân công ----
  // Optional: backend chưa trả các field này (xem TEACHER-DECLINE-SESSION-BE-PROMPT.md).
  /** Thời điểm giáo viên từ chối buổi; null = không có yêu cầu thay thế. */
  declinedAt?: string | null;
  /** Lý do bắt buộc do giáo viên nhập. */
  declineReason?: string | null;
  /** Giữ tên người vừa từ chối sau khi teacherId được gỡ khỏi buổi. */
  declinedTeacherName?: string | null;

  checkedById: number | null;
  checkedByName: string | null;
  checkedAt: string | null; // ISO
  note: string | null;

  // ---- Vị trí trường (BE trả kèm để app tính khoảng cách trước khi gửi) ----
  schoolLatitude: number | null;
  schoolLongitude: number | null;
  /** Bán kính cho phép check-in của trường (mét); null = dùng mặc định. */
  schoolCheckinRadius: number | null;

  /**
   * Buổi này có nằm trong block nhiều tiết liên tiếp cùng trường không: nếu
   * cả hai đều false, tiết này chỉ cần nộp nội dung bài dạy qua
   * `submitLesson` (không cần GPS) — tiết đầu/cuối block đã lo phần check-in/
   * check-out. Buổi lẻ (không liên tiếp trường nào khác) thì cả hai đều true.
   */
  checkinRequired: boolean;
  checkoutRequired: boolean;

  // ---- Check-in của giáo viên ----
  checkinAt: string | null; // ISO
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  /** Sai số GPS thiết bị báo lúc check-in (mét). */
  checkinAccuracy: number | null;
  /** Khoảng cách tới trường do BE tính lại (mét). */
  checkinDistance: number | null;
  /** BE quyết định: ngoài bán kính cho phép thì bật cờ này. */
  checkinOutOfRange: boolean | null;
  /** Ảnh chụp lúc check-in — giáo viên có thể không đính kèm. */
  checkinImages?: LessonImage[] | null;

  // ---- Check-out của giáo viên (cùng quy tắc với check-in) ----
  checkoutAt?: string | null; // ISO
  checkoutLatitude?: number | null;
  checkoutLongitude?: number | null;
  checkoutAccuracy?: number | null;
  checkoutDistance?: number | null;
  checkoutOutOfRange?: boolean | null;
  /**
   * true = mốc check-out này "ăn theo" tiết cuối cùng block (nhiều tiết liên
   * tiếp cùng trường), không phải giáo viên tự bấm check-out cho tiết này.
   */
  checkoutViaAdjacent?: boolean | null;

  // ---- Nội dung giáo viên báo cáo khi Check-out ----
  lessonName?: string | null;
  lessonEvaluation?: string | null;
  lessonImages?: LessonImage[] | null;
  /** Sĩ số thực tế có mặt buổi này, giáo viên tự khai khi báo giảng. */
  actualStudentCount?: number | null;
  /** Thời điểm giáo viên nộp báo giảng — ISO. */
  lessonSubmittedAt?: string | null;
}

/**
 * Buổi dạy để vẽ lên lịch. `fromTemplate` = ô dựng từ mẫu lịch tuần, chưa có
 * buổi dạy thật trong DB — chỉ tồn tại ở FE, không bấm vào xem chi tiết được.
 */
export type CalendarSession = TeachingSession & {
  fromTemplate?: boolean;
  /** Mẫu lịch bị giáo viên từ chối, dựng lên lịch để Nhân sự xếp lại. */
  rejectedTemplate?: boolean;
};

/** Vòng đời phân công của một tiết dạy. */
export type AssignmentStatus = "OPEN" | "ASSIGNED" | "CLOSED" | "CANCELLED";

/** Trạng thái đơn đăng ký nhận tiết của giáo viên. */
export type ApplicationStatus =
  | "PENDING"
  | "SELECTED"
  | "NOT_SELECTED"
  | "WITHDRAWN";

/** Đơn đăng ký nhận tiết — BE tự tính khoảng cách và định mức, FE chỉ hiển thị. */
export interface TeachingApplication {
  id: number;
  sessionId: number;
  teacherId: number;
  teacherName: string;
  status: ApplicationStatus;

  // Vị trí giáo viên gửi lúc đăng ký — chỉ Nhân sự xem.
  latitude: number;
  longitude: number;
  accuracy: number | null;

  /** Khoảng cách tới trường (mét) do BE tính; null = không xác định được. */
  distance: number | null;
  hasScheduleConflict: boolean;

  assignedPeriodsInWeek: number;
  pendingPeriodsInWeek: number;
  maxPeriodsPerWeek: number | null;
  remainingPeriodsInWeek: number | null;

  appliedAt: string;
  note: string | null;
  /** Thứ hạng do BE xếp — FE không tự đổi thứ tự mặc định. */
  suggestionRank?: number;
}

/** Kết quả trả về sau khi giáo viên đăng ký thành công. */
export interface ApplyResult {
  id: number;
  status: ApplicationStatus;
  distance: number | null;
  assignedPeriodsInWeek: number;
  pendingPeriodsInWeek: number;
  maxPeriodsPerWeek: number | null;
  remainingPeriodsInWeek: number | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  pagination: Pagination;
}

export interface AttendanceSummaryRow {
  teacherId: number;
  teacherName: string;
  totalSessions: number;
  present: number;
  absent: number;
  excused: number;
  cancelled: number;
  unchecked: number;
  makeup: number;

  /** Tổng số tiết trong khoảng, mọi trạng thái chấm công. */
  totalPeriods: number;
  /** Số tiết được trả tiền — chỉ buổi `PRESENT`. */
  payablePeriods: number;
  /** Tiền công = Σ (đơn giá × số tiết) của các buổi `PRESENT`. */
  payableAmount: number;
  /** Phụ cấp xăng do backend gộp theo mỗi lần đến trường. */
  fuelAllowanceAmount: number;
  /** Tổng km di chuyển — chỉ giáo viên công ty (có phụ cấp xăng) mới có. */
  totalDistanceKm: number;
  otherCostsAmount: number;
  totalPayableAmount: number;
  /** Buổi đã dạy nhưng chưa khai đơn giá → bảng công đang thiếu tiền. */
  missingRateSessions: number;
}

/** Cộng dồn cả bảng — backend tính sẵn, FE không tự cộng lại. */
export interface AttendanceGrandTotal {
  payablePeriods: number;
  payableAmount: number;
  fuelAllowanceAmount: number;
  totalDistanceKm: number;
  otherCostsAmount: number;
  totalPayableAmount: number;
  missingRateSessions: number;
}

export interface AttendanceSummary {
  fromDate: string;
  toDate: string;
  data: AttendanceSummaryRow[];
  grandTotal: AttendanceGrandTotal;
}

// ================= RÀ SOÁT QUÃNG ĐƯỜNG =================

/**
 * Điểm cần kiểm tra lại ở một lượt đến trường:
 * - `UNCHECKED`: có tiết đã tới ngày nhưng chưa chấm công — km/phụ cấp của
 *   lượt này chưa vào bảng công.
 * - `NOT_COUNTED`: giáo viên công ty nhưng lượt này không chốt được phụ cấp
 *   (thiếu vị trí nhà / toạ độ trường / chưa khai bậc) → đang bị sót tiền.
 * - `NO_DISTANCE`: có phụ cấp nhưng không tính được km chặng này.
 * - `NO_CHECKIN`: không tiết nào trong lượt có check-in.
 * - `CHECKIN_OUT_OF_RANGE` / `CHECKOUT_OUT_OF_RANGE`: GPS ngoài bán kính trường.
 */
export type TravelFlag =
  | "UNCHECKED"
  | "NOT_COUNTED"
  | "NO_DISTANCE"
  | "NO_CHECKIN"
  | "CHECKIN_OUT_OF_RANGE"
  | "CHECKOUT_OUT_OF_RANGE";

/** Vì sao một lượt của giáo viên công ty không có phụ cấp xăng. */
export type GasAllowanceMissingReason =
  | "NO_TEACHER_LOCATION"
  | "NO_SCHOOL_LOCATION"
  | "NO_MATCHING_TIER"
  | "INVALID_DISTANCE";

/** Việc cần bổ sung để các buổi có phụ cấp, gộp theo đối tượng phải sửa. */
export interface GasAllowanceMissingReport {
  teachersWithoutLocation: {
    teacherId: number;
    teacherName: string;
    sessions: number;
  }[];
  placesWithoutLocation: {
    schoolId: number;
    schoolName: string | null;
    schoolLocationId: number | null;
    locationName: string | null;
    sessions: number;
  }[];
  distancesWithoutTier: {
    teacherId: number;
    teacherName: string;
    schoolId: number;
    schoolName: string | null;
    schoolLocationId: number | null;
    locationName: string | null;
    /** null = khoảng cách vô lý, toạ độ nhà hoặc trường đang sai. */
    distanceKm: number | null;
    reason: "NO_MATCHING_TIER" | "INVALID_DISTANCE";
    sessions: number;
  }[];
}

export interface TravelPoint {
  lat: number;
  lng: number;
}

/** Một lượt đến nơi dạy: chuỗi tiết liên tiếp cùng ngày, cùng điểm trường. */
export interface TravelStop {
  placeKey: string;
  schoolId: number;
  schoolName: string | null;
  schoolLocationId: number | null;
  locationName: string | null;
  coords: TravelPoint | null;
  startTime: string;
  endTime: string;
  periods: number;
  sessions: {
    id: number;
    startTime: string;
    endTime: string;
    subjectName: string | null;
    className: string | null;
  }[];
  /** Số tiết trong lượt đã tới ngày nhưng chưa chấm công. */
  uncheckedSessions: number;
  /** Lượt có được trả phụ cấp xăng và tính vào tổng km không. */
  counted: boolean;
  gasAllowance: number | null;
  /**
   * Chỉ có ở lượt không có phụ cấp (`null` ở lượt bình thường). Mảng rỗng =
   * đã đủ dữ liệu, chỉ cần bấm "Tính lại phụ cấp".
   */
  missingReasons: GasAllowanceMissingReason[] | null;
  /** Km nhà → trường theo toạ độ hiện tại — để đối chiếu với bảng bậc. */
  diagnosedDistanceKm: number | null;
  distanceKm: number | null;
  /** `home` = nhà → trường; `previous_place` = điểm trường trước → điểm này. */
  distanceSource: "home" | "previous_place" | null;
  checkin: {
    at: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    /** Khoảng cách từ điểm check-in tới trường (mét). */
    distanceM: number | null;
  } | null;
  flags: TravelFlag[];
}

export interface TravelDay {
  date: string;
  /**
   * Nhà có hiệu lực vào ngày này (đổi vị trí có hiệu lực từ ngày Nhân sự
   * duyệt) — xem lại tháng cũ vẫn xuất phát từ nhà cũ.
   */
  home: TravelPoint | null;
  totalDistanceKm: number;
  fuelAllowanceAmount: number;
  stops: TravelStop[];
}

export interface TravelTeacher {
  teacherId: number;
  teacherName: string;
  /** Vị trí nhà hiện tại trong hồ sơ — mỗi ngày dùng `TravelDay.home`. */
  home: TravelPoint | null;
  /** Gồm cả buổi chưa chấm công. */
  totalDistanceKm: number;
  fuelAllowanceAmount: number;
  /** Chỉ buổi đã chấm Có mặt — khớp tab Tổng hợp. */
  checkedDistanceKm: number;
  checkedFuelAllowanceAmount: number;
  /** Số lượt có ít nhất một điểm cần kiểm tra. */
  flaggedStops: number;
  /** Buổi đã tới ngày mà chưa chấm công (vẫn nằm trong lộ trình). */
  uncheckedSessions: number;
  days: TravelDay[];
}

export interface TravelReview {
  fromDate: string;
  toDate: string;
  teachers: TravelTeacher[];
  /** Việc cần bổ sung cho các lượt "Không có phụ cấp" trong khoảng ngày. */
  missing: GasAllowanceMissingReport;
  /** Buổi đã đủ dữ liệu, chỉ cần bấm "Tính lại phụ cấp". */
  needsRecomputeSessions: number;
  grandTotal: {
    totalDistanceKm: number;
    fuelAllowanceAmount: number;
    checkedDistanceKm: number;
    checkedFuelAllowanceAmount: number;
    flaggedStops: number;
    uncheckedSessions: number;
  };
}

export interface GenerateSessionsResult {
  created: number;
  skipped: number;
  dates: string[];
}

export interface BulkAttendanceResult {
  updated: number;
  sessionIds: number[];
}

// ---- Query payloads ----
export type TeacherQuery = {
  search?: string;
  isActive?: boolean;
  schoolId?: number;
  teacherRole?: TeacherRole;
  page?: number;
  limit?: number;
};

/** Tên contract rõ nghĩa dùng bởi service danh sách thống nhất. */
export type GetTeachersParams = TeacherQuery;
export type TeacherPage = Paged<Teacher>;

export type TeacherCandidatePayload = {
  schoolId: number;
  subjectId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  periods: number;
  exceptScheduleId?: number;
};

export type CandidateReason = {
  kind: "PASS" | "UNKNOWN" | "FAIL";
  code: string;
  message: string;
};

export type TeacherCandidate = {
  teacherId: number;
  teacherName: string;
  score: number;
  eligible: boolean;
  distanceKm: number | null;
  assignedPeriodsInWeek: number;
  maxPeriodsPerWeek: number | null;
  conflicts: unknown[];
  reasons: CandidateReason[];
};

export type TeacherCandidatesResult = {
  candidates: TeacherCandidate[];
  coverage?: unknown;
  warnings: string[];
};

export type SchoolClassQuery = {
  schoolId?: number;
  /** Chỉ lớp của một cơ sở — trường nhiều điểm có lớp riêng từng điểm. */
  schoolLocationId?: number;
  schoolYear?: string;
  gradeLevel?: number;
  isActive?: boolean;
  /** Theo tên lớp hoặc GVCN, không phân biệt hoa/thường. */
  search?: string;
  /**
   * Môn trong danh mục dùng chung. Có tham số này thì mỗi lớp trả kèm môn
   * tương ứng của trường (`subjectStatus` / `subjectId` / `subjectName`).
   */
  catalogId?: number;
  page?: number;
  limit?: number;
};

/**
 * Kết quả tra môn của trường theo danh mục:
 * - `RESOLVED`: tìm được đúng 1 môn của trường → áp lịch được
 * - `MISSING`: trường chưa khai môn đó cho năm học này
 * - `AMBIGUOUS`: trường có nhiều môn khớp, backend không đoán bừa
 */
export type SubjectMatchStatus = "RESOLVED" | "MISSING" | "AMBIGUOUS";

/** Lớp kèm môn tương ứng của trường — chỉ có khi gọi kèm `catalogId`. */
export type SchoolClassWithSubject = SchoolClass & {
  subjectStatus?: SubjectMatchStatus;
  subjectId?: number | null;
  subjectName?: string | null;
  /** Lý do khi `subjectStatus` khác `RESOLVED`. */
  subjectReason?: string | null;
};

export type ScheduleQuery = {
  teacherId?: number;
  schoolId?: number;
  /** Khu vực (tỉnh/thành) của trường — backend suy qua `school.ward.province_id`. */
  provinceId?: number;
  /** Vùng nghiệp vụ tách riêng khỏi tỉnh hành chính, ví dụ `VUNG_TAU`. */
  region?: string;
  /** Thu hẹp về một cơ sở của trường — trường nhiều điểm có TKB riêng từng điểm. */
  schoolLocationId?: number;
  classId?: number;
  subjectId?: number;
  dayOfWeek?: number;
  isActive?: boolean;
  confirmationStatus?: ScheduleConfirmationStatus;
  page?: number;
  limit?: number;
};

export type SessionQuery = {
  teacherId?: number;
  schoolId?: number;
  /** Khu vực (tỉnh/thành) của trường — backend suy qua `school.ward.province_id`. */
  provinceId?: number;
  /** Vùng nghiệp vụ tách riêng khỏi tỉnh hành chính, ví dụ `VUNG_TAU`. */
  region?: string;
  classId?: number;
  subjectId?: number;
  scheduleId?: number;
  status?: SessionStatus;
  unchecked?: boolean;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

/** Gửi thông báo lịch dạy cho giáo viên trong khoảng đang xem. */
export type NotifySchedulePayload = {
  fromDate: string;
  toDate: string;
  /** Giới hạn theo bộ lọc đang áp ở màn Lịch dạy. */
  teacherId?: number;
  schoolId?: number;
  classId?: number;
  subjectId?: number;
  /** Lời nhắn kèm theo thông báo. */
  message?: string | null;
};

export type NotifyScheduleResult = {
  /** Số giáo viên đã nhận thông báo. */
  notified: number;
  /** Số buổi dạy nằm trong thông báo. */
  sessionCount?: number;
  teachers?: { id: number; name: string; sessionCount: number }[];
};

/** Bộ lọc màn "Tiết đang mở" của giáo viên. */
/** Một buổi dạy sắp/đã tới giờ mà giáo viên chưa check-in. */
export interface CheckinAlertItem {
  sessionId: number;
  date: string;
  startTime: string;
  endTime: string | null;
  teacherId: number | null;
  teacherName: string | null;
  teacherPhone: string | null;
  schoolName: string | null;
  className: string | null;
  /** >0 = còn bấy nhiêu phút nữa vào tiết; <0 = đã quá giờ. */
  minutesToStart: number;
  /** Đã bắn thông báo cho Giáo vụ / Nhân sự chưa. */
  alerted: boolean;
}

export interface CheckinAlertResponse {
  date: string;
  /** Số phút báo trước giờ vào tiết, do backend cấu hình. */
  leadMinutes: number;
  total: number;
  data: CheckinAlertItem[];
}

export type OpenSessionQuery = {
  fromDate?: string;
  toDate?: string;
  schoolId?: number;
  subjectId?: number;
  page?: number;
  limit?: number;
};

export type ApplyPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  note?: string | null;
};

/**
 * Kết quả `POST /teachers` / `PATCH /teachers/:id` khi người gửi là Giáo vụ:
 * hồ sơ mới chỉ **chờ Nhân sự duyệt**, chưa có tài khoản nào được tạo.
 */
export type PendingTeacherAccount = {
  status: "pending";
  requiresApproval: true;
  requestId: number;
  message?: string;
};

export type TeacherSaveResult = Teacher | PendingTeacherAccount;

export const isPendingTeacherAccount = (
  result: TeacherSaveResult,
): result is PendingTeacherAccount =>
  (result as PendingTeacherAccount)?.requiresApproval === true;

/** Một hồ sơ trong hàng chờ Nhân sự duyệt. */
export type TeacherAccountRequest = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  payload: Record<string, unknown>;
  createsLogin: boolean;
  /** Có giá trị = cấp tài khoản cho hồ sơ giáo viên này, không tạo hồ sơ mới. */
  teacherId: number | null;
  status: "pending" | "approved" | "rejected";
  requestedBy: number;
  requesterName: string | null;
  reviewedBy: number | null;
  reviewerName: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdTeacherId: number | null;
  createdAt: string;
};

export type TeacherPayload = {
  name: string;
  /**
   * Chỉ gửi khi giáo viên **chưa có** tài khoản đăng nhập: backend tạo tài
   * khoản trong cùng một lần gọi. Đừng tự tạo qua `POST /employees` — đường đó
   * đã khoá và cũng vòng qua bước Nhân sự duyệt.
   */
  password?: string;
  phone?: string | null;
  email?: string | null;
  employeeId?: number | null;
  teacherRole?: TeacherRole;
  isActive?: boolean;
  note?: string | null;
  /** null = không giới hạn. */
  maxPeriodsPerWeek?: number | null;
  /** Đơn giá mặc định cho các mẫu lịch/buổi dạy tạo về sau. */
  defaultRatePerPeriod?: number | null;
  /** null / chuỗi rỗng = xoá. */
  zaloUid?: string | null;
  /** null / chuỗi rỗng = xoá. */
  zaloUserId?: string | null;

  /** null / chuỗi rỗng = xoá vị trí. Chỉ nhận link Google Maps. */
  googleMapsUrl?: string | null;
  /**
   * PATCH: bỏ field = giữ nguyên, gửi `[]` = xoá hết lựa chọn.
   * Luôn là mảng số — không gửi object option hay ID dạng chuỗi.
   */
  wardIds?: number[];
  subjectCatalogIds?: number[];
};

export type SchoolClassPayload = {
  schoolId: number;
  name: string;
  schoolYear: string;
  /** null với mầm non; 1–12 với phổ thông. */
  gradeLevel?: number | null;
  studentCount?: number;
  homeroomTeacher?: string | null;
  isActive?: boolean;
  note?: string | null;
  /** Môn phải thuộc đúng trường và năm học của lớp; [] = bỏ toàn bộ môn. */
  subjectIds?: number[];
};

/** PATCH bỏ qua `schoolId`: đổi trường của lớp sẽ làm lịch đã sinh trỏ sai trường. */
export type SchoolClassUpdatePayload = Partial<
  Omit<SchoolClassPayload, "schoolId">
>;

export type SchedulePayload = {
  teacherId: number;
  /** Trường suy ra từ lớp — không gửi `schoolId` nữa. */
  classId: number;
  subjectId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  periods?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  note?: string | null;
};

export type SessionPayload = {
  /** null = tiết đang mở; OPEN không được có giáo viên, ASSIGNED bắt buộc có. */
  teacherId?: number | null;
  /** Có `classId` thì không cần `schoolId` — BE lấy trường theo lớp. */
  classId?: number;
  /** Chỉ dùng cho buổi chưa gắn lớp (dữ liệu cũ / trường chưa khai báo lớp). */
  schoolId?: number;
  subjectId: number;
  date: string;
  startTime: string;
  endTime: string;
  periods?: number | null;
  assignmentStatus?: AssignmentStatus;
  makeupForSessionId?: number | null;
  note?: string | null;
};

// ---- Áp môn cho nhiều lớp của nhiều trường (tạo hàng loạt) ----

/**
 * Một lớp trong lô. Ngoài `classId`, field nào bỏ trống thì lấy giá trị mặc
 * định ở cấp lô; có thì ghi đè riêng cho lớp đó.
 */
export type BulkScheduleItem = {
  classId: number;
  teacherId?: number;
  /** Khai thẳng môn của trường, bỏ qua việc tra theo `catalogId`. */
  subjectId?: number;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  periods?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  note?: string | null;
};

export type BulkSchedulePayload = {
  /** Môn trong danh mục dùng chung — BE tra ra môn của từng trường. */
  catalogId?: number;
  /** Bỏ trống = tra theo năm học của từng lớp. */
  schoolYear?: string;
  teacherId?: number;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  periods?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  note?: string | null;
  items: BulkScheduleItem[];
  /** Có thì sinh luôn buổi dạy cho các mẫu vừa tạo. */
  generateSessions?: { fromDate: string; toDate: string };
};

export type BulkSessionItem = {
  classId: number;
  teacherId?: number;
  subjectId?: number;
  /** Ngày riêng của lớp này — thắng `dates` chung của lô. */
  date?: string;
  startTime?: string;
  endTime?: string;
  periods?: number;
  note?: string | null;
};

export type BulkSessionPayload = {
  catalogId?: number;
  schoolYear?: string;
  /** Không có giáo viên → tiết ở trạng thái OPEN cho giáo viên đăng ký. */
  teacherId?: number;
  assignmentStatus?: AssignmentStatus;
  dates?: string[];
  startTime?: string;
  endTime?: string;
  periods?: number;
  note?: string | null;
  items: BulkSessionItem[];
};

/** Một dòng kết quả — lỗi nghiệp vụ của lớp nào chỉ bỏ qua lớp đó. */
export type BulkResultRow = {
  classId: number;
  className: string | null;
  schoolId: number | null;
  schoolName: string | null;
  status: "CREATED" | "SKIPPED";
  reason?: string;
  subjectId?: number;
  subjectName?: string;
  /** Chỉ có ở kết quả tạo tiết hàng loạt. */
  date?: string;
};

export type BulkScheduleResult = {
  created: number;
  skipped: number;
  /** Số buổi sinh kèm khi có `generateSessions`. */
  sessionsCreated: number;
  results: BulkResultRow[];
};

export type BulkSessionResult = {
  created: number;
  skipped: number;
  results: BulkResultRow[];
};

/** Toạ độ giáo viên gửi lên khi check-in; BE tính lại khoảng cách. */
export type CheckinPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

/** Tên bài + đánh giá buổi học — bắt buộc ở check-out lẫn nộp bài không GPS. */
export type LessonContentPayload = {
  lessonName: string;
  lessonEvaluation: string;
};

/**
 * Check-out: chỉ vị trí GPS — backend không nhận nội dung bài dạy/ảnh ở
 * endpoint này. Nội dung bài dạy nộp riêng qua `submitLesson()` ngay sau khi
 * check-out thành công (xem `useLessonSubmit.ts`).
 */
export type CheckoutPayload = CheckinPayload;

/** Nộp nội dung bài dạy không cần GPS — cho tiết giữa/đầu một block nhiều tiết. */
export type SubmitLessonPayload = LessonContentPayload & {
  images?: File[];
};

export type DeclineSessionPayload = {
  reason: string;
};

export type AttendancePayload = {
  status: SessionStatus;
  attendanceNote?: string | null;
  otherCosts?: AttendanceOtherCost[];
};

export interface AttendanceOtherCost {
  name: string;
  amount: number;
  note?: string | null;
}

export type BulkAttendanceItem = {
  sessionId: number;
  status: SessionStatus;
  attendanceNote?: string | null;
  otherCosts?: AttendanceOtherCost[];
};

// ================= METADATA =================

// Badge màu đồng bộ với STATUS_META của module Đề xuất chi.
// `event` = màu khối buổi dạy trên lưới lịch (nền + viền trái + chữ).
export const SESSION_STATUS_META: Record<
  SessionStatus,
  { label: string; badge: string; dot: string; event: string; strike?: boolean }
> = {
  SCHEDULED: {
    label: "Chưa chấm",
    badge: "bg-gray-100 text-gray-700",
    dot: "bg-blue-500",
    event: "bg-blue-50 border-blue-500 text-blue-900",
  },
  PRESENT: {
    label: "Có dạy",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
    event: "bg-green-50 border-green-500 text-green-900",
  },
  ABSENT: {
    label: "Vắng",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    event: "bg-red-50 border-red-500 text-red-900",
  },
  EXCUSED: {
    label: "Nghỉ có phép",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    event: "bg-amber-50 border-amber-500 text-amber-900",
  },
  CANCELLED: {
    label: "Huỷ buổi",
    badge: "bg-gray-200 text-gray-500",
    dot: "bg-gray-300",
    event: "bg-gray-100 border-gray-300 text-gray-400",
    strike: true,
  },
};

// Không còn "EXCUSED" — nghỉ phép đã bỏ khỏi chấm công.
// SESSION_STATUS_META vẫn giữ EXCUSED để các buổi cũ hiển thị đúng nhãn/màu.
export const ASSIGNMENT_STATUS_META: Record<
  AssignmentStatus,
  { label: string; badge: string }
> = {
  OPEN: { label: "Đang mở đăng ký", badge: "bg-blue-100 text-blue-700" },
  ASSIGNED: { label: "Đã phân công", badge: "bg-green-100 text-green-700" },
  CLOSED: { label: "Đã đóng đăng ký", badge: "bg-gray-100 text-gray-600" },
  CANCELLED: { label: "Đã huỷ", badge: "bg-red-100 text-red-600" },
};

export const APPLICATION_STATUS_META: Record<
  ApplicationStatus,
  { label: string; badge: string }
> = {
  PENDING: { label: "Chờ xếp lịch", badge: "bg-amber-100 text-amber-700" },
  SELECTED: {
    label: "Được phân công",
    badge: "bg-emerald-100 text-emerald-700",
  },
  NOT_SELECTED: {
    label: "Không được phân công",
    badge: "bg-gray-100 text-gray-500",
  },
  WITHDRAWN: { label: "Đã rút đăng ký", badge: "bg-gray-100 text-gray-400" },
};

export const SESSION_STATUS_ORDER: SessionStatus[] = [
  "SCHEDULED",
  "PRESENT",
  "ABSENT",
  "CANCELLED",
];

// Các trạng thái chấm công được (bỏ SCHEDULED = "bỏ chấm").
export const ATTENDANCE_OPTIONS: {
  value: Exclude<SessionStatus, "SCHEDULED">;
  label: string;
  active: string;
}[] = [
  { value: "PRESENT", label: "Có dạy", active: "bg-green-500 text-white" },
  { value: "ABSENT", label: "Vắng", active: "bg-red-500 text-white" },
  { value: "CANCELLED", label: "Huỷ", active: "bg-gray-500 text-white" },
];

// ⚠️ Không có giá trị 1. Chủ Nhật là 8.
export const DAY_OF_WEEK_OPTIONS: { value: number; label: string; short: string }[] = [
  { value: 2, label: "Thứ Hai", short: "T2" },
  { value: 3, label: "Thứ Ba", short: "T3" },
  { value: 4, label: "Thứ Tư", short: "T4" },
  { value: 5, label: "Thứ Năm", short: "T5" },
  { value: 6, label: "Thứ Sáu", short: "T6" },
  { value: 7, label: "Thứ Bảy", short: "T7" },
  { value: 8, label: "Chủ Nhật", short: "CN" },
];

/** Dự phòng khi API không trả `dayOfWeekLabel`. */
export const dayOfWeekLabel = (value?: number | null) =>
  DAY_OF_WEEK_OPTIONS.find((d) => d.value === value)?.label || "";

// ================= NHẬP TKB BẰNG ẢNH CHỤP =================
// Nhân sự gửi ảnh tờ thời khoá biểu → hệ thống đọc → hỏi lại phần còn thiếu qua
// chat → xác nhận rồi mới tạo lớp và mẫu lịch.
//
// Tên type giữ đúng tên của backend (`src/timetable-import`) để đối chiếu nhanh
// khi hình dạng dữ liệu đổi. Mô hình chỉ **đề xuất**: bước ghi dữ liệu chạy bằng
// code qua đúng các service tạo lớp/xếp lịch sẵn có.

export type DraftStatus = "DRAFT" | "COMMITTED" | "CANCELLED";

/** Trần dung lượng ảnh của backend — chặn ở client để khỏi tải lên rồi mới 413. */
export const TIMETABLE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/** Đúng bộ MIME backend nhận (`SUPPORTED_MIME`). */
export const TIMETABLE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** Trần độ dài tin nhắn chat (`ChatMessageDto.MaxLength`). */
export const TIMETABLE_MESSAGE_MAX_LENGTH = 2000;

export interface TimetableIssue {
  level: "ERROR" | "WARN" | "INFO";
  /** SLOT_COLLISION | PERIOD_TIME_MISSING | NO_ENTRIES | CLASS_REPEATED | LOW_CONFIDENCE | … */
  code: string;
  message: string;
}

/** Những gì đã chốt được sau khi tra database và hỏi lại Nhân sự. */
export interface DraftResolution {
  schoolId: number | null;
  schoolName: string | null;
  subjectId: number | null;
  subjectName: string | null;
  teacherId: number | null;
  teacherName: string | null;
  schoolYear: string | null;
  /** "YYYY-MM-DD" */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  /**
   * Nhân sự đã chốt "chạy vô thời hạn". Cần cờ riêng vì `effectiveTo = null`
   * còn mang nghĩa "chưa hỏi" — hai trạng thái này không được hiển thị giống nhau.
   */
  effectiveToUnbounded: boolean;
  periodTimes: {
    session: "SANG" | "CHIEU";
    period: number;
    startTime: string;
    endTime: string;
  }[];
}

/** Một ô đọc được từ ảnh, đã tra ra lớp và khung giờ tương ứng. */
export interface PreviewRow {
  className: string;
  /** null = lớp chưa tồn tại, sẽ được tạo khi xác nhận. */
  classId: number | null;
  /** ⚠️ Quy ước tiếng Việt: 2 = Thứ Hai … 7 = Thứ Bảy, 8 = Chủ Nhật. */
  dayOfWeek: number;
  dayOfWeekLabel: string;
  session: "SANG" | "CHIEU";
  period: number;
  /** null khi chưa có khung giờ cho tiết này — bình thường ở giai đoạn đang chat. */
  startTime: string | null;
  endTime: string | null;
  /** "low" = model tự nhận đọc chưa chắc; lưới phải tô riêng các ô này. */
  confidence: "high" | "low";
}

/** Một thông tin còn thiếu, kèm sẵn lựa chọn để Nhân sự bấm nhanh. */
export interface PreviewNeed {
  field:
    | "schoolId"
    | "schoolYear"
    | "subjectId"
    | "teacherId"
    | "effectiveFrom"
    | "effectiveTo"
    | "periodTimes";
  question: string;
  options?: { id: number; name: string; hint?: string }[];
}

export interface TimetablePreview {
  rows: PreviewRow[];
  resolution: DraftResolution;
  /** Số lớp đã tồn tại được dùng lại. */
  existingClassCount: number;
  /** Tên các lớp SẼ ĐƯỢC TẠO MỚI khi xác nhận — phải hiện rõ, không được giấu. */
  newClassNames: string[];
  /** Tổng số mẫu lịch sẽ tạo. */
  scheduleCount: number;
  stats: {
    totalEntries: number;
    distinctClasses: number;
    lowConfidenceEntries: number;
    /**
     * true = mỗi lớp đúng 1 tiết/tuần. ⚠️ Chỉ là **tín hiệu phụ**: một ô đọc tụt
     * xuống nhầm tiết vẫn giữ cờ này true — thứ bắt được lỗi đó là SLOT_COLLISION.
     */
    oneLessonPerClass: boolean;
  };
  /** ERROR — chặn xác nhận. */
  blockers: TimetableIssue[];
  /** WARN — cảnh báo, vẫn xác nhận được. */
  warnings: TimetableIssue[];
  /** INFO — thông tin thêm. */
  notes: TimetableIssue[];
  needs: PreviewNeed[];
  /** Nguồn sự thật duy nhất cho việc bật/tắt nút Xác nhận — FE không tính lại. */
  canCommit: boolean;
}

export interface DraftMessage {
  role: "user" | "assistant";
  text: string;
  at: string;
}

export interface TimetableCommitResult {
  committedById: number;
  createdClasses: { name: string; id: number }[];
  /** Một phần tử cho mỗi lô 200 mẫu lịch — số liệu phải cộng dồn. */
  scheduleResults: BulkScheduleResult[];
}

export interface DraftView {
  draftId: number;
  status: DraftStatus;
  preview: TimetablePreview;
  messages: DraftMessage[];
  commitResult?: TimetableCommitResult;
}
