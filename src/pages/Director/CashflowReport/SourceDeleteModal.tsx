import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { cashflowReportApi, type LedgerSource, type SourceDeletionPlan } from "@/service/cashflowReport";
import { getApiErrorMessage } from "@/utils/apiError";

type Props = {
  target: { type: LedgerSource["type"]; id: number };
  onClose: () => void;
  onDeleted: () => void;
};

/**
 * Xoá một dòng trên sổ: tải trước danh sách các khoản sẽ bị xoá / gỡ để người
 * xoá đọc và xác nhận; xoá xong nhắc lại đúng danh sách đó.
 */
export default function SourceDeleteModal({ target, onClose, onDeleted }: Props) {
  const [plan, setPlan] = useState<SourceDeletionPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cashflowReportApi
      .sourceDeletionPlan(target.type, target.id)
      .then(setPlan)
      .catch((err) => setError(getApiErrorMessage(err, "Không tải được dữ liệu cần xoá")));
  }, [target.type, target.id]);

  const confirm = async () => {
    setBusy(true);
    try {
      const done = await cashflowReportApi.deleteSource(target.type, target.id);
      toast.success(
        <div className="text-sm">
          <p className="font-semibold">{done.mode === "UNPOST" ? "Đã gỡ khỏi sổ" : "Đã xoá"}:</p>
          <ul className="mt-1 list-disc pl-4">
            {done.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>,
        { duration: 10000 },
      );
      onDeleted();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không xoá được"));
    } finally {
      setBusy(false);
    }
  };

  const unpost = plan?.mode === "UNPOST";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)] ring-1 ring-slate-200/70 backdrop-blur-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Trash2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{plan?.title ?? "Xoá dữ liệu"}</h3>
              <p className="text-xs text-slate-500">
                {unpost ? "Các khoản sau sẽ được gỡ khỏi sổ thu chi:" : "Các khoản sau sẽ bị xoá cùng:"}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800">
            <X size={18} />
          </button>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{error}</p>
        ) : !plan ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Đang kiểm tra dữ liệu liên quan…
          </div>
        ) : (
          <>
            <ul className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] text-slate-800">
              {plan.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {plan.warnings.length > 0 && (
              <div className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div>
                  {plan.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            )}
            {plan.blockers.length > 0 && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-medium text-rose-700">
                {plan.blockers.map((blocker) => (
                  <p key={blocker}>{blocker}</p>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy || !plan || plan.blockers.length > 0}
            onClick={() => void confirm()}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(225,29,72,0.9)] transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {unpost ? "Gỡ khỏi sổ" : plan?.type === "MANUAL_ENTRY" ? "Xoá" : "Xoá vĩnh viễn"}
          </button>
        </div>
      </div>
    </div>
  );
}
