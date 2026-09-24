import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  CalendarPlus,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserRoundSearch,
} from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { teacherApi, teachingApplicationApi, teachingSessionApi } from "@/service/teaching";
import {
  ATTENDANCE_OPTIONS,
  SESSION_STATUS_META,
  type SessionStatus,
  type Teacher,
  type TeachingSession,
} from "@/types/teaching";
import {
  formatDistance,
  googleMapsUrl,
  isValidLatLng,
  type LatLng,
} from "@/utils/geo";

import Modal, { ConfirmModal, Field, inputClass } from "./Modal";
import SearchableSelect from "@/components/SearchableSelect";
import OutOfRangeConfirm from "./OutOfRangeConfirm";
import LessonSubmitModal from "./LessonSubmitModal";
import SessionSuggestions from "./SessionSuggestions";
import SessionStatusBadge, {
  ApplicationBadge,
  AssignmentBadge,
  CheckinBadge,
  MakeupBadge,
} from "./SessionStatusBadge";
import ScheduleResponseBadge from "./ScheduleResponseBadge";
import {
  radiusOf,
  schoolPointOf,
  useSessionCheckin,
} from "../hooks/useSessionCheckin";
import { useLessonSubmit } from "../hooks/useLessonSubmit";
import {
  formatCheckedAt,
  formatDate,
  formatFuelAllowance,
  formatMinutes,
  formatMoney,
  formatTime,
  periodsOf,
  hasGasAllowance,
  isValidPeriods,
  MAX_PERIODS,
  RATE_MISSING_LABEL,
  TEACHING_MONEY_FEATURES_ENABLED,
  todayISO,
} from "../lib";

type Props = {
  session: TeachingSession;
  canManage: boolean;
  /** Màn "Lịch dạy của tôi": giáo viên tự check-in tại buổi của mình. */
  canCheckin?: boolean;
  onClose: () => void;
  /** Gọi sau khi chấm công / check-in / xoá để danh sách tải lại. */
  onChanged: (session?: TeachingSession) => void;
  onEdit?: (session: TeachingSession) => void;
  onCreateMakeup?: (session: TeachingSession) => void;
  /** Mở form xem/thêm chi phí khác của buổi dạy. */
  onManageCosts?: (session: TeachingSession) => void;
  /** Có truyền thì hiện thêm select gán nhanh giáo viên thay thế khi bị từ chối. */
  teachers?: Teacher[];
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium flex-1 break-words">{value}</span>
    </div>
  );
}

