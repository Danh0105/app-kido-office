import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { matchesSearch } from "@/utils/text";

export type MultiSelectOption = { id: number; name: string };

type Props = {
  /** ID đang chọn. Mảng rỗng = chưa chọn gì. */
  values: number[];
  onChange: (next: number[]) => void;
  options: MultiSelectOption[];
  /** Nhãn ô bấm khi chưa chọn gì. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Hiện khi đã tải xong mà danh mục rỗng. */
  noOptionLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Render menu ra body (position fixed) để không bị vùng cuộn của modal cắt. */
  portal?: boolean;
};

/**
 * Chọn nhiều mục từ một danh mục dài — bản nhiều lựa chọn của
 * [SearchableSelect](./SearchableSelect.tsx), giữ nguyên hình thức để các form
 * dùng lẫn hai loại không bị lệch bố cục.
 *
 * Bấm một dòng chỉ bật/tắt dòng đó, dropdown **không đóng** — chọn 5 trường mà
 * phải mở lại 5 lần thì không dùng được. Mục đã chọn hiện thành chip bên dưới
 * để thấy hết lựa chọn mà không cần mở dropdown.
 */
export default function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "— Chọn —",
  searchPlaceholder = "Tìm theo tên…",
  emptyLabel = "Không tìm thấy kết quả",
  noOptionLabel = "Chưa có dữ liệu",
  loading = false,
  disabled = false,
  className = "",
  portal = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !portal) return;
    const update = () => setMenuRect(boxRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, portal]);

  const picked = useMemo(() => new Set(values), [values]);

  /**
   * Chip hiển thị theo đúng thứ tự đã chọn. ID không có trong `options` vẫn
   * hiện `#id` thay vì biến mất — mục bị ngừng sử dụng không được lặng lẽ mất
   * khỏi form rồi bị xoá lúc lưu.
   */
  const selected = useMemo(
    () =>
      values.map((id) => ({
        id,
        name: options.find((option) => option.id === id)?.name || `#${id}`,
      })),
    [values, options],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter((option) => matchesSearch(option.name, query));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const toggle = (id: number) =>
    onChange(
      picked.has(id) ? values.filter((item) => item !== id) : [...values, id],
    );

  /** Chọn hết kết quả đang lọc — gộp với lựa chọn cũ, không ghi đè. */
  const addFiltered = () =>
    onChange(
      Array.from(new Set([...values, ...filtered.map((option) => option.id)])),
    );

  return (
    <div className={className}>
      <div ref={boxRef} className="relative">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full px-3 py-2 border rounded-lg text-sm bg-white flex items-center gap-1 text-left disabled:bg-gray-50 disabled:text-gray-400 ${
            open ? "ring-1 ring-blue-400" : ""
          }`}
        >
          <span
            className={`flex-1 min-w-0 truncate ${
              values.length > 0 ? "text-gray-800" : "text-gray-400"
            }`}
          >
            {loading
              ? "Đang tải…"
              : values.length > 0
              ? `Đã chọn ${values.length}`
              : placeholder}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-gray-400 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (() => {
          const menu = (
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className={`${portal ? "fixed z-[100]" : "absolute z-30 mt-1 w-full"} min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden`}
            style={portal && menuRect ? {
              left: Math.min(menuRect.left, window.innerWidth - Math.max(220, menuRect.width) - 8),
              top: menuRect.bottom + 4,
              width: Math.max(220, menuRect.width),
            } : undefined}
          >
            <div className="p-2 border-b border-gray-100 flex items-center gap-2">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 min-w-0 text-sm outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 ${
                    picked.has(option.id) ? "bg-blue-50 text-blue-700 font-medium" : ""
                  }`}
                >
                  <span
                    className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                      picked.has(option.id)
                        ? "bg-blue-500 border-blue-500 text-white"
                        : "border-gray-300"
                    }`}
                  >
                    {picked.has(option.id) && <Check size={12} />}
                  </span>
                  <span className="flex-1 min-w-0 truncate">{option.name}</span>
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">
                  {options.length === 0 ? noOptionLabel : emptyLabel}
                </p>
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-gray-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-400">
                {query.trim()
                  ? `${filtered.length}/${options.length} kết quả`
                  : `Đã chọn ${values.length}/${options.length}`}
              </span>
              <span className="flex gap-2">
                {filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={addFiltered}
                    className="text-[11px] text-blue-600 font-medium"
                  >
                    {query.trim() ? "Chọn kết quả" : "Chọn tất cả"}
                  </button>
                )}
                {values.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-[11px] text-gray-500 underline"
                  >
                    Bỏ hết
                  </button>
                )}
              </span>
            </div>
          </div>);
          return portal && menuRect ? createPortal(menu, document.body) : menu;
        })()}
      </div>

      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item.id}
              className="inline-flex max-w-full items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs"
            >
              <span className="min-w-0 truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="shrink-0 text-blue-400 hover:text-red-500"
                title="Bỏ chọn"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
