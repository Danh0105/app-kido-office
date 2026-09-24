import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

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
    icon?: ReactNode;
    step?: number;
    hint?: string;
};

export default function MobileSelect({
    label,
    placeholder,
    value,
    options,
    onChange,
    disabled,
    icon,
    step,
    hint,
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
        <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
            </div>

            {/* trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(true)}
                className={`
                    w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl border flex justify-between items-center text-left
                    transition-all active:scale-[0.99]
                    ${disabled
                        ? "border-slate-100 bg-slate-50 text-slate-400"
                        : selected
                            ? "border-blue-200 bg-blue-50/60 shadow-sm shadow-blue-100"
                            : "border-slate-200 bg-white shadow-sm hover:border-blue-200"}
                `}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {selected ? <Check size={16} strokeWidth={2.5} /> : icon || step}
                    </span>
                    <span className={`truncate text-sm ${selected ? "font-semibold text-slate-900" : "text-slate-400"}`}>
                        {selected?.name || placeholder}
                    </span>
                </span>
                <ChevronDown size={18} className="ml-2 shrink-0 text-slate-400" />
            </button>

            {/* modal */}
            {open && (
                <div className="fixed inset-0 z-50">
                    {/* overlay */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setOpen(false)}
                    />

                    {/* sheet */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[78vh] flex flex-col animate-slideUp shadow-2xl">
                        {/* handle */}
                        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />

                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                {step && <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Bước {step}</p>}
                                <h3 className="text-lg font-bold text-slate-900">Chọn {label.toLowerCase()}</h3>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label="Đóng">
                                <X size={18} />
                            </button>
                        </div>

                        {/* search */}
                        <div className="relative mb-3">
                            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input placeholder={`Tìm ${label.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" autoFocus />
                        </div>

                        {/* list */}
                        <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
                            {filteredOptions.length === 0 && (
                                <p className="col-span-2 py-6 text-center text-sm text-gray-400">
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
                                            setSearch("");
                                            setOpen(false);
                                        }}
                                        className={`
                                            min-h-[58px] p-3 rounded-2xl border text-sm flex gap-2 justify-between items-center cursor-pointer
                                            transition
                                            ${isActive
                                                ? "border-blue-200 bg-blue-50 text-blue-600 font-semibold"
                                                : "border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100"}
                                        `}
                                    >
                                        <span className="line-clamp-2">{o.name}</span>

                                        {isActive && (
                                            <Check size={18} className="text-blue-600" />
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
