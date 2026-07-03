import { ACTION_LABEL, STATUS_LABEL, type ExpenseLog } from "@/types/expenseRequest";
import { formatDateTime } from "../lib";

export default function Timeline({ logs }: { logs?: ExpenseLog[] }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-gray-400">Chưa có lịch sử.</p>;
  }

  return (
    <ol className="relative border-l border-gray-200 ml-2">
      {logs.map((log) => {
        const label =
          log.action === "CREATE_PAYMENT_ORDER" &&
          log.fromStatus === "FUND_RETURNED"
            ? "Lên lại lệnh chi"
            : ACTION_LABEL[log.action] || log.action;
        const transition =
          log.fromStatus && log.toStatus
            ? `${STATUS_LABEL(log.fromStatus)} → ${STATUS_LABEL(log.toStatus)}`
            : log.toStatus
            ? STATUS_LABEL(log.toStatus)
            : "";
        const who = log.actorName || log.actor?.name || (log.userId ? `#${log.userId}` : "");
        const when = log.createdAt || log.snapshotAt;
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
            {(log.note || log.reason) && (
              <div className="text-xs text-gray-600 mt-0.5 italic">
                {log.note || log.reason}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
