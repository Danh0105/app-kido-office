import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Sparkles } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teacherApi, teachingScheduleApi } from "@/service/teaching";
import {
  DAY_OF_WEEK_OPTIONS,
  type Teacher,
  type TeachingSchedule,
  type TeacherCandidatesResult,
} from "@/types/teaching";

import Modal, { Field, inputClass } from "./Modal";
import SearchableSelect from "@/components/SearchableSelect";
import ClassSelect, { NoClassNotice } from "./ClassSelect";
import TeacherCandidatesModal from "./TeacherCandidatesModal";
import {
  useClassesOfSchool,
  useSubjectsOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import {
  amountOf,
  dateRangesOverlap,
  formatMoney,
  formatTime,
  isDateOrderValid,
  isTimeOrderValid,
  isValidPeriods,
  MAX_PERIODS,
  TEACHING_MONEY_FEATURES_ENABLED,
  timeRangesOverlap,
  todayISO,
} from "../lib";

type Props = {
  schedule?: TeachingSchedule | null;
  teachers: Teacher[];
  schools: RefOption[];
  /** Mẫu lịch đã tải — dùng cảnh báo trùng lịch sớm (BE vẫn là nơi chốt bằng 409). */
  existing?: TeachingSchedule[];
  onClose: () => void;
  onSaved: () => void;
};

export default function ScheduleFormModal({
  schedule,
  teachers,
  schools,
  existing = [],
  onClose,
  onSaved,
}: Props) {
  const editing = !!schedule;

  const [teacherId, setTeacherId] = useState(
    schedule ? String(schedule.teacherId) : "",
  );
  // Trường chỉ để lọc lớp — field gửi lên backend là classId.
  const [schoolId, setSchoolId] = useState(
    schedule ? String(schedule.schoolId) : "",
  );
  const [classId, setClassId] = useState(
    schedule?.classId ? String(schedule.classId) : "",
  );
  const [subjectId, setSubjectId] = useState(
    schedule ? String(schedule.subjectId) : "",
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    schedule ? String(schedule.dayOfWeek) : "2",
  );
  const [startTime, setStartTime] = useState(formatTime(schedule?.startTime) || "07:30");
  const [endTime, setEndTime] = useState(formatTime(schedule?.endTime) || "09:00");
  const [periods, setPeriods] = useState(String(schedule?.periods ?? 1));
  const [effectiveFrom, setEffectiveFrom] = useState(
    schedule?.effectiveFrom || todayISO(),
  );
  const [effectiveTo, setEffectiveTo] = useState(schedule?.effectiveTo || "");
  const [note, setNote] = useState(schedule?.note || "");
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateResult, setCandidateResult] =
    useState<TeacherCandidatesResult | null>(null);
  const [suggestionSignature, setSuggestionSignature] = useState("");

  const { subjects, loading: loadingSubjects } = useSubjectsOfSchool(schoolId);
  const { classes, loading: loadingClasses } = useClassesOfSchool(schoolId);


  /**
   * Mẫu lịch cũ chưa gắn lớp vẫn phải sửa/lưu được: PATCH không gửi classId thì
   * backend giữ nguyên lớp cũ (null). Còn tạo mới thì classId là bắt buộc.
   */
  const classOptional = editing && !schedule?.classId;
  const pickedClass = classes.find((item) => String(item.id) === classId);
  const candidateSignature = [
    classId,
    subjectId,
    dayOfWeek,
    startTime,
    endTime,
    effectiveFrom,
    effectiveTo,
    periods,
  ].join("|");
  const suggestionNeedsRecheck =
    !!suggestionSignature && suggestionSignature !== candidateSignature;

  // Đổi trường → reset lớp và môn đã chọn (cả hai đều thuộc về trường).
  const changeSchool = (value: string) => {
    setSchoolId(value);
    setClassId("");
    setSubjectId("");
  };

  // Môn đang chọn không còn thuộc danh sách của trường → bỏ chọn.
  useEffect(() => {
    if (!subjectId || loadingSubjects || subjects.length === 0) return;
    if (!subjects.some((s) => String(s.id) === subjectId)) setSubjectId("");
  }, [subjects, loadingSubjects, subjectId]);

  const validate = () => {
    const next: Record<string, string> = {};

    if (!teacherId) next.teacherId = "Vui lòng chọn giáo viên";
    if (!schoolId) next.schoolId = "Vui lòng chọn trường";
    if (!classId && !classOptional) next.classId = "Vui lòng chọn lớp học";
    if (!subjectId) next.subjectId = "Vui lòng chọn môn";
    if (!effectiveFrom) next.effectiveFrom = "Vui lòng chọn ngày bắt đầu hiệu lực";

    if (!isTimeOrderValid(startTime, endTime)) {
      next.endTime = "Giờ bắt đầu phải nhỏ hơn giờ kết thúc";
    }
    if (!isValidPeriods(periods)) {
      next.periods = `Số tiết phải là số nguyên 1–${MAX_PERIODS}`;
    }
    if (!isDateOrderValid(effectiveFrom, effectiveTo || null)) {
      next.effectiveTo = "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Cùng thứ + giao giờ + giao khoảng hiệu lực — điều kiện chung của 2 kiểu trùng.
  const overlaps = (item: TeachingSchedule) =>
    item.id !== schedule?.id &&
    String(item.dayOfWeek) === dayOfWeek &&
    timeRangesOverlap(
      startTime,
      endTime,
      formatTime(item.startTime),
      formatTime(item.endTime),
    ) &&
    dateRangesOverlap(
      effectiveFrom,
      effectiveTo || null,
      item.effectiveFrom,
      item.effectiveTo,
    );

  // Giá của buổi sinh từ mẫu này = giá môn học hiện tại, không còn khai riêng ở đây.
  const pickedSubject = subjects.find((s) => String(s.id) === subjectId);
  const effectiveRate = pickedSubject?.ratePerPeriod ?? null;

  // Cảnh báo sớm: giáo viên đã bận khung giờ này.
  const teacherConflict = existing.find(
    (item) => String(item.teacherId) === teacherId && overlaps(item),
  );

  // Cảnh báo sớm: lớp đã có buổi khác — kể cả của giáo viên khác.
  const classConflict = existing.find(
    (item) => !!classId && String(item.classId) === classId && overlaps(item),
  );

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // Không gửi schoolId nữa — backend lấy trường theo lớp.
      const payload = {
        teacherId: Number(teacherId),
        subjectId: Number(subjectId),
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        periods: Number(periods),
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        isActive,
        note: note.trim() || null,
      };

      if (editing) {
        // Bỏ trống lớp ở mẫu lịch cũ = giữ nguyên (backend không đụng tới).
        await teachingScheduleApi.update(schedule!.id, {
          ...payload,
          ...(classId ? { classId: Number(classId) } : {}),
        });
        toast.success("Đã cập nhật mẫu lịch");
      } else {
        await teachingScheduleApi.create({
          ...payload,
          classId: Number(classId),
        });
        toast.success("Đã thêm mẫu lịch tuần");
      }

      onSaved();
      onClose();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status !== 403) {
        // 409 trùng lịch: message BE đã nêu rõ trường/giờ trùng.
        toast.error(getApiErrorMessage(error, "Lưu mẫu lịch thất bại"));
      }
    } finally {
      setLoading(false);
    }
  };

  const suggestTeachers = async () => {
    const next: Record<string, string> = {};
    if (!classId) next.classId = "Vui lòng chọn lớp học trước";
    if (!subjectId) next.subjectId = "Vui lòng chọn môn học trước";
    if (!startTime) next.startTime = "Vui lòng chọn giờ bắt đầu";
    if (!endTime || !isTimeOrderValid(startTime, endTime)) {
      next.endTime = "Giờ bắt đầu phải nhỏ hơn giờ kết thúc";
    }
    if (!effectiveFrom) next.effectiveFrom = "Vui lòng chọn ngày hiệu lực";
    if (!isValidPeriods(periods)) next.periods = "Số tiết không hợp lệ";
    if (
      pickedClass?.subjectIds?.length &&
      !pickedClass.subjectIds.includes(Number(subjectId))
    ) {
      next.subjectId = "Môn đã chọn không thuộc lớp học này";
    }
    if (Object.keys(next).length > 0) {
      setErrors((old) => ({ ...old, ...next }));
      const first = Object.keys(next)[0];
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-schedule-field="${first}"] input, [data-schedule-field="${first}"] select, [data-schedule-field="${first}"] button`)?.focus(),
      );
      return;
    }

    setLoadingCandidates(true);
    try {
      const result = await teacherApi.candidates({
        schoolId: pickedClass!.schoolId,
        subjectId: Number(subjectId),
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        periods: Number(periods),
        ...(schedule?.id ? { exceptScheduleId: schedule.id } : {}),
      });
      setCandidateResult(result);
    } catch (error: any) {
      if (![401, 403].includes(error?.response?.status)) {
        toast.error(getApiErrorMessage(error, "Không tải được gợi ý giáo viên"));
      }
    } finally {
      setLoadingCandidates(false);
    }
  };

  return (
    <>
    <Modal
      title={editing ? "Sửa mẫu lịch tuần" : "Thêm mẫu lịch tuần"}
      submitLabel={editing ? "Lưu" : "Thêm"}
      loading={loading}
      disabled={!classId && !classOptional}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Giáo viên" required error={errors.teacherId}>
        <div className="flex items-start gap-2" data-schedule-field="teacherId">
          <div className="min-w-0 flex-1"><SearchableSelect
            value={teacherId}
            onChange={(value) => { setTeacherId(value); setSuggestionSignature(""); }}
            options={teachers.map((teacher) => ({
              id: teacher.id,
              name: `${teacher.name}${teacher.isActive ? "" : " (ngừng)"}`,
            }))}
            placeholder="— Chọn giáo viên —"
            searchPlaceholder="Tìm giáo viên…"
          /></div>
          <button type="button" onClick={suggestTeachers} disabled={loadingCandidates} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-700 disabled:opacity-50">
            <Sparkles size={15}/>{loadingCandidates ? "Đang gợi ý…" : "Gợi ý giáo viên"}
          </button>
        </div>
        {suggestionNeedsRecheck && <p className="mt-1 text-xs text-amber-600">Điều kiện lịch đã thay đổi — cần kiểm tra lại giáo viên được gợi ý.</p>}
      </Field>

      <Field label="Trường" required error={errors.schoolId}>
        <SearchableSelect
          value={schoolId}
          onChange={changeSchool}
          options={schools}
          placeholder="— Chọn trường —"
          searchPlaceholder="Tìm trường…"
        />
      </Field>

      <div data-schedule-field="classId"><Field
        label="Lớp"
        required={!classOptional}
        error={errors.classId}
        hint={
          classOptional
            ? "Mẫu lịch cũ chưa gắn lớp. Chọn lớp để hệ thống chặn xếp trùng giờ cho cùng một lớp."
            : !schoolId
            ? "Chọn trường trước để tải danh sách lớp"
            : undefined
        }
      >
        <ClassSelect
          value={classId}
          onChange={setClassId}
          classes={classes}
          loading={loadingClasses}
          schoolPicked={!!schoolId}
          current={
            schedule?.classId
              ? { id: schedule.classId, name: schedule.className || `#${schedule.classId}` }
              : null
          }
        />
      </Field></div>

      {/* Trường chưa có lớp thì dropdown rỗng — chỉ đường sang màn Lớp học. */}
      {!!schoolId && !loadingClasses && classes.length === 0 && (
        <NoClassNotice
          schoolName={schools.find((s) => String(s.id) === schoolId)?.name}
        />
      )}

      <div data-schedule-field="subjectId"><Field
        label="Môn"
        required
        error={errors.subjectId}
        hint={!schoolId ? "Chọn trường trước để tải danh sách môn" : undefined}
      >
        <SearchableSelect
          value={subjectId}
          onChange={setSubjectId}
          options={subjects}
          disabled={!schoolId || loadingSubjects}
          placeholder={
            loadingSubjects
              ? "Đang tải môn…"
              : subjects.length === 0 && schoolId
              ? "Trường này chưa có môn"
              : "— Chọn môn —"
          }
          searchPlaceholder="Tìm môn học…"
        />
      </Field></div>

      <Field label="Thứ" required>
        <select
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(e.target.value)}
          className={inputClass}
        >
          {DAY_OF_WEEK_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <div data-schedule-field="startTime"><Field label="Giờ bắt đầu" required error={errors.startTime}>
          <input
            type="time"
            step={300}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </Field></div>
        <div data-schedule-field="endTime"><Field label="Giờ kết thúc" required error={errors.endTime}>
          <input
            type="time"
            step={300}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
        </Field></div>
      </div>

      <div data-schedule-field="periods"><Field
        label="Số tiết mỗi buổi"
        required
        error={errors.periods}
        hint="Căn cứ tính công dạy của giáo viên."
      >
        <input
          type="number"
          min={1}
          max={MAX_PERIODS}
          value={periods}
          onChange={(e) => setPeriods(e.target.value)}
          className={inputClass}
        />
      </Field></div>

      {/* Đơn giá do Nhân sự khai ở màn Môn học — đây chỉ hiện để tham khảo. */}
      {TEACHING_MONEY_FEATURES_ENABLED &&
        (effectiveRate == null ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Môn học chưa khai đơn giá — buổi dạy sinh từ mẫu này sẽ không tính
            được tiền công cho tới khi Nhân sự bổ sung giá ở màn Môn học.
          </p>
        ) : (
          isValidPeriods(periods) && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Mỗi buổi{" "}
              <b className="text-gray-800">
                {formatMoney(amountOf(effectiveRate, Number(periods)))}
              </b>{" "}
              ({formatMoney(effectiveRate)} × {periods} tiết)
            </p>
          )
        ))}

      <div className="grid grid-cols-2 gap-2">
        <div data-schedule-field="effectiveFrom"><Field label="Hiệu lực từ" required error={errors.effectiveFrom}>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className={inputClass}
          />
        </Field></div>
        <Field
          label="Hiệu lực đến"
          error={errors.effectiveTo}
          hint="Bỏ trống = không thời hạn"
        >
          <input
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {classConflict && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Lớp {classConflict.className} đã có lịch môn {classConflict.subjectName}{" "}
          {classConflict.dayOfWeekLabel} {formatTime(classConflict.startTime)}–
          {formatTime(classConflict.endTime)} của {classConflict.teacherName} trong
          khoảng thời gian này.
        </div>
      )}

      {teacherConflict && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Giáo viên đã có lịch {teacherConflict.dayOfWeekLabel}{" "}
          {formatTime(teacherConflict.startTime)}–
          {formatTime(teacherConflict.endTime)} tại {teacherConflict.schoolName}
          {teacherConflict.className ? ` · ${teacherConflict.className}` : ""} trong
          khoảng thời gian này.
        </div>
      )}

      <Field label="Ghi chú">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
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
        Đang áp dụng
      </label>
    </Modal>
    {candidateResult && (
      <TeacherCandidatesModal
        result={candidateResult}
        context={`${pickedClass?.schoolName || "—"} · ${pickedClass?.name || "—"} · ${
          subjects.find((item) => String(item.id) === subjectId)?.name || "—"
        } · ${DAY_OF_WEEK_OPTIONS.find((item) => String(item.value) === dayOfWeek)?.label || "—"} · ${startTime}–${endTime}`}
        onClose={() => setCandidateResult(null)}
        onPick={(candidate) => {
          setTeacherId(String(candidate.teacherId));
          setSuggestionSignature(candidateSignature);
          setErrors((old) => ({ ...old, teacherId: "" }));
          setCandidateResult(null);
        }}
      />
    )}
    </>
  );
}
