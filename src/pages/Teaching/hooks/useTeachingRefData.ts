import { useCallback, useEffect, useState } from "react";

import {
  schoolApi,
  schoolLocationApi,
  schoolPeriodApi,
  type SchoolLocation,
  type SchoolPeriod,
} from "@/service/school.api";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";
import { subjectApi, type Subject } from "@/service/subject.api";
import {
  schoolClassApi,
  teacherApi,
  teachingScheduleApi,
} from "@/service/teaching";
import type { SchoolClass, Teacher } from "@/types/teaching";

import { canViewTeacherDirectory, sortSchoolYears, type TimetableRow } from "../lib";

/**
 * Các phường/xã thuộc địa bàn Bà Rịa–Vũng Tàu trước khi gộp tỉnh (đối chiếu
 * theo địa chỉ trường thực tế trong DB — 7 Phước Hưng, 66 Tam Long (Hoà Long),
 * 117 Phước Thắng, 461 Ngã Giao (Ngãi Giao, Châu Đức) trước đây bị bỏ sót nên
 * các trường này vẫn lẫn vào bộ lọc TP.HCM).
 */
export const VUNG_TAU_WARD_IDS = new Set([
  7, 18, 24, 66, 79, 117, 151, 179, 439, 461,
]);
export const VUNG_TAU_REGION_ID = "VUNG_TAU";

/** Các phường/xã thuộc địa bàn Bình Dương trước khi gộp tỉnh (đối chiếu theo địa chỉ trường thực tế trong DB). */
export const BINH_DUONG_WARD_IDS = new Set([
  68, 84, 91, 93, 95, 99, 146, 185, 188, 437, 450, 459,
]);
export const BINH_DUONG_REGION_ID = "BINH_DUONG";

export type RefOption = {
  id: number;
  name: string;
  provinceId?: number;
  wardId?: number;
  /** Tên xã/phường — phân biệt các trường trùng tên ở địa bàn khác nhau. */
  wardName?: string;
  isVungTau?: boolean;
  isBinhDuong?: boolean;
};

/** Trần mỗi trang của `GET /teachers` (MAX_LIMIT của backend). */
const TEACHER_PAGE_SIZE = 100;

/**
 * Trần số trang chịu đọc để dựng ô chọn giáo viên. 10 trang = 1000 giáo viên,
 * vượt xa quy mô hiện tại — nhưng vẫn chặn cứng để dữ liệu có phình bất thường
 * thì cũng không nạp vô hạn.
 */
const MAX_TEACHER_PAGES = 10;