/** Một mốc chấm vị trí: giờ · khoảng cách · sai số · link bản đồ. */
function MarkRows({
  label,
  at,
  distance,
  accuracy,
  outOfRange,
  point,
  radius,
  viaBlock,
}: {
  label: string;
  at: string | null;
  distance: number | null;
  accuracy: number | null;
  outOfRange: boolean | null;
  point: LatLng | null;
  radius: number;
  /** Mốc này lấy theo tiết khác cùng trường, không phải giáo viên tự chấm. */
  viaBlock?: boolean;
}) {
  return (
    <Row
      label={label}
      value={
        at ? (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{formatCheckedAt(at)}</span>
            {viaBlock && (
              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                Tự động · theo tiết cùng trường
              </span>
            )}
            {distance != null && (
              <span
                className={`text-xs ${
                  outOfRange ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {formatDistance(distance)}
                {outOfRange ? ` · ngoài bán kính ${radius} m` : ""}
              </span>
            )}
            {accuracy != null && (
              <span className="text-xs text-gray-400">±{accuracy} m</span>
            )}
            {point && (
              <a
                href={googleMapsUrl(point)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-500 underline"
              >
                Xem bản đồ
              </a>
            )}
          </span>
        ) : (
          <span className="text-gray-400 font-normal">Chưa chấm</span>
        )
      }
    />
  );
}

export default function SessionDetailDrawer({
  session,
  canManage,
  canCheckin = false,
  onClose,
  onChanged,
  onEdit,
  onCreateMakeup,
  onManageCosts,
  teachers,
}: Props) {
  const [status, setStatus] = useState<SessionStatus>(session.status);
  const [note, setNote] = useState(session.attendanceNote || "");
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reassignTeacherId, setReassignTeacherId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [replacementOptions, setReplacementOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingReplacements, setLoadingReplacements] = useState(false);
  const [reassignOverride, setReassignOverride] = useState<{
    teacherId: number;
    teacherName: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!canManage || !session.declinedAt) return;
    let active = true;
    setLoadingReplacements(true);
    teacherApi.candidates({
      schoolId: session.schoolId,
      subjectId: session.subjectId,
      dayOfWeek: session.dayOfWeek,
      startTime: session.startTime,
      endTime: session.endTime,
      effectiveFrom: session.date,
      effectiveTo: session.date,
      periods: periodsOf(session),
      exceptScheduleId: session.scheduleId || undefined,
    }).then((result) => {
      if (!active) return;
      setReplacementOptions(result.candidates
        .filter((candidate) => candidate.eligible && candidate.teacherId !== session.teacherId)
        .map((candidate) => ({ id: candidate.teacherId, name: candidate.teacherName })));
    }).catch((error) => {
      if (active) toast.error(getApiErrorMessage(error, "Không tải được giáo viên đang trống lịch"));
    }).finally(() => active && setLoadingReplacements(false));
    return () => { active = false; };
  }, [canManage, session]);

  // Chấm xong thì đóng drawer để danh sách phía sau tải lại.
  const checkin = useSessionCheckin((updated) => {
    onChanged(updated);
    onClose();
  });
  const checkinLoading = checkin.busyId === session.id;
  const lesson = useLessonSubmit((updated) => {
    onChanged(updated);
    onClose();
  });
  const lessonLoading = lesson.busyId === session.id;

  const meta = SESSION_STATUS_META[session.status];
  const dirty =
    status !== session.status || note !== (session.attendanceNote || "");

  const saveAttendance = async (nextStatus: SessionStatus) => {
    setSaving(true);
    try {
      const updated = await teachingSessionApi.attendance(session.id, {
        status: nextStatus,
        attendanceNote: note.trim() || null,
      });
      toast.success(
        nextStatus === "SCHEDULED" ? "Đã bỏ chấm công" : "Đã chấm công",
      );
      onChanged(updated);
      onClose();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Chấm công thất bại"));
      }
    } finally {
      setSaving(false);
    }
  };

  // ================= ĐƠN GIÁ & TIỀN CÔNG =================
  // Đơn giá do Nhân sự khai theo môn học, chốt vào buổi lúc tạo — không sửa
  // được ở đây nữa, chỉ hiển thị (xem `Row label="Tiền công"` bên dưới).

  const periods = periodsOf(session);

  // ================= SỬA SỐ TIẾT =================
  // Cùng điều kiện BE chặn ở `teachingSessionApi.update`: buổi đã qua ngày
  // hoặc đã có dấu vết chấm công thì số tiết là căn cứ tính công đã thực tế
  // xảy ra, không sửa được nữa.
  const canEditPeriods =
    canManage &&
    session.date >= todayISO() &&
    !session.checkinAt &&
    !session.checkoutAt &&
    !session.lessonSubmittedAt;
  const [periodsValue, setPeriodsValue] = useState(String(periods));
  const [savingPeriods, setSavingPeriods] = useState(false);

  useEffect(() => {
    setPeriodsValue(String(periods));
  }, [periods]);

  const savePeriods = async () => {
    const value = Number(periodsValue);
    if (!isValidPeriods(value) || value === periods) {
      setPeriodsValue(String(periods));
      return;
    }
    setSavingPeriods(true);
    try {
      const updated = await teachingSessionApi.update(session.id, {
        periods: value,
      });
      toast.success("Đã đổi số tiết");
      onChanged(updated);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không đổi được số tiết"));
      setPeriodsValue(String(periods));
    } finally {
      setSavingPeriods(false);
    }
  };

  // ================= CHECK-IN =================

  const schoolPoint = schoolPointOf(session);

  const checkinPoint: LatLng | null = isValidLatLng({
    latitude: session.checkinLatitude ?? undefined,
    longitude: session.checkinLongitude ?? undefined,
  })
    ? {
        latitude: Number(session.checkinLatitude),
        longitude: Number(session.checkinLongitude),
      }
    : null;

  const checkoutPoint: LatLng | null = isValidLatLng({
    latitude: session.checkoutLatitude ?? undefined,
    longitude: session.checkoutLongitude ?? undefined,
  })
    ? {
        latitude: Number(session.checkoutLatitude),
        longitude: Number(session.checkoutLongitude),
      }
    : null;

  const radius = radiusOf(session);
  // Tiết chưa phân công (đang tuyển / đã huỷ) thì không chấm vị trí được.
  const isAssigned = session.assignmentStatus === "ASSIGNED";
  const checkedIn = !!session.checkinAt;
  const checkedOut = !!session.checkoutAt;
  // Chỉ chấm vị trí trong ngày dạy — BE cũng phải chặn lại, đây chỉ là lớp UX.
  const isTeachingDay = session.date === todayISO();
  /**
   * Tiết liên tiếp cùng trường: chỉ tiết đầu cần check-in, chỉ tiết cuối cần
   * check-out (GPS); tiết còn lại chỉ cần nộp nội dung bài dạy.
   */
  const nextAction: "checkin" | "checkout" | "lesson" | "done" = checkedOut
    ? "done"
    : session.checkinRequired && !checkedIn
    ? "checkin"
    : session.checkoutRequired
    ? "checkout"
    : "lesson";

  /**
   * Mốc chấm công "ăn theo" tiết khác trong cùng chuỗi (cùng trường / điểm
   * trường): tiết giữa chuỗi không cần check-in (`checkinRequired === false`),
   * còn check-out được BE gắn cờ `checkoutViaAdjacent` khi lấy theo tiết cuối.
   */
  const checkinViaBlock = checkedIn && session.checkinRequired === false;
  const checkoutViaBlock = checkedOut && session.checkoutViaAdjacent === true;
  const blockPlaceLabel = session.locationName
    ? `điểm trường ${session.locationName}`
    : `trường ${session.schoolName}`;

  /** Thời gian có mặt tại trường, tính từ 2 mốc check-in / check-out. */
  const stayMinutes =
    checkedIn && checkedOut
      ? Math.max(
          0,
          Math.round(
            (new Date(session.checkoutAt!).getTime() -
              new Date(session.checkinAt!).getTime()) /
              60000,
          ),
        )
      : 0;

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await teachingSessionApi.remove(session.id);
      toast.success("Đã xoá buổi dạy");
      setConfirmDelete(false);
      onChanged();
      onClose();
    } catch (error: any) {
      // 409: buổi đã chấm công → gợi ý chuyển sang "Huỷ buổi".
      if (error?.response?.status === 409) {
        setDeleteError(
          getApiErrorMessage(error, "Buổi này đã chấm công, không xoá được"),
        );
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá buổi dạy thất bại"));
      }
    } finally {
      setDeleting(false);
    }
  };

  const canCreateMakeup =
    canManage &&
    !!onCreateMakeup &&
    (session.status === "ABSENT" || session.status === "CANCELLED");

  const canDecline =
    !!canCheckin &&
    session.assignmentStatus === "ASSIGNED" &&
    session.status === "SCHEDULED" &&
    !session.checkinAt &&
    !session.declinedAt &&
    session.date >= todayISO();

  const submitDecline = async () => {
    const reason = declineReason.trim();
    if (reason.length < 5) {
      setDeclineError("Vui lòng nhập lý do ít nhất 5 ký tự");
      return;
    }
    setDeclining(true);
    setDeclineError("");
    try {
      const updated = await teachingSessionApi.decline(session.id, { reason });
      toast.success("Đã báo Nhân sự tìm giáo viên thay thế");
      setDeclineOpen(false);
      onChanged(updated);
      onClose();
    } catch (error: any) {
      setDeclineError(
        getApiErrorMessage(error, "Không gửi được yêu cầu thay thế"),
      );
    } finally {
      setDeclining(false);
    }
  };

  /** Gán nhanh giáo viên thay thế ngay tại đây, không cần mở form sửa đầy đủ. */
  const submitReassign = async (force = false) => {
    const teacherId = Number(reassignTeacherId);
    if (!teacherId) return;
    setReassigning(true);
    try {
      const updated = await teachingApplicationApi.assign(session.id, teacherId, force);
      const teacherName =
        teachers?.find((t) => t.id === teacherId)?.name || "giáo viên mới";
      toast.success(`Đã gán ${teacherName} cho buổi dạy`);
      setReassignOverride(null);
      onChanged(updated);
      onClose();
    } catch (error: any) {
      const data = error?.response?.data;
      // BE báo cần xác nhận (trùng lịch / vượt định mức) → hỏi lại rồi gửi override.
      if (error?.response?.status === 409 && data?.requiresOverride) {
        setReassignOverride({
          teacherId,
          teacherName: teachers?.find((t) => t.id === teacherId)?.name || "Giáo viên này",
          message: data?.message || "Giáo viên này không thoả điều kiện.",
        });
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Gán giáo viên thất bại"));
      }
    } finally {
      setReassigning(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
        onClick={onClose}
      >
        <div
          className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold truncate">Chi tiết buổi dạy</h2>
              <SessionStatusBadge
                status={session.status}
                label={session.statusLabel}
              />
              {session.isMakeup && (
                <MakeupBadge forSessionId={session.makeupForSessionId} />
              )}
              <AssignmentBadge
                status={session.assignmentStatus}
                applicationCount={session.applicationCount}
              />
              <ApplicationBadge status={session.myApplicationStatus} />
              <ScheduleResponseBadge session={session} />
              {checkedIn && (
                <CheckinBadge
                  checkedOut={!!session.checkoutAt}
                  outOfRange={
                    session.checkinOutOfRange || session.checkoutOutOfRange
                  }
                />
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Thông tin buổi */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              <Row
                label="Giáo viên"
                value={
                  session.teacherName || (
                    <span className="text-gray-400 font-normal">
                      Chưa phân công
                    </span>
                  )
                }
              />
              <Row
                label="Ngày"
                value={`${formatDate(session.date)}${
                  session.dayOfWeekLabel ? ` · ${session.dayOfWeekLabel}` : ""
                }`}
              />
              <Row
                label="Giờ"
                value={
                  <span className={meta?.strike ? "line-through" : ""}>
                    {formatTime(session.startTime)}–{formatTime(session.endTime)}
                    {canEditPeriods ? (
                      <span className="ml-1 inline-flex items-center gap-1 font-normal">
                        <span className="text-gray-400">·</span>
                        <input
                          type="number"
                          min={1}
                          max={MAX_PERIODS}
                          value={periodsValue}
                          disabled={savingPeriods}
                          onChange={(e) => setPeriodsValue(e.target.value)}
                          onBlur={savePeriods}
                          className="w-14 rounded-md border border-gray-200 px-1.5 py-0.5 text-sm disabled:opacity-50"
                        />
                        <span className="text-gray-400">tiết</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 font-normal">
                        {" "}· {periodsOf(session)} tiết
                      </span>
                    )}
                  </span>
                }
              />
              {canManage && !canEditPeriods && session.date >= todayISO() && (
                <p className="pl-28 -mt-1 text-[11px] text-gray-400">
                  Đã có dấu vết chấm công nên không đổi được số tiết.
                </p>
              )}
              <Row label="Trường" value={session.schoolName} />
              {/* Chỉ trường nhiều cơ sở mới có dòng này. Quan trọng khi soát
                  chấm công: check-in được đo theo toạ độ của chính điểm trường. */}
              {session.locationName && (
                <Row label="Điểm trường" value={session.locationName} />
              )}
              <Row
                label="Lớp"
                value={
                  session.className || (
                    <span className="text-gray-400 font-normal">
                      Chưa gắn lớp
                    </span>
                  )
                }
              />
              <Row
                label="Môn"
                value={`${session.subjectName}${
                  session.schoolYear ? ` · ${session.schoolYear}` : ""
                }`}
              />
              <Row
                label="Nguồn"
                value={
                  session.scheduleId
                    ? `Sinh từ mẫu lịch #${session.scheduleId}`
                    : session.isMakeup
                    ? `Buổi dạy bù cho buổi #${session.makeupForSessionId}`
                    : "Buổi lẻ"
                }
              />
              {TEACHING_MONEY_FEATURES_ENABLED && (
                <Row
                  label="Tiền công"
                  value={
                    hasGasAllowance(session) ? (
                      <span className="font-normal text-emerald-700">
                        {formatFuelAllowance(session)}
                      </span>
                    ) : session.amount == null ? (
                      // `null` = chưa khai giá, khác hẳn 0 đồng (dạy không công).
                      <span className="text-amber-600 font-normal">
                        {RATE_MISSING_LABEL}
                      </span>
                    ) : (
                      <>
                        {formatMoney(session.amount)}
                        <span className="text-gray-400 font-normal">
                          {" "}
                          · {formatMoney(session.ratePerPeriod)}/tiết × {periods}{" "}
                          tiết
                        </span>
                      </>
                    )
                  }
                />
              )}
              {session.note && <Row label="Ghi chú" value={session.note} />}
            </div>

            {session.declinedAt && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={16} /> Cần giáo viên thay thế
                </div>
                <p className="mt-1">
                  {session.declinedTeacherName || "Giáo viên được phân công"} đã
                  từ chối lúc {formatCheckedAt(session.declinedAt)}.
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  <span className="font-medium">Lý do:</span>{" "}
                  {session.declineReason || "Không có ghi chú"}
                </p>
                {canManage && (
                  <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                    <SearchableSelect
                      value={reassignTeacherId}
                      onChange={setReassignTeacherId}
                      options={replacementOptions}
                      disabled={loadingReplacements}
                      placeholder={loadingReplacements ? "Đang tìm giáo viên trống lịch…" : "— Chọn giáo viên phù hợp —"}
                      searchPlaceholder="Tìm giáo viên…"
                      emptyLabel="Không có giáo viên phù hợp và trống lịch"
                      className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                    />
                    <button
                      onClick={() => submitReassign()}
                      disabled={!reassignTeacherId || reassigning}
                      className="flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white active:scale-95 disabled:opacity-50"
                    >
                      <UserRoundSearch size={14} />
                      {reassigning ? "Đang gán…" : "Gán giáo viên"}
                    </button>
                  </div>
                )}
                {canManage && onEdit && (
                  <button
                    onClick={() => onEdit(session)}
                    className="mt-1.5 text-[11px] font-medium text-amber-700 underline"
                  >
                    Hoặc sửa toàn bộ buổi dạy
                  </button>
                )}
              </div>
            )}

            {/* Giáo viên đăng ký — Nhân sự chọn người phụ trách */}
            {canManage &&
              (session.assignmentStatus === "OPEN" ||
                session.applicationCount > 0) && (
                <SessionSuggestions
                  session={session}
                  onAssigned={(updated) => {
                    onChanged(updated);
                    onClose();
                  }}
                />
              )}

            {/* Tiết chưa phân công thì giáo viên chưa chấm vị trí được */}
            {canCheckin && !isAssigned && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Tiết này chưa được phân công nên chưa check-in được. Bạn sẽ nhận
                được lịch chính thức khi Nhân sự chọn giáo viên.
              </p>
            )}

            {/* Check-in / check-out tại trường */}
            {((canCheckin && isAssigned) || checkedIn) && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  Chấm vị trí tại trường
                </p>

                {checkedIn && (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 mb-2">
                    <MarkRows
                      label="Check-in"
                      at={session.checkinAt}
                      distance={session.checkinDistance}
                      accuracy={session.checkinAccuracy}
                      outOfRange={session.checkinOutOfRange}
                      point={checkinPoint}
                      radius={radius}
                      viaBlock={checkinViaBlock}
                    />
                    <MarkRows
                      label="Check-out"
                      at={session.checkoutAt}
                      distance={session.checkoutDistance}
                      accuracy={session.checkoutAccuracy}
                      outOfRange={session.checkoutOutOfRange}
                      point={checkoutPoint}
                      radius={radius}
                      viaBlock={checkoutViaBlock}
                    />
                    {stayMinutes > 0 && (
                      <Row
                        label="Có mặt"
                        value={formatMinutes(stayMinutes)}
                      />
                    )}

                    {(checkinViaBlock || checkoutViaBlock) && (
                      <p className="mt-1 rounded-lg bg-sky-50 px-2 py-1.5 text-[11px] leading-relaxed text-sky-800">
                        Tiết này nằm trong chuỗi tiết liên tiếp cùng{" "}
                        {blockPlaceLabel} nên giáo viên không phải chấm vị trí
                        riêng cho tiết này.{" "}
                        {checkinViaBlock &&
                          "Mốc check-in lấy theo tiết đầu chuỗi (chỉ tiết đầu cần check-in)."}{" "}
                        {checkoutViaBlock &&
                          "Mốc check-out lấy theo tiết cuối chuỗi (chỉ tiết cuối cần check-out)."}{" "}
                        Vì vậy khoảng cách / bản đồ của mốc tự động là toạ độ
                        giáo viên đã chấm ở tiết đó.
                      </p>
                    )}

                    {(session.checkinImages?.length ?? 0) > 0 && (
                      <div className="border-t border-gray-100 pt-2">
                        <p className="mb-2 text-xs text-gray-500">
                          Ảnh check-in ({session.checkinImages!.length})
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {session.checkinImages!.map((image, index) => (
                            <a
                              key={image.id}
                              href={resolveApiFileUrl(image.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="aspect-square overflow-hidden rounded-xl border border-gray-200 bg-white"
                              aria-label={`Xem ảnh check-in ${index + 1}`}
                            >
                              <img
                                src={resolveApiFileUrl(image.url)}
                                alt={`Ảnh check-in ${index + 1}`}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {canCheckin && isAssigned && !checkedOut && nextAction === "lesson" && (
                  <>
                    <button
                      onClick={() => lesson.openLessonOnly(session)}
                      disabled={lessonLoading || !isTeachingDay}
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-white text-sm font-medium active:scale-95 disabled:opacity-50 bg-indigo-500"
                    >
                      <FileText size={16} />
                      {lessonLoading ? "Đang gửi…" : "Nộp nội dung bài dạy"}
                    </button>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      Tiết này cùng trường với tiết trước/sau nên không cần tự
                      check-in/check-out — chỉ cần ghi lại nội dung bài dạy.
                    </p>
                  </>
                )}

                {canCheckin && isAssigned && !checkedOut && nextAction !== "lesson" && (
                  <>
                    <button
                      onClick={() =>
                        nextAction === "checkout"
                          ? lesson.openCheckout(session)
                          : checkin.mark(session)
                      }
                      disabled={
                        (nextAction === "checkout" ? lessonLoading : checkinLoading) ||
                        !isTeachingDay
                      }
                      className={`w-full flex items-center justify-center gap-1 py-2 rounded-xl text-white text-sm font-medium active:scale-95 disabled:opacity-50 ${
                        nextAction === "checkout" ? "bg-blue-500" : "bg-emerald-500"
                      }`}
                    >
                      <MapPin size={16} />
                      {nextAction === "checkout"
                        ? lessonLoading
                          ? "Đang lấy vị trí…"
                          : "Check-out"
                        : checkinLoading
                        ? "Đang lấy vị trí…"
                        : "Check-in tại trường"}
                    </button>

                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      {!isTeachingDay
                        ? "Chỉ chấm vị trí được trong ngày dạy."
                        : schoolPoint
                        ? `Cho phép trong bán kính ${radius} m quanh ${
                            session.locationName || session.schoolName
                          }. Đứng ngoài vẫn ghi nhận được nhưng sẽ bị đánh dấu để Nhân sự xem lại.`
                        : "Chưa gắn toạ độ nên hệ thống chỉ ghi nhận vị trí, chưa kiểm tra khoảng cách."}
                    </p>
                  </>
                )}
              </div>
            )}

            {canDecline && (
              <div className="border-t border-gray-100 pt-3">
                <button
                  onClick={() => setDeclineOpen(true)}
                  className="w-full rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-600 active:scale-95"
                >
                  Không thể dạy buổi này
                </button>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                  Nhân sự sẽ nhận thông báo kèm lý do để sắp xếp giáo viên thay
                  thế.
                </p>
              </div>
            )}

            {/* Chấm công */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Chấm công</p>

              {session.checkedByName && session.status !== "SCHEDULED" ? (
                <p className="text-xs text-gray-500 mb-2">
                  {session.checkedByName} · {formatCheckedAt(session.checkedAt)}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mb-2">Chưa chấm công</p>
              )}

              {canManage ? (
                <>
                  <div className="grid grid-cols-3 gap-1 bg-gray-100 rounded-xl p-1">
                    {ATTENDANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setStatus(opt.value)}
                        className={`py-1.5 text-xs font-medium rounded-lg transition ${
                          status === opt.value
                            ? opt.active
                            : "text-gray-500 bg-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Ghi chú chấm công (không bắt buộc)"
                    className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
                  />

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveAttendance(status)}
                      disabled={saving || !dirty}
                      className="flex-1 py-2 text-sm rounded-xl bg-blue-500 text-white font-medium active:scale-95 disabled:opacity-50"
                    >
                      {saving ? "Đang lưu…" : "Lưu chấm công"}
                    </button>
                    {session.status !== "SCHEDULED" && (
                      <button
                        onClick={() => saveAttendance("SCHEDULED")}
                        disabled={saving}
                        className="px-3 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium active:scale-95 disabled:opacity-50"
                      >
                        Bỏ chấm
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-700">
                  <SessionStatusBadge
                    status={session.status}
                    label={session.statusLabel}
                  />
                  {session.attendanceNote && (
                    <p className="text-xs text-gray-500 mt-1">
                      {session.attendanceNote}
                    </p>
                  )}
                </div>
              )}
            </div>

            {(session.lessonSubmittedAt ||
              session.lessonName?.trim() ||
              session.lessonEvaluation?.trim() ||
              (session.lessonImages?.length ?? 0) > 0) && (
              <div className="border-t border-gray-100 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800">Báo giảng</p>
                  {session.lessonSubmittedAt && (
                    <span className="text-[11px] text-gray-400">
                      {formatCheckedAt(session.lessonSubmittedAt)}
                    </span>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <Row
                    label="Sĩ số lớp"
                    value={session.classStudentCount ?? "Chưa cập nhật"}
                  />
                  <Row
                    label="Số thực học"
                    value={session.actualStudentCount ?? "Chưa cập nhật"}
                  />
                  <Row
                    label="Tên bài học"
                    value={session.lessonName?.trim() || "Chưa cập nhật"}
                  />
                  <Row
                    label="Đánh giá"
                    value={
                      <span className="whitespace-pre-wrap">
                        {session.lessonEvaluation?.trim() || "Chưa cập nhật"}
                      </span>
                    }
                  />
                </div>

                {(session.lessonImages?.length ?? 0) > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {session.lessonImages!.map((image, index) => (
                      <a
                        key={image.id}
                        href={resolveApiFileUrl(image.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                        aria-label={`Xem ảnh báo giảng ${index + 1}`}
                      >
                        <img
                          src={resolveApiFileUrl(image.url)}
                          alt={`Ảnh báo giảng ${index + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {onManageCosts && (
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Chi phí khác</p>
                    <p className="text-xs text-gray-400">
                      {(session.otherCosts?.length ?? 0) > 0
                        ? `${session.otherCosts?.length} khoản đã khai`
                        : "Chưa có chi phí"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onManageCosts(session)}
                    className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 active:scale-95"
                  >
                    <Plus size={14} />
                    {(session.otherCosts?.length ?? 0) > 0 ? "Xem/Sửa" : "Thêm chi phí"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {canManage && (
            <div className="p-4 border-t flex flex-wrap gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(session)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium active:scale-95"
                >
                  <Pencil size={14} /> Sửa
                </button>
              )}
              {canCreateMakeup && (
                <button
                  onClick={() => onCreateMakeup!(session)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 text-sm rounded-xl bg-purple-500 text-white font-medium active:scale-95"
                >
                  <CalendarPlus size={14} /> Tạo buổi bù
                </button>
              )}
              <button
                onClick={() => {
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
                className="flex-1 flex items-center justify-center gap-1 py-2 text-sm rounded-xl border border-red-100 text-red-400 font-medium active:scale-95"
              >
                <Trash2 size={14} /> Xoá
              </button>
            </div>
          )}
        </div>
      </div>

      {reassignOverride && (
        <ConfirmModal
          title="Giáo viên không thoả điều kiện"
          message={reassignOverride.message}
          hint={
            <>
              Vẫn gán <b>{reassignOverride.teacherName}</b> cho buổi dạy này?
              Hãy chắc chắn đã trao đổi với giáo viên.
            </>
          }
          submitLabel="Vẫn gán"
          submitColor="bg-amber-500"
          loading={reassigning}
          onClose={() => setReassignOverride(null)}
          onSubmit={() => submitReassign(true)}
        />
      )}

      {declineOpen && (
        <Modal
          title="Từ chối buổi dạy"
          submitLabel="Gửi cho Nhân sự"
          submitColor="bg-red-500"
          loading={declining}
          disabled={declineReason.trim().length < 5}
          onClose={() => !declining && setDeclineOpen(false)}
          onSubmit={submitDecline}
        >
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {formatDate(session.date)} · {formatTime(session.startTime)}–
            {formatTime(session.endTime)} · {session.schoolName}
            {session.locationName ? ` · ${session.locationName}` : ""}
          </div>
          <Field label="Lý do không thể dạy" required error={declineError}>
            <textarea
              value={declineReason}
              onChange={(event) => {
                setDeclineReason(event.target.value);
                if (declineError) setDeclineError("");
              }}
              rows={4}
              maxLength={500}
              autoFocus
              placeholder="Ví dụ: Tôi có việc gia đình đột xuất..."
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">
              {declineReason.length}/500
            </p>
          </Field>
        </Modal>
      )}

      {checkin.outOfRange && (
        <OutOfRangeConfirm
          mark={checkin.outOfRange}
          loading={checkinLoading}
          onClose={checkin.cancelOutOfRange}
          onSubmit={checkin.confirmOutOfRange}
        />
      )}

      {lesson.pending && (
        <LessonSubmitModal
          session={lesson.pending.session}
          mode={lesson.pending.mode}
          loading={lessonLoading}
          onClose={lesson.cancel}
          onSubmit={lesson.submit}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Xoá buổi dạy"
          message={
            deleteError ? (
              <span className="text-red-600">{deleteError}</span>
            ) : (
              <>
                Xoá buổi dạy ngày <b>{formatDate(session.date)}</b> của{" "}
                <b>{session.teacherName}</b>?
              </>
            )
          }
          hint={
            deleteError ? (
              <>
                Buổi đã chấm công không xoá được. Hãy chuyển trạng thái sang{" "}
                <b>"Huỷ buổi"</b> để không tính công mà vẫn giữ lịch sử.
              </>
            ) : undefined
          }
          submitLabel={deleteError ? "Chuyển sang Huỷ buổi" : "Xoá"}
          submitColor={deleteError ? "bg-amber-500" : "bg-red-500"}
          loading={deleting || saving}
          onClose={() => {
            setConfirmDelete(false);
            setDeleteError("");
          }}
          onSubmit={() =>
            deleteError ? saveAttendance("CANCELLED") : handleDelete()
          }
        />
      )}
    </>
  );
}
