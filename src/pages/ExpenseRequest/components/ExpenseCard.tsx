import { FUND_SOURCE_LABEL, type ExpenseRequest } from "@/types/expenseRequest";
import { hasRole } from "@/utils/auth";
import StatusBadge from "./StatusBadge";
import KindBadge from "./KindBadge";
import {
  availableActions,
  creatorDetails,
  creatorName,
  formatDate,
  isEquipmentRequest,
  requestKindOf,
  isSupplierEquipment,
} from "../lib";

export default function ExpenseCard({
  item,
  onClick,
  showCreator = true,
  onEdit,
  onWithdraw,
  onDelete,
}: {
  item: ExpenseRequest;
  onClick: () => void;
  showCreator?: boolean;
  /** Có truyền thì hiện nút sửa cho chính người gửi khi workflow còn cho phép. */
  onEdit?: (item: ExpenseRequest) => void;
  /** Có truyền thì hiện nút "Rút đề xuất" khi chủ đơn còn rút được (PENDING_APPROVAL). */
  onWithdraw?: (item: ExpenseRequest) => void;
  /** Có truyền thì hiện nút "Xoá đề xuất" khi giám đốc còn xoá được (chưa phát sinh dòng tiền). */
  onDelete?: (item: ExpenseRequest) => void;
}) {
  const requesterDetails = creatorDetails(item);
  const kind = requestKindOf(item);
  const equipment = isEquipmentRequest(item);
  // Khi chủ đơn sửa và gửi duyệt lại, chứng từ vòng cũ vẫn được backend giữ
  // để audit nhưng không còn là chứng từ đang hiệu lực của vòng mới.
  const hasActiveOrder = ![
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN",
  ].includes(item.status);
  const money =
    (hasActiveOrder ? item.paymentOrder?.amount : undefined) ??
    item.amount ??
    null;
  const fundSource = hasActiveOrder ? item.paymentOrder?.fundSource ?? null : null;
  const directorApprovedAmount =
    hasRole("thuquy") &&
    !equipment &&
    item.amount != null &&
    !["PENDING_APPROVAL", "REJECTED", "WITHDRAWN"].includes(item.status)
      ? item.amount
      : null;
  const actions = availableActions(item);
  const canEdit = !!onEdit && actions.includes("edit");
  const canWithdraw = !!onWithdraw && actions.includes("withdraw");
  const canDelete = !!onDelete && actions.includes("delete");

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 shadow-sm border active:scale-[0.98] transition cursor-pointer ${
        item.isOverdue ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <StatusBadge status={item.status} kind={kind} />
          {!item.requestKind ? (
            <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-slate-100 text-slate-600">
              {item.status === "PENDING_APPROVAL"
                ? "Chờ Giám đốc phân loại"
                : "Chưa phân loại"}
            </span>
          ) : (
            <KindBadge kind={kind} />
          )}
          {item.schoolId ? (
            <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-purple-100 text-purple-700">
              🏫 Đề xuất cho trường
            </span>
          ) : item.wardId ? (
            <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-teal-100 text-teal-700">
              🏘️ Đề xuất cho phường/xã
            </span>
          ) : null}
          {item.isOverdue && (
            <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-red-100 text-red-700">
              ⚠️ Quá hạn
            </span>
          )}
          {item.deductPolicy && (
            <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-orange-100 text-orange-700">
              📉 Trừ chính sách
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 shrink-0">{item.code}</span>
      </div>

      <p className="mt-2 font-semibold text-gray-900 text-[15px] leading-snug line-clamp-2">
        {item.content}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
        {item.expectedPaymentDate && (
          <span className={item.isOverdue ? "text-red-600 font-medium" : ""}>
            📅 {!item.requestKind
              ? "Ngày mong muốn"
              : equipment
                ? "Cần có thiết bị"
                : "Ngày dự kiến"}:{" "}
            {formatDate(item.expectedPaymentDate)}
          </span>
        )}
        {/*
          Với thủ quỹ, tách rõ số tiền giám đốc duyệt (`suggest.amount`) và số
          tiền của lệnh chi để có thể đối chiếu. Đề xuất thiết bị lấy từ kho
          hiện "—" vì không có số tiền; "0 đ" dễ bị hiểu nhầm là một khoản chi
          bằng không. Mua từ nhà cung cấp thì có số tiền theo phiếu nhập.
          Backend trả số dạng chuỗi ("800000.00") nên phải ép Number mới định
          dạng được.
        */}
        {equipment && !isSupplierEquipment(item) ? (
          <span>💵 Số tiền: —</span>
        ) : (
          directorApprovedAmount == null && money != null && (
            <span>💵 Số tiền: {Number(money).toLocaleString("vi-VN")} đ</span>
          )
        )}
        {directorApprovedAmount != null && (
          <span className="font-semibold text-emerald-700">
            💵 Số tiền giám đốc duyệt: {Number(directorApprovedAmount).toLocaleString("vi-VN")} đ
          </span>
        )}
        {directorApprovedAmount != null && item.paymentOrder?.amount != null && (
          <span>
            🧾 Số tiền lệnh chi: {Number(item.paymentOrder.amount).toLocaleString("vi-VN")} đ
          </span>
        )}
        {/* Thủ quỹ cần biết xuất tiền từ quỹ tiền mặt hay tài khoản ngân hàng */}
        {fundSource && (
          <span>🏦 Nguồn tiền: {FUND_SOURCE_LABEL[fundSource] ?? fundSource}</span>
        )}
        {item.school?.name && <span>🏫 {item.school.name}</span>}
        {item.schoolYear && <span>🎓 {item.schoolYear}</span>}
      </div>

      {showCreator && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            Người đề xuất
          </div>
          <div className="mt-0.5 text-sm font-semibold text-blue-950">
            {creatorName(item)}
          </div>
          {requesterDetails.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-blue-700">
              {requesterDetails.map((detail) => (
                <span key={detail.label}>
                  {detail.label}: {detail.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(canEdit || canWithdraw || canDelete) && (
        <div className="mt-3 flex justify-end gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit!(item);
              }}
              className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 active:scale-95"
            >
              ✏️ Sửa
            </button>
          )}
          {canWithdraw && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWithdraw!(item);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 active:scale-95"
            >
              🗑️ Rút đề xuất
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete!(item);
              }}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 active:scale-95"
            >
              🗑️ Xoá đề xuất
            </button>
          )}
        </div>
      )}
    </div>
  );
}
