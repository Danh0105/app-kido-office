import { useEffect, useMemo, useRef, useState } from "react";
import { rankSearchKey, toSearchKey } from "@/utils/text";

type Option = {
    id: number | string;
    name: string;
    /** Dòng phụ dưới tên (vd địa chỉ trường) — phân biệt các mục trùng tên. */
    description?: string;
    /** Chữ được tìm thêm nhưng không hiển thị (vd tên xã/phường). */
    keywords?: string;
};

type Props = {
    label: string;
    placeholder: string;
    value: number | string | null;
    options: Option[];
    onChange: (val: any) => void;
    disabled?: boolean;
    searchPlaceholder?: string;
};

// Danh sách ngắn (năm học, tỉnh...) thì không bật bàn phím sẵn — bàn phím
// che mất danh sách trong khi chỉ cần bấm chọn.
const AUTO_FOCUS_MIN_OPTIONS = 8;

export default function MobileSelect({
    label,
    placeholder,
    value,
    options,
    onChange,
    disabled,
    searchPlaceholder = "Tìm kiếm...",
}: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);

    // API có nơi trả id dạng number, có nơi trả chuỗi từ raw query. So sánh
    // theo chuỗi để giá trị đã chọn vẫn hiện đúng dù kiểu dữ liệu khác nhau.
    const selected = options.find((o) => String(o.id) === String(value));

    // Tính sẵn khoá tìm kiếm mỗi khi danh sách đổi, không tính lại theo từng phím gõ.
    const indexed = useMemo(
        () =>
            options.map((option, index) => ({
                option,
                index,
                nameKey: toSearchKey(option.name),
                extraKey: toSearchKey(`${option.description ?? ""} ${option.keywords ?? ""}`),
            })),
        [options],
    );

    const filteredOptions = useMemo(() => {
        const queryKey = toSearchKey(search);
        if (!queryKey) return options;

        return indexed
            .map((item) => ({ ...item, rank: rankSearchKey(item.nameKey, queryKey, item.extraKey) }))
            .filter((item) => item.rank !== null)
            .sort((a, b) => a.rank! - b.rank! || a.index - b.index)
            .map((item) => item.option);
    }, [search, indexed, options]);

    useEffect(() => {
        if (!open) {
            setSearch("");
            return;
        }
        if (options.length < AUTO_FOCUS_MIN_OPTIONS) return;

        // Chờ sheet trượt lên xong mới focus, tránh giật khung khi bàn phím bật.
        const timer = setTimeout(() => searchRef.current?.focus(), 250);
        return () => clearTimeout(timer);
    }, [open, options.length]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);

    const pick = (option: Option) => {
        onChange(option.id);
        setOpen(false);
    };

    return (
        <div className="space-y-1">
            <p className="text-xs text-gray-500">{label}</p>

            {/* trigger */}
            <div
                onClick={() => !disabled && setOpen(true)}
                className={`
                    w-full px-4 py-3 rounded-2xl border flex justify-between items-center
                    transition active:scale-[0.98]
                    ${disabled
                        ? "bg-gray-100 text-gray-400"
                        : "bg-white shadow-sm"}
                `}
            >
                <span className={selected ? "text-black" : "text-gray-400"}>
                    {selected?.name || placeholder}
                </span>
                <span className="text-gray-400">▾</span>
            </div>

            {/* modal */}
            {open && (
                <div className="fixed inset-0 z-50">
                    {/* overlay */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setOpen(false)}
                    />

                    {/* sheet */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-4 max-h-[75vh] flex flex-col animate-slideUp">
                        {/* handle */}
                        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />

                        <h3 className="font-semibold mb-2">{label}</h3>

                        {/* search */}
                        <div className="relative mb-1">
                            <input
                                ref={searchRef}
                                type="search"
                                enterKeyHint="go"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    // Enter chọn luôn kết quả khớp nhất.
                                    if (e.key === "Enter" && search.trim() && filteredOptions[0]) {
                                        e.preventDefault();
                                        pick(filteredOptions[0]);
                                    }
                                }}
                                className="w-full pl-3 pr-9 py-2 rounded-xl border bg-gray-50 text-sm [&::-webkit-search-cancel-button]:hidden"
                            />
                            {search && (
                                <button
                                    type="button"
                                    aria-label="Xoá từ khoá"
                                    onClick={() => {
                                        setSearch("");
                                        searchRef.current?.focus();
                                    }}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-gray-400 active:bg-gray-200"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {options.length > 0 && (
                            <p className="text-[11px] text-gray-400 mb-2 px-1">
                                {search.trim()
                                    ? `${filteredOptions.length}/${options.length} kết quả`
                                    : `${options.length} mục`}
                            </p>
                        )}

                        {/* list */}
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {filteredOptions.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">
                                    {search.trim()
                                        ? `Không tìm thấy "${search.trim()}"`
                                        : "Không có dữ liệu"}
                                </p>
                            )}

                            {filteredOptions.map((o) => {
                                const isActive = String(value) === String(o.id);

                                return (
                                    <div
                                        key={o.id}
                                        onClick={() => pick(o)}
                                        className={`
                                            p-3 rounded-xl text-sm flex justify-between items-center gap-2
                                            transition
                                            ${isActive
                                                ? "bg-blue-50 text-blue-600 font-medium"
                                                : "hover:bg-gray-100"}
                                        `}
                                    >
                                        <div className="min-w-0">
                                            <p>{o.name}</p>
                                            {o.description && (
                                                <p className="text-xs text-gray-400 font-normal truncate">
                                                    {o.description}
                                                </p>
                                            )}
                                        </div>

                                        {isActive && (
                                            <span className="text-blue-600 shrink-0">
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* animation */}
            <style>
                {`
                @keyframes slideUp {
                    from {
                        transform: translateY(100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
                .animate-slideUp {
                    animation: slideUp 0.25s ease-out;
                }
                `}
            </style>
        </div>
    );
}
