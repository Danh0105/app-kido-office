import {
  EQUIPMENT_SOURCE_META,
  FUND_SOURCE_LABEL,
  KIND_META,
  PAYMENT_METHOD_LABEL,
  type ExpenseLog,
  type ExpenseLogDetails,
  type ExpenseLogPerson,
} from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import { formatDate, mainAssigneeLabel } from "../lib";
import type { ExpenseRequestKind } from "@/types/expenseRequest";

const person = (p?: ExpenseLogPerson | null) =>
  p ? [p.name || `NV #${p.id}`, p.phone].filter(Boolean).join(" · ") : "";

const money = (value?: number | null) =>
  value != null ? `${formatVnd(Number(value)) || "0"} đ` : "";

/** Có dữ liệu chi tiết thật không — log cũ lưu `{}`. */
export const hasLogDetails = (log: ExpenseLog) => {
  const d = log.data;
  return !!d && typeof d === "object" && Object.keys(d).length > 0;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function ItemsTable({
  items,
  withPrice,
}: {
  items: NonNullable<NonNullable<ExpenseLogDetails["stockIn"]>["items"]>;
  withPrice?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-white/70 text-gray-500">
            <th className="border border-gray-200 px-1.5 py-1 text-left font-medium">Thiết bị</th>
            <th className="border border-gray-200 px-1.5 py-1 text-right font-medium">SL</th>
            {withPrice && (
              <>
                <th className="border border-gray-200 px-1.5 py-1 text-right font-medium">Đơn giá</th>
                <th className="border border-gray-200 px-1.5 py-1 text-right font-medium">Thành tiền</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={`${it.name}-${i}`}>
              <td className="border border-gray-200 px-1.5 py-1">
                {it.name}
                {it.unit ? <span className="text-gray-400"> ({it.unit})</span> : null}
              </td>
              <td className="border border-gray-200 px-1.5 py-1 text-right">{it.quantity}</td>
              {withPrice && (
                <>
                  <td className="border border-gray-200 px-1.5 py-1 text-right">
                    {it.unitPrice ? formatVnd(Number(it.unitPrice)) : "—"}
                  </td>
                  <td className="border border-gray-200 px-1.5 py-1 text-right">
                    {it.unitPrice ? formatVnd(Number(it.unitPrice) * it.quantity) : "—"}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Box = ({ tone, children }: { tone: string; children: React.ReactNode }) => (
  <div className={`mt-1.5 space-y-0.5 rounded-lg border px-2.5 py-2 text-xs text-gray-700 ${tone}`}>
    {children}
  </div>
);

/**
 * Thông tin đầy đủ của một bước trong Lịch sử, lấy từ ảnh chụp `log.data`
 * backend lưu lúc thực hiện bước (số liệu của đúng lần đó).
 */
export default function LogDetails({
  log,
  kind,
}: {
  log: ExpenseLog;
  /** Loại đề xuất — để gọi đúng "người bàn giao" / "người đảm nhận chính". */
  kind?: ExpenseRequestKind;
}) {
  const d = log.data || {};
  const nextPeople = d.next?.people || [];
  const nextDepartments = d.next?.departments || [];
  const hasNext = nextPeople.length > 0 || nextDepartments.length > 0;
  // Người nghiệm thu đã hiện trong khung duyệt (nhà cung cấp) thì không lặp lại.
  const showAcceptor = !!d.acceptor && !(log.action === "APPROVE" && d.stockIn?.acceptor);

  return (
    <>
      <StepDetails log={log} kind={kind} />
      {(hasNext || showAcceptor) && (
        <div className="mt-1 space-y-0.5 text-xs text-gray-600">
          {hasNext && (
            <div>
              <span className="text-gray-500">👉 Người xử lý tiếp theo: </span>
              <span className="font-medium text-gray-800">
                {[...nextPeople.map(person), ...nextDepartments].join(", ")}
              </span>
            </div>
          )}
          {showAcceptor && (
            <div>
              <span className="text-gray-500">📋 Người nghiệm thu: </span>
              <span className="font-medium text-gray-800">{person(d.acceptor)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Thông tin riêng của từng loại bước (lệnh chi, phiếu kho, giao việc…). */
function StepDetails({ log, kind: requestKind }: { log: ExpenseLog; kind?: ExpenseRequestKind }) {
  const d = log.data || {};

  switch (log.action) {
    case "APPROVE": {
      const kind = d.requestKind || undefined;
      const source = d.equipmentSource || undefined;
      return (
        <Box tone="border-blue-100 bg-blue-50">
          {kind && KIND_META[kind] && (
            <Row label="Loại đề xuất">
              {KIND_META[kind].icon} {KIND_META[kind].label}
            </Row>
          )}
          {kind === "EQUIPMENT" && source && (
            <Row label="Nguồn thiết bị">
              {EQUIPMENT_SOURCE_META[source].icon} {EQUIPMENT_SOURCE_META[source].label}
            </Row>
          )}
          {d.amount != null && (
            <Row label="Số tiền duyệt">
              <span className="text-emerald-700">{money(d.amount)}</span>
            </Row>
          )}
          {d.handover && (
            <Row label={mainAssigneeLabel(kind)}>{person(d.handover)}</Row>
          )}
          {!!d.supporters?.length && (
            <Row label="Người hỗ trợ">{d.supporters.map(person).join(", ")}</Row>
          )}
          {d.stockIn && (
            <>
              {d.stockIn.code && <Row label="Phiếu nhập kho dự kiến">{d.stockIn.code}</Row>}
              {d.stockIn.handler && (
                <Row label="Người xử lý phiếu nhập">{person(d.stockIn.handler)}</Row>
              )}
              {d.stockIn.acceptor && (
                <Row label="Người nghiệm thu">{person(d.stockIn.acceptor)}</Row>
              )}
              {d.stockIn.note && <Row label="Ghi chú cho người xử lý">{d.stockIn.note}</Row>}
              <ItemsTable items={d.stockIn.items || []} withPrice />
            </>
          )}
        </Box>
      );
    }

    case "CREATE_PAYMENT_ORDER":
    case "EDIT_PAYMENT_ORDER": {
      const po = d.paymentOrder;
      if (!po) return null;
      return (
        <Box tone="border-purple-100 bg-purple-50">
          {po.code && <Row label="Mã lệnh chi">{po.code}</Row>}
          {po.amount != null && <Row label="Số tiền">{money(po.amount)}</Row>}
          {po.paymentMethod && (
            <Row label="Hình thức">{PAYMENT_METHOD_LABEL[po.paymentMethod] || po.paymentMethod}</Row>
          )}
        </Box>
      );
    }

    case "CONFIRM_CASH_RELEASED":
      return d.fundSource ? (
        <Box tone="border-orange-100 bg-orange-50">
          <Row label="Nguồn tiền">{FUND_SOURCE_LABEL[d.fundSource]}</Row>
        </Box>
      ) : null;

    case "CREATE_STOCK_ISSUE_ORDER": {
      const o = d.stockIssueOrder;
      if (!o) return null;
      return (
        <Box tone="border-violet-100 bg-violet-50">
          {o.code && <Row label="Mã lệnh xuất kho">{o.code}</Row>}
          {o.warehouse && <Row label="Kho xuất">{o.warehouse}</Row>}
          {o.expectedDeliveryDate && (
            <Row label="Ngày giao dự kiến">{formatDate(o.expectedDeliveryDate)}</Row>
          )}
          <ItemsTable items={o.items || []} />
        </Box>
      );
    }

    case "CREATE_STOCK_IN_RECEIPT": {
      const o = d.stockIn;
      if (!o) return null;
      return (
        <Box tone="border-cyan-100 bg-cyan-50">
          {o.code && <Row label="Phiếu nhập kho">{o.code}</Row>}
          {o.warehouseReceiptCode && <Row label="Phiếu kho">{o.warehouseReceiptCode}</Row>}
          {!!o.total && (
            <Row label="Tổng tiền">
              <span className="text-emerald-700">{money(o.total)}</span>
            </Row>
          )}
          <ItemsTable items={o.items || []} withPrice />
        </Box>
      );
    }

    case "CONFIRM_STOCK_IN_ACCEPTED":
      return d.amount != null ? (
        <Box tone="border-green-100 bg-green-50">
          <Row label="Số tiền chuyển về QL thu chi">
            <span className="text-emerald-700">{money(d.amount)}</span>
          </Row>
        </Box>
      ) : null;

    case "DECLINE_ASSIGNMENT":
    case "REPLACE_ASSIGNMENT":
    case "REASSIGN_REPAIR": {
      const a = d.assignment;
      if (!a) return null;
      const roleLabel =
        a.role === "SUPPORT" ? "Người hỗ trợ" : mainAssigneeLabel(requestKind);
      return (
        <Box
          tone={
            log.action === "DECLINE_ASSIGNMENT"
              ? "border-red-100 bg-red-50"
              : "border-blue-100 bg-blue-50"
          }
        >
          {a.from && (
            <Row label={log.action === "DECLINE_ASSIGNMENT" ? `${roleLabel} từ chối` : `${roleLabel} cũ`}>
              {person(a.from)}
            </Row>
          )}
          {a.fromReason && <Row label="Lý do từ chối">{a.fromReason}</Row>}
          {a.to && <Row label={`${roleLabel} thay thế`}>{person(a.to)}</Row>}
        </Box>
      );
    }

    default:
      return null;
  }
}
