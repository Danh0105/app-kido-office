import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { schoolClassApi } from "@/service/teaching";
import type { SchoolClass } from "@/types/teaching";

import Modal, { Field, inputClass } from "./Modal";
import SearchableSelect from "@/components/SearchableSelect";
import MultiSelect from "@/components/MultiSelect";
import {
  useLocationsOfSchool,
  useSchoolYearsOfSchool,
  useSubjectsOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import {
  GRADE_LEVELS,
  MAIN_SCHOOL_LABEL,
  MAX_STUDENT_COUNT,
  currentSchoolYear,
  isValidStudentCount,
  sortSchoolYears,
} from "../lib";

type Props = {
  /** Có giá trị = sửa lớp; null = tạo mới. */
  schoolClass?: SchoolClass | null;
  schools: RefOption[];
  /** Trường + năm học đang lọc — điền sẵn khi tạo lớp mới. */
  defaultSchoolId?: string;
  defaultSchoolYear?: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function SchoolClassFormModal({
  schoolClass,
  schools,
  defaultSchoolId = "",
  defaultSchoolYear = "",
  onClose,
  onSaved,
}: Props) {
  const editing = !!schoolClass;

  const [schoolId, setSchoolId] = useState(
    schoolClass ? String(schoolClass.schoolId) : defaultSchoolId,
  );
  const [schoolLocationId, setSchoolLocationId] = useState(
    schoolClass?.schoolLocationId != null
      ? String(schoolClass.schoolLocationId)
      : "",
  );
  const [name, setName] = useState(schoolClass?.name || "");
  const [schoolYear, setSchoolYear] = useState(
    schoolClass?.schoolYear || defaultSchoolYear,
  );
  const [gradeLevel, setGradeLevel] = useState(
    schoolClass?.gradeLevel != null ? String(schoolClass.gradeLevel) : "",
  );
  const [studentCount, setStudentCount] = useState(
    schoolClass ? String(schoolClass.studentCount ?? 0) : "",
  );
  const [homeroomTeacher, setHomeroomTeacher] = useState(
    schoolClass?.homeroomTeacher || "",
  );
  const [note, setNote] = useState(schoolClass?.note || "");
  const [isActive, setIsActive] = useState(schoolClass?.isActive ?? true);
  const [subjectIds, setSubjectIds] = useState<number[]>(
    schoolClass?.subjectIds || schoolClass?.subjects?.map((item) => item.id) || [],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const schoolName =
    schoolClass?.schoolName ||
    schools.find((s) => String(s.id) === schoolId)?.name ||
    "";

  // Năm học lấy từ dữ liệu của chính trường đó (môn học + lớp đã tạo).
  const { years, loading: loadingYears } = useSchoolYearsOfSchool(schoolId);
  const { subjects, loading: loadingSubjects } = useSubjectsOfSchool(schoolId);
  // Trường một cơ sở trả mảng rỗng → ẩn hẳn ô chọn điểm trường cho gọn form.
  const { locations, loading: loadingLocations } = useLocationsOfSchool(schoolId);

  // Chỉ môn của đúng năm học mới hợp lệ với lớp theo ràng buộc backend.
  const subjectOptions = useMemo(() => {
    const available = subjects
      .filter((subject) => !schoolYear || subject.schoolYear === schoolYear)
      .map((subject) => ({
        id: subject.id,
        name: subject.code ? `[${subject.code}] ${subject.name}` : subject.name,
      }));

    // Giữ môn cũ trong form sửa kể cả khi bản ghi đã ngừng xuất hiện ở danh mục.
    for (const subject of schoolClass?.subjects || []) {
      if (!available.some((item) => item.id === subject.id)) {
        available.push({
          id: subject.id,
          name: subject.code ? `[${subject.code}] ${subject.name}` : subject.name,
        });
      }
    }
    return available;
  }, [subjects, schoolYear, schoolClass?.subjects]);

  /**
   * Trường mới chưa có năm học nào thì vẫn phải tạo được lớp → thêm năm học
   * hiện tại. Năm của lớp đang sửa cũng luôn có mặt để không bị mất lựa chọn.
   */
  const yearOptions = useMemo(
    () =>
      sortSchoolYears(
        Array.from(
          new Set(
            [
              ...years,
              schoolClass?.schoolYear || "",
              years.length === 0 ? currentSchoolYear() : "",
            ].filter(Boolean),
          ),
        ),
      ),
    [years, schoolClass?.schoolYear],
  );

  // Chưa chọn năm (thêm mới) → lấy năm học mới nhất của trường.
  // Chỉ chạy khi danh sách năm đổi, để không đè lựa chọn người dùng vừa xoá.
  useEffect(() => {
    if (yearOptions.length === 0) return;
    // Ưu tiên năm học hiện tại; không có trong danh sách thì lấy năm mới nhất.
    const current = currentSchoolYear();
    setSchoolYear(
      (prev) =>
        prev || (yearOptions.includes(current) ? current : yearOptions[0]),
    );
  }, [yearOptions]);

  // Đổi trường → bỏ năm đang chọn để lấy lại theo năm học của trường mới.
  const changeSchool = (value: string) => {
    setSchoolId(value);
    setSchoolYear("");
    setSubjectIds([]);
    // Điểm trường thuộc về một trường cụ thể — giữ lại là gửi lên id của
    // trường cũ, backend sẽ từ chối.
    setSchoolLocationId("");
  };

  const changeSchoolYear = (value: string) => {
    setSchoolYear(value);
    // Môn được định danh theo năm học; đổi năm phải chọn lại để không gửi sai.
    setSubjectIds([]);
  };

  const validate = () => {
    const next: Record<string, string> = {};

    if (!editing && !schoolId) next.schoolId = "Vui lòng chọn trường";
    if (!name.trim()) next.name = "Vui lòng nhập tên lớp";
    if (!schoolYear.trim()) next.schoolYear = "Vui lòng chọn năm học";
    if (!isValidStudentCount(studentCount)) {
      next.studentCount = `Sĩ số phải là số nguyên từ 0 đến ${MAX_STUDENT_COUNT}`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Trường bị BE bỏ qua ở PATCH nên form sửa cũng không gửi.
      const body = {
        name: name.trim(),
        schoolYear: schoolYear.trim(),
        gradeLevel: gradeLevel ? Number(gradeLevel) : null,
        studentCount: studentCount.trim() ? Number(studentCount) : 0,
        homeroomTeacher: homeroomTeacher.trim() || null,
        isActive,
        note: note.trim() || null,
        subjectIds,
        // Trường chưa khai điểm trường thì không gửi field này, để khỏi vô tình
        // ghi null đè lên dữ liệu cũ khi ô chọn đang bị ẩn.
        ...(locations.length > 0 && {
          schoolLocationId: schoolLocationId ? Number(schoolLocationId) : null,
        }),
      };

      if (editing) {
        await schoolClassApi.update(schoolClass!.id, body);
        toast.success("Đã cập nhật lớp học");
      } else {
        await schoolClassApi.create({ ...body, schoolId: Number(schoolId) });
        toast.success("Đã thêm lớp học");
      }

      onSaved();
      onClose();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status === 409) {
        // Trùng tên lớp trong cùng trường + cùng năm học.
        setErrors({ name: getApiErrorMessage(error, "Tên lớp đã tồn tại") });
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Lưu lớp học thất bại"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editing ? "Sửa lớp học" : "Thêm lớp học"}
      submitLabel={editing ? "Lưu" : "Thêm"}
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {/* Đổi trường của lớp sẽ làm lịch đã sinh trỏ sai trường → sửa thì khoá lại. */}
      {editing ? (
        <Field label="Trường">
          <div className="px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-600">
            {schoolName || `#${schoolClass!.schoolId}`}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Không đổi được trường của lớp đã tạo.
          </p>
        </Field>
      ) : (
        <Field label="Trường" required error={errors.schoolId}>
          <SearchableSelect
            value={schoolId}
            onChange={changeSchool}
            options={schools}
            placeholder="— Chọn trường —"
            searchPlaceholder="Tìm trường…"
          />
        </Field>
      )}

      {/* Chỉ trường nhiều cơ sở mới thấy ô này — trường một cơ sở không cần bận tâm. */}
      {locations.length > 0 && (
        <Field
          label="Thuộc trường chính / điểm trường"
          hint="Mỗi điểm trường có lớp riêng, tách biệt với trường chính. Lớp học ở cơ sở nào thì chọn cơ sở đó — check-in của giáo viên sẽ đo theo toạ độ của chính điểm trường ấy."
        >
          <select
            value={schoolLocationId}
            onChange={(e) => setSchoolLocationId(e.target.value)}
            disabled={loadingLocations}
            className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">{MAIN_SCHOOL_LABEL} (không thuộc điểm trường nào)</option>
            {locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Tên lớp" required error={errors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="1A"
            className={inputClass}
          />
        </Field>

        <Field
          label="Năm học"
          required
          error={errors.schoolYear}
          hint={
            !schoolId
              ? "Chọn trường trước để lấy năm học"
              : "Theo năm học đang dùng của trường (môn học · lớp đã tạo)"
          }
        >
          <select
            value={schoolYear}
            onChange={(e) => changeSchoolYear(e.target.value)}
            disabled={!schoolId || loadingYears}
            className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
          >
            <option value="">
              {!schoolId
                ? "Chọn trường trước"
                : loadingYears
                ? "Đang tải năm học…"
                : "— Chọn năm học —"}
            </option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Môn học của lớp"
        hint="Chỉ hiện các môn đã khai cho đúng trường và năm học của lớp. Có thể chọn nhiều môn."
      >
        <MultiSelect
          values={subjectIds}
          onChange={setSubjectIds}
          options={subjectOptions}
          loading={loadingSubjects}
          disabled={!schoolId || !schoolYear}
          placeholder="— Chọn các môn của lớp —"
          searchPlaceholder="Tìm môn…"
          noOptionLabel={
            schoolId && schoolYear
              ? "Trường chưa khai môn cho năm học này"
              : "Chọn trường và năm học trước"
          }
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Khối" hint="Bỏ trống với mầm non">
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            className={inputClass}
          >
            <option value="">— Không có khối —</option>
            {GRADE_LEVELS.map((grade) => (
              <option key={grade} value={grade}>
                Khối {grade}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sĩ số" error={errors.studentCount}>
          <input
            type="number"
            min={0}
            max={MAX_STUDENT_COUNT}
            value={studentCount}
            onChange={(e) => setStudentCount(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Giáo viên chủ nhiệm"
        hint="GVCN phía trường — không phải hồ sơ giáo viên của công ty."
      >
        <input
          value={homeroomTeacher}
          onChange={(e) => setHomeroomTeacher(e.target.value)}
          maxLength={255}
          placeholder="Không bắt buộc"
          className={inputClass}
        />
      </Field>

      <Field label="Ghi chú">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Không bắt buộc"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Đang sử dụng
      </label>
      <p className="text-[11px] text-gray-400 -mt-1">
        Lớp ngừng sử dụng không xếp được lịch mới, nhưng lịch và buổi dạy cũ vẫn
        giữ nguyên.
      </p>
    </Modal>
  );
}
