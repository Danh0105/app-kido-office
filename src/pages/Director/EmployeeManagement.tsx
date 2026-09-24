import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { employeeApi } from "@/service/employee";
import { teacherApi } from "@/service/teaching";
import type { Teacher } from "@/types/teaching";
import { getApiErrorMessage } from "@/utils/apiError";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import TeacherDetailModal from "./components/TeacherDetailModal";

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
  { value: "ky_thuat", label: "Phòng kỹ thuật" },
  { value: "nhansu", label: "Nhân sự" },
  { value: "giaovu", label: "Giáo vụ" },
  { value: "giaovien_congty", label: "Giáo viên công ty" },
  { value: "giaovien_ctv", label: "Giáo viên CTV" },
  { value: "employee", label: "Nhân viên" },
  { value: "probation", label: "Thử việc" },
  { value: "employee_la", label: "Long An" },
];

const CTV_ROLE = "giaovien_ctv";

type TabKey = "staff" | "ctv";

const TABS: { key: TabKey; label: string }[] = [
  { key: "staff", label: "Nhân viên" },
  { key: "ctv", label: "Giáo viên CTV" },
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
  if (r === "ky_thuat") return "bg-violet-100 text-violet-700";
  if (r === "nhansu" || r === "giaovu") return "bg-pink-100 text-pink-700";
  if (r === "giaovien_congty" || r === "giaovien_ctv") return "bg-cyan-100 text-cyan-700";
  return "bg-gray-100 text-gray-600";
};

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

type Employee = {
  id: number;
  name: string;
  phone: string;
  email: string;
  roles: string[];
  avatar?: string | null;
  avatarUrl?: string | null;
};

const EMPTY_FORM = { name: "", phone: "", email: "", password: "", roles: [] as string[] };

const employeeAvatarUrl = (employee: Employee) => {
  const raw = employee.avatarUrl || employee.avatar;
  return raw ? resolveApiFileUrl(raw) : null;
};

