import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { teachingSessionApi } from "@/service/teaching";
import type {
  NotifySchedulePayload,
  TeachingSession,
} from "@/types/teaching";

import Modal, { Field, inputClass } from "./Modal";
import { formatDate, periodsOf } from "../lib";

type Props = {
  /** Khoảng đang xem + bộ lọc đang áp ở màn Lịch dạy. */
  payload: NotifySchedulePayload;
  /** Nhãn kỳ, ví dụ "04/08 – 10/08/2026". */
  rangeLabel: string;
  /** Buổi đã tải của kỳ này — chỉ để xem trước người nhận. */
  sessions: TeachingSession[];
  onClose: () => void;
};

/**
 * Gửi lịch dạy: backend bắn thông báo tới từng giáo viên có buổi trong khoảng.
 * Danh sách dưới đây chỉ là xem trước từ dữ liệu đã tải; số liệu cuối cùng
 * lấy theo kết quả backend trả về.
 */
export default function SendScheduleModal({
  payload,
  rangeLabel,
  sessions,
  onClose,
}: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const { recipients, unassigned } = useMemo(() => {
    const map = new Map<number, { name: string; sessions: number; periods: number }>();
    let open = 0;

    sessions.forEach((session) => {
      if (!session.teacherId) {
        open += 1;
        return;
      }
      const entry = map.get(session.teacherId) || {
        name: session.teacherName || `#${session.teacherId}`,
        sessions: 0,
        periods: 0,
      };
      entry.sessions += 1;
      entry.periods += periodsOf(session);
      map.set(session.teacherId, entry);
    });

    return {
      recipients: Array.from(map.values()).sort((a, b) => b.sessions - a.sessions),
      unassigned: open,
    };
  }, [sessions]);

  const send = async () => {
    setLoading(true);
    try {
      const result = await teachingSessionApi.notifySchedule({
        ...payload,
        message: message.trim() || null,
      });
      toast.success(
        `Đã gửi lịch dạy tới ${result?.notified ?? recipients.length} giáo viên`,
      );
      onClose();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Gửi lịch dạy thất bại"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Gửi lịch dạy"
      submitLabel="Gửi thông báo"
      loading={loading}
      disabled={recipients.length === 0}
      onClose={onClose}
      onSubmit={send}
    >
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm space-y-0.5">
        <p>
          Kỳ: <b>{rangeLabel}</b>
        </p>
        <p className="text-gray-600">
          {formatDate(payload.fromDate)} → {formatDate(payload.toDate)} ·{" "}
          {sessions.length} buổi
        </p>
      </div>

      {recipients.length === 0 ? (
        <p className="text-sm text-gray-500">
          Không có giáo viên nào được phân công trong khoảng này, chưa gửi được.
        </p>
      ) : (
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-1">
            Người nhận · {recipients.length} giáo viên
          </p>
          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
            {recipients.map((teacher) => (
              <div
                key={teacher.name}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
              >
                <span className="text-gray-800 truncate">{teacher.name}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {teacher.sessions} buổi · {teacher.periods} tiết
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {unassigned > 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          {unassigned} buổi chưa phân công giáo viên nên không nằm trong thông báo
          này.
        </p>
      )}

      <Field label="Lời nhắn kèm theo">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Không bắt buộc — ví dụ: Lịch tuần tới, nhờ thầy cô kiểm tra lại."
          className={inputClass}
        />
      </Field>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Mỗi giáo viên chỉ nhận lịch của chính mình, theo đúng bộ lọc đang áp ở màn
        Lịch dạy.
      </p>
    </Modal>
  );
}
