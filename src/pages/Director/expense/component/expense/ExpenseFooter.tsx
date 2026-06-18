// components/expense/ExpenseFooter.tsx

import { Pencil, Plus, Save } from "lucide-react";

type Props = {
  editingItem: any;

  loading: boolean;

  addRow: () => void;

  handleSubmit: () => void;

  handleCancelEdit: () => void;
};

export default function ExpenseFooter({
  editingItem,
  loading,
  addRow,
  handleSubmit,
  handleCancelEdit,
}: Props) {
  return (
    <div
      className="
        border-t border-slate-200
        bg-slate-50/70
        px-5 py-5
      "
    >
      <div
        className="
          flex flex-col lg:flex-row
          gap-4
          lg:items-center
          lg:justify-between
        "
      >
        {/* INFO */}
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {editingItem
              ? "Đang chỉnh sửa khoản thu chi"
              : "Thêm dữ liệu thu chi"}
          </p>

          <p className="text-xs text-slate-400 mt-1">
            {editingItem
              ? "Sau khi chỉnh sửa hãy nhấn cập nhật để lưu thay đổi"
              : "Có thể nhập nhiều dòng cùng lúc như Excel"}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* ADD ROW */}
          <button
            onClick={addRow}
            className="
              h-12 px-5 rounded-2xl
              bg-white
              border border-slate-200
              text-slate-700 font-semibold

              hover:border-blue-300
              hover:bg-blue-50
              hover:text-blue-600

              transition-all

              flex items-center gap-2

              shadow-sm
            "
          >
            <Plus size={18} />

            <span>Thêm dòng</span>
          </button>

          {/* CANCEL */}
          {editingItem && (
            <button
              onClick={handleCancelEdit}
              className="
                h-12 px-5 rounded-2xl
                bg-white
                border border-red-200
                text-red-500
                font-semibold

                hover:bg-red-50

                transition-all
                shadow-sm
              "
            >
              Huỷ
            </button>
          )}

          {/* SUBMIT */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`
              h-12 px-7 rounded-2xl

              text-white font-bold

              shadow-lg shadow-blue-200

              transition-all

              flex items-center gap-2

              ${
                loading
                  ? "bg-slate-400 cursor-not-allowed"
                  : editingItem
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }
            `}
          >
            {editingItem ? (
              <>
                <Pencil size={18} />

                <span>Cập nhật</span>
              </>
            ) : (
              <>
                <Save size={18} />

                <span>Lưu tất cả</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