/** Danh sách trường + xã/phường + giáo viên dùng cho thanh lọc và form của cả module. */
export function useTeachingRefData() {
  const [schools, setSchools] = useState<RefOption[]>([]);
  const [provinces, setProvinces] = useState<RefOption[]>([]);
  const [wards, setWards] = useState<RefOption[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Lấy ĐỦ giáo viên, không chỉ trang đầu.
   *
   * Backend chặn mỗi trang tối đa 100 (`MAX_LIMIT`), nên trước đây chỉ nạp
   * `limit: 100` là mất hẳn giáo viên thứ 101 trở đi khỏi mọi ô chọn giáo viên
   * (xếp lịch, tạo buổi, phân công...) — họ vẫn tồn tại trong danh sách giáo
   * viên nhưng không tài nào chọn được để xếp lịch, và không có thông báo lỗi
   * nào cả. Đọc tiếp các trang còn lại theo `totalPages`.
   */
  const loadTeachers = useCallback(async () => {
    // Kinh doanh không có quyền đọc danh bạ giáo viên — không gọi để khỏi 403.
    if (!canViewTeacherDirectory()) {
      setTeachers([]);
      return;
    }
    try {
      const first = await teacherApi.list({ page: 1, limit: TEACHER_PAGE_SIZE });
      const pages = Math.min(
        first?.pagination?.totalPages || 1,
        MAX_TEACHER_PAGES,
      );

      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
          teacherApi
            .list({ page: index + 2, limit: TEACHER_PAGE_SIZE })
            .catch(() => null),
        ),
      );

      setTeachers([first, ...rest].flatMap((res) => res?.data || []));
    } catch {
      // Lỗi tải danh mục không chặn màn hình; danh sách chính đã có toast riêng.
      setTeachers([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const res = await schoolApi.getAll({ page: 1, limit: 1000 });
        // `GET /schools` trả kèm `ward`, nên khu vực (tỉnh) của trường suy được
        // ngay ở đây — các màn lọc theo khu vực không phải gọi thêm API.
        if (alive) {
          setSchools(
            (res?.data || []).map((school: any) => ({
              ...school,
              provinceId:
                Number(
                  school.ward?.province_id ??
                    school.ward?.provinceId ??
                    school.provinceId ??
                    0,
                ) || undefined,
              wardId: Number(school.ward?.id ?? school.wardId ?? 0) || undefined,
              wardName: school.ward?.name || undefined,
              isVungTau: VUNG_TAU_WARD_IDS.has(
                Number(school.ward?.id ?? school.wardId ?? 0),
              ),
              isBinhDuong: BINH_DUONG_WARD_IDS.has(
                Number(school.ward?.id ?? school.wardId ?? 0),
              ),
            })),
          );
        }
      } catch {
        if (alive) setSchools([]);
      }
      try {
        const res = await provinceApi.getAll();
        if (alive) setProvinces(Array.isArray(res) ? res : res?.data || []);
      } catch {
        if (alive) setProvinces([]);
      }
      try {
        const res = await wardApi.getAll();
        const rows = Array.isArray(res) ? res : res?.data || [];
        if (alive) {
          setWards(rows.map((ward: any) => ({
            id: ward.id,
            name: ward.name,
            provinceId: Number(
              ward.provinceId ?? ward.province_id ?? ward.province?.id ?? 0,
            ) || undefined,
          })));
        }
      } catch {
        if (alive) setWards([]);
      }
      await loadTeachers();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [loadTeachers]);

  return { schools, provinces, wards, teachers, loading, reloadTeachers: loadTeachers };
}

/**
 * Môn học phụ thuộc trường: đổi trường → tải lại môn.
 *
 * Trả nguyên bản ghi môn của trường (kèm `catalogId`, `schoolYear`) — form nào
 * chỉ cần chọn môn thì dùng `id`/`name`, lưới TKB cần `catalogId` để gộp về
 * danh mục dùng chung.
 */
export function useSubjectsOfSchool(schoolId?: number | string) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!schoolId) {
      setSubjects([]);
      return;
    }

    let alive = true;
    setLoading(true);

    subjectApi
      .getBySchool(Number(schoolId))
      .then((data: any) => {
        if (!alive) return;
        setSubjects(Array.isArray(data) ? data : data?.data || []);
      })
      .catch(() => {
        if (alive) setSubjects([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [schoolId, reloadToken]);

  const reload = useCallback(() => setReloadToken((v) => v + 1), []);

  return { subjects, loading, reload };
}

/**
 * Điểm trường của một trường — phụ thuộc trường giống môn học.
 *
 * Trường không chia cơ sở thì trả mảng rỗng: nơi gọi phải coi "không có điểm
 * trường" là hợp lệ (lớp/lịch gắn thẳng vào trường như trước), không phải lỗi.
 */
export function useLocationsOfSchool(schoolId?: number | string) {
  const [locations, setLocations] = useState<SchoolLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!schoolId) {
      setLocations([]);
      return;
    }

    let alive = true;
    setLoading(true);

    schoolLocationApi
      .getBySchool(Number(schoolId))
      .then((data) => {
        if (alive) setLocations(data);
      })
      .catch(() => {
        if (alive) setLocations([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [schoolId, reloadToken]);

  const reload = useCallback(() => setReloadToken((v) => v + 1), []);

  return { locations, loading, reload };
}

/** Lấy hết lớp của một trường trong 1 lần gọi — BE cho tối đa 200 mục mỗi trang. */
const CLASS_PAGE_SIZE = 200;

/**
 * Năm học của một trường, gom từ dữ liệu đang có: môn học đã khai báo và các
 * lớp đã tạo. Không có endpoint riêng trả danh sách năm học nên phải gộp ở FE.
 *
 * Trường mới tinh (chưa có môn, chưa có lớp) thì trả về mảng rỗng — nơi gọi tự
 * quyết định phương án dự phòng.
 *
 * `includeClasses: false` thì chỉ gom từ môn học: role không được đọc
 * `/school-classes` (kinh doanh) gọi vào chỉ nhận 403 rồi bỏ, không thêm dữ liệu.
 */
export function useSchoolYearsOfSchool(
  schoolId?: number | string,
  { includeClasses = true }: { includeClasses?: boolean } = {},
) {
  const [years, setYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) {
      setYears([]);
      return;
    }

    let alive = true;
    setLoading(true);

    Promise.all([
      // Một trong hai nguồn lỗi thì vẫn dùng nguồn còn lại.
      subjectApi.getBySchool(Number(schoolId)).catch(() => []),
      includeClasses
        ? schoolClassApi
            .list({ schoolId: Number(schoolId), limit: CLASS_PAGE_SIZE })
            .catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([subjectRes, classRes]) => {
        if (!alive) return;

        const subjects: { schoolYear?: string | null }[] = Array.isArray(
          subjectRes,
        )
          ? subjectRes
          : (subjectRes as any)?.data || [];

        const found = [...subjects, ...(classRes?.data || [])]
          .map((item) => (item.schoolYear || "").trim())
          .filter(Boolean);

        setYears(sortSchoolYears(Array.from(new Set(found))));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [schoolId, includeClasses]);

  return { years, loading };
}

/** Trần mỗi trang của `GET /teaching-schedules` (MAX_LIMIT của backend). */
const SCHEDULE_PAGE_SIZE = 100;

/**
 * Số trang tối đa chịu đọc để dựng danh sách trường. 5 trang = 500 mẫu lịch,
 * quá xa mức một người dạy nổi (định mức trần là 100 tiết/tuần) nên trong thực
 * tế không bao giờ chạm.
 */
const MAX_SCHEDULE_PAGES = 5;

/**
 * Các trường **đã lên thời khoá biểu** cho một giáo viên, suy từ chính mẫu lịch
 * đang áp dụng của người đó. Không dùng `teacher.schoolIds` vì đó là "trường
 * được phép nhận dạy" — khai một lần lúc lập hồ sơ, không phản ánh nơi đã thật
 * sự có lịch.
 *
 * Không có endpoint trả thẳng danh sách trường nên phải gom từ mẫu lịch; backend
 * chặn mỗi trang 100 mục nên đọc tiếp các trang còn lại theo `totalPages`.
 */
export function useSchoolsOfTeacher(teacherId?: number | string) {
  const [schoolIds, setSchoolIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teacherId) {
      setSchoolIds([]);
      return;
    }

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const query = {
          teacherId: Number(teacherId),
          isActive: true,
          limit: SCHEDULE_PAGE_SIZE,
        };

        const first = await teachingScheduleApi.list({ ...query, page: 1 });
        const pages = Math.min(
          first?.pagination?.totalPages || 1,
          MAX_SCHEDULE_PAGES,
        );

        const rest = await Promise.all(
          Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
            teachingScheduleApi
              .list({ ...query, page: i + 2 })
              .catch(() => null),
          ),
        );

        if (!alive) return;

        const found = [first, ...rest].flatMap((res) => res?.data || []);
        setSchoolIds([...new Set(found.map((item) => item.schoolId))]);
      } catch {
        // Lỗi tải danh mục không chặn màn hình — nơi gọi tự lo phương án dự phòng.
        if (alive) setSchoolIds([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [teacherId]);

  return { schoolIds, loading };
}

/**
 * Lớp học phụ thuộc trường, giống môn học: đổi trường → tải lại lớp.
 * Mặc định chỉ lấy lớp đang dùng vì lớp đã ngừng không xếp lịch mới được.
 */
/**
 * `enabled: false` để **không gọi API**: `/school-classes` chỉ mở cho Nhân sự /
 * Giáo vụ / ban giám đốc, nên màn chỉ-xem của kinh doanh gọi vào là 403. Danh
 * sách lớp cũng chỉ cần khi xếp lịch — lưới TKB đã có tên lớp trong mẫu lịch.
 */
export function useClassesOfSchool(
  schoolId?: number | string,
  { activeOnly = true, enabled = true }: { activeOnly?: boolean; enabled?: boolean } = {},
) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId || !enabled) {
      setClasses([]);
      return;
    }

    let alive = true;
    setLoading(true);

    schoolClassApi
      .list({
        schoolId: Number(schoolId),
        isActive: activeOnly ? true : undefined,
        limit: CLASS_PAGE_SIZE,
      })
      .then((res) => {
        if (alive) setClasses(res?.data || []);
      })
      .catch(() => {
        if (alive) setClasses([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [schoolId, activeOnly, enabled]);

  return { classes, loading };
}

/**
 * Bảng giờ tiết học của một trường, dùng làm các DÒNG của lưới TKB.
 *
 * Trường chưa khai thì trả khung mặc định (`DEFAULT_TIMETABLE_ROWS`) để lưới
 * vẫn dùng được ngay; người dùng sửa giờ trên lưới là tự lưu lại thành khung
 * riêng của trường đó.
 */
export function useSchoolPeriodRows(schoolId?: number | string) {
  const [rows, setRows] = useState<TimetableRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedSchoolId, setLoadedSchoolId] = useState("");
  const requestedSchoolId = schoolId ? String(schoolId) : "";

  useEffect(() => {
    if (!schoolId) {
      setRows(null);
      setLoadedSchoolId("");
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    schoolPeriodApi
      .list(Number(schoolId))
      .then((data) => {
        if (!alive) return;
        setRows(
          data.length
            ? data.map((item) => ({
                key: `db-${item.periodNo}`,
                session: (item.session as TimetableRow["session"]) || "SANG",
                isPeriod: item.isPeriod !== false,
                label: item.label || String(item.periodNo),
                startTime: item.startTime,
                endTime: item.endTime,
              }))
            : null,
        );
      })
      .catch(() => {
        // Không tải được thì để lưới dùng khung mặc định, không chặn xếp lịch.
        if (alive) setRows(null);
      })
      .finally(() => {
        if (alive) {
          setLoadedSchoolId(String(schoolId));
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [schoolId]);

  return {
    rows: loadedSchoolId === requestedSchoolId ? rows : null,
    loading: !!schoolId && (loading || loadedSchoolId !== requestedSchoolId),
  };
}
