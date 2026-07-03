import { useState } from "react";
import DecimalInput from "@/components/DecimalInput";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/types/expenseRequest";
import type { PaymentOrderPayload } from "@/service/expenseRequest";

export default function PaymentOrderModal({
  defaultAmount,
  retry = false,
  loading,
  onClose,
  onSubmit,
}: {
  defaultAmount: number;
  retry?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: PaymentOrderPayload) => void;
}) {
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!amount || amount <= 0) {
      setError("Số tiền phải lớn hơn 0");
      return;
    }
    onSubmit({ amount, paymentMethod, note: note.trim() || undefined });
  };

  const methods: PaymentMethod[] = ["CASH", "BANK_TRANSFER"];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">
            {retry ? "Lên lại lệnh chi" : "Lên lệnh chi"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-sm text-gray-600">
              Số tiền <span className="text-red-500">*</span>
            </label>
            <DecimalInput
              value={amount}
              onValueChange={setAmount}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Hình thức</label>
            <div className="flex gap-2 mt-1">
              {methods.map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2 text-sm rounded-lg border font-medium ${
                    paymentMethod === m
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="Không bắt buộc"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl text-white font-medium bg-purple-500 active:scale-95 disabled:opacity-60"
          >
            {loading
              ? "Đang xử lý…"
              : retry
                ? "Lên lại lệnh chi"
                : "Lên lệnh chi"}
          </button>
        </div>
      </div>
    </div>
  );
}
