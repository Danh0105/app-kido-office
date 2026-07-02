import { useMemo, useState } from "react";
import { PolicyHistoryEntry } from "@/types/policy";
import PolicyDiffView from "./PolicyDiffView";

const actionLabels: Record<string, string> = {
  DIRECTOR_UPDATE: "Giám đốc chỉnh sửa",
  CREATE: "Tạo mới",
  UPDATE: "Nhân viên cập nhật",
  ADMIN_UPDATE: "Admin cập nhật",
  AUTO_APPROVED: "Tự động duyệt",
  SAVE_DRAFT: "Lưu nháp",
};

const actionClasses: Record<string, string> = {
  DIRECTOR_UPDATE: "bg-purple-100 text-purple-700",
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  ADMIN_UPDATE: "bg-amber-100 text-amber-700",
  AUTO_APPROVED: "bg-green-100 text-green-700",
  SAVE_DRAFT: "bg-slate-100 text-slate-700",
};

const getUpdaterName = (history: PolicyHistoryEntry) => {
  if (history.updatedByName) return history.updatedByName;
  if (typeof history.updatedBy === "string") return history.updatedBy;
  return history.updatedBy?.name || "Hệ thống";
};

export default function PolicyHistoryTimeline({
  histories,
  title = "Lịch sử thay đổi chính sách",
  compact = false,
}: {
  histories: PolicyHistoryEntry[];
  title?: string;
  compact?: boolean;
}) {
  const [selectedAction, setSelectedAction] = useState("ALL");
  const sortedHistories = useMemo(
    () =>
      [...(histories || [])].sort(
        (left, right) =>
          new Date(right.createdAt || 0).getTime() -
          new Date(left.createdAt || 0).getTime(),
      ),
    [histories],
  );
  const actions = useMemo(
    () => Array.from(new Set(sortedHistories.map((item) => item.action))),
    [sortedHistories],
  );
  const visibleHistories =
    selectedAction === "ALL"
      ? sortedHistories
      : sortedHistories.filter((item) => item.action === selectedAction);

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {sortedHistories.length} phiên bản, mới nhất hiển thị trước
          </p>
        </div>

        {actions.length > 1 && (
          <select
            value={selectedAction}
            onChange={(event) => setSelectedAction(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả thao tác</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {actionLabels[action] || action}
              </option>
            ))}
          </select>
        )}
      </div>

      {visibleHistories.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Chưa có lịch sử thay đổi.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleHistories.map((history) => (
            <article
              key={history.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                      actionClasses[history.action] ||
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {actionLabels[history.action] || history.action}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {getUpdaterName(history)}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>
                    {history.createdAt
                      ? new Date(history.createdAt).toLocaleString("vi-VN")
                      : ""}
                  </p>
                  {history.status && (
                    <p className="mt-1 font-semibold text-slate-600">
                      {String(history.status)}
                    </p>
                  )}
                </div>
              </div>

              {history.note && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <span className="font-bold">Lý do: </span>
                  {history.note}
                </div>
              )}

              <div className="mt-3">
                <PolicyDiffView diff={history.diff} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
