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
  role: string;
};

export default function EmployeeList() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [showHandover, setShowHandover] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

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

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "",
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

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
      const data = await employeeApi.getAll();
      console.log(data);
      setEmployees(data);
    } catch (err) {
      console.error("Load employees failed", err);
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
  }, []);

  const handleCreate = async () => {
    try {
      const res = await employeeApi.create({
        ...form,
        departmentId: 1,
      });

      console.log(res);

      alert("Tạo nhân viên thành công");

      setShowForm(false);

      setForm({
        name: "",
        phone: "",
        email: "",
        password: "",
        role: "",
      });

      fetchData();
    } catch (err: any) {
      console.error("Create employee failed", err);

      // render message từ backend
      const message = err?.response?.data?.message;

      if (Array.isArray(message)) {
        alert(message.join("\n"));
      } else {
        alert(message || "Tạo nhân viên thất bại");
      }
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <HeaderWithBack title="Danh sách nhân viên" />
      {from === "policy" ? (
        <div className="p-4 mt-[60px] flex flex-col gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-medium transition"
          >
            + Thêm nhân viên
          </button>
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

      {/* FORM */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowForm(false)}
          />

          <div className="relative bg-white w-[90%] max-w-md rounded-2xl shadow-lg p-4 space-y-3">
            <h2 className="text-lg font-semibold">Tạo nhân viên</h2>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <input
                placeholder="Tên"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border"
              />

              <input
                placeholder="Số điện thoại"
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border"
              />

              <input
                type="password"
                placeholder="Mật khẩu"
                value={form.password || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border"
              />

              <input
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                className="w-full p-3 rounded-xl border"
              />
            </div>
            <select
              value={form.role || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  role: e.target.value,
                })
              }
              className="w-full p-3 rounded-xl border"
            >
              <option value="">Chọn bộ phận</option>
              <option value="employee">Kinh doanh</option>
              <option value="probation">Thử việc</option>
              <option value="employee_la">Long An</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-300 py-3 rounded-xl"
              >
                Huỷ
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 bg-blue-500 text-white py-3 rounded-xl"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="p-4 space-y-3">
        {employees.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm"
          >
            <div
              onClick={async () => {
                if (from === "policy") {
                  setSelectedEmployeeId(item.id);

                  setSelectedProvince(null);

                  setWards([]);

                  const provinceData = await fetchProvinces(item.id);

                  const firstProvince = provinceData?.[0];

                  if (firstProvince) {
                    setSelectedProvince(firstProvince);
                  }

                  setShowRegionModal(true);
                } else if (from === "report") {
                  navigate(`/director/daily-report/${item.id}`);
                } else if (from === "suggest") {
                  navigate(`/director/suggest/${item.id}`);
                } else if (from === "statistics") {
                  navigate(`/director/statistics/${item.id}`);
                }
              }}
              className="flex items-center gap-3 flex-1 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                👤
              </div>

              <div>
                <p className="font-semibold text-gray-800">{item.name}</p>

                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[11px] px-2 py-[2px] rounded-full font-medium
        ${
          item.role === "employee"
            ? "bg-blue-100 text-blue-600"
            : item.role === "probation"
            ? "bg-yellow-100 text-yellow-700"
            : item.role === "employee_la"
            ? "bg-green-100 text-green-600"
            : item.role === "director_la"
            ? "bg-red-100 text-gray-600"
            : item.role === "saleadmin"
            ? "bg-green-100 text-gray-600"
            : "bg-red-100 text-gray-600"
        }
      `}
                  >
                    {item.role === "employee"
                      ? "Kinh doanh"
                      : item.role === "probation"
                      ? "Thử việc"
                      : item.role === "employee_la"
                      ? "Long An"
                      : item.role === "director_la"
                      ? "Giám đốc Long An"
                      : item.role}
                  </span>

                  <p className="text-sm text-gray-500">{item.phone}</p>
                </div>
              </div>
            </div>

            {from === "report" ? (
              reportedIds.includes(item.id) ? (
                <span className="text-xs bg-green-100 text-green-600 px-3 py-1 rounded-full">
                  ✅ Đã báo cáo
                </span>
              ) : (
                <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full">
                  ❌ Chưa báo cáo
                </span>
              )
            ) : (
              <div className="flex items-center gap-2">
                {item.role === "probation" && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      const confirmApprove = window.confirm(
                        `Chuyển ${item.name} thành nhân viên chính thức?`,
                      );

                      if (!confirmApprove) return;

                      try {
                        await employeeApi.update(item.id, {
                          role: "employee",
                        });

                        fetchData();

                        alert("Đã chuyển sang nhân viên chính thức");
                      } catch (err) {
                        console.error(err);

                        alert("Cập nhật thất bại");
                      }
                    }}
                    className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600"
                  >
                    Duyệt
                  </button>
                )}

                <button
                  onClick={async (e) => {
                    e.stopPropagation();

                    const confirmDelete = window.confirm("Xoá nhân viên này?");

                    if (!confirmDelete) return;

                    await employeeApi.delete(item.id);

                    fetchData();
                  }}
                  className="text-red-500 px-3 py-1 rounded-lg hover:bg-red-50"
                >
                  Xoá
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* SELECT EMPLOYEE */}
      {showForm && (
        <div className="p-4 space-y-3">
          {availableEmployees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => toggleSelect(emp.id)}
              className={`p-3 rounded-xl border ${
                selectedIds.includes(emp.id)
                  ? "bg-blue-100 border-blue-500"
                  : "bg-white"
              }`}
            >
              <p className="font-semibold">{emp.name}</p>

              <p className="text-sm text-gray-500">{emp.phone}</p>
            </div>
          ))}
        </div>
      )}

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
