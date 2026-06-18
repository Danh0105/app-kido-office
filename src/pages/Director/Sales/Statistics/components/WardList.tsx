import { useState, useMemo } from "react";
import SchoolList from "./SchoolList";

type Ward = {
    wardId: number;
    wardName: string;
    count: number;
    provinceId?: number;
};

interface Props {
    data: Ward[];
    schools: any[]; // Assuming this is the data for schools
    selectedProvince: number | null;
}

export default function WardList({ data, selectedProvince }: Props) {
    const [selectedWard, setSelectedWard] = useState<number | null>(null);

    // 🔥 filter theo tỉnh
    const wards = useMemo(() => {
        if (!selectedProvince) return data;
        return data.filter((w) => w.provinceId === selectedProvince);
    }, [data, selectedProvince]);

    if (!wards.length) {
        return (
            <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">
                Không có xã/phường
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h2 className="font-semibold text-lg">Xã / Phường</h2>

            {wards.map((w) => (
                <div key={w.wardId} className="bg-white rounded-xl shadow">
                    {/* Header */}
                    <div
                        onClick={() =>
                            setSelectedWard(selectedWard === w.wardId ? null : w.wardId)
                        }
                        className={`p-4 flex justify-between items-center cursor-pointer
              ${selectedWard === w.wardId ? "bg-blue-50" : ""}
              active:scale-[0.98] transition`}
                    >
                        <div>
                            <div className="font-medium">{w.wardName}</div>
                            <div className="text-sm text-gray-500">
                                {w.count} policies
                            </div>
                        </div>

                        <div className="text-blue-600 font-bold text-lg">
                            {w.count}
                        </div>
                    </div>

                    {/* Expand */}
                    {selectedWard === w.wardId && (
                        <div className="border-t p-3 bg-gray-50">
                            <SchoolList wardId={w.wardId} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}