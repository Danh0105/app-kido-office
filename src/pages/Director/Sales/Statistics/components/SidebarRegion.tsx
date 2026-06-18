import HeaderWithBack from "@/components/HeaderWithBack";
import { schoolApi } from "@/service/school.api";
import { wardApi } from "@/service/ward";
import { getEmployeeId } from "@/utils/auth";
import { useEffect, useMemo, useState } from "react";

export default function SidebarRegion({ employeeId, data, selected, onSelect, onSelectSchool }: any) {
    const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
    const [wards, setWards] = useState<any[]>([]);
    const [openProvince, setOpenProvince] = useState<number | null>(null);
    const [schools, setSchools] = useState<any[]>([]);
    const [selectedWard, setSelectedWard] = useState<number | null>(null);

    // ===== LOAD WARDS =====
    useEffect(() => {
        const fetchWards = async () => {
            const res = await wardApi.getByEmployee(Number(employeeId));
            console.log("res ward ", res)
            setWards(res || []);
        };
        fetchWards();
    }, []);
    const handleResetFilter = () => {
        setOpenProvince(null);
        setSelectedWard(null);
        setSelectedSchool(null);
        setSchools([]);

        onSelect?.(null);
        onSelectSchool?.(null);
    };
    // ===== CLICK PROVINCE =====
    const handleClickProvince = (provinceId: number) => {
        onSelect(provinceId);

        setOpenProvince((prev) =>
            prev === provinceId ? null : provinceId
        );

        // reset khi đổi province
        setSelectedWard(null);
        setSchools([]);
    };

    // ===== CLICK WARD =====
    const handleClickWard = async (wardId: number) => {
        setSelectedWard(wardId);

        const res = await schoolApi.getByEmployeeAndWard(
            Number(employeeId),
            wardId
        );

        setSchools(res || []);
    };

    // ===== GROUP WARD BY PROVINCE =====
    const wardMap = useMemo(() => {
        const map: Record<number, any[]> = {};

        wards.forEach((w: any) => {
            if (!map[w.province_id]) {
                map[w.province_id] = [];
            }
            map[w.province_id].push(w);
        });

        return map;
    }, [wards]);

    return (
        <div className="h-full overflow-y-auto bg-white border-r p-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">KV / Tỉnh / Thành</h2>

                <button
                    onClick={handleResetFilter}
                    className="
            px-3 py-1.5 text-xs rounded-lg
            bg-gray-100 hover:bg-red-100
            text-gray-700 hover:text-red-600
            transition-all duration-150
            border border-gray-200
        "
                >
                    Reset
                </button>
            </div>

            {data.map((p: any) => {
                const wardList = wardMap[p.provinceId] || [];

                return (
                    <div key={p.provinceId} className="mb-2">
                        {/* ===== PROVINCE ===== */}
                        <div
                            onClick={() => handleClickProvince(p.provinceId)}
                            className={`p-3 rounded-xl cursor-pointer flex justify-between items-center
                            ${selected === p.provinceId
                                    ? "bg-blue-100"
                                    : "hover:bg-gray-100"
                                }`}
                        >
                            <div>
                                <div className="font-medium">
                                    {p.provinceName}
                                </div>

                                <div className="flex gap-2 mt-1">
                                    <p className="text-xs px-2 py-0.5 bg-green-200 rounded-full text-center">
                                        🏫Số trường: {p.schoolCount}
                                    </p>
                                    <p className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-center">
                                        📄Số hợp đồng: {p.total}
                                    </p>
                                </div>
                            </div>

                            <span>
                                {openProvince === p.provinceId ? "▲" : "▼"}
                            </span>
                        </div>

                        {/* ===== WARD DROPDOWN ===== */}
                        {openProvince === p.provinceId && (
                            <div className="ml-4 mt-2 space-y-1 border-l-2 border-gray-300 pl-4 relative">
                                {wardList.map((w: any) => (
                                    <div key={w.id} className="relative">
                                        <div className="absolute -left-4 top-3 w-4 border-t-2 border-gray-300"></div>

                                        {/* ===== WARD ===== */}
                                        <div
                                            onClick={() => handleClickWard(w.id)}
                                            className={`p-2 rounded-lg cursor-pointer flex justify-between text-sm
                                            ${selectedWard === w.id
                                                    ? "bg-orange-200"
                                                    : "hover:bg-orange-200"
                                                }`}
                                        >
                                            <span>{w.name}</span>
                                            <span className="text-gray-500">
                                                {w.schoolcount}
                                            </span>
                                        </div>

                                        {/* ===== SCHOOL LIST ===== */}
                                        {selectedWard === w.id && (
                                            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4 relative">
                                                {schools.map((s: any) => (
                                                    <div
                                                        onClick={() => {
                                                            setSelectedSchool(s.id);
                                                            onSelectSchool?.(s.id);
                                                        }}
                                                        className={`
    group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer
    transition-all duration-150 active:scale-[0.98]

    ${selectedSchool === s.id
                                                                ? "bg-red-100 border border-red-300"
                                                                : "hover:bg-red-50"
                                                            }
`}
                                                    >
                                                        {/* gạch nối */}
                                                        <div className="w-3 h-px bg-gray-300 group-hover:bg-blue-400 transition" />

                                                        {/* tên school */}
                                                        <span
                                                            className="
                                                            cursor-pointer
                                                            text-sm text-gray-700
                                                            transition-all duration-150
                                                            hover:text-blue-600
                                                            hover:underline
                                                        "
                                                        >
                                                            {s.name}
                                                        </span>
                                                    </div>
                                                ))}

                                                {schools.length === 0 && (
                                                    <div className="text-xs text-gray-400">
                                                        Không có trường
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}