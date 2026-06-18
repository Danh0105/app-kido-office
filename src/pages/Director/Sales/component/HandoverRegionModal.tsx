import React, { useEffect, useState } from "react";
import { employeeApi } from "@/service/employee";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";

type Props = {
    onClose: () => void;
    employees: any[];
};

export default function HandoverRegionModal({
    onClose,
    employees,
}: Props) {

    const [fromEmployeeId, setFromEmployeeId] =
        useState<number | null>(null);

    const [toEmployeeId, setToEmployeeId] =
        useState<number | null>(null);

    const [loading, setLoading] =
        useState(false);

    const [provinces, setProvinces] =
        useState<any[]>([]);

    const [wardsByProvince, setWardsByProvince] =
        useState<Record<number, any[]>>({});

    const [expandedProvinces, setExpandedProvinces] =
        useState<number[]>([]);

    const [selectedProvinceIds, setSelectedProvinceIds] =
        useState<number[]>([]);

    const [selectedWardIds, setSelectedWardIds] =
        useState<number[]>([]);

    // load province của nhân viên bàn giao
    useEffect(() => {

        if (!fromEmployeeId) {
            setProvinces([]);
            return;
        }

        loadRegions();

    }, [fromEmployeeId]);

    const loadRegions = async () => {

        try {
            if (!fromEmployeeId) return;
            const provinceData =
                await provinceApi.getProvincesByEmployee(
                    fromEmployeeId
                );

            setProvinces(provinceData);

        } catch (err) {
            console.error(err);
        }
    };

    const fetchWards = async (
        provinceId: number
    ) => {

        if (wardsByProvince[provinceId]) {
            return;
        }

        try {
            if (!fromEmployeeId) return;
            const data =
                await wardApi.getByEmployee(
                    fromEmployeeId
                );

            const filtered =
                data.filter(
                    (w: any) =>
                        w.province_id ===
                        provinceId
                );

            setWardsByProvince((prev) => ({
                ...prev,
                [provinceId]: filtered,
            }));

        } catch (err) {
            console.error(err);
        }
    };

    const toggleProvince = async (
        provinceId: number
    ) => {

        const active =
            selectedProvinceIds.includes(
                provinceId
            );

        if (active) {

            setSelectedProvinceIds((prev) =>
                prev.filter(
                    (x) => x !== provinceId
                )
            );

        } else {

            setSelectedProvinceIds((prev) => [
                ...prev,
                provinceId,
            ]);
        }

        const expanded =
            expandedProvinces.includes(
                provinceId
            );

        if (expanded) {

            setExpandedProvinces((prev) =>
                prev.filter(
                    (x) => x !== provinceId
                )
            );

        } else {

            setExpandedProvinces((prev) => [
                ...prev,
                provinceId,
            ]);

            await fetchWards(provinceId);
        }
    };

    const toggleWard = (
        wardId: number
    ) => {

        setSelectedWardIds((prev) =>
            prev.includes(wardId)
                ? prev.filter(
                    (x) => x !== wardId
                )
                : [...prev, wardId]
        );
    };

    const handleSubmit = async () => {

        try {

            if (!fromEmployeeId) {
                alert(
                    "Chọn nhân viên bàn giao"
                );
                return;
            }

            if (!toEmployeeId) {
                alert(
                    "Chọn nhân viên nhận"
                );
                return;
            }

            if (
                fromEmployeeId ===
                toEmployeeId
            ) {
                alert(
                    "Không thể bàn giao cho chính mình"
                );
                return;
            }

            if (
                selectedProvinceIds.length === 0 &&
                selectedWardIds.length === 0
            ) {
                alert(
                    "Chọn khu vực cần bàn giao"
                );
                return;
            }

            setLoading(true);

            await provinceApi.handoverRegion({
                fromEmployeeId,
                toEmployeeId,
                provinceIds:
                    selectedProvinceIds,
                wardIds:
                    selectedWardIds,
            });

            alert(
                "Bàn giao khu vực thành công"
            );

            onClose();

        } catch (err: any) {

            console.error(err);

            alert(
                err?.response?.data?.message ||
                "Bàn giao thất bại"
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">

            <div className="bg-white w-[95%] max-w-md rounded-2xl p-5">

                <h2 className="text-xl font-semibold text-center mb-5">
                    Bàn giao khu vực
                </h2>

                {/* FROM */}
                <div className="mb-4">

                    <p className="font-medium mb-2">
                        Nhân viên bàn giao
                    </p>

                    <select
                        value={
                            fromEmployeeId || ""
                        }
                        onChange={(e) =>
                            setFromEmployeeId(
                                Number(
                                    e.target.value
                                )
                            )
                        }
                        className="w-full border rounded-xl p-3"
                    >
                        <option value="">
                            -- Chọn --
                        </option>

                        {employees.map((emp) => (
                            <option
                                key={emp.id}
                                value={emp.id}
                            >
                                {emp.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* TO */}
                <div className="mb-5">

                    <p className="font-medium mb-2">
                        Nhân viên nhận
                    </p>

                    <select
                        value={
                            toEmployeeId || ""
                        }
                        onChange={(e) =>
                            setToEmployeeId(
                                Number(
                                    e.target.value
                                )
                            )
                        }
                        className="w-full border rounded-xl p-3"
                    >
                        <option value="">
                            -- Chọn --
                        </option>

                        {employees
                            .filter(
                                (e) =>
                                    e.id !==
                                    fromEmployeeId
                            )
                            .map((emp) => (
                                <option
                                    key={emp.id}
                                    value={emp.id}
                                >
                                    {emp.name}
                                </option>
                            ))}
                    </select>
                </div>

                {/* REGION */}
                <div>

                    <p className="font-medium mb-3">
                        Chọn khu vực bàn giao
                    </p>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto">

                        {provinces.map(
                            (province) => {

                                const expanded =
                                    expandedProvinces.includes(
                                        province.id
                                    );

                                const provinceSelected =
                                    selectedProvinceIds.includes(
                                        province.id
                                    );

                                const wards =
                                    wardsByProvince[
                                    province.id
                                    ] || [];

                                return (
                                    <div
                                        key={
                                            province.id
                                        }
                                        className="border rounded-2xl overflow-hidden"
                                    >

                                        {/* PROVINCE */}
                                        <div
                                            onClick={() =>
                                                toggleProvince(
                                                    province.id
                                                )
                                            }
                                            className={`p-4 cursor-pointer flex items-center justify-between
                                            ${provinceSelected
                                                    ? "bg-blue-100"
                                                    : "bg-white"
                                                }`}
                                        >

                                            <span className="font-medium">
                                                {
                                                    province.name
                                                }
                                            </span>

                                            <span>
                                                {expanded
                                                    ? "▲"
                                                    : "▼"}
                                            </span>
                                        </div>

                                        {/* WARDS */}
                                        {expanded && (
                                            <div className="bg-gray-50 border-t p-3 space-y-2">

                                                {wards.map(
                                                    (
                                                        ward: any
                                                    ) => {

                                                        const active =
                                                            selectedWardIds.includes(
                                                                ward.id
                                                            );

                                                        return (
                                                            <div
                                                                key={
                                                                    ward.id
                                                                }
                                                                onClick={() =>
                                                                    toggleWard(
                                                                        ward.id
                                                                    )
                                                                }
                                                                className={`p-3 rounded-xl border cursor-pointer
                                                                ${active
                                                                        ? "bg-green-100 border-green-500"
                                                                        : "bg-white"
                                                                    }`}
                                                            >
                                                                {
                                                                    ward.name
                                                                }
                                                            </div>
                                                        );
                                                    }
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        )}
                    </div>
                </div>

                {/* ACTION */}
                <div className="flex gap-3 mt-5">

                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-300 py-3 rounded-xl"
                    >
                        Huỷ
                    </button>

                    <button
                        disabled={loading}
                        onClick={handleSubmit}
                        className="flex-1 bg-green-500 text-white py-3 rounded-xl"
                    >
                        {loading
                            ? "Đang bàn giao..."
                            : "Xác nhận"}
                    </button>
                </div>
            </div>
        </div>
    );
}