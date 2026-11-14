import { useEffect, useState, type ReactNode } from "react";
import { toast } from "react-hot-toast";
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  Lock,
  LockOpen,
  MoonStar,
  X,
} from "lucide-react";
import {
  cashflowReportApi,
  type DayClosing,
  type DayClosingBalance,
  type DayClosingStatus,
} from "@/service/cashflowReport";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate, formatMoney } from "./cashflowFormat";

type Props = {
  status: DayClosingStatus | null;
  /** Thủ quỹ / kế toán trưởng / giám đốc: bấm End of Day. */
  canClose: boolean;
  /** Kế toán trưởng / giám đốc: mở lại ngày chốt gần nhất. */
  canReopen: boolean;
  range: { from: string; to: string };
  onChanged: () => void;
};

const timeVN = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

/** Trạng thái chốt quỹ ngày + nút End of Day / mở lại. */
export default function DayClosingBar({
  status,
  canClose,
  canReopen,
  range,
  onChanged,
}: Props) {
  const [dialog, setDialog] = useState<"history" | "close" | "reopen" | null>(null);
  if (!status) return null;
  const { latest, lockedThrough, todayClosed } = status;

  // Hộp thoại đặt ngoài thanh: backdrop-blur tạo khung chứa mới cho phần tử fixed.
  return (
    <>
      <div className="relative flex flex-col gap-3 rounded-[22px] border border-white/80 bg-white/[0.88] px-4 py-3 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              todayClosed
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {todayClosed ? <Lock size={18} /> : <LockOpen size={18} />}
          </div>
          <div className="text-[13px] leading-5">
            <p className="font-semibold text-slate-900">
              {lockedThrough
                ? `Đã chốt quỹ đến hết ngày ${formatDate(lockedThrough)}`
                : "Chưa chốt quỹ ngày nào"}
              {!todayClosed && (
                <span className="ml-2 font-medium text-amber-700">
                  · Hôm nay {formatDate(status.today)} chưa chốt
                </span>
              )}
            </p>
            <p className="text-slate-500">
              {latest &&
                `${
                  latest.mode === "AUTO"
                    ? "Tự động chốt sau 0h"
                    : `Chốt bởi ${latest.closedByName ?? "—"}`
                } lúc ${timeVN(latest.closedAt)}. `}
              Không bấm End of Day thì hệ thống tự chốt quỹ sau 0h. Ngày đã chốt
              không thêm/sửa/xoá trên sổ được.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDialog("history")}
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[13px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <CalendarDays size={14} /> Tồn quỹ hàng ngày
          </button>
          {canReopen && lockedThrough && (
            <button
              type="button"
              onClick={() => setDialog("reopen")}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <LockOpen size={14} /> Mở lại ngày {formatDate(lockedThrough)}
            </button>
          )}
          {canClose && !todayClosed && (
            <button
              type="button"
              onClick={() => setDialog("close")}
              className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_9px_22px_-12px_rgba(79,70,229,0.95)] transition hover:bg-indigo-700"
            >
              <MoonStar size={14} /> End of Day · Chốt quỹ hôm nay
            </button>
          )}
        </div>
      </div>
      {dialog === "history" && (
        <DayClosingHistoryModal
          initialFrom={range.from}
          initialTo={range.to}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "close" && (
        <EndOfDayModal
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
      {dialog === "reopen" && lockedThrough && (
        <ReopenModal
          date={lockedThrough}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

const sumOrNull = (values: (string | null)[]) =>
  values.some((value) => value === null)
    ? null
    : String(values.reduce((sum, value) => sum + Number(value), 0));

function ModalShell({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div
        className={`max-h-[92vh] w-full ${wide ? "max-w-6xl" : "max-w-2xl"} overflow-y-auto rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

/** Tra cứu snapshot tồn quỹ của từng ngày đã chốt, có thể bung chi tiết tài khoản. */
function DayClosingHistoryModal({
  initialFrom,
  initialTo,
  onClose,
}: {
  initialFrom: string;
  initialTo: string;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [query, setQuery] = useState({ from: initialFrom, to: initialTo });
  const [rows, setRows] = useState<DayClosing[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setExpandedId(null);
    cashflowReportApi
      .dayClosings(query.from, query.to)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err) => {
        if (active) {
          setRows(null);
          setError(getApiErrorMessage(err, "Không tải được lịch sử chốt quỹ"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const applyRange = () => {
    if (!from || !to) {
      setError("Chọn đủ ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (from > to) {
      setError("Từ ngày phải trước hoặc bằng Đến ngày");
      return;
    }
    setQuery({ from, to });
  };

  return (
    <ModalShell
      wide
      title="Tồn quỹ hàng ngày đã chốt"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Đóng
        </button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 sm:flex-row sm:items-end">
        <label className="text-xs font-semibold text-slate-600">
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1 block h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <button
          type="button"
          onClick={applyRange}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />} Xem tồn quỹ
        </button>
        {rows && !loading && (
          <span className="sm:ml-auto sm:self-center text-xs font-medium text-slate-500">
            {rows.length} lần chốt/mở lại
          </span>
        )}
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : loading && !rows ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Đang tải tồn quỹ…
        </div>
      ) : rows?.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          Chưa có lần chốt quỹ nào trong khoảng ngày này.
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-2xl border border-slate-200 ${loading ? "opacity-60" : ""}`}>
          <table className="w-full min-w-[980px] text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-9 px-2 py-2.5" />
                <th className="px-3 py-2.5 text-left">Ngày</th>
                <th className="px-3 py-2.5 text-left">Trạng thái</th>
                <th className="px-3 py-2.5 text-right">Đầu ngày</th>
                <th className="px-3 py-2.5 text-right">Thu</th>
                <th className="px-3 py-2.5 text-right">Chi</th>
                <th className="px-3 py-2.5 text-right">Tồn cuối ngày</th>
                <th className="px-3 py-2.5 text-left">Thực hiện</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => {
                const expanded = expandedId === row.id;
                const opening = sumOrNull(row.balances.map((balance) => balance.opening));
                return (
                  <HistoryRows
                    key={row.id}
                    row={row}
                    opening={opening}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : row.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Số liệu là snapshot tại thời điểm chốt. Dòng “Đã mở lại” được giữ lại để
        đối chiếu lịch sử; bấm mũi tên để xem tồn theo từng tài khoản.
      </p>
    </ModalShell>
  );
}

function HistoryRows({
  row,
  opening,
  expanded,
  onToggle,
}: {
  row: DayClosing;
  opening: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const actor =
    row.status === "REOPENED"
      ? row.reopenedByName ?? "—"
      : row.mode === "AUTO"
        ? "Tự động sau 0h"
        : row.closedByName ?? "—";
  const actionAt =
    row.status === "REOPENED" && row.reopenedAt ? row.reopenedAt : row.closedAt;

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/70">
        <td className="px-2 py-2.5 text-center">
          <button
            type="button"
            onClick={onToggle}
            aria-label={`${expanded ? "Ẩn" : "Xem"} chi tiết ngày ${formatDate(row.date)}`}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <ChevronDown size={15} className={`transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </td>
        <td className="px-3 py-2.5 font-semibold text-slate-900">{formatDate(row.date)}</td>
        <td className="px-3 py-2.5">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              row.status === "CLOSED"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {row.status === "CLOSED" ? "Đã chốt" : "Đã mở lại"}
          </span>
        </td>
        <MoneyCell value={opening} />
        <MoneyCell value={row.totals.receipts} tone="text-emerald-700" />
        <MoneyCell value={row.totals.payments} tone="text-rose-700" />
        <MoneyCell value={row.totals.closing} tone="font-semibold text-indigo-700" />
        <td className="px-3 py-2.5 text-slate-600">
          <div className="font-medium text-slate-700">{actor}</div>
          <div className="text-[11px]">{timeVN(actionAt)}</div>
          {row.status === "REOPENED" && row.reopenReason && (
            <div className="mt-0.5 max-w-[240px] truncate text-[11px] text-amber-700" title={row.reopenReason}>
              Lý do: {row.reopenReason}
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-indigo-100 bg-indigo-50/45">
          <td colSpan={8} className="px-4 py-3">
            <div className="overflow-x-auto rounded-xl border border-indigo-100 bg-white">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="bg-indigo-50/70 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Tài khoản</th>
                    <th className="px-3 py-2 text-right">Đầu ngày</th>
                    <th className="px-3 py-2 text-right">Thu</th>
                    <th className="px-3 py-2 text-right">Chi</th>
                    <th className="px-3 py-2 text-right">Tồn cuối ngày</th>
                    <th className="px-3 py-2 text-right">Số dòng</th>
                  </tr>
                </thead>
                <tbody>
                  {row.balances.map((balance) => (
                    <tr key={balance.code} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800">
                        <span className="font-mono font-semibold">{balance.code}</span>{" "}
                        {balance.name}
                      </td>
                      <MoneyCell value={balance.opening} compact />
                      <MoneyCell value={balance.receipts} tone="text-emerald-700" compact />
                      <MoneyCell value={balance.payments} tone="text-rose-700" compact />
                      <MoneyCell value={balance.closing} tone="font-semibold" compact />
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {balance.lineCount.toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MoneyCell({
  value,
  tone = "text-slate-800",
  compact = false,
}: {
  value: string | null;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <td className={`${compact ? "px-3 py-2" : "px-3 py-2.5"} text-right tabular-nums ${tone}`}>
      {value === null ? <Unverified /> : formatMoney(value)}
    </td>
  );
}

/** Xem trước số dư từng tài khoản của ngày sẽ chốt rồi mới chốt. */
function EndOfDayModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [days, setDays] = useState<
    { date: string; balances: DayClosingBalance[] }[] | null
  >(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cashflowReportApi
      .dayClosingPreview()
      .then((preview) => setDays(preview.days))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Không tải được số liệu chốt quỹ"))
      );
  }, []);

  const last = days?.[days.length - 1];
  const confirm = async () => {
    setBusy(true);
    try {
      const result = await cashflowReportApi.closeDay();
      toast.success(
        `Đã chốt quỹ đến hết ngày ${formatDate(result.lockedThrough)}`
      );
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không chốt được quỹ"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={
        last
          ? `End of Day · Chốt quỹ ngày ${formatDate(last.date)}`
          : "End of Day · Chốt quỹ"
      }
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy || !last}
            onClick={() => void confirm()}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Chốt quỹ
          </button>
        </>
      }
    >
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : !days || !last ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Đang tính số dư…
        </div>
      ) : (
        <>
          {days.length > 1 && (
            <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              Chốt luôn {days.length - 1} ngày trước chưa chốt:{" "}
              {formatDate(days[0].date)}
              {days.length > 2
                ? ` – ${formatDate(days[days.length - 2].date)}`
                : ""}
              .
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Tài khoản</th>
                  <th className="px-3 py-2 text-right">Đầu ngày</th>
                  <th className="px-3 py-2 text-right">Thu</th>
                  <th className="px-3 py-2 text-right">Chi</th>
                  <th className="px-3 py-2 text-right">Cuối ngày</th>
                </tr>
              </thead>
              <tbody>
                {last.balances.map((b) => (
                  <tr key={b.code} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800">
                      <span className="font-mono font-semibold">{b.code}</span>{" "}
                      {b.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.opening === null ? (
                        <Unverified />
                      ) : (
                        formatMoney(b.opening)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {formatMoney(b.receipts)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                      {formatMoney(b.payments)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {b.closing === null ? (
                        <Unverified />
                      ) : (
                        formatMoney(b.closing)
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-3 py-2">Cộng</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(
                      sumOrNull(last.balances.map((b) => b.opening))
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                    {formatMoney(
                      sumOrNull(last.balances.map((b) => b.receipts))
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                    {formatMoney(
                      sumOrNull(last.balances.map((b) => b.payments))
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(
                      sumOrNull(last.balances.map((b) => b.closing))
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-slate-500">
            Sau khi chốt: không thêm/sửa/xoá bút toán nhập tay và không xoá dòng
            sổ của ngày đã chốt. Kế toán trưởng / giám đốc mở lại được ngày chốt
            gần nhất. Phân hệ khác ghi thêm vào ngày đã chốt sẽ hiện cảnh báo ở
            tab "Cần kiểm tra".
          </p>
        </>
      )}
    </ModalShell>
  );
}

const Unverified = () => (
  <span className="text-xs italic text-amber-700">Chưa xác minh</span>
);

function ReopenModal({
  date,
  onClose,
  onDone,
}: {
  date: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await cashflowReportApi.reopenDay(reason.trim());
      toast.success(`Đã mở lại ngày ${formatDate(date)}`);
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không mở lại được"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell
      title={`Mở lại ngày đã chốt ${formatDate(date)}`}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => void confirm()}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Mở lại
          </button>
        </>
      }
    >
      <label className="block text-sm font-medium text-slate-700">
        Lý do mở lại *
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[14px] outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
      </label>
      <p className="mt-2 text-[12px] text-slate-500">
        Mở lại để sửa sổ ngày {formatDate(date)}; sửa xong thủ quỹ bấm End of
        Day để chốt lại (hoặc hệ thống tự chốt sau 0h).
      </p>
    </ModalShell>
  );
}
