import { useState, useMemo, useRef, useEffect } from "react";

type Props<T> = {
    data: T[];
    value: string;
    onChange: (val: string) => void;

    getLabel: (item: T) => string;
    getValue: (item: T) => string;

    placeholder?: string;
    disabled?: boolean;
};

export default function SearchSelect<T>({
    data,
    value,
    onChange,
    getLabel,
    getValue,
    placeholder = "Chọn...",
    disabled = false
}: Props<T>) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightIndex, setHighlightIndex] = useState(0);

    const ref = useRef<HTMLDivElement>(null);

    // FILTER
    const filtered = useMemo(() => {
        return data.filter(item =>
            (getLabel(item) || "")
                .toLowerCase()
                .includes(search.toLowerCase())
        );
    }, [data, search]);

    // SELECTED
    const selected = data.find(e => getValue(e) === value);

    // CLICK OUTSIDE
    useEffect(() => {
        const handleClickOutside = (e: any) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // KEYBOARD
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open) return;

        if (e.key === "ArrowDown") {
            setHighlightIndex(prev =>
                prev < filtered.length - 1 ? prev + 1 : prev
            );
        }

        if (e.key === "ArrowUp") {
            setHighlightIndex(prev => (prev > 0 ? prev - 1 : 0));
        }

        if (e.key === "Enter") {
            const item = filtered[highlightIndex];
            if (item) {
                onChange(getValue(item));
                setOpen(false);
                setSearch("");
            }
        }

        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <div ref={ref} className="relative">
            {/* SELECT BOX */}
            <div
                onClick={() => {
                    if (disabled) return;
                    setOpen(prev => !prev);
                }}
                className={`border rounded-lg px-3 py-2 flex items-center justify-between transition
                    ${disabled
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-white cursor-pointer hover:border-blue-400"
                    }
                `}
            >
                <span className={selected ? "text-black" : "text-gray-400"}>
                    {selected
                        ? getLabel(selected)
                        : disabled
                            ? "Chọn trước..."
                            : placeholder}
                </span>

                <span className={`transition ${open ? "rotate-180" : ""}`}>
                    ▼
                </span>
            </div>

            {/* DROPDOWN */}
            {open && !disabled && (
                <div className="absolute z-[9999] mt-2 w-full bg-white border rounded-xl shadow-lg overflow-hidden">

                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setHighlightIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Tìm kiếm..."
                        className="w-full p-2 border-b outline-none"
                    />

                    <div className="max-h-56 overflow-y-auto">
                        {filtered.length === 0 && (
                            <div className="p-3 text-sm text-gray-400 text-center">
                                Không tìm thấy
                            </div>
                        )}

                        {filtered.map((item, index) => {
                            const isSelected = getValue(item) === value;
                            const isActive = index === highlightIndex;

                            return (
                                <div
                                    key={getValue(item)}
                                    onClick={() => {
                                        onChange(getValue(item));
                                        setOpen(false);
                                        setSearch("");
                                    }}
                                    className={`px-3 py-2 text-sm flex justify-between items-center cursor-pointer
                                        ${isActive ? "bg-blue-50" : ""}
                                        ${isSelected ? "font-semibold text-blue-600" : ""}
                                        hover:bg-blue-50
                                    `}
                                >
                                    {getLabel(item)}
                                    {isSelected && "✓"}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}