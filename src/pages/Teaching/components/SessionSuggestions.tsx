import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingApplicationApi } from "@/service/teaching";
import type { TeachingApplication, TeachingSession } from "@/types/teaching";
import {
  MAX_TRUSTED_ACCURACY,
  formatDistance,
  googleMapsUrl,
  isValidLatLng,
} from "@/utils/geo";

import { ConfirmModal } from "./Modal";
import { formatCheckedAt, periodsOf } from "../lib";

type Props = {
  session: TeachingSession;
  /** Gọi sau khi phân công xong để lịch và chi tiết tải lại. */
  onAssigned: (session: TeachingSession) => void;
};

type Tone = "ok" | "warn" | "block";

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-emerald-100 bg-emerald-50/50",
  warn: "border-amber-100 bg-amber-50/50",
  block: "border-red-100 bg-red-50/50",
};

/**
 * Danh sách giáo viên đăng ký nhận tiết, đã được backend xếp hạng.
 * FE giữ nguyên thứ tự và không tự tính lại khoảng cách hay định mức.
 */
export default function SessionSuggestions({ session, onAssigned }: Props) {
  const [items, setItems] = useState<TeachingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [override, setOverride] = useState<{
    application: TeachingApplication;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await teachingApplicationApi.getSuggestions(session.id));
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(
          getApiErrorMessage(error, "Không tải được danh sách đăng ký"),
        );
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session.id]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (application: TeachingApplication, force = false) => {
    setAssigningId(application.teacherId);
    try {
      const updated = await teachingApplicationApi.assign(
        session.id,
        application.teacherId,
        force,
      );
      toast.success(`Đã phân công ${application.teacherName}`);
      setOverride(null);
      onAssigned(updated);
    } catch (error: any) {
      const data = error?.response?.data;
      // BE báo cần xác nhận (trùng lịch / vượt định mức) → hỏi lại rồi gửi override.
      if (error?.response?.status === 409 && data?.requiresOverride) {
        setOverride({
          application,
          message: data?.message || "Giáo viên này không thoả điều kiện.",
        });
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Phân công thất bại"));
      }
    } finally {
      setAssigningId(null);
    }
  };

  const sessionPeriods = periodsOf(session);

  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">
        Giáo viên đăng ký
        {items.length > 0 && (
          <span className="text-gray-400 font-normal"> · {items.length}</span>
        )}
      </p>

      {loading && (
        <p className="text-xs text-gray-400 py-3 text-center">Đang tải…</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-xs text-gray-400 py-3 text-center">
          Chưa có giáo viên nào đăng ký tiết này.
        </p>
      )}

      <div className="space-y-2">
        {items.map((application, index) => {
          const warnings: string[] = [];
          let tone: Tone = "ok";

          if (application.hasScheduleConflict) {
            warnings.push("Trùng lịch dạy đã phân công");
            tone = "block";
          }
          if (
            application.remainingPeriodsInWeek != null &&
            application.remainingPeriodsInWeek < sessionPeriods
          ) {
            warnings.push("Vượt định mức tiết trong tuần");
            tone = "block";
          }
          if (application.distance == null) {
            warnings.push("Không xác định được khoảng cách");
            if (tone === "ok") tone = "warn";
          }
          if (
            application.accuracy != null &&
            application.accuracy > MAX_TRUSTED_ACCURACY
          ) {
            warnings.push(`GPS sai số lớn (~${application.accuracy} m)`);
            if (tone === "ok") tone = "warn";
          }

          const point = isValidLatLng(application)
            ? {
                latitude: Number(application.latitude),
                longitude: Number(application.longitude),
              }
            : null;

          const isCurrent = session.teacherId === application.teacherId;

          return (
            <div
              key={application.id}
              className={`rounded-xl border p-3 space-y-1 ${TONE_CLASS[tone]}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-400">
                  #{application.suggestionRank ?? index + 1}
                </span>
                <p className="text-sm font-semibold text-gray-800">
                  {application.teacherName}
                </p>
                {isCurrent && (
                  <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-emerald-100 text-emerald-700">
                    Đang phụ trách
                  </span>
                )}
              </div>

              <div className="text-xs text-gray-600 space-y-0.5">
                <p>
                  Cách trường:{" "}
                  {application.distance == null
                    ? "không xác định"
                    : formatDistance(application.distance)}
                  {point && (
                    <>
                      {" · "}
                      <a
                        href={googleMapsUrl(point)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 underline"
                      >
                        Xem vị trí
                      </a>
                    </>
                  )}
                </p>
                <p>
                  Tuần này: {application.assignedPeriodsInWeek}
                  {application.maxPeriodsPerWeek == null
                    ? " tiết (không giới hạn)"
                    : `/${application.maxPeriodsPerWeek} tiết`}
                  {application.pendingPeriodsInWeek > 0
                    ? ` · chờ duyệt ${application.pendingPeriodsInWeek} tiết`
                    : ""}
                </p>
                <p className="text-gray-400">
                  Đăng ký lúc {formatCheckedAt(application.appliedAt)}
                </p>
                {application.note && (
                  <p className="text-gray-500 italic">“{application.note}”</p>
                )}
              </div>

              {warnings.length > 0 && (
                <p
                  className={`text-[11px] font-medium ${
                    tone === "block" ? "text-red-600" : "text-amber-700"
                  }`}
                >
                  {warnings.join(" · ")}
                </p>
              )}

              {!isCurrent && (
                <button
                  onClick={() => assign(application)}
                  disabled={assigningId === application.teacherId}
                  className="w-full py-2 rounded-xl bg-blue-500 text-white text-sm font-medium active:scale-95 disabled:opacity-50"
                >
                  {assigningId === application.teacherId
                    ? "Đang phân công…"
                    : session.teacherId
                    ? "Đổi sang giáo viên này"
                    : "Chọn giáo viên"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {override && (
        <ConfirmModal
          title="Giáo viên không thoả điều kiện"
          message={override.message}
          hint={
            <>
              Vẫn phân công <b>{override.application.teacherName}</b> cho tiết
              này? Hãy chắc chắn đã trao đổi với giáo viên.
            </>
          }
          submitLabel="Vẫn phân công"
          submitColor="bg-amber-500"
          loading={assigningId === override.application.teacherId}
          onClose={() => setOverride(null)}
          onSubmit={() => assign(override.application, true)}
        />
      )}
    </div>
  );
}
