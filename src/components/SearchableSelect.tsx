import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { matchesSearch } from "@/utils/text";

export type SelectOption = { id: number | string; name: string };

type Props = {
  /** Giá trị đang chọn, "" = chưa chọn. Dùng string để thay thẳng cho <select>. */
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Nhãn khi chưa chọn gì — cũng là dòng đầu để bỏ chọn. */
  placeholder?: string;
  /** Class của ô bấm, truyền y như class cũ của <select>. */
  className?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /**
   * Mở sẵn dropdown ngay khi hiện ra. Dùng khi select được bật lên từ một chỗ
   * bấm khác (sửa tại chỗ) — người dùng đã bấm một lần rồi, bắt bấm thêm lần
   * nữa để mở là thừa.
   */
  defaultOpen?: boolean;
  /** Render menu ra ngoài ancestor overflow (dùng trong bảng cuộn ngang). */
  portal?: boolean;
};

/**
 * Select có ô tìm kiếm — thay cho <select> khi danh mục dài (danh sách trường
 * đang hơn 200 mục, cuộn tay không tìm nổi).
 *
 * Tìm kiếm bỏ dấu tiếng Việt nên gõ không dấu vẫn ra kết quả.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— Chọn —",
  className = "",
  disabled = false,
  searchPlaceholder = "Tìm theo tên…",
  emptyLabel = "Không tìm thấy kết quả",
  defaultOpen = false,
  portal = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

  const selected = useMemo(
    () => options.find((option) => String(option.id) === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter((option) => matchesSearch(option.name, query));
  }, [options, query]);

  // Bấm ra ngoài hoặc Esc thì đóng, giống hành vi của <select>.
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

  // Mở ra là gõ tìm được ngay, không phải bấm thêm vào ô tìm kiếm.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

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

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {/* Ô bấm — dựng lại hình thức của <select> để các màn cũ không đổi bố cục */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white flex items-center gap-1 text-left disabled:bg-gray-50 disabled:text-gray-400 ${
          open ? "ring-1 ring-blue-400" : ""
        }`}
      >
        <span
          className={`flex-1 min-w-0 truncate ${
            selected ? "text-gray-800" : "text-gray-400"
          }`}
        >
          {selected ? selected.name : placeholder}
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
          className={`${portal ? "fixed z-[10050]" : "absolute z-30 mt-1 w-full"} min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden`}
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
            {/* Dòng bỏ chọn — tương ứng <option value=""> của select cũ */}
            <Row
              label={placeholder}
              muted
              active={value === ""}
              onClick={() => pick("")}
            />

            {filtered.map((option) => (
              <Row
                key={option.id}
                label={option.name}
                active={String(option.id) === value}
                onClick={() => pick(String(option.id))}
              />
            ))}

            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">
                {emptyLabel}
              </p>
            )}
          </div>

          {options.length > 0 && (
            <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">
              {query.trim()
                ? `${filtered.length}/${options.length} kết quả`
                : `${options.length} mục`}
            </p>
          )}
        </div>);
        return portal && menuRect ? createPortal(menu, document.body) : menu;
      })()}
    </div>
  );
}

function Row({
  label,
  active,
  muted,
  onClick,
}: {
  label: string;
  active: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 ${
        active ? "bg-blue-50 text-blue-700 font-medium" : ""
      } ${muted && !active ? "text-gray-400" : ""}`}
    >
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {active && <Check size={14} className="shrink-0" />}
    </button>
  );
}
