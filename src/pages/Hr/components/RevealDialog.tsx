import { useEffect, useRef, useState } from "react";
import { Copy, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { ExpiringSecret, REVEAL_TTL_MS } from "../lib/expiringSecret";
import { HrFormError } from "./HrUi";
import { isValidReason } from "../lib/hrAccess";

/**
 * Xem đầy đủ một giá trị nhạy cảm.
 *
 * - Bắt buộc lý do; gọi API reveal TRỰC TIẾP (không react-query → không nằm
 *   trong cache).
 * - Giá trị chỉ sống trong state của dialog: tự che sau 45 giây, xoá khi đóng
 *   dialog, khi tab bị ẩn, khi rời trang (unmount). Không log, không persist,
 *   không đưa vào toast / URL.
 * - Hết giờ không tự gọi lại API.
 */
export default function RevealDialog({
  title,
  fieldLabel,
  reveal,
  onClose,
}: {
  title: string;
  fieldLabel: string;
  reveal: (reason: string) => Promise<string>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [value, setValue] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [remaining, setRemaining] = useState(0);
  const secretRef = useRef<ExpiringSecret | null>(null);

  if (!secretRef.current) {
    secretRef.current = new ExpiringSecret(REVEAL_TTL_MS, (v) => {
      setValue(v);
      if (v === null) setExpired(true);
    });
  }

  useEffect(() => {
    const secret = secretRef.current!;
    const onHidden = () => {
      if (document.visibilityState === "hidden") secret.clear();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onHidden);
      secret.clear();
    };
  }, []);

  useEffect(() => {
    if (!value) return;
    const tick = () => setRemaining(Math.ceil((secretRef.current?.remainingMs() ?? 0) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [value]);

  const close = () => {
    secretRef.current?.clear();
    onClose();
  };

  const submit = async () => {
    const trimmed = reason.trim();
    if (!isValidReason(trimmed)) return;
    setLoading(true);
    setError(null);
    try {
      const full = await reveal(trimmed);
      setExpired(false);
      secretRef.current!.set(full);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    const v = secretRef.current?.get();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast.success("Đã sao chép.");
    } catch {
      toast.error("Không sao chép được.");
    }
  };

  if (value) {
    return (
      <Modal title={title} hideFooter onClose={close}>
        <p className="text-xs text-gray-500">{fieldLabel}</p>
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 font-mono text-lg font-semibold tracking-wider text-gray-900 break-all select-all"
          aria-live="polite"
        >
          {value}
        </div>
        <p className="text-xs text-gray-500">
          Tự che lại sau {remaining} giây. Lượt xem này đã được ghi vào nhật ký HR.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={copy}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-gray-300 py-2 text-sm font-medium text-gray-700"
          >
            <Copy size={14} /> Sao chép
          </button>
          <button
            onClick={close}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-blue-500 py-2 text-sm font-medium text-white"
          >
            <EyeOff size={14} /> Che lại & đóng
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      submitLabel="Xác nhận xem"
      loading={loading}
      disabled={!isValidReason(reason)}
      onClose={close}
      onSubmit={submit}
    >
      {expired && (
        <p className="text-xs text-gray-500">Giá trị đã được che lại. Nhập lý do để xem lại.</p>
      )}
      <Field
        label="Lý do xem dữ liệu"
        required
        hint="Tối thiểu 5 ký tự. Lý do được ghi vào nhật ký HR."
      >
        <textarea
          className={inputClass}
          rows={3}
          maxLength={2000}
          value={reason}
          autoComplete="off"
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <HrFormError error={error} />
    </Modal>
  );
}
