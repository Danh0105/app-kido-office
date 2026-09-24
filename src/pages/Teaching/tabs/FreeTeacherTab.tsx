import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Search } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingScheduleApi } from "@/service/teaching";
import {
  DAY_OF_WEEK_OPTIONS,
  type Teacher,
  type TeachingSchedule,
} from "@/types/teaching";

import SearchableSelect from "@/components/SearchableSelect";
import DragScrollContainer from "../components/DragScrollContainer";
import { EmptyState, FilterCard, Loading } from "../components/Shared";
import { inputClass } from "../components/Modal";
import {
  useSubjectsOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import { catalogsOfSubjects, formatTime, minutesOfTime, todayISO } from "../lib";

type Props = {
  teachers: Teacher[];
  schools: RefOption[];
  /** Khu vực nhận dạy của giáo viên: tỉnh/thành → xã/phường. */
  provinces: RefOption[];
  wards: RefOption[];
};

type Session = "SANG" | "CHIEU";

/** Một tiết đã xếp, rút gọn đúng những gì bảng cần hiện. */
type Entry = {
  dayOfWeek: number;
  session: Session;
  startTime: string;
  schoolName: string;
  className: string | null;
  subjectName: string;
};

/**
 * Trần số trang chịu đọc của `GET /teaching-schedules`. 20 trang × 500 = 10.000
 * mẫu lịch, vượt xa quy mô hiện tại — nhưng vẫn chặn cứng để dữ liệu có phình
 * bất thường thì cũng không nạp vô hạn.
 */
const MAX_SCHEDULE_PAGES = 20;
const SCHEDULE_PAGE_SIZE = 500;

/** Bề ngang tối thiểu của bảng — giữ chữ nguyên vẹn, thừa ra thì kéo ngang. */
const STT_WIDTH = 48;
const NAME_WIDTH = 150;
const TOTAL_WIDTH = 90;
const SESSION_WIDTH = 130;

/** Thứ hiện trên bảng — đúng như bảng giấy: Thứ 2 → Thứ 7. */
const SHEET_DAYS = [2, 3, 4, 5, 6, 7];

const SESSIONS: [Session, string][] = [
  ["SANG", "SÁNG"],
  ["CHIEU", "CHIỀU"],
];

/** Mốc 12:00 chia buổi, cùng quy ước với lưới TKB. */
const sessionOf = (startTime: string): Session =>
  formatTime(startTime) < "12:00" ? "SANG" : "CHIEU";

/**
 * Giáo viên trống tiết — bày đúng dạng bảng check-in giáo viên nhà trường đang
 * dùng: mỗi dòng một giáo viên, mỗi thứ tách hai cột Sáng / Chiều, ô ghi lớp +
 * trường + giờ vào. **Ô trống là buổi giáo viên chưa có lịch** — chỗ còn xếp
 * thêm được, nên tô xanh nhạt cho bật lên.
 *
 * "Trống" xét trên **toàn hệ thống**, không bó trong một trường: giáo viên dạy
 * nhiều trường thì bận ở trường khác cũng là bận.
 *
 * Nguồn dữ liệu là **mẫu lịch tuần**, không phải buổi dạy đã sinh: mẫu lịch mới
 * là thứ lặp hằng tuần, còn buổi dạy chỉ là các lần cụ thể sinh ra từ mẫu.
 */
export default function FreeTeacherTab({
  teachers,
  schools,
  provinces,
  wards,
}: Props) {
  const [schoolId, setSchoolId] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [wardId, setWardId] = useState("");
  const [search, setSearch] = useState("");
  const [day, setDay] = useState("");
  const [session, setSession] = useState<"" | Session>("");
  const [catalogId, setCatalogId] = useState("");
  const [onlyThisSchool, setOnlyThisSchool] = useState(false);
  const [onlyUnderQuota, setOnlyUnderQuota] = useState(false);
  /** Bảng vốn để tìm người rảnh; bỏ tick khi muốn xem cả bảng như file Excel. */
  const [onlyFree, setOnlyFree] = useState(true);

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<TeachingSchedule[]>([]);

  const { subjects } = useSubjectsOfSchool(schoolId);
  const catalogOptions = useMemo(() => catalogsOfSubjects(subjects), [subjects]);

  const wardOptions = useMemo(
    () =>
      provinceId
        ? wards.filter((ward) => String(ward.provinceId) === provinceId)
        : wards,
    [wards, provinceId],
  );

  // Đổi tỉnh → xã/phường của tỉnh cũ không còn nằm trong danh sách.
  useEffect(() => {
    setWardId((prev) =>
      prev && !wardOptions.some((ward) => String(ward.id) === prev) ? "" : prev,
    );
  }, [wardOptions]);

  /**
   * Các xã/phường thuộc khu vực đang lọc. `null` = không lọc khu vực.
   * Chọn tỉnh mà không chọn xã/phường thì lấy cả tỉnh.
   */
  const wardScope = useMemo<Set<number> | null>(() => {
    if (wardId) return new Set([Number(wardId)]);
    if (provinceId) return new Set(wardOptions.map((ward) => ward.id));
    return null;
  }, [wardId, provinceId, wardOptions]);

  /**
   * Mẫu lịch đang hoạt động của mọi trường. Endpoint phân trang nên phải đi hết
   * các trang — thiếu một trang là báo trống nhầm rồi xếp chồng lịch.
   */
  useEffect(() => {
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const all: TeachingSchedule[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages && page <= MAX_SCHEDULE_PAGES) {
          const res = await teachingScheduleApi.list({
            isActive: true,
            page,
            limit: SCHEDULE_PAGE_SIZE,
          });
          all.push(...(res?.data || []));
          totalPages = res?.pagination?.totalPages || 1;
          page += 1;
        }

        if (active) setSchedules(all);
      } catch (error: any) {
        if (!active) return;
        if (error?.response?.status !== 403) {
          toast.error(
            getApiErrorMessage(error, "Không tải được lịch dạy để đối chiếu"),
          );
        }
        setSchedules([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Lịch tuần của từng giáo viên. Mẫu lịch đã hết hiệu lực không còn chiếm chỗ;
   * mẫu chưa tới ngày áp dụng thì vẫn tính là bận, vì xếp thêm vào đó là đặt
   * trước một cuộc trùng lịch.
   */
  const entriesByTeacher = useMemo(() => {
    const today = todayISO();
    const map = new Map<number, Entry[]>();

    schedules.forEach((item) => {
      if (item.effectiveTo && item.effectiveTo < today) return;
      map.set(item.teacherId, [
        ...(map.get(item.teacherId) || []),
        {
          dayOfWeek: item.dayOfWeek,
          session: sessionOf(item.startTime),
          startTime: formatTime(item.startTime),
          schoolName: item.schoolName,
          className: item.className,
          subjectName: item.subjectName,
        },
      ]);
    });

    return map;
  }, [schedules]);

  /** Cột của bảng: thứ đang xem × buổi đang xem. */
  const shownDays = day ? [Number(day)] : SHEET_DAYS;
  const shownSessions = session
    ? SESSIONS.filter(([value]) => value === session)
    : SESSIONS;

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const catalog = Number(catalogId);
    const school = Number(schoolId);

    return teachers
      .filter((teacher) => {
        if (teacher.isActive === false) return false;
        if (keyword && !teacher.name.toLowerCase().includes(keyword)) {
          return false;
        }
        // Mảng rỗng = chưa khai giới hạn → không loại ai, vì loại là giấu mất
        // đúng những người thực sự đang rảnh.
        if (catalog) {
          const list = teacher.subjectCatalogIds || [];
          if (list.length > 0 && !list.includes(catalog)) return false;
        }
        if (onlyThisSchool && school) {
          const list = teacher.schoolIds || [];
          if (list.length > 0 && !list.includes(school)) return false;
        }
        if (wardScope) {
          const list = teacher.wardIds || [];
          if (list.length > 0 && !list.some((id) => wardScope.has(id))) {
            return false;
          }
        }
        return true;
      })
      .map((teacher) => {
        const entries = entriesByTeacher.get(teacher.id) || [];

        // Ô của bảng: [thứ][buổi] → các tiết đã xếp, sớm trước muộn sau.
        const cells = shownDays.map((value) =>
          shownSessions.map(([name]) =>
            entries
              .filter(
                (item) => item.dayOfWeek === value && item.session === name,
              )
              .sort(
                (a, b) =>
                  (minutesOfTime(a.startTime) ?? 0) -
                  (minutesOfTime(b.startTime) ?? 0),
              ),
          ),
        );

        const freeCount = cells
          .flat()
          .filter((slot) => slot.length === 0).length;
        // Tổng tiết đếm cả tuần, không phụ thuộc bộ lọc thứ / buổi.
        const total = entries.length;
        const max = teacher.maxPeriodsPerWeek;

        return {
          teacher,
          cells,
          freeCount,
          total,
          max,
          underQuota: max == null || total < max,
        };
      })
      .filter((row) => !onlyFree || row.freeCount > 0)
      .filter((row) => !onlyUnderQuota || row.underQuota)
      .sort(
        (a, b) =>
          b.freeCount - a.freeCount ||
          a.total - b.total ||
          a.teacher.name.localeCompare(b.teacher.name, "vi"),
      );
  }, [
    teachers,
    search,
    catalogId,
    schoolId,
    onlyThisSchool,
    onlyUnderQuota,
    onlyFree,
    wardScope,
    entriesByTeacher,
    shownDays,
    shownSessions,
  ]);

  const cellCount = shownDays.length * shownSessions.length;

  return (
    <>
      <div className="rounded-2xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
        <p className="text-xs leading-relaxed text-gray-500">
          Ô ghi <b>lớp · trường</b> và giờ vào là buổi đã có lịch; ô{" "}
          <b className="text-emerald-700">xanh nhạt</b> là buổi còn trống. Trống
          xét trên mẫu lịch tuần của <b>mọi trường</b>: người đang dạy trường
          khác cùng buổi vẫn là bận.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          Lọc khu vực xét theo xã/phường giáo viên nhận dạy. Người chưa khai khu
          vực vẫn hiện, vì chưa khai không có nghĩa là không nhận.
        </p>
      </div>

      <FilterCard>
        <SearchableSelect
          value={provinceId}
          onChange={setProvinceId}
          options={provinces}
          placeholder="Mọi khu vực"
        />

        <SearchableSelect
          value={wardId}
          onChange={setWardId}
          options={wardOptions}
          placeholder={provinceId ? "Mọi xã/phường" : "Xã/phường"}
        />

        <SearchableSelect
          value={schoolId}
          onChange={setSchoolId}
          options={schools}
          placeholder="Mọi trường"
        />

        <div className="flex items-center gap-2 rounded-lg border px-2">
          <Search size={16} className="shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên giáo viên"
            className="min-w-0 flex-1 py-2 text-sm outline-none"
          />
        </div>

        <select
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={inputClass}
        >
          <option value="">Cả tuần (T2–T7)</option>
          {DAY_OF_WEEK_OPTIONS.filter((item) =>
            SHEET_DAYS.includes(item.value),
          ).map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <select
          value={session}
          onChange={(e) => setSession(e.target.value as "" | Session)}
          className={inputClass}
        >
          <option value="">Cả sáng và chiều</option>
          <option value="SANG">Chỉ buổi sáng</option>
          <option value="CHIEU">Chỉ buổi chiều</option>
        </select>

        <select
          value={catalogId}
          onChange={(e) => setCatalogId(e.target.value)}
          disabled={!schoolId}
          title={schoolId ? undefined : "Chọn trường trước để có danh sách môn"}
          className={`${inputClass} disabled:opacity-40`}
        >
          <option value="">Mọi môn</option>
          {catalogOptions.map((item) => (
            <option key={item.id} value={item.id}>
              Dạy được {item.name}
            </option>
          ))}
        </select>
      </FilterCard>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm text-gray-600">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
          />
          Chỉ giáo viên còn buổi trống
        </label>

        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={onlyUnderQuota}
            onChange={(e) => setOnlyUnderQuota(e.target.checked)}
          />
          Còn định mức tiết/tuần
        </label>

        <label
          className={`flex items-center gap-1.5 ${schoolId ? "" : "opacity-40"}`}
          title={schoolId ? undefined : "Chọn trường trước"}
        >
          <input
            type="checkbox"
            disabled={!schoolId}
            checked={onlyThisSchool}
            onChange={(e) => setOnlyThisSchool(e.target.checked)}
          />
          Nhận dạy trường này
        </label>
      </div>

      {loading && <Loading label="Đang tải lịch dạy của các trường…" />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="🧑‍🏫"
          title="Không có giáo viên nào khớp bộ lọc"
          description="Nới bộ lọc, hoặc bỏ tick “Chỉ giáo viên còn buổi trống”."
        />
      )}

      {!loading && rows.length > 0 && (
        <>
          <p className="px-1 text-xs text-gray-400">
            {rows.length} giáo viên — mỗi người {cellCount} buổi đang xét.
          </p>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <DragScrollContainer className="overflow-x-auto rounded-2xl">
              <table
                className="w-full border-collapse text-sm"
                style={{
                  minWidth:
                    STT_WIDTH +
                    NAME_WIDTH +
                    TOTAL_WIDTH +
                    shownDays.length * shownSessions.length * SESSION_WIDTH,
                }}
              >
                <thead>
                  <tr className="bg-emerald-100 text-gray-800">
                    <th
                      colSpan={3 + shownDays.length * shownSessions.length}
                      className="border border-gray-300 px-3 py-2 text-sm font-bold uppercase tracking-wide"
                    >
                      Check in giáo viên
                    </th>
                  </tr>

                  <tr className="bg-yellow-200 text-gray-900">
                    <th
                      rowSpan={2}
                      className="sticky left-0 z-20 border border-gray-300 bg-yellow-200 px-2 py-2 text-xs font-bold uppercase"
                      style={{ width: STT_WIDTH }}
                    >
                      STT
                    </th>
                    <th
                      rowSpan={2}
                      className="sticky z-20 border border-gray-300 bg-yellow-200 px-2 py-2 text-left text-xs font-bold uppercase"
                      style={{ left: STT_WIDTH, width: NAME_WIDTH }}
                    >
                      Họ và tên
                    </th>

                    {shownDays.map((value) => (
                      <th
                        key={value}
                        colSpan={shownSessions.length}
                        className="border border-gray-300 px-3 py-2 text-sm font-bold uppercase"
                      >
                        {`Thứ ${value === 8 ? "CN" : value}`}
                      </th>
                    ))}

                    <th
                      rowSpan={2}
                      className="border border-gray-300 px-2 py-2 text-xs font-bold uppercase"
                      style={{ width: TOTAL_WIDTH }}
                    >
                      Tổng tiết
                    </th>
                  </tr>

                  <tr className="bg-yellow-100 text-gray-800">
                    {shownDays.map((value) =>
                      shownSessions.map(([name, label]) => (
                        <th
                          key={`${value}|${name}`}
                          className="border border-gray-300 px-3 py-1.5 text-xs font-bold uppercase"
                        >
                          {label}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>

                <tbody>
                  {rows.map(({ teacher, cells, total, max }, index) => (
                    <tr key={teacher.id} className="align-top">
                      <td
                        className="sticky left-0 z-10 border border-gray-300 bg-white px-2 py-1.5 text-center text-xs text-gray-500"
                        style={{ width: STT_WIDTH }}
                      >
                        {index + 1}
                      </td>
                      <td
                        className="sticky z-10 border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium text-gray-800"
                        style={{ left: STT_WIDTH, width: NAME_WIDTH }}
                      >
                        {teacher.name}
                      </td>

                      {cells.map((byDay, dayIndex) =>
                        byDay.map((slot, sessionIndex) => (
                          <td
                            key={`${shownDays[dayIndex]}|${shownSessions[sessionIndex][0]}`}
                            className={`border border-gray-300 px-2 py-1.5 text-xs leading-snug ${
                              slot.length === 0 ? "bg-emerald-50" : "text-gray-700"
                            }`}
                          >
                            {slot.map((item, itemIndex) => (
                              <div
                                key={`${item.startTime}-${itemIndex}`}
                                className={itemIndex > 0 ? "mt-1.5" : ""}
                                title={`${item.subjectName} — ${item.className || "chưa gắn lớp"} — ${item.schoolName}`}
                              >
                                <span className="block font-medium">
                                  {[item.className, item.schoolName]
                                    .filter(Boolean)
                                    .join(" ")}
                                </span>
                                <span className="block text-gray-500">
                                  {item.startTime}
                                </span>
                              </div>
                            ))}
                          </td>
                        )),
                      )}

                      <td
                        className={`border border-gray-300 px-2 py-1.5 text-center text-xs font-bold ${
                          max != null && total >= max
                            ? "bg-red-50 text-red-600"
                            : "text-gray-700"
                        }`}
                        style={{ width: TOTAL_WIDTH }}
                      >
                        {max == null ? total : `${total}/${max}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DragScrollContainer>
          </div>
        </>
      )}
    </>
  );
}
