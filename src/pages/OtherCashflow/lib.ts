import { previewLineAmount, type Tone } from "@/pages/Finance/lib";
import type {
  OrderStatus,
  OtherCashflowForm,
  OtherCashflowStatus,
} from "@/types/otherCashflow";

export const FORM_LABELS: Record<OtherCashflowForm, string> = {
  STANDARD: "Thông thường",
  COMMERCIAL: "Thương mại",
};

/** Thuế suất VAT chọn được; null = không thuế (cùng danh sách VAT_RATES của backend). */
export const VAT_OPTIONS: (number | null)[] = [null, 0, 5, 8, 10];

export const vatLabel = (rate: number | null) => (rate === null ? "Không thuế" : `${rate}%`);

/** Xem trước tiền một khoản như backend: SL × đơn giá, thuế làm tròn nửa lên tới đồng. */
export const previewLine = (quantity: string, unitPrice: string, vatRate: number | null) => {
  const net = previewLineAmount(quantity, unitPrice);
  const vat = vatRate ? Math.floor((net * vatRate * 2 + 100) / 200) : 0;
  return { net, vat, total: net + vat };
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
  ENTRY_RECORDED: "Thủ quỹ thu/chi",
  ENTRY_VOIDED: "Huỷ lần thu/chi",
  ORDER_CREATED: "Kế toán công nợ lập phiếu",
  ORDER_CANCELLED: "Huỷ phiếu",
  ORDER_EXECUTED: "Thủ quỹ thu/chi theo phiếu",
  ATTACHMENT_ADDED: "Đính kèm tệp",
  ATTACHMENT_REMOVED: "Xoá tệp",
};

export const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*";

/** Đường dẫn trang Thu Chi ngoài theo workspace (thông báo, báo cáo thu chi). */
export const otherCashflowPath = (base: "/director" | "/employee", id?: number) =>
  `${base}/other-cashflows${id ? `?contract=${id}` : ""}`;
