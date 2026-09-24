import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type { Teacher, TeachingSession } from "@/types/teaching";

import Modal, { ConfirmModal, Field, inputClass } from "./Modal";
import SearchableSelect from "@/components/SearchableSelect";
import ClassSelect, { NoClassNotice } from "./ClassSelect";
import {
  useClassesOfSchool,
  useSubjectsOfSchool,
  type RefOption,
} from "../hooks/useTeachingRefData";
import {
  amountOf,
  dayOfWeekOf,
  formatDate,
  formatMoney,
  formatTime,
  isTimeOrderValid,
  isValidPeriods,
  MAX_PERIODS,
  TEACHING_MONEY_FEATURES_ENABLED,
  todayISO,
} from "../lib";
import { dayOfWeekLabel } from "@/types/teaching";

type Props = {
  /** Có giá trị = sửa buổi; không có = tạo mới. */
  session?: TeachingSession | null;
  /** Buổi gốc khi tạo buổi dạy bù. */
  makeupFor?: TeachingSession | null;
  teachers: Teacher[];
  schools: RefOption[];
  defaultDate?: string;
  /** Khung giờ bấm trên lịch — điền sẵn khi tạo buổi từ ô giờ trống. */
  defaultStartTime?: string;
  defaultEndTime?: string;
  onClose: () => void;
  onSaved: () => void;
};

/** Hai cách tạo buổi dạy: mở đăng ký hoặc phân công thẳng. */
type AssignmentMode = "OPEN" | "ASSIGNED";

