import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { subjectApi, type Subject } from "@/service/subject.api";
import SubjectFormModal, {
  type EditableSubject,
} from "@/components/subject/SubjectFormModal";

import TeachingLayout from "./components/TeachingLayout";
import BulkSubjectRateModal from "./components/BulkSubjectRateModal";
import TeachingTabs from "./components/TeachingTabs";
import { ConfirmModal } from "./components/Modal";
import SearchableSelect from "@/components/SearchableSelect";
import {
  EmptyState,
  FilterCard,
  Loading,
  TableCard,
  selectClass,
  tdClass,
  thClass,
  theadClass,
  trClass,
} from "./components/Shared";
import { useSubjectsOfSchool, useTeachingRefData } from "./hooks/useTeachingRefData";
import {
  canManageTeaching,
  canSetTeachingRates,
  catalogLabel,
  formatMoney,
  TEACHING_MONEY_FEATURES_ENABLED,
} from "./lib";

/**
 * Môn học của từng trường. Nhân sự và Giáo vụ tự thêm/sửa/xoá môn như bên
 * Kinh doanh — không có môn thì không xếp được lịch dạy. Các role chỉ-xem vào
 * được nhưng không thao tác.
 *
 * Đơn giá mỗi tiết theo môn đã bỏ khỏi màn này — xem
 * `TEACHING_MONEY_FEATURES_ENABLED`. Điều kiện quyền giữ nguyên phía sau cờ để
 * bật lại là về đúng nguyên trạng (chỉ Nhân sự khai giá).
 */
