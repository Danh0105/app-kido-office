import { useState } from "react";
import { hasRole, getEmployeeRoles, logout } from "@/utils/auth";
import { employeeApi } from "@/service/employee";

/** Tên hiển thị cho từng role — khớp danh sách ALL_BUSINESS_ROLES ở backend. */
const ROLE_LABELS: Record<string, string> = {
  director: "Giám đốc",
  director_la: "Giám đốc (Long An)",
  nhansu: "Nhân sự",
  giaovu: "Giáo vụ",
  saleadmin: "Sale admin",
  salesadmin: "Sales admin",
  salesadmin_la: "Sales admin (Long An)",
  ketoan_congno: "Kế toán công nợ",
  ketoan_truong: "Kế toán trưởng",
  thuquy: "Thủ quỹ",
  ky_thuat: "Kỹ thuật",
  sales: "Kinh doanh",
  troly_gd: "Trợ lý GĐ",
  accountant: "Kế toán",
  giaovien_congty: "Giáo viên công ty",
  giaovien_ctv: "Giáo viên CTV",
};

const ALL_ROLES = Object.keys(ROLE_LABELS);

/**
 * Chỉ hiện với tài khoản có role `dev` — cho tự chọn tổ hợp role để test,
 * gọi PATCH /employees/me/dev-roles (backend tự kiểm tra lại role `dev` trên
 * DB, không phải bypass toàn quyền: tài khoản vẫn chỉ có đúng role đang chọn).
 * Đổi role xong phải đăng nhập lại vì JWT là stateless, roles nằm trong token.
 */
export default function DevRoleSwitcher() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(() =>
    getEmployeeRoles().filter((r) => r !== "dev"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!hasRole("dev")) return null;

  const toggle = (role: string) => {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const apply = async () => {
    setSaving(true);
    setError("");
    try {
      await employeeApi.setDevRoles(selected);
      logout();
      window.location.href = "/";
    } catch (e: any) {
      setError(e?.response?.data?.message || "Đổi role thất bại");
      setSaving(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-3 z-50">
      {open ? (
        <div className="bg-white border rounded-2xl shadow-xl w-72 max-h-[70vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-purple-50">
            <h3 className="font-semibold text-purple-700 text-sm">
              🛠 Dev — chọn role để test
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-purple-100"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {ALL_ROLES.map((role) => (
              <label
                key={role}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(role)}
                  onChange={() => toggle(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
          {error && (
            <p className="px-4 text-xs text-red-500 pb-1">{error}</p>
          )}
          <div className="p-3 border-t">
            <button
              onClick={apply}
              disabled={saving}
              className="w-full py-2 text-sm rounded-xl text-white font-medium bg-purple-600 active:scale-95 disabled:opacity-60"
            >
              {saving ? "Đang đổi role…" : "Áp dụng & đăng nhập lại"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-purple-600 text-white shadow-xl flex items-center justify-center text-xl active:scale-95"
          title="Dev — chọn role"
        >
          🛠
        </button>
      )}
    </div>
  );
}
