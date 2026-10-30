import type { Tone } from "@/pages/Finance/lib";
import type {
  CashflowDirection,
  OrderStatus,
  OtherCashflowStatus,
} from "@/types/otherCashflow";

export const DIRECTION_LABELS: Record<CashflowDirection, string> = {
  IN: "Thu",
  OUT: "Chi",
};

export const DIRECTION_TONES: Record<CashflowDirection, Tone> = {
  IN: "emerald",
  OUT: "rose",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, [string, Tone]> = {
  PENDING: ["Chờ thủ quỹ", "amber"],
  EXECUTED: ["Đã thực hiện", "emerald"],
  CANCELLED: ["Đã huỷ", "slate"],
};

export const STATUS_LABELS: Record<OtherCashflowStatus, [string, Tone]> = {
  PENDING: ["Chờ giám đốc duyệt", "amber"],
  REJECTED: ["Bị từ chối", "rose"],
  APPROVED: ["Đã duyệt — chờ ghi nhận", "blue"],
  IN_PROGRESS: ["Đang thu/chi", "violet"],
  COMPLETED: ["Hoàn tất", "emerald"],
  CANCELLED: ["Đã huỷ", "slate"],
};

/** Thứ tự nút lọc trạng thái. */
export const STATUS_FILTERS: OtherCashflowStatus[] = [
  "PENDING",
  "APPROVED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

export const EVENT_LABELS: Record<string, string> = {
  SUBMITTED: "Gửi duyệt",
  UPDATED: "Sửa hợp đồng",
  RESUBMITTED: "Sửa và gửi duyệt lại",
  APPROVED: "Giám đốc duyệt",
  REJECTED: "Giám đốc từ chối",
  CANCELLED: "Huỷ hợp đồng",
  ENTRY_RECORDED: "Thủ quỹ ghi nhận",
  ENTRY_VOIDED: "Huỷ lần thu/chi",
  ORDER_CREATED: "Kế toán công nợ lập phiếu",
  ORDER_CANCELLED: "Huỷ phiếu",
  ORDER_EXECUTED: "Thủ quỹ thu/chi theo phiếu",
  ATTACHMENT_ADDED: "Đính kèm tệp",
  ATTACHMENT_REMOVED: "Xoá tệp",
};

/** Hợp đồng Thu: "thu"; hợp đồng Chi: "chi". */
export const verbOf = (direction: CashflowDirection) =>
  DIRECTION_LABELS[direction].toLowerCase();

export const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*";

/** Đường dẫn trang Thu Chi ngoài theo workspace (thông báo, báo cáo thu chi). */
export const otherCashflowPath = (base: "/director" | "/employee", id?: number) =>
  `${base}/other-cashflows${id ? `?contract=${id}` : ""}`;
