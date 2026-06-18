import { useMemo, useState } from "react";

type Option = {
    id: number | string;
    name: string;
};

type Props = {
    label: string;
    placeholder: string;
    value: number | string | null;
    options: Option[];
    onChange: (val: any) => void;
    disabled?: boolean;
};

export default function MobileSelect({
    label,
    placeholder,
    value,
    options,
    onChange,
    disabled,
}: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selected = options.find((o) => o.id === value);

    const filteredOptions = useMemo(() => {
        if (!search) return options;
        return options.filter((o) =>
            o.name.toLowerCase().includes(search.toLowerCase())
        );
    }, [search, options]);

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
                        <input
                            placeholder="Tìm kiếm..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full px-3 py-2 mb-3 rounded-xl border bg-gray-50 text-sm"
                        />

                        {/* list */}
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {filteredOptions.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">
                                    Không có dữ liệu
                                </p>
                            )}

                            {filteredOptions.map((o) => {
                                const isActive = value === o.id;

                                return (
                                    <div
                                        key={o.id}
                                        onClick={() => {
                                            onChange(o.id);
                                            setOpen(false);
                                        }}
                                        className={`
                                            p-3 rounded-xl text-sm flex justify-between items-center
                                            transition
                                            ${isActive
                                                ? "bg-blue-50 text-blue-600 font-medium"
                                                : "hover:bg-gray-100"}
                                        `}
                                    >
                                        {o.name}

                                        {isActive && (
                                            <span className="text-blue-600">
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