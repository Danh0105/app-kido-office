import {
  ACTION_LABEL,
  FUND_SOURCE_LABEL,
  KIND_META,
  statusLabel,
  type ExpenseAttachment,
  type ExpenseLog,
  type ExpenseRequest,
  type ExpenseRequestKind,
  type FundSource,
} from "@/types/expenseRequest";
import { formatVnd } from "@/utils/decimal";
import { resolveFileUrl } from "@/service/expenseRequest";
import { formatDateTime } from "../lib";
import LogDetails, { hasLogDetails } from "./LogDetails";

const APPROVAL_ACTIONS = new Set([
  "APPROVE",
  "APPROVED",
  "APPROVE_EXPENSE_REQUEST",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim().startsWith("{")) return null;

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const firstValue = (
  sources: Record<string, unknown>[],
  keys: string[],
) => {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
};

const normalizeKind = (value: unknown): ExpenseRequestKind | undefined => {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  return normalized === "CASH" ||
    normalized === "EQUIPMENT" ||
    normalized === "REPAIR"
    ? normalized
    : undefined;
};

const normalizeAmount = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
};

const normalizeFundSource = (value: unknown): FundSource | undefined =>
  value === "COMPANY_CASH" || value === "BANK_ACCOUNT" ? value : undefined;

const logSources = (log: ExpenseLog) => {
  const rawLog = log as unknown as Record<string, unknown>;
  const nestedSources = [
    rawLog.details,
    rawLog.metadata,
    rawLog.meta,
    rawLog.snapshot,
    rawLog.payload,
    rawLog.data,
    rawLog.note,
  ]
    .map(asRecord)
    .filter((value): value is Record<string, unknown> => !!value);
  return [...nestedSources, rawLog];
};

const fundSourceFromLog = (log: ExpenseLog): FundSource | undefined =>
  normalizeFundSource(firstValue(logSources(log), ["fundSource"]));

const personLabel = (value: unknown): string => {
  if (!isRecord(value)) return "";
  const name = value.name || value.fullName || value.employeeName;
  if (typeof name === "string" && name.trim()) return name.trim();
  const id = value.id || value.employeeId || value.userId;
  return id !== undefined && id !== null && id !== "" ? `#${id}` : "";
};

const approvalDetailsFromLog = (log: ExpenseLog) => {
  const sources = logSources(log);
  const kind = normalizeKind(
    firstValue(sources, ["requestKind", "approvedRequestKind", "selectedKind"]),
  );
  const amount = normalizeAmount(
    firstValue(sources, ["amount", "approvedAmount"]),
  );
  const assignedPerson = firstValue(sources, [
    "assignedTechnician",
    "technician",
    "assignee",
    "executor",
  ]);
  const assignedName = firstValue(sources, [
    "assignedTechnicianName",
    "technicianName",
    "assigneeName",
    "executorName",
  ]);
  const assignedId = firstValue(sources, [
    "assignedTechnicianId",
    "technicianId",
    "assigneeId",
    "executorId",
  ]);
  const assignee =
    personLabel(assignedPerson) ||
    (typeof assignedName === "string" ? assignedName.trim() : "") ||
    (assignedId !== undefined ? `#${assignedId}` : "");

  return { kind, amount, assignee };
};

