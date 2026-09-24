import { useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingScheduleApi } from "@/service/teaching";
import type { TeachingSchedule } from "@/types/teaching";

import Modal, { Field, inputClass } from "./Modal";
import {
  daysBetween,
  endOfMonth,
  formatDate,
  formatTime,
  isDateOrderValid,
  MAX_GENERATE_DAYS,
  startOfMonth,
  todayISO,
} from "../lib";

type Props = {
  /** Một hoặc nhiều mẫu lịch — cả TKB sinh buổi trong cùng một khoảng ngày. */
  schedules: TeachingSchedule[];
  onClose: () => void;
  onGenerated: () => void;
};

export default function GenerateSessionsModal({
  schedules,
  onClose,
  onGenerated,
}: Props) {
  const single = schedules.length === 1 ? schedules[0] : null;
  // Ưu tiên tháng hiện tại nếu có mẫu đang hiệu lực. Nếu toàn bộ mẫu ở tương
  // lai/quá khứ, mở đúng tháng hiệu lực gần nhất thay vì âm thầm chọn một
  // khoảng chắc chắn sinh ra 0 buổi.
  const initialRange = recommendedRange(schedules);
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!fromDate || !toDate) {
      setError("Vui lòng chọn khoảng ngày");
      return;
    }
    if (!isDateOrderValid(fromDate, toDate)) {
      setError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc");
      return;
    }
    if (daysBetween(fromDate, toDate) > MAX_GENERATE_DAYS) {
      setError(`Khoảng sinh buổi tối đa ${MAX_GENERATE_DAYS} ngày`);
      return;
    }

    setError("");
    setLoading(true);
    try {
      let created = 0;
      let skipped = 0;

      // Tuần tự: sinh buổi có kiểm tra trùng giờ, chạy song song dễ tự đá nhau.
      for (const schedule of schedules) {
        const res = await teachingScheduleApi.generateSessions(schedule.id, {
          fromDate,
          toDate,
        });
        created += res?.created || 0;
        skipped += res?.skipped || 0;
      }

      if (created === 0 && skipped === 0) {
        setError(
          "Không có ngày dạy phù hợp. Khoảng đã chọn có thể nằm ngoài hiệu lực của mẫu, hoặc không chứa đúng thứ trong tuần của lịch.",
        );
        return;
      } else if (skipped > 0) {
        toast.success(`Đã sinh ${created} buổi, bỏ qua ${skipped} buổi đã có`);
      } else {
        toast.success(`Đã sinh ${created} buổi`);
      }

      onGenerated();
      onClose();
    } catch (err: any) {
      const raw = err?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (err?.response?.status !== 403) {
        toast.error(getApiErrorMessage(err, "Sinh buổi dạy thất bại"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Sinh buổi dạy"
      submitLabel="Sinh buổi"
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm space-y-0.5">
        {single ? (
          <>
            <p className="font-semibold text-gray-800">{single.teacherName}</p>
            <p className="text-gray-600">
              {single.dayOfWeekLabel} · {formatTime(single.startTime)}–
              {formatTime(single.endTime)}
            </p>
            <p className="text-gray-500 text-xs">
              {single.schoolName} · {single.subjectName}
            </p>
            <p className="text-gray-500 text-xs">
              Hiệu lực: {formatDate(single.effectiveFrom)} →{" "}
              {single.effectiveTo
                ? formatDate(single.effectiveTo)
                : "Không thời hạn"}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-gray-800">
              {schedules.length} mẫu lịch trong thời khoá biểu
            </p>
            <p className="text-gray-500 text-xs">
              {schedules[0]?.schoolName} · sinh buổi cho toàn bộ các ô đã xếp.
            </p>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Từ ngày" required>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Đến ngày" required>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <p className="text-[11px] text-gray-400">
        Chỉ sinh trong phần giao giữa khoảng đã chọn và khoảng hiệu lực của mẫu. Bấm
        lại nhiều lần không nhân đôi — buổi đã có sẽ được bỏ qua.
      </p>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </Modal>
  );
}

function recommendedRange(schedules: TeachingSchedule[]) {
  const today = todayISO();
  const activeToday = schedules.some(
    (item) =>
      item.effectiveFrom <= today &&
      (!item.effectiveTo || item.effectiveTo >= today),
  );

  let anchor = today;
  if (!activeToday && schedules.length > 0) {
    const futureStarts = schedules
      .map((item) => item.effectiveFrom)
      .filter((date) => date > today)
      .sort();
    const pastEnds = schedules
      .map((item) => item.effectiveTo)
      .filter((date): date is string => !!date && date < today)
      .sort()
      .reverse();
    anchor = futureStarts[0] || pastEnds[0] || today;
  }

  const monthFrom = startOfMonth(anchor);
  const monthTo = endOfMonth(anchor);
  const starts = schedules.map((item) => item.effectiveFrom).sort();
  const unbounded = schedules.some((item) => !item.effectiveTo);
  const ends = schedules
    .map((item) => item.effectiveTo)
    .filter((date): date is string => !!date)
    .sort()
    .reverse();

  return {
    fromDate: starts.length > 0 && starts[0] > monthFrom ? starts[0] : monthFrom,
    toDate: !unbounded && ends.length > 0 && ends[0] < monthTo ? ends[0] : monthTo,
  };
}
