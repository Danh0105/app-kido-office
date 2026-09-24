import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { MapPin, Plus, Search, Pencil, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teacherApi } from "@/service/teaching";
import type { Teacher, TeacherQuery, TeacherRole } from "@/types/teaching";

import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import TeacherFormModal from "./components/TeacherFormModal";
import TeacherDetailDrawer from "./components/TeacherDetailDrawer";
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
import { useTeachingRefData } from "./hooks/useTeachingRefData";
import {
  canManageTeaching,
  canSetTeachingRates,
  formatMoney,
  summarizeNames,
  TEACHER_COLLABORATOR_ROLE,
  TEACHER_STAFF_ROLE,
} from "./lib";
import type { TeachingRefItem } from "@/types/teaching";
import ReviewQueues from "./components/ReviewQueues";

/**
 * Tóm tắt danh mục dài trong một ô bảng: 2 tên đầu + "+N", tên đầy đủ nằm ở
 * `title` để rê chuột xem được mà không kéo cao dòng.
 */
function RefSummary({
  items,
  empty,
}: {
  items: TeachingRefItem[];
  empty: string;
}) {
  if (items.length === 0) {
    return <span className="text-xs text-gray-400">{empty}</span>;
  }

  const { names, extra } = summarizeNames(items);

  return (
    <span
      className="flex flex-wrap items-center gap-1"
      title={items.map((item) => item.name).join(", ")}
    >
      {names.map((name) => (
        <span
          key={name}
          className="inline-block max-w-[10rem] truncate rounded-md bg-gray-100 px-1.5 py-[2px] text-[11px] text-gray-700"
        >
          {name}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[11px] font-medium text-gray-500">+{extra}</span>
      )}
    </span>
  );
}

function TeacherRoleBadge({ role }: { role: TeacherRole | null }) {
  const config =
    role === TEACHER_STAFF_ROLE
      ? { label: "Giáo viên công ty", className: "bg-blue-100 text-blue-700" }
      : role === TEACHER_COLLABORATOR_ROLE
      ? { label: "Cộng tác viên", className: "bg-violet-100 text-violet-700" }
      : { label: "Chưa phân loại", className: "bg-gray-100 text-gray-600" };

  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default function TeacherList() {
  const canManage = canManageTeaching();
  const canSetRates = canSetTeachingRates();
  const { schools, provinces, wards } = useTeachingRefData();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [teacherRole, setTeacherRole] = useState<"" | TeacherRole>("");

  const [formTarget, setFormTarget] = useState<Teacher | null | undefined>(
    undefined,
  );
  const [detailTarget, setDetailTarget] = useState<Teacher | null>(null);

  // `?edit=<id>` (vd. từ báo cáo "Cần bổ sung" ở tab Quãng đường: giáo viên
  // chưa có vị trí nhà) → mở thẳng form sửa của giáo viên đó.
  const [searchParams, setSearchParams] = useSearchParams();
  const editTeacherId = Number(searchParams.get("edit")) || null;
  useEffect(() => {
    if (!editTeacherId || !canManage) return;
    setSearchParams({}, { replace: true });
    teacherApi
      .findOne(editTeacherId)
      .then(setFormTarget)
      .catch((error) =>
        toast.error(getApiErrorMessage(error, "Không tải được giáo viên")),
      );
  }, [editTeacherId, canManage, setSearchParams]);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Debounce ô tìm kiếm ~300ms.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<TeacherQuery>(
    () => ({
      search: search || undefined,
      isActive: isActive === "" ? undefined : isActive === "true",
      schoolId: schoolId ? Number(schoolId) : undefined,
      teacherRole: teacherRole || undefined,
    }),
    [search, isActive, schoolId, teacherRole],
  );

  const { items, pagination, page, setPage, loading, reload } = usePagedList<
    Teacher,
    TeacherQuery
  >({
    fetcher: teacherApi.list,
    query,
    errorMessage: "Không tải được danh sách giáo viên",
  });

  const hasFilter = !!search || isActive !== "" || !!schoolId;

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setIsActive("");
    setSchoolId("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await teacherApi.remove(deleteTarget.id);
      toast.success("Đã xoá giáo viên");
      setDeleteTarget(null);
      reload();
    } catch (error: any) {
      // 409: giáo viên đã có buổi dạy → giữ modal, gợi ý tắt "Đang hoạt động".
      if (error?.response?.status === 409) {
        setDeleteError(
          getApiErrorMessage(
            error,
            "Giáo viên này đã có buổi dạy, không xoá được",
          ),
        );
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá giáo viên thất bại"));
      }
    } finally {
      setDeleting(false);
    }
  };

  const deactivate = async (teacher: Teacher) => {
    try {
      await teacherApi.update(teacher.id, { isActive: false });
      toast.success(`Đã chuyển ${teacher.name} sang ngừng hoạt động`);
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
    <TeachingLayout title="Giáo viên">
      <TeachingTabs />

      {/* Mở tài khoản + đổi vị trí gộp một khối; duyệt xong có giáo viên mới. */}
      {canManage && <ReviewQueues onApproved={reload} />}

      {canManage && (
        <button
          onClick={() => setFormTarget(null)}
          className="w-full md:w-auto md:inline-flex md:px-5 flex items-center justify-center gap-1 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
        >
          <Plus size={16} /> Thêm giáo viên
        </button>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            ["", "Tất cả"],
            [TEACHER_STAFF_ROLE, "Giáo viên công ty"],
            [TEACHER_COLLABORATOR_ROLE, "Giáo viên cộng tác viên"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            onClick={() => setTeacherRole(value)}
            className={`rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
              teacherRole === value
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bộ lọc */}
      <FilterCard>
        <div className="relative md:col-span-2">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên, SĐT, email…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="flex gap-2 md:contents">
          <select
            value={isActive}
            onChange={(e) => setIsActive(e.target.value as any)}
            className={`flex-1 ${selectClass}`}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang dạy</option>
            <option value="false">Ngừng</option>
          </select>

          <SearchableSelect
            value={schoolId}
            onChange={setSchoolId}
            options={schools}
            placeholder="Tất cả trường"
            searchPlaceholder="Tìm trường…"
            className="flex-1 min-w-0"
          />

          {hasFilter && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-500 whitespace-nowrap md:justify-self-end"
            >
              Xoá lọc
            </button>
          )}
        </div>
      </FilterCard>

      {loading && <Loading />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon="🧑‍🏫"
          title={
            hasFilter ? "Không tìm thấy giáo viên nào" : "Chưa có giáo viên nào"
          }
          description={
            hasFilter
              ? "Thử đổi từ khoá hoặc xoá bớt bộ lọc."
              : "Thêm giáo viên để bắt đầu xếp lịch dạy và chấm công."
          }
          action={
            hasFilter ? (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                Xoá lọc
              </button>
            ) : canManage ? (
              <button
                onClick={() => setFormTarget(null)}
                className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
              >
                <Plus size={16} /> Thêm giáo viên
              </button>
            ) : undefined
          }
        />
      )}

      {!loading && items.length > 0 && (
        <TableCard minWidth={canManage ? 1840 : 1620}>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Tên</th>
              <th className={thClass}>SĐT</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Loại giáo viên</th>
              <th className={thClass}>Xã/phường có thể dạy</th>
              <th className={thClass}>Môn có thể dạy</th>
              <th className={thClass}>Vị trí</th>
              <th className={thClass}>Định mức tuần</th>
              {canSetRates && (
                <th className={`${thClass} text-right`}>Đơn giá/tiết</th>
              )}
              <th className={thClass}>Trạng thái</th>
              {canManage && (
                <th className={`${thClass} text-right`}>Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((teacher) => (
              <tr
                key={teacher.id}
                onClick={() => setDetailTarget(teacher)}
                className={`${trClass} cursor-pointer`}
                title="Xem chi tiết"
              >
                <td className={`${tdClass} font-semibold text-gray-800`}>
                  {teacher.name}
                </td>
                <td className={`${tdClass} text-gray-600`}>
                  {teacher.phone || "—"}
                </td>
                <td className={`${tdClass} text-gray-600`}>
                  {teacher.email || "—"}
                </td>
                <td className={tdClass}>
                  <TeacherRoleBadge role={teacher.teacherRole} />
                </td>

                <td className={tdClass}>
                  <RefSummary
                    items={teacher.allowedWards || []}
                    empty="Chưa chọn xã/phường"
                  />
                </td>
                <td className={tdClass}>
                  <RefSummary
                    items={teacher.teachableSubjects || []}
                    empty="Chưa chọn môn"
                  />
                </td>
                <td className={tdClass}>
                  {teacher.googleMapsUrl ? (
                    <a
                      href={teacher.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <MapPin size={12} /> Mở bản đồ
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">
                      Chưa khai vị trí
                    </span>
                  )}
                </td>
                <td className={`${tdClass} text-gray-600`}>
                  {teacher.maxPeriodsPerWeek == null
                    ? "Không giới hạn"
                    : `Tối đa ${teacher.maxPeriodsPerWeek} tiết/tuần`}
                </td>
                {canSetRates && (
                  <td
                    className={`${tdClass} whitespace-nowrap text-right font-medium text-gray-700`}
                  >
                    {formatMoney(teacher.defaultRatePerPeriod)}
                  </td>
                )}
                <td className={tdClass}>
                  <ActiveBadge active={teacher.isActive} />
                </td>
                {canManage && (
                  <td
                    className={`${tdClass} text-right`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setFormTarget(teacher)}
                        className="px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 active:scale-95"
                        title="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(teacher);
                        }}
                        className="px-2 py-1.5 rounded-lg border border-red-100 text-red-400 active:scale-95"
                        title="Xoá"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onChange={setPage}
      />

      {detailTarget && (
        <TeacherDetailDrawer
          teacher={detailTarget}
          roleBadge={<TeacherRoleBadge role={detailTarget.teacherRole} />}
          canManage={canManage}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            setFormTarget(detailTarget);
            setDetailTarget(null);
          }}
          onDelete={() => {
            setDeleteError("");
            setDeleteTarget(detailTarget);
            setDetailTarget(null);
          }}
        />
      )}

      {formTarget !== undefined && (
        <TeacherFormModal
          teacher={formTarget}
          provinces={provinces}
          wards={wards}
          onClose={() => setFormTarget(undefined)}
          onSaved={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Xoá giáo viên"
          message={
            deleteError ? (
              <span className="text-red-600">{deleteError}</span>
            ) : (
              <>
                Xoá giáo viên <b>{deleteTarget.name}</b>? Thao tác này không
                hoàn tác được.
              </>
            )
          }
          hint={
            deleteError ? (
              <>
                Giáo viên đã có dữ liệu buổi dạy nên không xoá được. Hãy chuyển
                sang <b>tắt "Đang hoạt động"</b> để ngừng xếp lịch mà vẫn giữ
                lịch sử.
              </>
            ) : undefined
          }
          submitLabel={deleteError ? "Tắt hoạt động" : "Xoá"}
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
