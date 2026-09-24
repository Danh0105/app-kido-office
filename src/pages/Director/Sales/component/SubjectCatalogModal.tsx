import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Info,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import {
  subjectCatalogApi,
  type SubjectCatalog,
} from "@/service/subjectCatalog.api";

type StatusFilter = "all" | "active" | "inactive";

/**
 * Danh mục môn học — popup quản lý danh sách môn mà nhân viên kinh doanh được
 * chọn khi tạo môn học cho trường.
 *
 * ⚠️ Không phải môn học của trường (`/subjects`, có hợp đồng / số HS / số tiết).
 */
export default function SubjectCatalogModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [items, setItems] = useState<SubjectCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [formTarget, setFormTarget] = useState<SubjectCatalog | null | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<SubjectCatalog | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  // Debounce ô tìm kiếm ~300ms.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Esc để đóng — cùng thói quen với các popup khác.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Màn quản lý phải thấy cả môn đã ngừng dùng để bật lại được.
      const data = await subjectCatalogApi.list({
        includeInactive: true,
        search,
      });
      setItems(data);
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Không tải được danh mục môn học"));
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => item.isActive).length,
      inactive: items.filter((item) => !item.isActive).length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    if (status === "active") return items.filter((item) => item.isActive);
    if (status === "inactive") return items.filter((item) => !item.isActive);
    return items;
  }, [items, status]);

  const toggleActive = async (item: SubjectCatalog) => {
    setBusyId(item.id);
    try {
      await subjectCatalogApi.setActive(item.id, !item.isActive);
      toast.success(
        item.isActive
          ? `Đã ngừng dùng môn "${item.name}"`
          : `Đã bật lại môn "${item.name}"`,
      );
      load();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Cập nhật thất bại"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setBusyId(deleteTarget.id);
    setDeleteError("");
    try {
      await subjectCatalogApi.remove(deleteTarget.id);
      toast.success("Đã xoá môn khỏi danh mục");
      setDeleteTarget(null);
      load();
    } catch (error: any) {
      // 409: môn đang được trường dùng — backend nói rõ số lượng, giữ hộp thoại
      // lại và đổi hành động chính thành "Ngừng dùng".
      if (error?.response?.status === 409) {
        setDeleteError(
          getApiErrorMessage(error, "Môn này đang được sử dụng, không xoá được"),
        );
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá môn thất bại"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const rowProps = (item: SubjectCatalog) => ({
    item,
    busy: busyId === item.id,
    onEdit: () => setFormTarget(item),
    onToggle: () => toggleActive(item),
    onDelete: () => {
      setDeleteError("");
      setDeleteTarget(item);
    },
  });

  return (
    <div className="fixed inset-0 z-[55]">
      <style>{sheetKeyframes}</style>

      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div
        className="absolute inset-x-0 bottom-0 md:inset-0 md:m-auto md:h-[min(760px,88vh)] md:max-w-4xl bg-[#f8fafc] rounded-t-[28px] md:rounded-[24px] max-h-[94vh] flex flex-col shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] overflow-hidden ring-1 ring-white/20"
        style={{ animation: "catalogSheetIn .18s ease-out" }}
        role="dialog"
        aria-modal="true"
        aria-label="Quản lý danh mục môn học"
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* ===== TOOLBAR ===== */}
        <div className="relative pl-4 pr-14 md:px-6 py-4 border-b border-slate-200/80 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo tên hoặc mã môn…"
                className="w-full h-11 pl-10 pr-9 border border-slate-200 rounded-xl text-sm bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                  aria-label="Xoá từ khoá"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              onClick={() => setFormTarget(null)}
              className="h-11 flex items-center justify-center gap-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold active:scale-[.98] transition whitespace-nowrap shadow-lg shadow-indigo-600/20"
            >
              <Plus size={16} /> Thêm môn
            </button>

            <button
              onClick={onClose}
              className="absolute right-3 top-5 md:static md:h-11 md:w-11 w-8 h-8 shrink-0 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition"
              aria-label="Đóng"
            >
              <X size={19} />
            </button>
          </div>

          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-full sm:w-fit overflow-x-auto">
            {(
              [
                ["all", "Tất cả", counts.all],
                ["active", "Đang dùng", counts.active],
                ["inactive", "Ngừng dùng", counts.inactive],
              ] as [StatusFilter, string, number][]
            ).map(([value, label, count]) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  status === value
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                <span
                  className={`ml-1.5 ${
                    status === value ? "text-indigo-400" : "text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ===== DANH SÁCH ===== */}
        <div className="flex-1 overflow-y-auto min-h-[180px] px-4 md:px-6 py-4">
          {loading && (
            <div className="py-14 text-center">
              <div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 mt-3">Đang tải danh mục…</p>
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div className="py-14 px-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <BookMarked size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-700 mt-3">
                {search
                  ? "Không tìm thấy môn nào"
                  : status === "inactive"
                  ? "Không có môn nào đang ngừng dùng"
                  : "Danh mục đang trống"}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                {search
                  ? "Thử đổi từ khoá, hoặc thêm môn mới vào danh mục."
                  : "Thêm môn để nhân viên kinh doanh có thể chọn khi tạo môn học cho trường."}
              </p>
            </div>
          )}

          {!loading && visible.length > 0 && (
            <>
              {/* Desktop: bảng */}
              <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/90 sticky top-0 shadow-[0_1px_0_0_rgb(226_232_240)]">
                    <th className={thClass}>Tên môn</th>
                    <th className={thClass}>Mã</th>
                    <th className={`${thClass} text-right`}>Đang dùng</th>
                    <th className={thClass}>Trạng thái</th>
                    <th className={`${thClass} text-right`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 hover:bg-indigo-50/35 transition group"
                    >
                      <td className="px-6 py-2.5">
                        <p
                          className={`text-base font-semibold truncate max-w-[260px] ${
                            item.isActive ? "text-slate-800" : "text-slate-400"
                          }`}
                        >
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-2.5">
                        {item.code ? (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {item.code}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums">
                        <UsageCell count={item.usageCount} />
                      </td>
                      <td className="px-6 py-2.5">
                        <StatusBadge active={item.isActive} />
                      </td>
                      <td className="px-6 py-2.5">
                        <RowActions {...rowProps(item)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Mobile: thẻ */}
              <div className="md:hidden space-y-3">
                {visible.map((item) => (
                  <div key={item.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${item.isActive ? "border-slate-200" : "border-slate-200 opacity-75"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`font-semibold text-base truncate ${
                            item.isActive ? "text-slate-800" : "text-slate-400"
                          }`}
                        >
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.code && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {item.code}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {item.usageCount} môn học đang dùng
                          </span>
                        </div>
                      </div>
                      <StatusBadge active={item.isActive} />
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{item.description}</p>
                    )}
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <RowActions {...rowProps(item)} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <div className="px-4 md:px-6 py-3 border-t border-slate-200/80 bg-white">
          <p className="text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
            <Info size={14} className="text-indigo-500 shrink-0 mt-px" />
            <span>Môn <b className="text-slate-700">ngừng dùng</b> sẽ ẩn khỏi ô chọn, nhưng dữ liệu môn học đã tạo trước đó vẫn được giữ nguyên.</span>
          </p>
        </div>
      </div>

      {formTarget !== undefined && (
        <CatalogFormModal
          item={formTarget}
          onClose={() => setFormTarget(undefined)}
          onSaved={() => {
            setFormTarget(undefined);
            load();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Xoá môn khỏi danh mục"
          message={
            deleteError ? (
              <span className="text-red-600">{deleteError}</span>
            ) : (
              <>
                Xoá môn <b>{deleteTarget.name}</b> khỏi danh mục? Thao tác này
                không hoàn tác được.
              </>
            )
          }
          hint={
            deleteError
              ? 'Dùng "Ngừng dùng" để môn biến mất khỏi ô chọn mà vẫn giữ dữ liệu cũ.'
              : // Biết trước sẽ bị chặn thì nói luôn, đỡ bắt người dùng bấm rồi mới báo lỗi.
                deleteTarget.usageCount > 0
              ? `Đang có ${deleteTarget.usageCount} môn học của trường dùng môn này, nên nhiều khả năng hệ thống sẽ từ chối xoá. Cân nhắc dùng "Ngừng dùng".`
              : undefined
          }
          submitLabel={deleteError ? "Ngừng dùng" : "Xoá"}
          submitColor={deleteError ? "bg-amber-500" : "bg-red-500"}
          loading={busyId === deleteTarget.id}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError("");
          }}
          onSubmit={() => {
            if (deleteError) {
              toggleActive(deleteTarget);
              setDeleteTarget(null);
              setDeleteError("");
            } else {
              handleDelete();
            }
          }}
        />
      )}
    </div>
  );
}

const sheetKeyframes = `
@keyframes catalogSheetIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const thClass =
  "px-6 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide text-slate-500";

function UsageCell({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5 text-slate-700 font-semibold">
      <Users size={13} className="text-slate-400" />
      {count}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-[3px] rounded-full font-medium whitespace-nowrap ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />
      {active ? "Đang dùng" : "Ngừng dùng"}
    </span>
  );
}

function RowActions({
  item,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: SubjectCatalog;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton label="Sửa" onClick={onEdit} className="hover:text-slate-700">
        <Pencil size={15} />
      </IconButton>

      <IconButton
        label={item.isActive ? "Ngừng dùng" : "Bật lại"}
        onClick={onToggle}
        disabled={busy}
        className={item.isActive ? "hover:text-amber-600" : "hover:text-emerald-600"}
      >
        <Power size={15} />
      </IconButton>

      <IconButton
        label="Xoá"
        onClick={onDelete}
        disabled={busy}
        className="hover:text-red-600 hover:bg-red-50"
      >
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className = "",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      {children}
    </button>
  );
}

// ================= FORM =================

function CatalogFormModal({
  item,
  onClose,
  onSaved,
}: {
  /** null = thêm mới, có giá trị = sửa. */
  item: SubjectCatalog | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!item;

  const [name, setName] = useState(item?.name || "");
  const [code, setCode] = useState(item?.code || "");
  const [description, setDescription] = useState(item?.description || "");
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Vui lòng nhập tên môn");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };

      if (editing) {
        await subjectCatalogApi.update(item!.id, payload);
        toast.success("Đã cập nhật môn");
      } else {
        await subjectCatalogApi.create(payload);
        toast.success("Đã thêm môn vào danh mục");
      }

      onSaved();
    } catch (err: any) {
      // 409 trùng tên / trùng mã — backend nói rõ trùng với môn nào.
      const message = getApiErrorMessage(err, "Lưu môn thất bại");
      setError(message);
      if (err?.response?.status !== 403) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-900/40 backdrop-blur-[2px] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-slate-900/5"
        style={{ animation: "catalogSheetIn .18s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-indigo-500">Danh mục môn học</p>
            <h2 className="font-bold text-slate-900 mt-0.5">
              {editing ? "Chỉnh sửa môn học" : "Thêm môn học mới"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <FormRow label="Tên môn" required>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Robotics nâng cao"
              className={fieldClass}
            />
          </FormRow>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Mã môn" hint="Không bắt buộc, phải duy nhất.">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ROBO-ADV"
                className={`${fieldClass} font-mono`}
              />
            </FormRow>

            <FormRow label="Thứ tự" hint="Số nhỏ hiện trước.">
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={fieldClass}
              />
            </FormRow>
          </div>

          <FormRow label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Không bắt buộc"
              className={fieldClass}
            />
          </FormRow>

          <label className={`flex items-center justify-between gap-3 text-sm border rounded-xl px-3.5 py-3 cursor-pointer transition ${isActive ? "text-emerald-800 bg-emerald-50/70 border-emerald-200" : "text-slate-700 bg-slate-50 border-slate-200"}`}>
            <span className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className={isActive ? "text-emerald-600 mt-px" : "text-slate-400 mt-px"} />
              <span>
                {isActive ? "Đang sử dụng" : "Đang ngừng sử dụng"}
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {isActive ? "Có thể chọn môn này khi tạo hồ sơ cho trường." : "Môn này sẽ không xuất hiện trong danh sách chọn."}
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="peer sr-only"
            />
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
            </span>
          </label>

          {editing && item!.usageCount > 0 && (
            <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 leading-relaxed flex gap-2">
              <AlertTriangle size={15} className="text-amber-600 shrink-0" />
              <span>
              Đang có <b>{item!.usageCount}</b> môn học của trường dùng môn này.
              Đổi tên ở đây <b>không</b> đổi tên các môn học đã tạo trước đó.
              </span>
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 text-sm rounded-xl text-white font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition disabled:opacity-60 shadow-sm shadow-indigo-600/20"
          >
            {loading ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm môn"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldClass =
  "w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition";

function FormRow({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  hint,
  submitLabel,
  submitColor,
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  message: React.ReactNode;
  hint?: string;
  submitLabel: string;
  submitColor: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-900/40 backdrop-blur-[2px] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-900/5"
        style={{ animation: "catalogSheetIn .18s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 space-y-2.5">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          {hint && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
              {hint}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-sm rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className={`flex-1 py-2.5 text-sm rounded-xl text-white font-semibold active:scale-95 transition disabled:opacity-60 ${submitColor}`}
          >
            {loading ? "Đang xử lý…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
