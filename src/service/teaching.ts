import api from "./api";
import { stripRateFields } from "@/pages/Teaching/lib";
import type {
  ApplyPayload,
  ApplyResult,
  AttendancePayload,
  BulkSchedulePayload,
  BulkScheduleResult,
  BulkSessionPayload,
  BulkSessionResult,
  DraftView,
  AttendanceSummary,
  TravelReview,
  BulkAttendanceItem,
  BulkAttendanceResult,
  CheckinAlertResponse,
  CheckinPayload,
  CheckoutPayload,
  DeclineSessionPayload,
  NotifySchedulePayload,
  NotifyScheduleResult,
  GenerateSessionsResult,
  Paged,
  SchedulePayload,
  ScheduleQuery,
  SchoolClassPayload,
  SchoolClassQuery,
  SchoolClassUpdatePayload,
  SchoolClassWithSubject,
  SessionPayload,
  SessionQuery,
  SubmitLessonPayload,
  Teacher,
  TeacherPayload,
  TeacherQuery,
  TeacherPage,
  TeacherCandidatePayload,
  TeacherCandidatesResult,
  TeacherAccountRequest,
  TeacherLocationChangeRequest,
  TeacherLocationChangeStatus,
  TeacherSaveResult,
  OpenSessionQuery,
  TeachingApplication,
  TeachingSchedule,
  TeachingSession,
} from "@/types/teaching";

// Base URL không có prefix /api — endpoint là /teachers, /teaching-schedules, /teaching-sessions.
const TEACHERS = "/teachers";
const CLASSES = "/school-classes";
const SCHEDULES = "/teaching-schedules";
const SESSIONS = "/teaching-sessions";
const TIMETABLE_IMPORT = "/timetable-import";

// Bỏ các param rỗng để không gửi `?search=&isActive=` lên backend.
const clean = (params: Record<string, any> = {}) => {
  const out: Record<string, any> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  });
  return out;
};

/** Nguồn danh sách giáo viên duy nhất cho cả công ty và cộng tác viên. */
export const getTeachers = async (
  params: TeacherQuery = {},
): Promise<TeacherPage> => {
  const res = await api.get(TEACHERS, { params: clean(params) });
  return res.data;
};

export const teacherApi = {
  list: getTeachers,

  findOne: async (id: number): Promise<Teacher> => {
    const res = await api.get(`${TEACHERS}/${id}`);
    return res.data;
  },

  candidates: async (
    data: TeacherCandidatePayload,
  ): Promise<TeacherCandidatesResult> => {
    const res = await api.post(`${TEACHERS}/candidates`, data);
    return res.data;
  },

  // Hồ sơ giáo viên của tài khoản đang đăng nhập (role giaovien).
  me: async (): Promise<Teacher> => {
    const res = await api.get(`${TEACHERS}/me`);
    return res.data;
  },

  // Giáo vụ gọi thì nhận về hồ sơ chờ duyệt chứ không phải giáo viên đã tạo —
  // xem `isPendingTeacherAccount`.
  create: async (data: TeacherPayload): Promise<TeacherSaveResult> => {
    const res = await api.post(TEACHERS, stripRateFields(data));
    return res.data;
  },

  update: async (
    id: number,
    data: Partial<TeacherPayload>,
  ): Promise<TeacherSaveResult> => {
    const res = await api.patch(`${TEACHERS}/${id}`, stripRateFields(data));
    return res.data;
  },

  /** Hàng chờ duyệt tài khoản giáo viên. Giáo vụ chỉ thấy hồ sơ của mình. */
  accountRequests: async (
    status: TeacherAccountRequest["status"] = "pending",
  ): Promise<TeacherAccountRequest[]> => {
    const res = await api.get(`${TEACHERS}/account-requests`, {
      params: { status },
    });
    return res.data;
  },

  approveAccountRequest: async (id: number, note?: string) => {
    const res = await api.patch(
      `${TEACHERS}/account-requests/${id}/approve`,
      { note },
    );
    return res.data;
  },

  rejectAccountRequest: async (id: number, note?: string) => {
    const res = await api.patch(
      `${TEACHERS}/account-requests/${id}/reject`,
      { note },
    );
    return res.data;
  },

  // 409 nếu giáo viên đã có buổi dạy.
  remove: async (id: number): Promise<void> => {
    await api.delete(`${TEACHERS}/${id}`);
  },
};

