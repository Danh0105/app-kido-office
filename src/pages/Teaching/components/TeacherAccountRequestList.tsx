import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { UserPlus } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teacherApi } from "@/service/teaching";
import type { TeacherAccountRequest } from "@/types/teaching";

import Modal, { Field, inputClass } from "./Modal";
import type { ReviewStatus } from "./ReviewQueues";
import {
  QueueEmpty,
  QueueLoading,
  QueueRow,
  STATUS_LABEL,
  formatQueueTime,
} from "./QueueRow";
import { canApproveTeacherAccount } from "../lib";

/**
 * Hàng chờ duyệt tài khoản giáo viên. Chỉ phần danh sách — tiêu đề, ô tìm và bộ
 * chọn trạng thái nằm ở khối `ReviewQueues` dùng chung với hàng chờ đổi vị trí.
 *
 * Giáo vụ khai hồ sơ giáo viên nhưng **không tự tạo được tài khoản**: hồ sơ nằm
 * lại đây tới khi Nhân sự bấm duyệt — chính lúc duyệt backend mới thật sự tạo
 * hồ sơ giáo viên và tài khoản đăng nhập. Không duyệt thì không có gì được tạo.
 *
 * Nhân sự thấy mọi đề nghị và duyệt được; Giáo vụ chỉ thấy đề nghị của chính
 * mình (backend tự ép) và chỉ để theo dõi kết quả.
 */
export function AccountRequestRows({
  status,
  search,
  onReviewed,
}: {
  status: ReviewStatus;
  search: string;
  onReviewed: (approved: boolean) => void;
}) {
  const canApprove = canApproveTeacherAccount();

  const [items, setItems] = useState<TeacherAccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TeacherAccountRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await teacherApi.accountRequests(status)) || []);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(
          getApiErrorMessage(error, "Không tải được đề nghị mở tài khoản"),
        );
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return items;
    return items.filter((item) =>
      `${item.name} ${item.phone || ""} ${item.email || ""} ${item.requesterName || ""}`
        .toLocaleLowerCase("vi")
        .includes(keyword),
    );
  }, [items, search]);

  if (loading) return <QueueLoading />;
  if (visible.length === 0) return <QueueEmpty />;

  return (
    <div className="divide-y divide-gray-100">
      {visible.map((item) => (
        <QueueRow
          key={item.id}
          icon={<UserPlus size={15} />}
          iconClass="bg-indigo-50 text-indigo-600"
          title={item.name}
          badge={item.teacherId ? "(cấp TK cho hồ sơ có sẵn)" : undefined}
          subtitle={`${item.phone || item.email || "chưa khai liên hệ"} · ${item.requesterName || `NV #${item.requestedBy}`}`}
          createdAt={item.createdAt}
          status={item.status}
          onClick={() => setTarget(item)}
        />
      ))}

      {target && (
        <ReviewModal
          request={target}
          canApprove={canApprove}
          onClose={() => setTarget(null)}
          onReviewed={(approved) => {
            setTarget(null);
            void load();
            onReviewed(approved);
          }}
        />
      )}
    </div>
  );
}

