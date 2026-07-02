import { useEffect, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { employeeApi } from "@/service/employee";

const ROLE_OPTIONS = [
  { value: "sales", label: "Nhân viên KD" },
  { value: "saleadmin", label: "Sale Admin" },
  { value: "salesadmin_la", label: "Sale Admin LA" },
  { value: "director", label: "Giám đốc" },
  { value: "director_la", label: "Giám đốc LA" },
  { value: "accountant", label: "Kế toán" },
  { value: "ketoan_congno", label: "KT công nợ" },
  { value: "ketoan_truong", label: "Kế toán trưởng" },
  { value: "troly_gd", label: "Trợ lý GĐ" },
  { value: "thuquy", label: "Thủ quỹ" },
  { value: "employee", label: "Nhân viên" },
  { value: "probation", label: "Thử việc" },
  { value: "employee_la", label: "Long An" },
];

const roleColor = (r: string) => {
  if (r === "employee" || r === "sales") return "bg-blue-100 text-blue-600";
  if (r === "probation") return "bg-yellow-100 text-yellow-700";
  if (r === "employee_la") return "bg-green-100 text-green-600";
  if (r === "director") return "bg-purple-100 text-purple-700";
  if (r === "director_la") return "bg-red-100 text-red-700";
  if (r === "saleadmin" || r === "salesadmin_la") return "bg-indigo-100 text-indigo-700";
  if (r === "accountant") return "bg-orange-100 text-orange-700";
  if (r === "ketoan_congno" || r === "thuquy" || r === "ketoan_truong" || r === "troly_gd")
    return "bg-teal-100 text-teal-700";
  return "bg-gray-100 text-gray-600";
};

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

type Employee = {
  id: number;
  name: string;
  phone: string;
  email: string;
  roles: string[];
};

const EMPTY_FORM = { name: "", phone: "", email: "", password: "", roles: [] as string[] };

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // single role assignment
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [pendingRoles, setPendingRoles] = useState<string[]>([]);

  // bulk role assignment
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRoles, setBulkRoles] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchData = async () => {
    try {
      const data = await employeeApi.getAll();
      setEmployees(data);
    } catch (err) {
      console.error("Load employees failed", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  // ── Create ──────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      await employeeApi.create({ ...form, departmentId: 1 });
      alert("Tạo nhân viên thành công");
      setShowCreateModal(false);
      setForm(EMPTY_FORM);
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join("\n") : msg || "Tạo nhân viên thất bại");
    }
  };

  // ── Single role assignment ───────────────────────────────
  const handleSaveRoles = async () => {
    if (!roleTarget) return;
    try {
      await employeeApi.update(roleTarget.id, { roles: pendingRoles });
      alert("Cập nhật quyền thành công");
      setRoleTarget(null);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Cập nhật thất bại");
    }
  };

  // ── Bulk role assignment ─────────────────────────────────
  const openBulkModal = () => {
    const commonRoles = (() => {
      const selected = employees.filter((e) => selectedIds.has(e.id));
      if (!selected.length) return [];
      return ROLE_OPTIONS.map((o) => o.value).filter((r) =>
        selected.every((e) => (e.roles ?? []).includes(r)),
      );
    })();
    setBulkRoles(commonRoles);
    setShowBulkModal(true);
  };

  const handleBulkSave = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => employeeApi.update(id, { roles: bulkRoles })),
      );
      alert(`Đã cập nhật quyền cho ${selectedIds.size} nhân viên`);
      setShowBulkModal(false);
      clearSelection();
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Cập nhật thất bại");
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Approve probation ────────────────────────────────────
  const handleApproveProbation = async (item: Employee) => {
    if (!window.confirm(`Chuyển ${item.name} thành nhân viên chính thức?`)) return;
    try {
      await employeeApi.update(item.id, { roles: ["employee"] });
      fetchData();
    } catch {
      alert("Cập nhật thất bại");
    }
  };

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = async (item: Employee) => {
    if (!window.confirm(`Xoá nhân viên ${item.name}?`)) return;
    try {
      await employeeApi.delete(item.id);
      fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Xoá thất bại");
    }
  };

  const toggleRole = (
    value: string,
    checked: boolean,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) =>
    setter((prev) =>
      checked ? [...prev, value] : prev.filter((r) => r !== value),
    );

  const hasSelected = selectedIds.size > 0;

  return (
    <div className="bg-gray-100 min-h-screen pb-32">
      <HeaderWithBack title="Quản lý nhân viên" />

      {/* ── Toolbar ── */}
      <div className="px-3 pt-[68px] pb-2 flex items-center gap-2">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-sm font-medium transition"
        >
          + Thêm nhân viên
        </button>

        {hasSelected && (
          <button
            onClick={openBulkModal}
            className="flex-shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition"
          >
            Phân quyền ({selectedIds.size})
          </button>
        )}

        {hasSelected && (
          <button
            onClick={clearSelection}
            className="text-gray-500 px-2 py-2 text-sm"
          >
            Bỏ chọn
          </button>
        )}
      </div>

      {/* ── 3-column grid ── */}
      <div className="px-3 grid grid-cols-3 gap-2">
        {employees.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const isProbation = item.roles?.includes("probation");

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col transition ${
                isSelected ? "ring-2 ring-indigo-400" : ""
              }`}
            >
              {/* ── Card header: avatar + checkbox ── */}
              <div
                className="relative flex flex-col items-center pt-3 pb-1 px-2 cursor-pointer"
                onClick={() => toggleSelect(item.id)}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${
                    isSelected ? "bg-indigo-100" : "bg-blue-50"
                  }`}
                >
                  {isSelected ? "✓" : "👤"}
                </div>

                <p className="text-xs font-semibold text-gray-800 mt-1.5 text-center leading-tight line-clamp-2 w-full">
                  {item.name}
                </p>

                <p className="text-[11px] text-gray-400 mt-0.5">{item.phone}</p>
              </div>

              {/* ── Roles ── */}
              <div className="px-2 pb-2 flex flex-wrap gap-0.5 justify-center min-h-[24px]">
                {(item.roles ?? []).length === 0 ? (
                  <span className="text-[11px] text-gray-300 italic">Chưa có</span>
                ) : (
                  (item.roles ?? []).map((r) => (
                    <span
                      key={r}
                      className={`text-[11px] px-1.5 py-[2px] rounded-full font-medium leading-tight ${roleColor(r)}`}
                    >
                      {roleLabel(r)}
                    </span>
                  ))
                )}
              </div>

              {/* ── Actions ── */}
              <div className="border-t border-gray-100 px-2 py-2 flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setRoleTarget(item);
                    setPendingRoles(item.roles ?? []);
                  }}
                  className="w-full py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-medium"
                >
                  Phân quyền
                </button>

                {isProbation && (
                  <button
                    onClick={() => handleApproveProbation(item)}
                    className="w-full py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium"
                  >
                    Duyệt
                  </button>
                )}

                <button
                  onClick={() => handleDelete(item)}
                  className="w-full py-1.5 text-red-400 border border-red-100 rounded-lg text-xs font-medium"
                >
                  Xoá
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white w-[90%] max-w-md rounded-2xl shadow-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold">Tạo nhân viên</h2>
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              <input placeholder="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-3 rounded-xl border" />
              <input placeholder="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full p-3 rounded-xl border" />
              <input type="password" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full p-3 rounded-xl border" />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full p-3 rounded-xl border" />
              <div className="border rounded-xl p-3">
                <p className="text-sm font-medium text-gray-600 mb-2">Chọn quyền</p>
                <div className="grid grid-cols-2 gap-1">
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(value)}
                        onChange={(e) => toggleRole(value, e.target.checked, (fn) => setForm((f) => ({ ...f, roles: typeof fn === "function" ? fn(f.roles) : fn })))}
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-200 py-3 rounded-xl text-sm">Huỷ</button>
              <button onClick={handleCreate} className="flex-1 bg-blue-500 text-white py-3 rounded-xl text-sm font-medium">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SINGLE ROLE MODAL ── */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRoleTarget(null)} />
          <div className="relative bg-white w-[90%] max-w-md rounded-2xl shadow-lg p-4 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Phân quyền</h2>
              <p className="text-sm text-gray-500">{roleTarget.name}</p>
            </div>
            <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
              {ROLE_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingRoles.includes(value)}
                    onChange={(e) => toggleRole(value, e.target.checked, setPendingRoles)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{value}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRoleTarget(null)} className="flex-1 bg-gray-200 py-3 rounded-xl text-sm">Huỷ</button>
              <button onClick={handleSaveRoles} className="flex-1 bg-indigo-500 text-white py-3 rounded-xl text-sm font-medium">Lưu quyền</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK ROLE MODAL ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBulkModal(false)} />
          <div className="relative bg-white w-[90%] max-w-md rounded-2xl shadow-lg p-4 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Phân quyền hàng loạt</h2>
              <p className="text-sm text-gray-500">{selectedIds.size} nhân viên được chọn</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-2 max-h-[80px] overflow-y-auto">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {employees
                  .filter((e) => selectedIds.has(e.id))
                  .map((e) => e.name)
                  .join(", ")}
              </p>
            </div>

            <div className="space-y-0.5 max-h-[45vh] overflow-y-auto">
              {ROLE_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkRoles.includes(value)}
                    onChange={(e) => toggleRole(value, e.target.checked, setBulkRoles)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{value}</p>
                  </div>
                </label>
              ))}
            </div>

            <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              Quyền đã chọn sẽ <strong>thay thế toàn bộ</strong> quyền hiện tại của các nhân viên được chọn.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 bg-gray-200 py-3 rounded-xl text-sm"
              >
                Huỷ
              </button>
              <button
                onClick={handleBulkSave}
                disabled={bulkLoading}
                className="flex-1 bg-indigo-500 disabled:bg-indigo-300 text-white py-3 rounded-xl text-sm font-medium"
              >
                {bulkLoading ? "Đang lưu..." : `Lưu cho ${selectedIds.size} NV`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