export default function Timeline({
  logs,
  kind = "CASH",
  request,
  releasedFundSource,
  attachments,
}: {
  logs?: ExpenseLog[];
  /** Nhãn SPENT/NOT_SPENT đọc theo loại đề xuất ("đã chi" ↔ "đã bàn giao"). */
  kind?: ExpenseRequestKind;
  /** Dữ liệu hiện tại dùng làm fallback cho lần duyệt mới nhất. */
  request?: ExpenseRequest;
  /** Nguồn tiền hiện tại của lệnh chi — fallback cho lần xuất tiền mới nhất (log không lưu riêng nguồn tiền theo từng lần). */
  releasedFundSource?: FundSource;
  /**
   * Toàn bộ tệp đính kèm của đề xuất — mỗi tệp gắn `action` cho biết được
   * up ở bước nào (VD kinh doanh up chứng từ khi CREATE/UPDATE/CONFIRM_SPENT,
   * thủ quỹ up khi CONFIRM_CASH_RELEASED). Hiện dưới đúng log của bước đó,
   * chỉ ở lần gần nhất của mỗi action (tránh lặp lại nếu làm lại nhiều lần).
   */
  attachments?: ExpenseAttachment[];
}) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-400">Chưa có lịch sử.</p>;
  }

  const latestApprovalIndex = logs.reduce(
    (latest, log, index) =>
      APPROVAL_ACTIONS.has(log.action) || log.toStatus === "APPROVED"
        ? index
        : latest,
    -1,
  );
  const canUseCurrentApproval =
    !!request &&
    !["PENDING_APPROVAL", "REJECTED", "WITHDRAWN"].includes(request.status);

  const latestReleaseIndex = logs.reduce(
    (latest, log, index) =>
      log.action === "CONFIRM_CASH_RELEASED" ? index : latest,
    -1,
  );

  // Log cuối cùng của mỗi action — chỉ log đó mới gắn file, tránh lặp lại
  // cùng một tệp ở nhiều bước trùng action (VD làm lại lệnh chi nhiều lần).
  const latestIndexByAction = logs.reduce<Record<string, number>>(
    (acc, log, index) => {
      acc[log.action] = index;
      return acc;
    },
    {},
  );

  return (
    <ol className="relative border-l border-gray-200 ml-2">
      {logs.map((log, index) => {
        const isApproval =
          APPROVAL_ACTIONS.has(log.action) || log.toStatus === "APPROVED";
        const loggedApproval = isApproval
          ? approvalDetailsFromLog(log)
          : { kind: undefined, amount: undefined, assignee: "" };
        const useCurrentFallback =
          isApproval && index === latestApprovalIndex && canUseCurrentApproval;
        const approvalKind =
          loggedApproval.kind ||
          (useCurrentFallback ? request?.requestKind || kind : undefined);
        const approvalAmount =
          loggedApproval.amount ?? (useCurrentFallback ? request?.amount : undefined);
        const approvalAssignee =
          loggedApproval.assignee ||
          (useCurrentFallback
            ? request?.assignedTechnician?.name ||
              (request?.assignedTechnicianId
                ? `#${request.assignedTechnicianId}`
                : "")
            : "");
        const label =
          log.action === "CREATE_PAYMENT_ORDER" &&
          log.fromStatus === "FUND_RETURNED"
            ? "Lên lại lệnh chi"
            : log.action === "CREATE_STOCK_ISSUE_ORDER" &&
                log.fromStatus === "EQUIPMENT_RETURNED"
              ? "Lên lại lệnh xuất kho"
              : ACTION_LABEL[log.action] || log.action;
        const transition =
          // Bước không đổi trạng thái (từ chối / thay người) thì không hiện.
          log.fromStatus && log.toStatus && log.fromStatus === log.toStatus
            ? ""
            : log.fromStatus && log.toStatus
            ? `${statusLabel(log.fromStatus, kind)} → ${statusLabel(log.toStatus, kind)}`
            : log.toStatus
            ? statusLabel(log.toStatus, kind)
            : "";
        // Log mới có ảnh chụp thông tin của bước — hiện bằng LogDetails; log cũ
        // (data = {}) giữ cách hiển thị cũ với số liệu hiện tại làm fallback.
        const detailed = hasLogDetails(log);
        const who = log.actorName || log.actor?.name || (log.userId ? `#${log.userId}` : "");
        const when = log.createdAt || log.snapshotAt;
        const visibleNote =
          // Lý do từ chối đã hiện trong khung chi tiết.
          detailed && log.action === "DECLINE_ASSIGNMENT"
            ? ""
            : log.reason || (asRecord(log.note) ? "" : log.note);
        const releaseFundSource =
          log.action === "CONFIRM_CASH_RELEASED"
            ? fundSourceFromLog(log) ||
              (index === latestReleaseIndex ? releasedFundSource : undefined)
            : undefined;
        const logFiles =
          index === latestIndexByAction[log.action]
            ? attachments?.filter((a) => a.action === log.action)
            : undefined;
        return (
          <li key={log.id} className="mb-4 ml-4">
            <span className="absolute -left-[6px] mt-1.5 w-3 h-3 rounded-full bg-blue-500 border border-white" />
            <div className="text-xs text-gray-400">{formatDateTime(when)}</div>
            <div className="text-sm font-medium text-gray-800">
              {label}
              {transition && (
                <span className="ml-1 text-xs font-normal text-gray-500">
                  ({transition})
                </span>
              )}
            </div>
            {who && <div className="text-xs text-gray-500">{who}</div>}
            {detailed && <LogDetails log={log} kind={request?.requestKind || kind} />}
            {!detailed &&
              isApproval &&
              (approvalKind ||
                approvalAmount !== undefined ||
                approvalAssignee ||
                (useCurrentFallback &&
                  (request?.stockInHandler || request?.acceptor))) && (
                <div className="mt-1.5 space-y-0.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs text-gray-700">
                  {approvalKind && (
                    <div>
                      <span className="text-gray-500">Loại đề xuất: </span>
                      <span className="font-medium">
                        {KIND_META[approvalKind].icon} {KIND_META[approvalKind].label}
                      </span>
                    </div>
                  )}
                  {approvalAmount !== undefined && (
                    <div>
                      <span className="text-gray-500">
                        Số tiền giám đốc duyệt:{" "}
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {formatVnd(approvalAmount)} đ
                      </span>
                    </div>
                  )}
                  {approvalAssignee && (
                    <div>
                      <span className="text-gray-500">
                        {(request?.requestKind || kind) === "REPAIR"
                          ? "Người đảm nhận chính: "
                          : "Người bàn giao: "}
                      </span>
                      <span className="font-medium">{approvalAssignee}</span>
                    </div>
                  )}
                  {/* Log cũ không lưu chi tiết: lần duyệt mới nhất lấy người xử lý /
                      người nghiệm thu hiện tại của đề xuất. */}
                  {useCurrentFallback && request?.stockInHandler?.name && (
                    <div>
                      <span className="text-gray-500">Người xử lý phiếu nhập: </span>
                      <span className="font-medium">{request.stockInHandler.name}</span>
                    </div>
                  )}
                  {useCurrentFallback && request?.acceptor?.name && (
                    <div>
                      <span className="text-gray-500">Người nghiệm thu: </span>
                      <span className="font-medium">{request.acceptor.name}</span>
                    </div>
                  )}
                </div>
              )}
            {!detailed && releaseFundSource && (
              <div className="mt-1.5 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-2 text-xs text-gray-700">
                <span className="text-gray-500">Nguồn tiền: </span>
                <span className="font-medium">
                  {FUND_SOURCE_LABEL[releaseFundSource]}
                </span>
              </div>
            )}
            {visibleNote && (
              <div className="text-xs text-gray-600 mt-0.5 italic">
                {visibleNote}
              </div>
            )}
            {!!logFiles?.length && (
              <ul className="mt-1.5 space-y-0.5">
                {logFiles.map((f) => (
                  <li key={f.id}>
                    <a
                      href={resolveFileUrl(f.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-500 font-medium break-all"
                    >
                      📄 {f.fileName || f.fileUrl}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