const employeeInitial = (employee: Employee) =>
  (employee.name || employee.email || "U").trim().charAt(0).toUpperCase() || "U";

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // tab + search + filter
  const [tab, setTab] = useState<TabKey>("staff");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // single role assignment
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [pendingRoles, setPendingRoles] = useState<string[]>([]);

  // bulk role assignment
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRoles, setBulkRoles] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // chi tiết giáo viên CTV
  const [detailTarget, setDetailTarget] = useState<Employee | null>(null);
  const [teacherByEmployee, setTeacherByEmployee] = useState<Map<number, Teacher>>(
    new Map(),
  );
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState("");
  const teacherLoadedRef = useRef(false);

  const fetchData = async () => {
    try {
      const data = await employeeApi.getAll();
      setEmployees(data);
    } catch (err) {
      console.error("Load employees failed", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /**
   * Hồ sơ giảng dạy nằm ở bảng `teachers`, khác bảng tài khoản — nạp một lần khi
   * mở tab CTV rồi tra theo `employeeId` để bật popup không phải chờ mạng.
   * Role không xem được module Giảng dạy sẽ nhận 403; giữ lỗi để popup báo rõ
   * thay vì hiện hồ sơ trống như thể giáo viên chưa khai gì.
   */
  const loadTeachers = async () => {
    if (teacherLoadedRef.current) return;
    teacherLoadedRef.current = true;
    setTeacherLoading(true);
    setTeacherError("");
    try {
      const map = new Map<number, Teacher>();
      let page = 1;
      let totalPages = 1;
      do {
        const res = await teacherApi.list({ teacherRole: CTV_ROLE, page, limit: 100 });
        (res?.data ?? []).forEach((t) => {
          if (t.employeeId) map.set(t.employeeId, t);
        });
        totalPages = res?.pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages && page <= 20);
      setTeacherByEmployee(map);
    } catch (err) {
      teacherLoadedRef.current = false; // cho phép thử lại lần mở tab sau
      setTeacherError(getApiErrorMessage(err, "Không tải được hồ sơ giáo viên"));
    } finally {
      setTeacherLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "ctv") loadTeachers();
  }, [tab]);

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

  // Giáo viên CTV đứng riêng một tab, tab nhân viên không hiển thị họ nữa.
  const tabEmployees = useMemo(() => {
    const isCtv = (e: Employee) => (e.roles ?? []).includes(CTV_ROLE);
    return employees.filter((e) => (tab === "ctv" ? isCtv(e) : !isCtv(e)));
  }, [employees, tab]);

  const tabCounts = useMemo(() => {
    const ctv = employees.filter((e) => (e.roles ?? []).includes(CTV_ROLE)).length;
    return { ctv, staff: employees.length - ctv };
  }, [employees]);

  // Chỉ liệt kê những chức vụ thực sự có trong tab đang xem.
  const roleFilterOptions = useMemo(() => {
    const present = new Set<string>();
    tabEmployees.forEach((e) => (e.roles ?? []).forEach((r) => present.add(r)));
    const known = ROLE_OPTIONS.filter(
      (o) => present.has(o.value) && !(tab === "ctv" && o.value === CTV_ROLE),
    );
    const unknown = [...present]
      .filter((r) => !ROLE_OPTIONS.some((o) => o.value === r) && r !== CTV_ROLE)
      .map((r) => ({ value: r, label: r }));
    return [...known, ...unknown];
  }, [tabEmployees, tab]);

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tabEmployees.filter((item) => {
      if (keyword) {
        const haystack = `${item.name ?? ""} ${item.phone ?? ""} ${item.email ?? ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (roleFilter === "__none__" && (item.roles ?? []).length > 0) return false;
      if (roleFilter && roleFilter !== "__none__" && !(item.roles ?? []).includes(roleFilter)) {
        return false;
      }
      return true;
    });
  }, [tabEmployees, search, roleFilter]);

  const hasFilter = !!search.trim() || !!roleFilter;
  const clearFilters = () => {
    setSearch("");
    setRoleFilter("");
  };

  const changeTab = (key: TabKey) => {
    if (key === tab) return;
    setTab(key);
    setRoleFilter("");
    clearSelection();
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-32">
      <HeaderWithBack title="Quản lý nhân viên" />

      {/* ── Tabs ── */}
      <div className="px-3 pt-[68px] pb-2 flex gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => changeTab(key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
              tab === key
                ? "bg-white text-blue-600 shadow-sm ring-1 ring-blue-200"
                : "bg-white/60 text-gray-500"
            }`}
          >
            {label}
            <span className="ml-1 text-[11px] font-normal text-gray-400">
              ({key === "ctv" ? tabCounts.ctv : tabCounts.staff})
            </span>
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <button
          onClick={() => {
            // Tạo từ tab CTV thì tick sẵn chức vụ Giáo viên CTV.
            setForm({ ...EMPTY_FORM, roles: tab === "ctv" ? [CTV_ROLE] : [] });
            setShowCreateModal(true);
          }}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-sm font-medium transition"
        >
          + Thêm {tab === "ctv" ? "giáo viên CTV" : "nhân viên"}
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

      {/* ── Search + filter ── */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, SĐT, email…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border text-sm bg-white"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="flex-shrink-0 py-2 px-2 rounded-xl border text-sm bg-white max-w-[140px]"
        >
          <option value="">Tất cả chức vụ</option>
          <option value="__none__">Chưa có chức vụ</option>
          {roleFilterOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="flex-shrink-0 text-gray-500 px-2 py-2 text-sm"
          >
            Xoá lọc
          </button>
        )}
      </div>

      {hasFilter && (
        <p className="px-3 pb-2 text-xs text-gray-500">
          {filteredEmployees.length}/{tabEmployees.length}{" "}
          {tab === "ctv" ? "giáo viên CTV" : "nhân viên"}
        </p>
      )}

      {!filteredEmployees.length && (
        <p className="px-3 py-8 text-center text-sm text-gray-400">
          {tabEmployees.length
            ? "Không tìm thấy kết quả phù hợp"
            : tab === "ctv"
              ? "Chưa có giáo viên CTV nào"
              : "Chưa có nhân viên nào"}
        </p>
      )}

      {/* ── 3-column grid ── */}
      <div className="px-3 grid grid-cols-3 gap-2">
        {filteredEmployees.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const isProbation = item.roles?.includes("probation");
          const avatarUrl = employeeAvatarUrl(item);

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
                onClick={() =>
                  tab === "ctv" ? setDetailTarget(item) : toggleSelect(item.id)
                }
              >
                {/* Tab CTV dùng cú chạm để mở hồ sơ, nên chọn hàng loạt tách ra ô tick riêng. */}
                {tab === "ctv" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    aria-label={isSelected ? "Bỏ chọn" : "Chọn"}
                    className={`absolute left-1.5 top-1.5 w-5 h-5 rounded-md border flex items-center justify-center text-[11px] leading-none ${
                      isSelected
                        ? "bg-indigo-500 border-indigo-500 text-white"
                        : "bg-white border-gray-300 text-transparent"
                    }`}
                  >
                    ✓
                  </button>
                )}

                <div className="relative w-12 h-12 shrink-0">
                  <div
                    className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold ${
                      isSelected ? "bg-indigo-100 text-indigo-700" : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={item.name ? `Avatar ${item.name}` : "Avatar nhân viên"}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span>{employeeInitial(item)}</span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white ring-2 ring-white">
                      ✓
                    </span>
                  )}
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

      {/* ── CTV DETAIL MODAL ── */}
      {detailTarget && (
        <TeacherDetailModal
          account={detailTarget}
          teacher={teacherByEmployee.get(detailTarget.id) ?? null}
          loading={teacherLoading}
          error={teacherError}
          roleLabel={roleLabel}
          roleColor={roleColor}
          onClose={() => setDetailTarget(null)}
          onAssignRoles={() => {
            setRoleTarget(detailTarget);
            setPendingRoles(detailTarget.roles ?? []);
            setDetailTarget(null);
          }}
        />
      )}

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
