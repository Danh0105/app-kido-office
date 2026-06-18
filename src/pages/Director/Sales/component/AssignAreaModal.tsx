import React, { useEffect, useState } from "react";
import { provinceApi } from "@/service/province";
import { employeeApi } from "@/service/employee";
import { wardApi } from "@/service/ward";

type Props = {
  onClose: () => void;
  employees: any[];
};

export default function AssignAreaModal({ onClose, employees }: Props) {
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [wards, setWards] = useState<any[]>([]);

  const [provinces, setProvinces] = useState<any[]>([]);
  const [wardsByProvince, setWardsByProvince] = useState<Record<number, any[]>>(
    {},
  );
  const [assignedWardIds, setAssignedWardIds] = useState<number[]>([]);
  const [expandedProvinces, setExpandedProvinces] = useState<number[]>([]);

  const [selectedProvinceIds, setSelectedProvinceIds] = useState<number[]>([]);
  const [selectedWardIds, setSelectedWardIds] = useState<number[]>([]);
  useEffect(() => {
    fetchProvinces();
  }, []);
  const fetchWards = async (provinceId: number, force = false) => {
    if (wardsByProvince[provinceId] && !force) {
      return;
    }

    try {
      const data = await wardApi.getByProvince(provinceId);
      const grouped = Object.values(
        data.reduce((acc: any, item: any) => {
          if (!acc[item.id]) {
            acc[item.id] = {
              id: item.id,
              name: item.name,
              employees: [],
            };
          }

          if (item.employee) {
            acc[item.id].employees.push(item.employee);
          }

          return acc;
        }, {}),
      );
      setWardsByProvince((prev) => ({
        ...prev,
        [provinceId]: grouped,
      }));
    } catch (err) {
      console.error(err);
    }
  };
  const fetchProvinces = async () => {
    try {
      const data = await provinceApi.getAll();
      setProvinces(data);
    } catch (err) {
      console.error(err);
    }
  };
  useEffect(() => {
    if (!selectedEmployee) {
      setAssignedWardIds([]);
      return;
    }

    loadAssignedWards();
  }, [selectedEmployee]);
  const loadAssignedWards = async () => {
    try {
      if (!selectedEmployee) return;
      const data = await wardApi.getByEmployee(selectedEmployee);

      const ids = data.map((w: any) => w.id);

      setAssignedWardIds(ids);
    } catch (err) {
      console.error(err);
    }
  };
  const toggleProvince = async (provinceId: number) => {
    if (!selectedEmployee) return;

    const isSelected = selectedProvinceIds.includes(provinceId);

    if (isSelected) {
      // revoke province
      await provinceApi.revokeProvince(selectedEmployee, provinceId);
      await loadAssignedWards();
      setSelectedProvinceIds((prev) => prev.filter((x) => x !== provinceId));
    } else {
      setSelectedProvinceIds((prev) => [...prev, provinceId]);
    }

    // expand / collapse
    const expanded = expandedProvinces.includes(provinceId);

    if (expanded) {
      setExpandedProvinces((prev) => prev.filter((x) => x !== provinceId));
    } else {
      setExpandedProvinces((prev) => [...prev, provinceId]);

      await fetchWards(provinceId);
    }
  };
  const toggleWard = async (wardId: number) => {
    if (!selectedEmployee) return;

    const isSelected = selectedWardIds.includes(wardId);

    if (isSelected) {
      // revoke ward
      await wardApi.revokeWard(selectedEmployee, wardId);

      setSelectedWardIds((prev) => prev.filter((x) => x !== wardId));
      await loadAssignedWards();
    } else {
      setSelectedWardIds((prev) => [...prev, wardId]);
    }
  };
  const handleSubmit = async () => {
    try {
      if (!selectedEmployee) {
        alert("Chọn nhân viên");
        return;
      }

      setLoading(true);

      await employeeApi.assignRegion({
        employeeId: selectedEmployee,
        wardIds: selectedWardIds,
      });
      alert("Phân khu vực thành công");

      setSelectedProvinceIds([]);
      setSelectedWardIds([]);
      setExpandedProvinces([]);
      setAssignedWardIds([]);

      onClose();
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white w-[95%] max-w-md rounded-2xl p-5">
        <h2 className="text-xl font-semibold mb-4 text-center">Phân khu vực</h2>

        {/* Employee */}
        <div className="mb-4">
          <p className="font-medium mb-2">Chọn nhân viên</p>

          <select
            value={selectedEmployee || ""}
            onChange={(e) => setSelectedEmployee(Number(e.target.value))}
            className="w-full border rounded-xl p-3"
          >
            <option value="">-- Chọn nhân viên --</option>

            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        {/* Provinces */}
        <div>
          <p className="font-medium mb-2">Chọn tỉnh/thành</p>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {provinces.map((province) => {
              const provinceSelected = selectedProvinceIds.includes(
                province.id,
              );

              const expanded = expandedProvinces.includes(province.id);

              const wards = wardsByProvince[province.id] || [];
              return (
                <div
                  key={province.id}
                  className="border rounded-2xl overflow-hidden"
                >
                  {/* PROVINCE */}
                  <div
                    onClick={() => toggleProvince(province.id)}
                    className={`
        p-4 flex items-center justify-between
        ${provinceSelected ? "bg-blue-100" : "bg-white"}
    `}
                  >
                    {/* LEFT */}
                    <div className="flex items-center gap-3">
                      {/* EXPAND */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();

                          const expanded = expandedProvinces.includes(
                            province.id,
                          );

                          if (expanded) {
                            setExpandedProvinces((prev) =>
                              prev.filter((x) => x !== province.id),
                            );
                          } else {
                            setExpandedProvinces((prev) => [
                              ...prev,
                              province.id,
                            ]);

                            await fetchWards(province.id);
                          }
                        }}
                        className="
                h-7 w-7 rounded-lg
                border bg-white
                flex items-center justify-center
            "
                      >
                        {expanded ? "▲" : "▼"}
                      </button>

                      {/* SELECT PROVINCE */}
                      <button className="font-medium text-left">
                        {province.name}
                      </button>
                    </div>

                    {/* RIGHT */}
                    <div className="flex items-center gap-2">
                      {provinceSelected && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();

                            if (!selectedEmployee) return;

                            const ok = confirm("Xác nhận xoá tỉnh/thành?");

                            if (!ok) return;

                            await provinceApi.revokeProvince(
                              selectedEmployee,
                              province.id,
                            );

                            await loadAssignedWards();

                            setSelectedProvinceIds((prev) =>
                              prev.filter((x) => x !== province.id),
                            );
                          }}
                          className="
                    text-xs
                    bg-red-100
                    text-red-600
                    px-3 py-1
                    rounded-full
                    hover:bg-red-200
                "
                        >
                          Xoá
                        </button>
                      )}
                    </div>
                  </div>

                  {/* WARDS */}
                  {expanded && (
                    <div className="border-t bg-gray-50 p-3 space-y-2">
                      {wards.map((ward: any) => {
                        const wardSelected = selectedWardIds.includes(ward.id);

                        const assignedEmployees = ward.employees || [];

                        const hasAssignedEmployee =
                          assignedEmployees.length > 0;

                        return (
                          <div
                            key={ward.id}
                            onClick={() => {
                              toggleWard(ward.id);
                            }}
                            className={`
        p-3 rounded-xl border transition
        cursor-pointer hover:border-orange-400

        ${
          wardSelected
            ? `
              bg-green-500
              border-green-600
              text-white
              shadow-lg
              scale-[1.02]
            `
            : "bg-white"
        }
      `}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p
                                  className={`font-medium ${
                                    wardSelected ? "text-white" : "text-black"
                                  }`}
                                >
                                  {ward.name}
                                </p>

                                {hasAssignedEmployee && (
                                  <p
                                    className={`text-sm ${
                                      wardSelected
                                        ? "text-white/90"
                                        : "text-red-500"
                                    }`}
                                  >
                                    Phụ trách:{" "}
                                    {assignedEmployees
                                      .map((e: any) => e.name)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {/* ONLY DELETE WHEN NO EMPLOYEE */}
                                {!hasAssignedEmployee && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();

                                      const ok = confirm("Xác nhận xoá ward?");

                                      if (!ok) return;

                                      try {
                                        await wardApi.delete(ward.id);

                                        await fetchWards(province.id, true);

                                        setSelectedWardIds((prev) =>
                                          prev.filter((x) => x !== ward.id),
                                        );

                                        setAssignedWardIds((prev) =>
                                          prev.filter((x) => x !== ward.id),
                                        );
                                      } catch (err) {
                                        console.error(err);
                                        alert("Xoá ward thất bại");
                                      }
                                    }}
                                    className="
                text-xs
                bg-red-100
                text-red-600
                px-2 py-1
                rounded-full
                hover:bg-red-200
              "
                                  >
                                    Xoá
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
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
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl"
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
