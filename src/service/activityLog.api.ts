import api from "./api";

export interface ActivityContext {
  schoolName?: string;
  className?: string;
  teacherName?: string;
  subjectName?: string;
  employeeName?: string;
  schoolYear?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  periods?: number;
  /** Endpoint hàng loạt: số bản ghi bị tác động. */
  itemCount?: number;
}

export interface FieldChange {
  field: string;
  before: any;
  after: any;
}

export interface ActivityLog {
  id: number;
  createdAt: string;
  actorId: number;
  actorName?: string | null;
  actorRoles: string[];
  method: string;
  path: string;
  /** Đoạn đầu của path: `teachers`, `employees`, `teaching-sessions`… */
  resource: string;
  body?: any;
  /** Tên trường/lớp/giáo viên/môn + ngày giờ tiết, chốt lúc thao tác. */
  context?: ActivityContext | null;
  /** Bản ghi trước khi sửa/xoá (null với thao tác thêm mới). */
  beforeData?: Record<string, any> | null;
  /** Bản ghi sau khi sửa (null với thao tác xoá). */
  afterData?: Record<string, any> | null;
  /** Các field thực sự đổi giá trị. */
  changes?: FieldChange[] | null;
  params?: any;
  query?: any;
  statusCode?: number | null;
  success: boolean;
  errorMessage?: string | null;
  durationMs?: number | null;
  ip?: string | null;
}

export interface ActivityLogQuery {
  actorId?: number;
  schoolId?: number;
  teacherId?: number;
  resource?: string;
  method?: string;
  success?: boolean;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogActor {
  actorId: number;
  actorName?: string | null;
  total: number;
}

const PATH = "/activity-logs";

/** Bỏ field rỗng để không gửi `?resource=` làm backend lọc nhầm chuỗi rỗng. */
const clean = (params: ActivityLogQuery) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );

export const activityLogApi = {
  list: async (
    params: ActivityLogQuery = {},
  ): Promise<{ data: ActivityLog[]; total: number; page: number; limit: number }> => {
    const res = await api.get(PATH, { params: clean(params) });
    return res.data;
  },
  actors: async (): Promise<ActivityLogActor[]> =>
    (await api.get(`${PATH}/actors`)).data,
  /** Lịch sử thao tác trên một bản ghi cụ thể, vd `teachers` + `12`. */
  byResource: async (
    resource: string,
    resourceId: number | string,
  ): Promise<ActivityLog[]> =>
    (await api.get(`${PATH}/${resource}/${resourceId}`)).data,
};
