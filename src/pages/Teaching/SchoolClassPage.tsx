import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { schoolClassApi } from "@/service/teaching";
import type { SchoolClass, SchoolClassQuery } from "@/types/teaching";

import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import SchoolClassFormModal from "./components/SchoolClassFormModal";
import { ConfirmModal } from "./components/Modal";
import { ActiveBadge } from "./components/SessionStatusBadge";
import SearchableSelect from "@/components/SearchableSelect";
import {
  EmptyState,
  FilterCard,
  Loading,
  Pagination,
  TableCard,
  selectClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "./components/Shared";
import { usePagedList } from "./hooks/usePagedList";
import {
  useClassesOfSchool,
  useLocationsOfSchool,
  useTeachingRefData,
} from "./hooks/useTeachingRefData";
import {
  GRADE_LEVELS,
  canManageTeaching,
  gradeLabel,
  locationScopeOptions,
  isClassInUse,
} from "./lib";

/** Ô lọc năm học liệt kê cả lớp đã ngừng dùng — năm cũ vẫn cần tra lại. */
const ALL_CLASSES = { activeOnly: false };

/**
 * Lớp học của từng trường. Nhân sự tạo lớp ở đây trước, rồi mới xếp được
 * lịch dạy cho lớp ở màn "Lịch dạy".
 *
 * Mặc định hiện lớp của TẤT CẢ các trường; chọn trường ở ô lọc chỉ để thu hẹp
 * khi cần, không còn là điều kiện bắt buộc để xem danh sách.
 */
export default function SchoolClassPage() {
  const canManage = canManageTeaching();
  const { schools } = useTeachingRefData();

  const [schoolId, setSchoolId] = useState("");
  /** "" = mọi cơ sở. Chỉ có nghĩa khi trường đã khai điểm trường. */
  const [schoolLocationId, setSchoolLocationId] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [formTarget, setFormTarget] = useState<
    SchoolClass | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Debounce ô tìm kiếm ~300ms.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<SchoolClassQuery>(
    () => ({
      schoolId: schoolId ? Number(schoolId) : undefined,
      schoolLocationId: schoolLocationId ? Number(schoolLocationId) : undefined,
      schoolYear: schoolYear.trim() || undefined,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      isActive: isActive === "" ? undefined : isActive === "true",
      search: search || undefined,
    }),
    [schoolId, schoolLocationId, schoolYear, gradeLevel, isActive, search],
  );

  const { items, setItems, pagination, page, setPage, loading, reload } =
    usePagedList<SchoolClass, SchoolClassQuery>({
      fetcher: schoolClassApi.list,
      query,
      limit: 50,
      errorMessage: "Không tải được danh sách lớp học",
    });

  /**
   * Backend lọc năm học bằng so khớp tuyệt đối nên phải cho chọn, không cho gõ:
   * gõ thiếu một ký tự là ra danh sách rỗng mà không hiểu vì sao.
   * Danh sách năm lấy từ toàn bộ lớp của trường, không phụ thuộc bộ lọc đang áp.
   */
  const { classes: allClasses } = useClassesOfSchool(schoolId, ALL_CLASSES);

  // Trường một cơ sở trả mảng rỗng → không hiện ô lọc điểm trường.
  const { locations } = useLocationsOfSchool(schoolId);

  const schoolYearOptions = useMemo(
    () =>
      Array.from(new Set(allClasses.map((item) => item.schoolYear))).sort(
        (a, b) => b.localeCompare(a, "vi"),
      ),
    [allClasses],
  );

  const hasFilter =
    !!schoolId ||
    !!schoolLocationId ||
    !!schoolYear.trim() ||
    !!gradeLevel ||
    isActive !== "" ||
    !!search;

  const clearFilters = () => {
    setSchoolId("");
    setSchoolLocationId("");
    setSchoolYear("");
    setGradeLevel("");
    setIsActive("");
    setSearchInput("");
    setSearch("");
  };

  // Đổi trường → bỏ năm học đang lọc: trường mới có thể không có năm học đó.
  const changeSchool = (value: string) => {
    setSchoolId(value);
    setSchoolYear("");
    // Điểm trường thuộc về một trường cụ thể — giữ lại là lọc theo cơ sở của
    // trường cũ, danh sách sẽ trống mà không rõ vì sao.
    setSchoolLocationId("");
  };

  /** Ngừng / dùng lại lớp ngay trên hàng — cách "ngừng dùng" thay cho xoá. */
  const toggleActive = async (item: SchoolClass) => {
    setTogglingId(item.id);
    try {
      const updated = await schoolClassApi.update(item.id, {
        isActive: !item.isActive,
      });
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, ...updated } : row)),
      );
      toast.success(
        item.isActive
          ? `Đã ngừng dùng lớp ${item.name}`
          : `Đã dùng lại lớp ${item.name}`,
      );
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Cập nhật lớp học thất bại"));
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await schoolClassApi.remove(deleteTarget.id);
      toast.success("Đã xoá lớp học");
      setDeleteTarget(null);
      reload();
    } catch (error: any) {
      // 409: lớp đã có lịch / buổi dạy — message của BE nêu rõ số lượng.
      if (error?.response?.status === 409) {
        setDeleteError(
          getApiErrorMessage(
            error,
            "Lớp đang được dùng ở lịch dạy nên không xoá được",
          ),
        );
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá lớp học thất bại"));
      }
    } finally {
      setDeleting(false);
    }
  };

  const deactivate = async (item: SchoolClass) => {
    try {
      await schoolClassApi.update(item.id, { isActive: false });
      toast.success(`Đã ngừng dùng lớp ${item.name}`);
      setDeleteTarget(null);
      setDeleteError("");
      reload();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Cập nhật thất bại"));
      }
    }
  };

  return (
    <TeachingLayout title="Lớp học">
      <TeachingTabs />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          Lịch dạy được xếp cho từng lớp, nên trường phải có lớp trước. Hai lớp
          khác nhau học cùng khung giờ thì xếp được, còn một lớp không thể có hai
          buổi trùng giờ.
        </p>
      </div>

      {canManage && (
        <button
          onClick={() => setFormTarget(null)}
          className="w-full md:w-auto md:inline-flex md:px-5 flex items-center justify-center gap-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
        >
          <Plus size={16} /> Thêm lớp học
        </button>
      )}

      <FilterCard>
        <div className="md:col-span-2">
          <SearchableSelect
            value={schoolId}
            onChange={changeSchool}
            options={schools}
            placeholder="— Tất cả trường —"
            searchPlaceholder="Tìm trường…"
          />
        </div>

        {/* Chỉ trường nhiều cơ sở mới có ô này — trường một cơ sở giữ nguyên
            bộ lọc như cũ. */}
        {locations.length > 0 && (
          <div className="md:col-span-2">
            <SearchableSelect
              value={schoolLocationId}
              onChange={setSchoolLocationId}
              options={locationScopeOptions(locations)}
              placeholder="— Trường chính + mọi điểm trường —"
              searchPlaceholder="Tìm điểm trường…"
            />
          </div>
        )}

        <div className="flex items-center gap-2 border rounded-lg px-2 md:col-span-2">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên lớp hoặc GVCN"
            className="flex-1 min-w-0 py-2 text-sm outline-none"
          />
        </div>

        <div className="flex gap-2 md:contents">
          <select
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            disabled={!schoolId}
            className={`flex-1 min-w-0 ${selectClass} disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">Tất cả năm học</option>
            {schoolYearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className={`flex-1 min-w-0 ${selectClass}`}
          >
            <option value="">Tất cả khối</option>
            {GRADE_LEVELS.map((grade) => (
              <option key={grade} value={grade}>
                Khối {grade}
              </option>
            ))}
          </select>

          <select
            value={isActive}
            onChange={(e) => setIsActive(e.target.value as any)}
            className={`flex-1 min-w-0 ${selectClass}`}
          >
            <option value="">Tất cả</option>
            <option value="true">Đang dùng</option>
            <option value="false">Ngừng dùng</option>
          </select>
        </div>

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="w-full py-2 text-sm rounded-lg border border-gray-200 text-gray-500 md:col-span-4 md:w-auto md:px-4 md:justify-self-end"
          >
            Xoá lọc
          </button>
        )}
      </FilterCard>

      {loading && <Loading />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon="🧑‍🎓"
          title={
            hasFilter
              ? "Không có lớp nào khớp bộ lọc"
              : "Chưa có lớp học nào"
          }
          description={
            hasFilter
              ? "Thử xoá bớt bộ lọc để xem toàn bộ lớp."
              : "Tạo lớp học rồi mới xếp được lịch dạy theo lớp."
          }
          action={
            canManage && !hasFilter ? (
              <button
                onClick={() => setFormTarget(null)}
                className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
              >
                <Plus size={16} /> Thêm lớp học
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && items.length > 0 && (
        <TableCard minWidth={canManage ? 1160 : 1020}>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Tên lớp</th>
              <th className={thClass}>Trường</th>
              <th className={thClass}>Khối</th>
              <th className={thClass}>Năm học</th>
              <th className={`${thClass} text-right`}>Sĩ số</th>
              <th className={thClass}>GVCN</th>
              <th className={thClass}>Đang dùng</th>
              <th className={thClass}>Trạng thái</th>
              {canManage && <th className={`${thClass} text-right`}>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const inUse = isClassInUse(item);

              return (
                <tr key={item.id} className={trClass}>
                  <td className={`${tdClass} font-semibold text-gray-800`}>
                    {item.name}
                    {item.note && (
                      <span className="block text-[11px] text-gray-400 font-normal">
                        {item.note}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>
                    {item.schoolName}
                    {item.locationName && (
                      <span className="block text-[11px] text-gray-400 font-normal">
                        {item.locationName}
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>{gradeLabel(item.gradeLevel)}</td>
                  <td className={tdClass}>{item.schoolYear}</td>
                  <td className={`${tdClass} text-right`}>
                    {item.studentCount || "—"}
                  </td>
                  <td className={tdClass}>{item.homeroomTeacher || "—"}</td>
                  <td className={`${tdClass} text-xs`}>
                    {inUse ? (
                      <span className="text-gray-600">
                        {item.scheduleCount} lịch · {item.sessionCount} buổi
                      </span>
                    ) : (
                      <span className="text-gray-300">Chưa dùng</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    {canManage ? (
                      <button
                        onClick={() => toggleActive(item)}
                        disabled={togglingId === item.id}
                        title={
                          item.isActive
                            ? "Bấm để ngừng dùng lớp này"
                            : "Bấm để dùng lại lớp này"
                        }
                        className="disabled:opacity-50 active:scale-95"
                      >
                        <ActiveBadge
                          active={item.isActive}
                          activeLabel="Đang dùng"
                          inactiveLabel="Ngừng dùng"
                        />
                      </button>
                    ) : (
                      <ActiveBadge
                        active={item.isActive}
                        activeLabel="Đang dùng"
                        inactiveLabel="Ngừng dùng"
                      />
                    )}
                  </td>
                  {canManage && (
                    <td className={`${tdClass} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setFormTarget(item)}
                          className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 active:scale-95"
                          title="Sửa"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(item);
                          }}
                          disabled={inUse}
                          title={
                            inUse
                              ? "Lớp đang có lịch / buổi dạy — hãy chuyển sang ngừng dùng"
                              : "Xoá"
                          }
                          className="px-2 py-1.5 rounded-lg border border-red-100 text-red-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onChange={setPage}
      />

      {formTarget !== undefined && (
        <SchoolClassFormModal
          schoolClass={formTarget}
          schools={schools}
          defaultSchoolId={schoolId}
          defaultSchoolYear={schoolYear.trim() || schoolYearOptions[0] || ""}
          onClose={() => setFormTarget(undefined)}
          onSaved={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Xoá lớp học"
          message={
            deleteError ? (
              <span className="text-red-600">{deleteError}</span>
            ) : (
              <>
                Xoá lớp <b>{deleteTarget.name}</b> ({deleteTarget.schoolYear})
                của <b>{deleteTarget.schoolName}</b>?
              </>
            )
          }
          hint={
            deleteError ? (
              <>
                Lớp đang được dùng nên không xoá được. Hãy chuyển sang{" "}
                <b>ngừng dùng</b> để không xếp thêm lịch mới mà vẫn giữ nguyên
                lịch và buổi dạy cũ.
              </>
            ) : undefined
          }
          submitLabel={deleteError ? "Ngừng dùng" : "Xoá"}
          submitColor={deleteError ? "bg-amber-500" : "bg-red-500"}
          loading={deleting}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          onSubmit={() =>
            deleteError ? deactivate(deleteTarget) : handleDelete()
          }
        />
      )}
    </TeachingLayout>
  );
}
