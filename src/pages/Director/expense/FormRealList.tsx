// FormRealList.tsx
// component popup tái sử dụng

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
};

import { useEffect, useState } from "react";

export default function FormRealList({ open, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({
    title: "",
    amount: "",
    note: "",
  });

  useEffect(() => {
    if (!open) {
      setForm({
        title: "",
        amount: "",
        note: "",
      });
    }
  }, [open]);

  const handleSubmit = () => {
    onSubmit?.(form);

    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full bg-white rounded-t-[30px] p-5 animate-slideUp max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Thêm chi tiền thực</h2>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Khoản chi</p>

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              placeholder="Nhập khoản chi..."
              className="w-full border rounded-2xl px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-1">Số tiền</p>

            <input
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount: e.target.value,
                })
              }
              placeholder="Nhập số tiền..."
              className="w-full border rounded-2xl px-4 py-3 outline-none"
            />
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-1">Ghi chú</p>

            <textarea
              rows={4}
              value={form.note}
              onChange={(e) =>
                setForm({
                  ...form,
                  note: e.target.value,
                })
              }
              placeholder="Nhập ghi chú..."
              className="w-full border rounded-2xl px-4 py-3 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="bg-gray-100 py-3 rounded-2xl font-semibold"
            >
              Huỷ
            </button>

            <button
              onClick={handleSubmit}
              className="bg-green-500 text-white py-3 rounded-2xl font-semibold active:scale-95 transition"
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
