import { useNavigate, useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { provinceApi } from "@/service/province";
import { employeeApi } from "@/service/employee";
import { wardApi } from "@/service/ward";
import { getEmployeeId } from "@/utils/auth";

type ProvinceType = {
  id: number;
  employeeId: number;
  provinceId: number;
  province: {
    id: number;
    name: string;
  };
};

type Employee = {
  id: number;
  name: string;
  email: string;
  phone: string;
};

export default function Province() {
  const navigate = useNavigate();

  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [showSelectForm, setShowSelectForm] = useState(false);

  const [provinces, setProvinces] = useState<ProvinceType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(
    null,
  );
  const [wards, setWards] = useState<any[]>([]);
  const [showWardModal, setShowWardModal] = useState(false);
  const employeeId = getEmployeeId();
  const fetchData = async () => {
    if (!employeeId) return;
    const data = await provinceApi.getProvincesByEmployee(employeeId);
    setProvinces(data);
    const dataW = await wardApi.getByEmployee(Number(employeeId));

    setWards(dataW);
  };

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const groupedProvinces = provinces.reduce((acc: any, item) => {
    const provinceId = item.id;

    if (!acc[provinceId]) {
      acc[provinceId] = {
        province: item,
        wards: [],
      };
    }

    acc[provinceId].wards.push(item);

    return acc;
  }, {});
  return (
    <div className="bg-gray-100 min-h-screen">
      <HeaderWithBack title="Danh sách tỉnh" />

      <div className="p-4 space-y-4 pt-20">
        {Object.values(groupedProvinces).map((item: any) => {
          const provinceWards = wards.filter(
            (w) => w.province_id === item.province.id,
          );
          console.log("provinceWards", provinceWards);
          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              {/* PROVINCE */}
              <div
                className="p-4 flex items-center justify-between border-b"
                onClick={async () => {
                  setSelectedProvinceId(
                    selectedProvinceId === item.province.id
                      ? null
                      : item.province.id,
                  );
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                    📍
                  </div>

                  <div>
                    <p className="font-semibold">{item.province.name}</p>

                    <p className="text-sm text-gray-500">
                      {provinceWards.length} khu vực
                    </p>
                  </div>
                </div>

                <span>
                  {selectedProvinceId === item.province.id ? "▲" : "▼"}
                </span>
              </div>

              {/* WARDS */}
              {selectedProvinceId === item.province.id && (
                <div className="p-3 bg-gray-50 space-y-2">
                  {provinceWards.length === 0 && (
                    <p className="text-center text-gray-500 py-3">
                      Không có khu vực
                    </p>
                  )}

                  {provinceWards.map((w) => (
                    <div
                      key={w.id}
                      onClick={() => {
                        navigate(`/employee/school-list/${employeeId}`, {
                          state: { ward: w },
                        });
                      }}
                      className="bg-white border rounded-xl p-3 flex justify-between cursor-pointer hover:bg-gray-50"
                    >
                      <span>{w.name}</span>

                      <span className="text-sm text-red-500">
                        {w.schoolCount} trường
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