export const teacherLocationChangeApi = {
  list: async (
    status: TeacherLocationChangeStatus = "pending",
  ): Promise<TeacherLocationChangeRequest[]> => {
    const res = await api.get(`${TEACHERS}/location-change-requests`, {
      params: { status },
    });
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  approve: async (id: number, note?: string) => {
    const res = await api.patch(
      `${TEACHERS}/location-change-requests/${id}/approve`,
      { note: note?.trim() || undefined },
    );
    return res.data;
  },

  reject: async (id: number, note: string) => {
    const res = await api.patch(
      `${TEACHERS}/location-change-requests/${id}/reject`,
      { note: note.trim() },
    );
    return res.data;
  },
};

/**
 * Lớp học của trường. Nhân sự toàn quyền; các role xem được module Giảng dạy
 * và cả giáo viên đều đọc được (để hiển thị tên lớp trong lịch).
 *
 * Danh sách đã được BE sắp theo khối rồi tới tên lớp — FE giữ nguyên thứ tự.
 */
export const schoolClassApi = {
  // Gửi kèm `catalogId` thì mỗi lớp có thêm môn tương ứng của trường.
  list: async (
    params: SchoolClassQuery = {},
  ): Promise<Paged<SchoolClassWithSubject>> => {
    const res = await api.get(CLASSES, { params: clean(params) });
    return res.data;
  },

  findOne: async (id: number): Promise<SchoolClassWithSubject> => {
    const res = await api.get(`${CLASSES}/${id}`);
    return res.data;
  },

  // 409 nếu trùng tên lớp trong cùng trường + cùng năm học.
  create: async (data: SchoolClassPayload): Promise<SchoolClassWithSubject> => {
    const res = await api.post(CLASSES, stripRateFields(data));
    return res.data;
  },

  // `schoolId` bị BE bỏ qua — không đổi được trường của lớp.
  update: async (
    id: number,
    data: SchoolClassUpdatePayload,
  ): Promise<SchoolClassWithSubject> => {
    const res = await api.patch(`${CLASSES}/${id}`, stripRateFields(data));
    return res.data;
  },

  // 409 nếu lớp đã có mẫu lịch hoặc buổi dạy — khi đó tắt isActive thay vì xoá.
  remove: async (id: number): Promise<void> => {
    await api.delete(`${CLASSES}/${id}`);
  },
};

export const teachingScheduleApi = {
  list: async (params: ScheduleQuery = {}): Promise<Paged<TeachingSchedule>> => {
    const res = await api.get(SCHEDULES, { params: clean(params) });
    return res.data;
  },

  findOne: async (id: number): Promise<TeachingSchedule> => {
    const res = await api.get(`${SCHEDULES}/${id}`);
    return res.data;
  },

  // Mẫu lịch tuần của chính giáo viên đang đăng nhập.
  // 404 nếu tài khoản chưa được gắn hồ sơ giáo viên → hiện empty state.
  me: async (params: ScheduleQuery = {}): Promise<Paged<TeachingSchedule>> => {
    const res = await api.get(`${SCHEDULES}/me`, { params: clean(params) });
    return res.data;
  },

  // 409 nếu trùng lịch giáo viên (cùng thứ + giao giờ + giao khoảng hiệu lực).
  create: async (data: SchedulePayload): Promise<TeachingSchedule> => {
    const res = await api.post(SCHEDULES, stripRateFields(data));
    return res.data;
  },

  update: async (
    id: number,
    data: Partial<SchedulePayload>,
  ): Promise<TeachingSchedule> => {
    const res = await api.patch(`${SCHEDULES}/${id}`, stripRateFields(data));
    return res.data;
  },

  // Xoá luôn buổi đã sinh. 409 nếu đã có buổi được chấm công.
  remove: async (id: number): Promise<void> => {
    await api.delete(`${SCHEDULES}/${id}`);
  },

  /**
   * Xoá toàn bộ TKB của một trường (mọi mẫu lịch, kèm buổi tương lai). POST
   * vì cần gửi `schoolId` trong body. Buổi đã chấm công/quá ngày được BE giữ
   * lại (chỉ gỡ liên kết mẫu lịch) — không mất lịch sử.
   */
  removeBySchool: async (dto: {
    schoolId: number;
    subjectId?: number;
  }): Promise<{
    deletedSchedules: number;
    sessions: { kept: number; removed: number };
  }> => {
    const res = await api.post(`${SCHEDULES}/bulk-delete`, dto);
    return res.data;
  },

  // Idempotent: buổi đã có rơi vào `skipped`. Tối đa 400 ngày mỗi lần.
  /**
   * Áp một khoảng hiệu lực cho toàn bộ tiết của trường (POST
   * /teaching-schedules/bulk-effective-range). BE sửa từng tiết qua luồng
   * update nên buổi dạy được đồng bộ (cắt/sinh thêm) như sửa tay.
   */
  applyEffectiveRange: async (body: {
    schoolId: number;
    schoolLocationId?: number;
    subjectId?: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    includeInactive?: boolean;
  }): Promise<{
    total: number;
    applied: number;
    unchanged: number;
    failed: number;
    sessions: { updated: number; removed: number; created: number; skipped: number };
    results: { scheduleId: number; status: "UPDATED" | "UNCHANGED" | "FAILED"; message?: string }[];
  }> => {
    const res = await api.post(`${SCHEDULES}/bulk-effective-range`, body);
    return res.data;
  },
  /**
   * Đổi chéo lịch dạy 2 chiều: toàn bộ lịch (đang áp dụng) của A thoả bộ lọc
   * chuyển sang B, và ngược lại, cùng một lúc — khác `update({ teacherId })`
   * vốn chỉ chuyển một chiều.
   */
  swapTeachers: async (dto: {
    teacherAId: number;
    teacherBId: number;
    schoolId?: number;
    schoolLocationId?: number;
    subjectId?: number;
    dayOfWeek?: number;
  }): Promise<{
    teacherA: { id: number; name: string; movedTo: number };
    teacherB: { id: number; name: string; movedTo: number };
    swapped: { fromA: number; fromB: number };
    sessions: { updated: number; removed: number; created: number; skipped: number };
  }> => {
    const res = await api.post(`${SCHEDULES}/swap-teachers`, dto);
    return res.data;
  },

  generateSessions: async (
    id: number,
    body: { fromDate: string; toDate: string },
  ): Promise<GenerateSessionsResult> => {
    const res = await api.post(
      `${SCHEDULES}/${id}/generate-sessions`,
      stripRateFields(body),
    );
    return res.data;
  },
};

export const teachingSessionApi = {
  list: async (params: SessionQuery = {}): Promise<Paged<TeachingSession>> => {
    const res = await api.get(SESSIONS, { params: clean(params) });
    return res.data;
  },

  findOne: async (id: number): Promise<TeachingSession> => {
    const res = await api.get(`${SESSIONS}/${id}`);
    return res.data;
  },

  // Lịch dạy của chính giáo viên đang đăng nhập.
  // 404 nếu tài khoản chưa được gắn hồ sơ giáo viên → hiện empty state.
  me: async (params: SessionQuery = {}): Promise<Paged<TeachingSession>> => {
    const res = await api.get(`${SESSIONS}/me`, { params: clean(params) });
    return res.data;
  },

  /**
   * Buổi dạy hôm nay sắp/đã tới giờ mà giáo viên chưa check-in.
   * Backend tự tính mốc báo trước, FE chỉ hiển thị.
   */
  checkinAlerts: async (): Promise<CheckinAlertResponse> => {
    const res = await api.get(`${SESSIONS}/checkin-alerts`);
    return res.data;
  },

  // Buổi lẻ / buổi dạy bù (có makeupForSessionId → BE tự bật isMakeup).
  create: async (data: SessionPayload): Promise<TeachingSession> => {
    const res = await api.post(SESSIONS, stripRateFields(data));
    return res.data;
  },

  update: async (
    id: number,
    data: Partial<SessionPayload>,
  ): Promise<TeachingSession> => {
    const res = await api.patch(`${SESSIONS}/${id}`, stripRateFields(data));
    return res.data;
  },

  // 409 nếu buổi đã được chấm công.
  remove: async (id: number): Promise<void> => {
    await api.delete(`${SESSIONS}/${id}`);
  },

  // Giáo viên check-in tại buổi dạy của chính mình.
  // BE tính lại khoảng cách tới trường → trả về buổi kèm checkinDistance / checkinOutOfRange.
  // 403 nếu không phải giáo viên của buổi, 409 nếu đã check-in.
  checkin: async (
    id: number,
    data: CheckinPayload,
  ): Promise<TeachingSession> => {
    const res = await api.post(`${SESSIONS}/${id}/checkin`, data);
    return res.data;
  },

  /**
   * Check-out khi dạy xong: vị trí GPS + nội dung bài dạy (bắt buộc) + ảnh.
   * Multipart — BE validate `lessonName`/`lessonEvaluation` không rỗng.
   *
   * 400 nếu bản thân buổi chưa check-in VÀ không có buổi nào khác cùng block
   * (tiết liên tiếp cùng trường hôm đó) đã check-in — tiết cuối một block
   * nhiều tiết thì không cần tự check-in, miễn tiết đầu đã check-in.
   * 409 nếu đã check-out.
   */
  checkout: async (
    id: number,
    data: CheckoutPayload,
  ): Promise<TeachingSession> => {
    const form = new FormData();
    form.append("latitude", String(data.latitude));
    form.append("longitude", String(data.longitude));
    if (data.accuracy != null) form.append("accuracy", String(data.accuracy));
    const res = await api.post(`${SESSIONS}/${id}/checkout`, form);
    return res.data;
  },

  /**
   * Nộp nội dung bài dạy không cần GPS — cho tiết giữa/đầu một block nhiều
   * tiết liên tiếp cùng trường (`session.checkoutRequired === false`).
   * Vẫn yêu cầu block đó đã có ai check-in (400 nếu chưa).
   */
  submitLesson: async (
    id: number,
    data: SubmitLessonPayload,
  ): Promise<TeachingSession> => {
    const form = new FormData();
    form.append("lessonName", data.lessonName);
    form.append("lessonEvaluation", data.lessonEvaluation);
    (data.images ?? []).forEach((file) => form.append("images", file));
    const res = await api.post(`${SESSIONS}/${id}/lesson`, form);
    return res.data;
  },

  // Giáo viên xin rút khỏi buổi đã phân công vì có việc đột xuất.
  // BE gỡ giáo viên, mở lại buổi và gửi thông báo cho Nhân sự chọn người thay thế.
  decline: async (
    id: number,
    data: DeclineSessionPayload,
  ): Promise<TeachingSession> => {
    const res = await api.post(`${SESSIONS}/${id}/decline`, data);
    return res.data;
  },

  // Chấm công 1 buổi. status = SCHEDULED nghĩa là bỏ chấm.
  attendance: async (
    id: number,
    data: AttendancePayload,
  ): Promise<TeachingSession> => {
    const res = await api.patch(
      `${SESSIONS}/${id}/attendance`,
      stripRateFields(data),
    );
    return res.data;
  },

  // Đổi/gán giáo viên cho 1 buổi. 409 nếu đã chấm công. 409 kèm
  // requiresOverride nếu trùng lịch/vượt định mức tuần — gọi lại với override: true để ép.
  assign: async (
    id: number,
    data: { teacherId: number; override?: boolean },
  ): Promise<TeachingSession> => {
    const res = await api.patch(`${SESSIONS}/${id}/assign`, data);
    return res.data;
  },

  /**
   * Đổi/gán giáo viên cho nhiều buổi đã chọn cùng lúc (bảng Chấm công), tối
   * đa 200 buổi/request. Buổi nào lỗi (đã chấm công, trùng lịch...) bị bỏ
   * qua và báo lại riêng trong `results`, các buổi khác vẫn đổi.
   */
  bulkAssign: async (dto: {
    sessionIds: number[];
    teacherId: number;
    override?: boolean;
  }): Promise<{
    total: number;
    updated: number;
    failed: number;
    /** Số buổi phải đổi chéo (GV đích đang bận cùng giờ nên đẩy buổi đó về GV nguồn). */
    swapped: number;
    results: { sessionId: number; status: "UPDATED" | "FAILED"; message?: string; swapped?: boolean }[];
  }> => {
    const res = await api.patch(`${SESSIONS}/assign/bulk`, dto);
    return res.data;
  },

  // Chấm công hàng loạt, tối đa 200 buổi / request.
  bulkAttendance: async (
    items: BulkAttendanceItem[],
  ): Promise<BulkAttendanceResult> => {
    const body = stripRateFields({
      items: items.map((item) => stripRateFields(item)),
    });
    const res = await api.patch(`${SESSIONS}/attendance/bulk`, body);
    return res.data;
  },

  // Gửi thông báo lịch dạy cho các giáo viên có buổi trong khoảng đã chọn.
  notifySchedule: async (
    data: NotifySchedulePayload,
  ): Promise<NotifyScheduleResult> => {
    const res = await api.post(`${SESSIONS}/notify-schedule`, clean(data));
    return res.data;
  },

  summary: async (params: {
    fromDate: string;
    toDate: string;
    /** Role tài khoản giáo viên: giáo viên công ty hoặc cộng tác viên. */
    teacherRole?: "giaovien_congty" | "giaovien_ctv";
    teacherId?: number;
    schoolId?: number;
    classId?: number;
  }): Promise<AttendanceSummary> => {
    const res = await api.get(`${SESSIONS}/attendance/summary`, {
      params: clean(params),
    });
    return res.data;
  },

  /** Lộ trình di chuyển từng ngày của giáo viên công ty, kèm điểm cần kiểm tra. */
  travelReview: async (params: {
    fromDate: string;
    toDate: string;
    teacherId?: number;
  }): Promise<TravelReview> => {
    const res = await api.get(`${SESSIONS}/attendance/travel-review`, {
      params: clean(params),
    });
    return res.data;
  },
};

/**
 * Áp một môn cho nhiều lớp của nhiều trường trong một lần gọi.
 *
 * Môn được chọn theo **danh mục dùng chung** (`catalogId`); backend tra ra môn
 * riêng của từng trường theo năm học của lớp. Lớp nào trường chưa khai môn, hoặc
 * trùng giờ, thì rơi vào `results` với `status: "SKIPPED"` kèm lý do — các lớp
 * còn lại vẫn được tạo.
 *
 * Sai sót phía client (thiếu field, giờ ngược, lớp lặp, vượt trần) thì BE trả
 * 400 **trước khi ghi bất cứ gì**, không có chuyện tạo được nửa lô.
 */
export const teachingBulkApi = {
  // Tối đa 200 lớp mỗi lần; kèm generateSessions thì sinh buổi luôn.
  createSchedules: async (
    data: BulkSchedulePayload,
  ): Promise<BulkScheduleResult> => {
    const body = stripRateFields({
      ...data,
      items: data.items.map((item) => stripRateFields(item)),
    });
    const res = await api.post(`${SCHEDULES}/bulk`, body);
    return res.data;
  },

  // Nhân lớp × ngày, tối đa 200 lớp / 31 ngày / 500 tiết mỗi lần.
  createSessions: async (
    data: BulkSessionPayload,
  ): Promise<BulkSessionResult> => {
    const body = stripRateFields({
      ...data,
      items: data.items.map((item) => stripRateFields(item)),
    });
    const res = await api.post(`${SESSIONS}/bulk`, body);
    return res.data;
  },
};

/**
 * Nhập thời khoá biểu bằng ảnh chụp. Ba bước, và bước ghi dữ liệu tách hẳn khỏi
 * bước đọc ảnh:
 *
 *   1. `create`   — gửi ảnh, nhận bản nháp + bảng preview
 *   2. `chat`     — điền phần ảnh không có (giáo viên, khung giờ, ngày kết thúc)
 *   3. `commit`   — xác nhận, hệ thống mới thật sự tạo lớp + mẫu lịch
 *
 * Chỉ role `nhansu` gọi được; các role chỉ-xem nhận 403.
 */
export const timetableImportApi = {
  /**
   * ⏱ Đọc ảnh/xử lý mô tả mất khoảng 5–60 giây. `api` không đặt `timeout` nên
   * lời gọi này chờ tới khi backend trả — cố ý, đừng thêm timeout riêng. Bù
   * lại FE phải chặn double-submit: gọi lần hai là tốn tiền gấp đôi.
   *
   * Có ảnh thì gửi ảnh (đọc hàng loạt tiết); không có ảnh thì gửi `message` —
   * Nhân sự mô tả lịch cần xếp bằng lời, không bắt buộc chụp ảnh.
   *
   * Không tự đặt `Content-Type`: axios tự sinh boundary cho FormData.
   */
  create: async (input: { image: File } | { message: string }): Promise<DraftView> => {
    const form = new FormData();
    if ("image" in input) {
      // Tên field phải đúng "image" — sai tên thì BE trả TIMETABLE_IMAGE_FIELD_INVALID.
      form.append("image", input.image);
    } else {
      form.append("message", input.message);
    }
    const res = await api.post(TIMETABLE_IMPORT, form);
    return res.data;
  },

  findOne: async (draftId: number): Promise<DraftView> => {
    const res = await api.get(`${TIMETABLE_IMPORT}/${draftId}`);
    return res.data;
  },

  // Trả về DraftView đã cập nhật, **kèm cả preview mới** — không cần gọi lại GET.
  chat: async (draftId: number, message: string): Promise<DraftView> => {
    const res = await api.post(`${TIMETABLE_IMPORT}/${draftId}/messages`, {
      message,
    });
    return res.data;
  },

  // 400 kèm code TIMETABLE_DRAFT_INCOMPLETE (body có blockers + needs) nếu còn
  // thiếu thông tin; 409 nếu bản nháp đã chốt ở tab/lần bấm khác.
  commit: async (draftId: number): Promise<DraftView> => {
    const res = await api.post(`${TIMETABLE_IMPORT}/${draftId}/commit`);
    return res.data;
  },

  // 409 nếu đã commit — bản nháp đã tạo lịch thì không huỷ được.
  cancel: async (draftId: number): Promise<void> => {
    await api.post(`${TIMETABLE_IMPORT}/${draftId}/cancel`);
  },
};

/**
 * Đăng ký nhận tiết dạy: Nhân sự mở tiết → giáo viên đăng ký kèm vị trí →
 * BE xếp hạng gợi ý → Nhân sự chọn giáo viên.
 * Khoảng cách và định mức tuần đều do BE tính, FE chỉ hiển thị.
 */
export const teachingApplicationApi = {
  // Tiết đang mở cho giáo viên đăng nhập đăng ký.
  getOpenSessions: async (
    params: OpenSessionQuery = {},
  ): Promise<Paged<TeachingSession>> => {
    const res = await api.get(`${SESSIONS}/open`, { params: clean(params) });
    return res.data;
  },

  // Không gửi teacherId — BE lấy giáo viên từ JWT.
  // 409 nếu trùng lịch, đã đăng ký, hoặc vượt định mức tuần.
  apply: async (
    sessionId: number,
    payload: ApplyPayload,
  ): Promise<ApplyResult> => {
    const res = await api.post(
      `${SESSIONS}/${sessionId}/applications`,
      payload,
    );
    return res.data;
  },

  // Chỉ rút được khi đơn còn PENDING.
  withdraw: async (sessionId: number): Promise<void> => {
    await api.delete(`${SESSIONS}/${sessionId}/applications/me`);
  },

  // Danh sách giáo viên đăng ký, đã được BE xếp hạng sẵn.
  getSuggestions: async (sessionId: number): Promise<TeachingApplication[]> => {
    const res = await api.get(`${SESSIONS}/${sessionId}/suggestions`);
    return Array.isArray(res.data) ? res.data : res.data?.data || [];
  },

  // 409 kèm requiresOverride nếu giáo viên trùng lịch / vượt định mức.
  assign: async (
    sessionId: number,
    teacherId: number,
    override = false,
  ): Promise<TeachingSession> => {
    const res = await api.patch(
      `${SESSIONS}/${sessionId}/assign`,
      stripRateFields({ teacherId, override }),
    );
    return res.data;
  },
};