export default function SessionFormModal({
  session,
  makeupFor,
  teachers,
  schools,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onClose,
  onSaved,
}: Props) {
  const editing = !!session;
  const base = session || makeupFor;

  // Mở đăng ký hay phân công ngay — mặc định mở đăng ký khi tạo mới.
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(
    session ? (session.assignmentStatus === "OPEN" ? "OPEN" : "ASSIGNED") : "OPEN",
  );
  const [teacherId, setTeacherId] = useState(
    base?.teacherId ? String(base.teacherId) : "",
  );
  // Gỡ giáo viên khỏi buổi đã phân công thì hỏi lại trước khi lưu.
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [schoolId, setSchoolId] = useState(base ? String(base.schoolId) : "");
  // Buổi dạy bù lấy sẵn lớp của buổi gốc — vẫn đổi được.
  const [classId, setClassId] = useState(
    base?.classId ? String(base.classId) : "",
  );
  const [subjectId, setSubjectId] = useState(base ? String(base.subjectId) : "");
  const [date, setDate] = useState(
    session?.date || defaultDate || makeupFor?.date || todayISO(),
  );
  const [startTime, setStartTime] = useState(
    formatTime(base?.startTime) || defaultStartTime || "07:30",
  );
  const [endTime, setEndTime] = useState(
    formatTime(base?.endTime) || defaultEndTime || "09:00",
  );
  const [periods, setPeriods] = useState(String(base?.periods ?? 1));
  const [note, setNote] = useState(
    session?.note ||
      (makeupFor ? `Dạy bù buổi ${formatDate(makeupFor.date)}` : ""),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { subjects, loading: loadingSubjects } = useSubjectsOfSchool(schoolId);
  const { classes, loading: loadingClasses } = useClassesOfSchool(schoolId);

  /**
   * Trường đã khai báo lớp thì buộc chọn lớp — có lớp backend mới chặn được
   * hai buổi trùng giờ của cùng một lớp. Trường chưa có lớp nào (hoặc dữ liệu
   * cũ) vẫn tạo buổi theo trường như trước.
   */
  const mustPickClass = !loadingClasses && classes.length > 0;

  const changeSchool = (value: string) => {
    setSchoolId(value);
    setClassId("");
    setSubjectId("");
  };

  useEffect(() => {
    if (!subjectId || loadingSubjects || subjects.length === 0) return;
    if (!subjects.some((s) => String(s.id) === subjectId)) setSubjectId("");
  }, [subjects, loadingSubjects, subjectId]);

  const validate = () => {
    const next: Record<string, string> = {};

    if (!schoolId) next.schoolId = "Vui lòng chọn trường";
    if (!classId && mustPickClass) next.classId = "Vui lòng chọn lớp học";
    if (!subjectId) next.subjectId = "Vui lòng chọn môn học";
    if (assignmentMode === "ASSIGNED" && !teacherId) {
      next.teacherId = "Vui lòng chọn giáo viên";
    }
    if (assignmentMode === "OPEN" && teacherId) {
      next.teacherId = "Tiết đang mở không thể có giáo viên";
    }
    if (!date) next.date = "Vui lòng chọn ngày";
    // Tiết đã qua ngày không lọt vào API "tiết đang mở" (BE lọc date >= hôm nay)
    // → mở đăng ký cho ngày cũ thì giáo viên không bao giờ nhìn thấy.
    else if (assignmentMode === "OPEN" && date < todayISO()) {
      next.date = "Ngày dạy đã qua — giáo viên sẽ không thấy tiết này để đăng ký";
    }
    if (!isTimeOrderValid(startTime, endTime)) {
      next.endTime = "Giờ bắt đầu phải nhỏ hơn giờ kết thúc";
    }
    if (!isValidPeriods(periods)) {
      next.periods = `Số tiết phải là số nguyên từ 1 đến ${MAX_PERIODS}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Đang gỡ giáo viên khỏi buổi đã phân công? */
  const unassigning =
    editing && session?.assignmentStatus === "ASSIGNED" && assignmentMode === "OPEN";

  const handleSubmit = async () => {
    if (!validate()) return;
    if (unassigning && !confirmUnassign) {
      setConfirmUnassign(true);
      return;
    }

    setLoading(true);
    try {
      // OPEN không được có giáo viên; ASSIGNED bắt buộc có.
      // Có lớp thì không gửi schoolId — backend lấy trường theo lớp.
      const payload = {
        teacherId: assignmentMode === "ASSIGNED" ? Number(teacherId) : null,
        assignmentStatus: assignmentMode,
        ...(classId
          ? { classId: Number(classId) }
          : { schoolId: Number(schoolId) }),
        subjectId: Number(subjectId),
        date,
        startTime,
        endTime,
        periods: Number(periods),
        note: note.trim() || null,
      };

      if (editing) {
        await teachingSessionApi.update(session!.id, payload);
        toast.success("Đã cập nhật buổi dạy");
      } else {
        // Có makeupForSessionId → BE tự bật isMakeup.
        await teachingSessionApi.create({
          ...payload,
          makeupForSessionId: makeupFor ? makeupFor.id : undefined,
        });
        toast.success(makeupFor ? "Đã tạo buổi dạy bù" : "Đã thêm buổi dạy");
      }

      onSaved();
      onClose();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status !== 403) {
        // 409: giáo viên đã có buổi giao giờ trong ngày.
        toast.error(getApiErrorMessage(error, "Lưu buổi dạy thất bại"));
      }
    } finally {
      setLoading(false);
    }
  };

  const dayLabel = dayOfWeekLabel(dayOfWeekOf(date));

  // Giá của buổi = giá môn học hiện tại tại thời điểm tạo — không khai riêng ở đây.
  const pickedSubject = subjects.find((s) => String(s.id) === subjectId);
  const effectiveRate = editing
    ? (base?.ratePerPeriod ?? null)
    : (pickedSubject?.ratePerPeriod ?? null);

  return (
    <>
    <Modal
      title={
        editing
          ? "Sửa buổi dạy"
          : makeupFor
          ? "Tạo buổi dạy bù"
          : "Thêm buổi lẻ"
      }
      submitLabel={editing ? "Lưu" : "Thêm"}
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {makeupFor && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs text-purple-700">
          Dạy bù cho buổi <b>#{makeupFor.id}</b> — {formatDate(makeupFor.date)}{" "}
          {formatTime(makeupFor.startTime)}–{formatTime(makeupFor.endTime)} (
          {makeupFor.statusLabel || makeupFor.status})
        </div>
      )}

      <Field label="Hình thức phân công" required>
        <div className="space-y-1.5">
          {(
            [
              ["OPEN", "Mở cho giáo viên đăng ký"],
              ["ASSIGNED", "Chọn giáo viên ngay"],
            ] as [AssignmentMode, string][]
          ).map(([mode, label]) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="assignmentMode"
                checked={assignmentMode === mode}
                onChange={() => {
                  setAssignmentMode(mode);
                  // Chuyển sang mở đăng ký thì bỏ giáo viên đang chọn.
                  if (mode === "OPEN") setTeacherId("");
                  setErrors((prev) => ({ ...prev, teacherId: "" }));
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </Field>

      {assignmentMode === "ASSIGNED" && (
        <Field label="Giáo viên" required error={errors.teacherId}>
          <SearchableSelect
            value={teacherId}
            onChange={setTeacherId}
            options={teachers.map((teacher) => ({
              id: teacher.id,
              name: `${teacher.name}${teacher.isActive ? "" : " (ngừng)"}`,
            }))}
            placeholder="— Chọn giáo viên —"
            searchPlaceholder="Tìm giáo viên…"
          />
        </Field>
      )}

      <Field label="Trường" required error={errors.schoolId}>
        <SearchableSelect
          value={schoolId}
          onChange={changeSchool}
          options={schools}
          placeholder="— Chọn trường —"
          searchPlaceholder="Tìm trường…"
        />
      </Field>

      <Field
        label="Lớp"
        required={mustPickClass}
        error={errors.classId}
        hint={
          !schoolId
            ? "Chọn trường trước để tải danh sách lớp"
            : session?.classId && !classId
            ? "Để trống sẽ giữ nguyên lớp hiện tại của buổi dạy."
            : makeupFor?.classId
            ? "Lấy sẵn lớp của buổi gốc — đổi được nếu dạy bù cho lớp khác."
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
            base?.classId
              ? { id: base.classId, name: base.className || `#${base.classId}` }
              : null
          }
        />
      </Field>

      {/* Trường chưa có lớp thì buổi dạy vẫn tạo được, chỉ mất phần chặn trùng lớp. */}
      {!!schoolId && !loadingClasses && classes.length === 0 && (
        <NoClassNotice
          schoolName={schools.find((s) => String(s.id) === schoolId)?.name}
        />
      )}

      <Field
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
      </Field>

      <Field
        label="Ngày dạy"
        required
        error={errors.date}
        hint={date ? dayLabel : undefined}
      >
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Giờ bắt đầu" required>
          <input
            type="time"
            step={300}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Giờ kết thúc" required error={errors.endTime}>
          <input
            type="time"
            step={300}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Số tiết"
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
      </Field>

      {/* Đơn giá do Nhân sự khai ở màn Môn học — đây chỉ hiện để tham khảo. */}
      {TEACHING_MONEY_FEATURES_ENABLED &&
        (editing ? (
          effectiveRate != null &&
          isValidPeriods(periods) && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Tiền công buổi này{" "}
              <b className="text-gray-800">
                {formatMoney(amountOf(effectiveRate, Number(periods)))}
              </b>{" "}
              ({formatMoney(effectiveRate)} × {periods} tiết) — đơn giá đã chốt lúc tạo, không đổi khi sửa buổi.
            </p>
          )
        ) : effectiveRate == null ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Môn học chưa khai đơn giá — buổi này sẽ không tính được tiền công cho
            tới khi Nhân sự bổ sung giá ở màn Môn học.
          </p>
        ) : (
          isValidPeriods(periods) && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Tiền công buổi này{" "}
              <b className="text-gray-800">
                {formatMoney(amountOf(effectiveRate, Number(periods)))}
              </b>{" "}
              ({formatMoney(effectiveRate)} × {periods} tiết)
            </p>
          )
        ))}

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
    </Modal>

    {confirmUnassign && (
      <ConfirmModal
        title="Chuyển sang mở đăng ký"
        message="Chuyển sang mở đăng ký sẽ gỡ giáo viên đang được phân công. Bạn có muốn tiếp tục?"
        submitLabel="Tiếp tục"
        submitColor="bg-amber-500"
        loading={loading}
        onClose={() => setConfirmUnassign(false)}
        onSubmit={handleSubmit}
      />
    )}
    </>
  );
}
