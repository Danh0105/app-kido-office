import { useLocation, useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import HeaderWithBack from "../../../components/HeaderWithBack";
import { employeeApi } from "../../../service/employee";
import { dailyReportApi } from "@/service/report";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";
import AssignAreaModal from "./component/AssignAreaModal";
import HandoverRegionModal from "./component/HandoverRegionModal";

type Employee = {
  id: number;
  name: string;
  email: string;
  phone: string;
  roles: string[];
};

const SALES_EMPLOYEE_SCOPES = ["policy", "report", "statistics"];

const roleColor = (role: string) => {
  if (role === "employee" || role === "sales")
    return "bg-blue-100 text-blue-600";
  if (role === "probation") return "bg-yellow-100 text-yellow-700";
  if (role === "employee_la") return "bg-green-100 text-green-600";
  if (role === "director") return "bg-purple-100 text-purple-700";
  if (role === "director_la") return "bg-red-100 text-red-700";
  if (role === "saleadmin" || role === "salesadmin_la")
    return "bg-indigo-100 text-indigo-700";
  if (role === "accountant") return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-600";
};

const roleLabel = (role: string) => {
  const labels: Record<string, string> = {
    employee: "Kinh doanh",
    sales: "Nhân viên KD",
    probation: "Thử việc",
    employee_la: "Long An",
    director_la: "Giám đốc LA",
    director: "Giám đốc",
    saleadmin: "Sale Admin",
    salesadmin_la: "Sale Admin LA",
    accountant: "Kế toán",
  };

  return labels[role] || role;
};

export default function EmployeeList() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [showHandover, setShowHandover] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [showRegionModal, setShowRegionModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );

  const [showAssign, setShowAssign] = useState(false);

  const [provinces, setProvinces] = useState<any[]>([]);
  const [allProvinces, setAllProvinces] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);

  const [showWardModal, setShowWardModal] = useState(false);

  const [reportedIds, setReportedIds] = useState<number[]>([]);

  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showWardCreateModal, setShowWardCreateModal] = useState(false);

  const [provinceName, setProvinceName] = useState("");
  const [wardName, setWardName] = useState("");
  const [wardInputs, setWardInputs] = useState([""]);
  const [selectedProvince, setSelectedProvince] = useState<any>(null);

  const fetchProvinces = async (employeeId: number) => {
    const data = await provinceApi.getProvincesByEmployee(employeeId);
    console.log(data);
    setProvinces(data);

    return data;
  };
  const fetchAllProvinces = async () => {
    try {
      const data = await provinceApi.getAll();

      setAllProvinces(data);
    } catch (err) {
      console.error(err);
    }
  };
  const fetchData = async () => {
    try {
      const response = SALES_EMPLOYEE_SCOPES.includes(from)
        ? await employeeApi.getSales()
        : await employeeApi.getAll();
      const data = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setEmployees(data);
    } catch (err) {
      console.error("Load employees failed", err);
      setEmployees([]);
    }
  };

  const fetchReportedToday = async () => {
    try {
      const data = await dailyReportApi.getEmployeesReportedToday();

      const ids = data.map((e: any) => e.employee_id);

      setReportedIds(ids);
    } catch (err) {
      console.error("Load reported employees failed", err);
    }
  };

  useEffect(() => {
    fetchData();

    fetchAllProvinces();

    if (from === "report") {
      fetchReportedToday();
    }
  }, [from]);

  const handleEmployeeClick = async (item: Employee) => {
    if (from === "policy") {
      setSelectedEmployeeId(item.id);
      setSelectedProvince(null);
      setWards([]);

      const provinceData = await fetchProvinces(item.id);
      const firstProvince = provinceData?.[0];
      if (firstProvince) setSelectedProvince(firstProvince);

      setShowRegionModal(true);
    } else if (from === "report") {
      navigate(`/director/daily-report/${item.id}`);
    } else if (from === "statistics") {
      navigate(`/director/statistics/${item.id}`);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <HeaderWithBack
        title={
          SALES_EMPLOYEE_SCOPES.includes(from)
            ? "Danh sách nhân viên kinh doanh"
            : "Danh sách nhân viên"
        }
      />
      {from === "policy" ? (
        <div className="p-4 mt-[60px] flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              onClick={() => setShowAssign(true)}
              className="flex-1 bg-orange-500 text-white py-3 rounded-xl"
            >
              Phân khu vực
            </button>
            <button
              onClick={() => setShowHandover(true)}
              className="flex-1 bg-green-500 text-white py-3 rounded-xl"
            >
              Bàn giao khu vực
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowProvinceModal(true)}
              className="flex-1 bg-red-500 text-white py-3 rounded-xl"
            >
              + Tạo tỉnh/khu vực
            </button>

            <button
              onClick={() => {
                if (allProvinces.length === 0) {
                  alert("Chưa có tỉnh");
                  return;
                }

                setShowWardCreateModal(true);
              }}
              className="flex-1 bg-yellow-500 text-white py-3 rounded-xl"
            >
              + Tạo phường/xã
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 mt-[60px] flex flex-col gap-3"></div>
      )}

      {/* CREATE PROVINCE */}
      {showProvinceModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] max-w-md rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-4">Tạo tỉnh/khu vực</h2>

            <input
              value={provinceName}
              onChange={(e) => setProvinceName(e.target.value)}
              placeholder="Tên tỉnh"
              className="w-full border rounded-xl p-3"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowProvinceModal(false);
                  setProvinceName("");
                }}
                className="flex-1 bg-gray-300 py-3 rounded-xl"
              >
                Huỷ
              </button>

              <button
                onClick={async () => {
                  try {
                    if (!provinceName.trim()) {
                      alert("Vui lòng nhập tên tỉnh");
                      return;
                    }

                    await provinceApi.create({
                      name: provinceName,
                    });

                    alert("Tạo tỉnh thành công");

                    setProvinceName("");

                    setShowProvinceModal(false);

                    if (selectedEmployeeId) {
                      await fetchProvinces(selectedEmployeeId);
                    }
                  } catch (err: any) {
                    console.error(err);

                    alert(
                      err?.response?.data?.message ||
                        err.message ||
                        "Tạo tỉnh thất bại",
                    );
                  }
                }}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl"
              >
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WARD */}
      {showWardCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] max-w-md rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-4">Tạo Phường/xã</h2>

            <div className="space-y-2 mb-4 max-h-[200px] overflow-auto">
              {allProvinces.map((p) => {
                const active = selectedProvince?.id === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProvince(p)}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      active ? "bg-blue-100 border-blue-500" : "bg-white"
                    }`}
                  >
                    <p className="font-medium">{p.name}</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              {wardInputs.map((value, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={value}
                    onChange={(e) => {
                      const updated = [...wardInputs];

                      updated[index] = e.target.value;

                      setWardInputs(updated);
                    }}
                    placeholder={`Tên khu vực ${index + 1}`}
                    className="flex-1 border rounded-xl p-3"
                  />

                  {wardInputs.length > 1 && (
                    <button
                      onClick={() => {
                        const updated = wardInputs.filter(
                          (_, i) => i !== index,
                        );

                        setWardInputs(updated);
                      }}
                      className="bg-red-500 text-white px-3 rounded-xl"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={() => setWardInputs([...wardInputs, ""])}
                className="w-full border-2 border-dashed border-gray-300 py-3 rounded-xl hover:bg-gray-50"
              >
                + Thêm khu vực
              </button>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowWardCreateModal(false);

                  setWardInputs([""]);
                }}
                className="flex-1 bg-gray-300 py-3 rounded-xl"
              >
                Huỷ
              </button>

              <button
                onClick={async () => {
                  try {
                    if (!selectedProvince?.id) {
                      alert("Vui lòng chọn tỉnh");
                      return;
                    }

                    const validWards = wardInputs.filter(
                      (w) => w.trim() !== "",
                    );

                    if (validWards.length === 0) {
                      alert("Vui lòng nhập tên khu vực");
                      return;
                    }
                    for (const name of validWards) {
                      await wardApi.create({
                        name,
                        province_id: selectedProvince.id,
                      });
                    }

                    alert(`Tạo thành công ${validWards.length} khu vực`);

                    setWardInputs([""]);

                    setShowWardCreateModal(false);

                    if (selectedEmployeeId) {
                      const data = await wardApi.getByEmployee(
                        selectedEmployeeId,
                      );

                      const filtered = data.filter(
                        (w: any) => w.province_id === selectedProvince.id,
                      );

                      setWards(filtered);

                      setShowWardModal(true);
                    }
                  } catch (err: any) {
                    console.error(err);

                    alert(
                      err?.response?.data?.message ||
                        err.message ||
                        "Tạo khu vực thất bại",
                    );
                  }
                }}
                className="flex-1 bg-green-500 text-white py-3 rounded-xl"
              >
                Tạo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      <div
        className={
          from === "policy"
            ? "px-3 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
            : "p-4 space-y-3"
        }
      >
        {employees.map((item) =>
          from === "policy" ? (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => void handleEmployeeClick(item)}
                className="flex flex-col items-center px-3 pt-4 pb-2 text-center hover:bg-blue-50/40 transition"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-2xl">
                  👤
                </div>
                <p className="mt-1.5 w-full line-clamp-2 text-xs font-semibold leading-tight text-gray-800">
                  {item.name}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {item.phone || "Chưa có số điện thoại"}
                </p>
              </button>

              <div className="min-h-[28px] px-2 pb-2 flex flex-wrap justify-center gap-1">
                {(item.roles ?? []).map((role) => (
                  <span
                    key={role}
                    className={`rounded-full px-1.5 py-[2px] text-[11px] font-medium leading-tight ${roleColor(
                      role,
                    )}`}
                  >
                    {roleLabel(role)}
                  </span>
                ))}
              </div>

              <div className="mt-auto border-t border-gray-100 px-2 py-2">
                <button
                  type="button"
                  onClick={() => void handleEmployeeClick(item)}
                  className="w-full rounded-lg bg-blue-500 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                >
                  Xem khu vực và chính sách
                </button>
              </div>
            </div>
          ) : (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm"
            >
              <button
                type="button"
                onClick={() => void handleEmployeeClick(item)}
                className="flex items-center gap-3 flex-1 cursor-pointer text-left"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                  👤
                </div>

                <div>
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {(item.roles ?? []).map((role) => (
                      <span
                        key={role}
                        className={`text-[11px] px-2 py-[2px] rounded-full font-medium ${roleColor(
                          role,
                        )}`}
                      >
                        {roleLabel(role)}
                      </span>
                    ))}
                    <p className="text-sm text-gray-500">{item.phone}</p>
                  </div>
                </div>
              </button>

              {from === "report" &&
                (reportedIds.includes(item.id) ? (
                  <span className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-full">
                    ✅ Đã báo cáo
                  </span>
                ) : (
                  <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full">
                    ❌ Chưa báo cáo
                  </span>
                ))}
            </div>
          ),
        )}
      </div>

      {/* REGION MODAL */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[90%] max-w-md rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-4 text-center">
              Danh sách tỉnh / thành phố
            </h2>

            <div className="max-h-[300px] overflow-auto space-y-2">
              {provinces.length === 0 && (
                <p className="text-center text-gray-500">Không có dữ liệu</p>
              )}

              {provinces.map((item) => (
                <div
                  key={item.id}
                  className="p-3 border rounded-xl flex items-center justify-between gap-3"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={async () => {
                      setSelectedProvince(item);

                      if (!selectedEmployeeId) return;

                      const data = await wardApi.getByEmployee(
                        Number(selectedEmployeeId),
                      );

                      const filtered = data.filter(
                        (w: any) => w.province_id === item.id,
                      );

                      setWards(filtered);
                      console.log(filtered);
                      setShowWardModal(true);
                    }}
                  >
                    <p className="font-medium">{item.name}</p>
                  </div>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      if (!selectedEmployeeId) return;

                      const confirmDelete = window.confirm(
                        `Thu hồi toàn bộ khu vực tỉnh ${item.name}?`,
                      );

                      if (!confirmDelete) return;

                      try {
                        await provinceApi.revokeProvince(
                          selectedEmployeeId,
                          item.id,
                        );

                        alert("Thu hồi tỉnh thành công");

                        setProvinces((prev) =>
                          prev.filter((p) => p.id !== item.id),
                        );
                      } catch (err: any) {
                        console.error(err);

                        alert(
                          err?.response?.data?.message || "Thu hồi thất bại",
                        );
                      }
                    }}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    Thu hồi
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowRegionModal(false)}
              className="mt-4 w-full bg-gray-300 py-3 rounded-xl"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* WARD MODAL */}
      {showWardModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[90%] max-w-md rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-4 text-center">
              Danh sách phường/xã
            </h2>

            <div className="max-h-[300px] overflow-auto space-y-2">
              {wards.map((w) => (
                <div
                  key={w.id}
                  className="p-3 border rounded-xl flex items-center justify-between gap-3"
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      navigate(`/director/school-list/${selectedEmployeeId}`, {
                        state: { ward: w },
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{w.name}</span>

                      <span className="text-sm text-red-500">
                        {w.schoolCount} trường
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      if (!selectedEmployeeId) return;

                      const confirmDelete = window.confirm(
                        `Thu hồi phường/xã ${w.name}?`,
                      );

                      if (!confirmDelete) return;

                      try {
                        await wardApi.revokeWard(selectedEmployeeId, w.id);

                        alert("Thu hồi khu vực thành công");

                        setWards((prev) => prev.filter((i) => i.id !== w.id));
                      } catch (err: any) {
                        console.error(err);

                        alert(
                          err?.response?.data?.message || "Thu hồi thất bại",
                        );
                      }
                    }}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    Thu hồi
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowWardModal(false)}
              className="mt-4 w-full bg-gray-300 py-3 rounded-xl"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showAssign && (
        <AssignAreaModal
          onClose={() => setShowAssign(false)}
          employees={employees}
        />
      )}
      {showHandover && (
        <HandoverRegionModal
          onClose={() => setShowHandover(false)}
          employees={employees}
        />
      )}
    </div>
  );
}