/** Xem chi tiết một đề nghị; Nhân sự duyệt hoặc từ chối ngay tại đây. */
function ReviewModal({
  request,
  canApprove,
  onClose,
  onReviewed,
}: {
  request: TeacherAccountRequest;
  canApprove: boolean;
  onClose: () => void;
  onReviewed: (approved: boolean) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<"approve" | "reject" | null>(
    null,
  );

  const pending = request.status === "pending";

  const review = async (approved: boolean) => {
    // Từ chối mà không nói lý do thì Giáo vụ không biết phải sửa gì.
    if (!approved && !note.trim()) {
      setError("Nhập lý do để Giáo vụ biết cần sửa gì");
      return;
    }

    setProcessing(approved ? "approve" : "reject");
    try {
      if (approved) {
        await teacherApi.approveAccountRequest(request.id, note.trim() || undefined);
        toast.success("Đã duyệt — tài khoản giáo viên đã được tạo");
      } else {
        await teacherApi.rejectAccountRequest(request.id, note.trim());
        toast.success("Đã từ chối đề nghị");
      }
      onReviewed(approved);
    } catch (cause: any) {
      // 409 = đề nghị đã xử lý, hoặc SĐT/email đã bị người khác chiếm.
      setError(getApiErrorMessage(cause, "Không xử lý được đề nghị"));
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Modal
      title="Đề nghị mở tài khoản giáo viên"
      cancelLabel="Đóng"
      onClose={onClose}
      loading={!!processing}
      hideFooter={pending && canApprove}
    >
      <div className="grid gap-2 rounded-xl border bg-gray-50 p-3 text-sm sm:grid-cols-2">
        <p>
          <span className="text-gray-500">Họ tên:</span> <b>{request.name}</b>
        </p>
        <p>
          <span className="text-gray-500">Trạng thái:</span>{" "}
          <b>{STATUS_LABEL[request.status]}</b>
        </p>
        <p>
          <span className="text-gray-500">Điện thoại:</span>{" "}
          {request.phone || "—"}
        </p>
        <p>
          <span className="text-gray-500">Email:</span> {request.email || "—"}
        </p>
        <p>
          <span className="text-gray-500">Người gửi:</span>{" "}
          {request.requesterName || `NV #${request.requestedBy}`}
        </p>
        <p>
          <span className="text-gray-500">Gửi lúc:</span>{" "}
          {formatQueueTime(request.createdAt)}
        </p>
      </div>

      <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800">
        {request.teacherId
          ? `Cấp tài khoản đăng nhập cho hồ sơ giáo viên #${request.teacherId} đã có sẵn.`
          : "Duyệt sẽ tạo mới hồ sơ giáo viên."}
        {request.createsLogin
          ? " Kèm tài khoản đăng nhập (mật khẩu Giáo vụ đã đặt sẵn khi gửi)."
          : " Không kèm tài khoản đăng nhập."}
      </p>

      <PayloadDetails payload={request.payload} />

      {request.status !== "pending" && (
        <div className="rounded-xl border px-3 py-2 text-sm">
          <p className="text-xs text-gray-500">Kết quả xử lý</p>
          <p>
            {request.reviewerName || `NV #${request.reviewedBy}`} ·{" "}
            {formatQueueTime(request.reviewedAt)}
          </p>
          {request.reviewNote && (
            <p className="mt-1 text-gray-600">{request.reviewNote}</p>
          )}
          {request.createdTeacherId && (
            <p className="mt-1 text-xs text-emerald-700">
              Đã tạo giáo viên #{request.createdTeacherId}
            </p>
          )}
        </div>
      )}

      {pending && canApprove && (
        <>
          <Field
            label="Ghi chú"
            hint="Bắt buộc khi từ chối — Giáo vụ sẽ đọc được để sửa lại hồ sơ."
            error={error}
          >
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (error) setError("");
              }}
              rows={2}
              maxLength={500}
              placeholder="Lý do từ chối, hoặc ghi chú khi duyệt"
              className={inputClass}
            />
          </Field>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!!processing}
              onClick={() => review(false)}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 active:scale-95 disabled:opacity-50"
            >
              {processing === "reject" ? "Đang xử lý…" : "Không duyệt"}
            </button>
            <button
              type="button"
              disabled={!!processing}
              onClick={() => review(true)}
              className="flex-1 rounded-xl bg-blue-500 py-2.5 text-sm font-medium text-white active:scale-95 disabled:opacity-50"
            >
              {processing === "approve" ? "Đang tạo tài khoản…" : "Duyệt & tạo tài khoản"}
            </button>
          </div>
        </>
      )}

      {pending && !canApprove && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Đề nghị đang chờ Nhân sự duyệt. Giáo vụ không tự duyệt được hồ sơ của
          mình.
        </p>
      )}

      {error && !pending && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </Modal>
  );
}

/** Nhãn tiếng Việt cho các field đáng đọc trong hồ sơ Giáo vụ đã khai. */
const PAYLOAD_LABELS: Record<string, string> = {
  teacherRole: "Loại giáo viên",
  note: "Ghi chú hồ sơ",
  maxPeriodsPerWeek: "Định mức tiết/tuần",
  defaultRatePerPeriod: "Đơn giá mặc định/tiết",
  googleMapsUrl: "Vị trí Google Maps",
  employeeId: "Gắn nhân viên",
};

/**
 * Hồ sơ Giáo vụ đã khai. `payload` là DTO thô của backend nên chỉ hiện những
 * field người duyệt thật sự cần đọc — mảng ID (xã/phường, môn) bỏ qua vì hiện
 * ra số ID không giúp được gì.
 */
function PayloadDetails({ payload }: { payload: Record<string, unknown> }) {
  const rows = Object.entries(PAYLOAD_LABELS)
    .map(([key, label]) => ({ label, value: payload?.[key] }))
    .filter(({ value }) => value !== null && value !== undefined && value !== "");

  const wardCount = Array.isArray(payload?.wardIds) ? payload.wardIds.length : 0;
  const subjectCount = Array.isArray(payload?.subjectCatalogIds)
    ? payload.subjectCatalogIds.length
    : 0;

  if (rows.length === 0 && !wardCount && !subjectCount) return null;

  return (
    <div className="rounded-xl border px-3 py-2 text-sm">
      <p className="mb-1 text-xs text-gray-500">Hồ sơ Giáo vụ đã khai</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {rows.map(({ label, value }) => (
          <p key={label}>
            <span className="text-gray-500">{label}:</span> {String(value)}
          </p>
        ))}
        {wardCount > 0 && (
          <p>
            <span className="text-gray-500">Khu vực nhận dạy:</span> {wardCount}{" "}
            xã/phường
          </p>
        )}
        {subjectCount > 0 && (
          <p>
            <span className="text-gray-500">Môn dạy được:</span> {subjectCount}{" "}
            môn
          </p>
        )}
      </div>
    </div>
  );
}
