import { useMemo, useState } from "react";

export default function PolicyPopup({ data, onClose }: any) {
    const [tab, setTab] = useState<"tienmat" | "thietbi">("tienmat");

    const raw = data?.policyData;

    // 🔥 normalize
    const tienmat = useMemo(() => {
        if (!raw) return [];

        if (Array.isArray(raw)) return raw; // case bạn test

        return raw?.httienmat || [];
    }, [raw]);

    const thietbi = useMemo(() => {
        if (!raw) return [];

        if (Array.isArray(raw)) return []; // array hiện tại là tiền mặt

        return raw?.htthietbi || [];
    }, [raw]);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
            <div className="bg-white w-full md:w-[420px] rounded-t-2xl md:rounded-2xl p-4 space-y-4">

                {/* HEADER */}
                <div className="flex justify-between">
                    <p className="font-semibold">Chi tiết policy</p>
                    <button onClick={onClose}>✕</button>
                </div>

                {/* TAB */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab("tienmat")}
                        className={`px-3 py-1 rounded-full ${tab === "tienmat"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100"
                            }`}
                    >
                        Tiền mặt
                    </button>

                    <button
                        onClick={() => setTab("thietbi")}
                        className={`px-3 py-1 rounded-full ${tab === "thietbi"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100"
                            }`}
                    >
                        Thiết bị
                    </button>
                </div>

                {/* CONTENT */}
                <div className="max-h-[300px] overflow-auto space-y-2">

                    {/* ===== TIỀN MẶT ===== */}
                    {tab === "tienmat" &&
                        (tienmat.length ? (
                            tienmat.map((i: any, idx: number) => (
                                <div key={idx} className="bg-green-50 p-3 rounded-xl">
                                    <div className="flex justify-between">
                                        <span className="font-medium">{i.type}</span>
                                        <span className="font-semibold text-green-600">
                                            {i.money?.toLocaleString()}đ
                                        </span>
                                    </div>

                                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                                        <span>{i.months} tháng</span>
                                        <span>{i.students} HS</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-400 text-sm">
                                Không có dữ liệu
                            </div>
                        ))}

                    {/* ===== THIẾT BỊ ===== */}
                    {tab === "thietbi" &&
                        (thietbi.length ? (
                            thietbi.map((i: any, idx: number) => (
                                <div key={idx} className="bg-blue-50 p-3 rounded-xl space-y-1">
                                    <div className="font-medium">
                                        📺 {i.category}
                                    </div>

                                    <div className="text-sm text-gray-700">
                                        Số lượng: {i.qty}
                                    </div>

                                    <div className="text-sm text-gray-700">
                                        Giá: {i.price?.toLocaleString()}đ
                                    </div>

                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>{i.months} tháng</span>
                                        <span>{i.students} HS</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-gray-400 text-sm">
                                Không có dữ liệu thiết bị
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}