export default function SubjectManagePage() {
  const canManage = canManageTeaching();
  const canManageRate = TEACHING_MONEY_FEATURES_ENABLED && canSetTeachingRates();
  const { schools } = useTeachingRefData();

  const [schoolId, setSchoolId] = useState("");
  const [schoolYear, setSchoolYear] = useState("");

  const { subjects, loading, reload } = useSubjectsOfSchool(schoolId);

  const [formTarget, setFormTarget] = useState<
    EditableSubject | null | undefined
  >(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [bulkRateOpen, setBulkRateOpen] = useState(false);

  const schoolYearOptions = useMemo(
    () =>
      Array.from(new Set(subjects.map((item) => item.schoolYear).filter(Boolean)))
        .sort((a, b) => (b as string).localeCompare(a as string, "vi")),
    [subjects],
  );

  const visibleSubjects = useMemo(
    () =>
      schoolYear
        ? subjects.filter((item) => item.schoolYear === schoolYear)
        : subjects,
    [subjects, schoolYear],
  );

  const changeSchool = (value: string) => {
    setSchoolId(value);
    setSchoolYear("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await subjectApi.remove(deleteTarget.id);
      toast.success("Đã xoá môn học");
      setDeleteTarget(null);
      reload();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        setDeleteError(getApiErrorMessage(error, "Xoá môn học thất bại"));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <TeachingLayout title="Môn học">
      <TeachingTabs />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2 flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          {canManageRate
            ? "Đơn giá mỗi tiết khai ở đây được chốt vào buổi dạy ngay lúc tạo — đổi giá chỉ áp cho buổi tạo về sau, buổi đã tạo giữ nguyên giá cũ."
            : "Môn học là bản ghi riêng của từng trường theo năm học — khai môn xong mới xếp được lớp và lịch dạy cho môn đó."}
        </p>
        {canManageRate && (
          <button
            onClick={() => setBulkRateOpen(true)}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 active:scale-95 whitespace-nowrap"
          >
            Áp giá cho nhiều trường
          </button>
        )}
      </div>

      <FilterCard>
        <div className="md:col-span-2">
          <SearchableSelect
            value={schoolId}
            onChange={changeSchool}
            options={schools}
            placeholder="— Chọn trường —"
            searchPlaceholder="Tìm trường…"
          />
        </div>

        <select
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          disabled={!schoolId}
          className={`${selectClass} disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">Tất cả năm học</option>
          {schoolYearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {schoolId && canManage && (
          <button
            onClick={() => setFormTarget(null)}
            className="w-full md:w-auto md:justify-self-end inline-flex items-center justify-center gap-1 py-2 px-4 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
          >
            <Plus size={16} /> Thêm môn học
          </button>
        )}
      </FilterCard>

      {!schoolId ? (
        <EmptyState
          icon="📚"
          title="Chọn trường để xem môn học"
          description="Môn học là bản ghi riêng của từng trường, kèm số lớp, sĩ số và thông tin hợp đồng."
        />
      ) : loading ? (
        <Loading />
      ) : visibleSubjects.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Chưa có môn học nào"
          description="Thêm môn học rồi mới xếp được lịch dạy cho môn đó."
          action={
            canManage ? (
              <button
                onClick={() => setFormTarget(null)}
                className="flex items-center gap-1 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium active:scale-95"
              >
                <Plus size={16} /> Thêm môn học
              </button>
            ) : undefined
          }
        />
      ) : (
        <TableCard minWidth={canManageRate ? 1180 : 1040}>
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Môn học</th>
              <th className={thClass}>Năm học</th>
              <th className={`${thClass} text-right`}>Số lớp</th>
              <th className={`${thClass} text-right`}>Sĩ số</th>
              <th className={`${thClass} text-right`}>Tổng số tiết</th>
              <th className={thClass}>Số hợp đồng</th>
              {canManageRate && (
                <th className={`${thClass} text-right`}>Đơn giá/tiết</th>
              )}
              {canManage && (
                <th className={`${thClass} text-right`}>Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleSubjects.map((item) => (
              <tr key={item.id} className={trClass}>
                <td className={`${tdClass} font-semibold text-gray-800`}>
                  {item.catalog ? catalogLabel(item.catalog) : item.name}
                </td>
                <td className={tdClass}>{item.schoolYear || "—"}</td>
                <td className={`${tdClass} text-right`}>
                  {item.classCount || 0}
                </td>
                <td className={`${tdClass} text-right`}>
                  {item.studentCount || 0}
                </td>
                <td className={`${tdClass} text-right`}>
                  {item.totalLessons || 0}
                </td>
                <td className={tdClass}>{item.contractNumber || "—"}</td>
                {canManageRate && (
                  <td
                    className={`${tdClass} text-right whitespace-nowrap ${
                      item.ratePerPeriod == null
                        ? "text-amber-600"
                        : "font-medium text-gray-800"
                    }`}
                  >
                    {formatMoney(item.ratePerPeriod)}
                  </td>
                )}
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

      {formTarget !== undefined && (
        <SubjectFormModal
          schoolId={schoolId ? Number(schoolId) : undefined}
          schoolYear={schoolYear || undefined}
          subject={formTarget}
          schools={schools}
          onClose={() => setFormTarget(undefined)}
          onSaved={() => {
            setFormTarget(undefined);
            reload();
          }}
        />
      )}

      {bulkRateOpen && (
        <BulkSubjectRateModal
          onClose={() => setBulkRateOpen(false)}
          onApplied={reload}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Xoá môn học"
          message={
            deleteError ? (
              <span className="text-red-600">{deleteError}</span>
            ) : (
              <>
                Xoá môn <b>{deleteTarget.name}</b> ({deleteTarget.schoolYear})?
                {deleteTarget.policyCount ? (
                  <>
                    {" "}
                    Môn này đang có <b>{deleteTarget.policyCount}</b> chính
                    sách — xoá môn sẽ xoá luôn các chính sách đó.
                  </>
                ) : null}
              </>
            )
          }
          submitLabel={deleteError ? "Đóng" : "Xoá"}
          submitColor={deleteError ? "bg-gray-400" : "bg-red-500"}
          loading={deleting}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          onSubmit={() => (deleteError ? setDeleteTarget(null) : handleDelete())}
        />
      )}
    </TeachingLayout>
  );
}
