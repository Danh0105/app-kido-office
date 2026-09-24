import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { provinceApi } from "@/service/province";
import { employeeApi } from "@/service/employee";
import { wardApi } from "@/service/ward";
import { getApiErrorMessage } from "@/utils/apiError";
import SearchableSelect from "@/components/SearchableSelect";

type Props = {
  onClose: () => void;
  employees: any[];
};

export default function AssignAreaModal({ onClose, employees }: Props) {
  const [viewMode, setViewMode] = useState<"employee" | "ward">("employee");
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedLoadError, setAssignedLoadError] = useState("");
  const [removingAssignment, setRemovingAssignment] = useState<string | null>(
    null,
  );
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
      const response = await wardApi.getByProvince(provinceId);
      const data = Array.isArray(response) ? response : response?.data || [];
      const grouped = Object.values(
        data.reduce((acc: any, item: any) => {
          if (!acc[item.id]) {
            acc[item.id] = {
              id: item.id,
              name: item.name,
              employees: [],
            };
          }

          const relatedEmployees = Array.isArray(item.employees)
            ? item.employees
            : item.employee
              ? [item.employee]
              : [];
          relatedEmployees.forEach((employee: any) => {
            if (
              !acc[item.id].employees.some(
                (current: any) => current.id === employee.id,
              )
            ) {
              acc[item.id].employees.push(employee);
            }
          });

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
      setSelectedWardIds([]);
      setSelectedProvinceIds([]);
      setExpandedProvinces([]);
      return;
    }

    setSelectedProvinceIds([]);
    setExpandedProvinces([]);
    void loadAssignedWards();
  }, [selectedEmployee]);
  const loadAssignedWards = async () => {
    setAssignedLoading(true);
    setAssignedLoadError("");
    try {
      if (!selectedEmployee) return;
      const [wardResponse, provinceResponse] = await Promise.all([
        wardApi.getByEmployee(selectedEmployee),
        provinceApi.getProvincesByEmployee(selectedEmployee),
      ]);
      const data = Array.isArray(wardResponse)
        ? wardResponse
        : wardResponse?.data || [];
      const provinceData = Array.isArray(provinceResponse)
        ? provinceResponse
        : provinceResponse?.data || [];

      const ids = data.map((w: any) => Number(w.id)).filter(Boolean);
      const provinceIds = Array.from(
        new Set([...provinceData, ...data]
        .map((item: any) =>
          Number(
            item.provinceId ??
              item.province_id ??
              item.province?.id ??
              ("provinceId" in item || "province_id" in item || item.province
                ? undefined
                : item.id),
          ),
        )
        .filter(Boolean)),
      );

      setAssignedWardIds(ids);
      setSelectedWardIds(ids);
      setSelectedProvinceIds(provinceIds);
    } catch (err) {
      console.error(err);
      setAssignedLoadError(
        "Không tải được khu vực hiện tại. Vui lòng thử lại trước khi lưu.",
      );
    } finally {
      setAssignedLoading(false);
    }
  };
  const toggleProvinceExpansion = async (provinceId: number) => {
    if (!selectedEmployee) return;

    if (expandedProvinces.includes(provinceId)) {
      setExpandedProvinces((prev) =>
        prev.filter((id) => id !== provinceId),
      );
      return;
    }

    await fetchWards(provinceId);
    setExpandedProvinces((prev) => [...prev, provinceId]);
  };

  const toggleAllProvinceWards = async (provinceId: number) => {
    if (!selectedEmployee) return;

    const provinceWards = wardsByProvince[provinceId] || [];
    const response = provinceWards.length
      ? provinceWards
      : await wardApi.getByProvince(provinceId);
    const rows = Array.isArray(response) ? response : response?.data || [];
    const wardIds: number[] = Array.from(
      new Set<number>(
        rows.map((ward: any) => Number(ward.id)).filter((id: number) => id > 0),
      ),
    );
    const allSelected =
      wardIds.length > 0 && wardIds.every((id) => selectedWardIds.includes(id));

    setSelectedWardIds((prev) =>
      allSelected
        ? prev.filter((id) => !wardIds.includes(id))
        : Array.from(new Set([...prev, ...wardIds])),
    );
    setSelectedProvinceIds((prev) =>
      allSelected
        ? prev.filter((id) => id !== provinceId)
        : Array.from(new Set([...prev, provinceId])),
    );
  };
  const toggleWard = (wardId: number, provinceId: number) => {
    if (!selectedEmployee) return;

    setSelectedWardIds((prev) => {
      const removing = prev.includes(wardId);
      const next = removing
        ? prev.filter((id) => id !== wardId)
        : [...prev, wardId];

      setSelectedProvinceIds((current) => {
        if (!removing) {
          return current.includes(provinceId)
            ? current
            : [...current, provinceId];
        }

        const provinceWardIds = (wardsByProvince[provinceId] || []).map(
          (ward: any) => Number(ward.id),
        );
        return next.some((id) => provinceWardIds.includes(id))
          ? current
          : current.filter((id) => id !== provinceId);
      });
      return next;
    });
  };

  const removeEmployeeFromWard = async (
    employee: any,
    ward: any,
    provinceId: number,
  ) => {
    const employeeId = Number(employee?.id);
    const wardId = Number(ward?.id);
    if (!employeeId || !wardId || removingAssignment) return;

    const ok = confirm(
      `Gỡ ${employee?.name || `nhân viên #${employeeId}`} khỏi ${ward?.name || "khu vực này"}?`,
    );
    if (!ok) return;

    const assignmentKey = `${employeeId}-${wardId}`;
    setRemovingAssignment(assignmentKey);
    try {
      await wardApi.revokeWard(employeeId, wardId);
      await fetchWards(provinceId, true);

      if (selectedEmployee === employeeId) {
        setAssignedWardIds((current) =>
          current.filter((id) => id !== wardId),
        );
        setSelectedWardIds((current) =>
          current.filter((id) => id !== wardId),
        );
      }
      toast.success("Đã gỡ nhân viên khỏi khu vực");
    } catch (reason) {
      toast.error(
        getApiErrorMessage(reason, "Không thể gỡ nhân viên khỏi khu vực"),
      );
    } finally {
      setRemovingAssignment(null);
    }
  };
  const handleSubmit = async () => {
    try {
      if (!selectedEmployee) {
        toast.error("Chọn nhân viên");
        return;
      }
      if (assignedLoading) {
        toast.error("Đang tải khu vực hiện tại, vui lòng chờ");
        return;
      }
      if (assignedLoadError) {
        toast.error(assignedLoadError);
        return;
      }

      setLoading(true);

      const addedWardIds = selectedWardIds.filter(
        (wardId) => !assignedWardIds.includes(wardId),
      );
      const removedWardIds = assignedWardIds.filter(
        (wardId) => !selectedWardIds.includes(wardId),
      );

      if (addedWardIds.length === 0 && removedWardIds.length === 0) {
        toast.error("Không có thay đổi khu vực");
        return;
      }

      const operations: Array<{
        label: string;
        promise: Promise<unknown>;
      }> = [];

      const assignOperationIndex = addedWardIds.length > 0 ? operations.length : -1;
      if (addedWardIds.length > 0) {
        operations.push({
          label: "gán khu vực mới",
          promise: employeeApi.assignRegion({
            employeeId: selectedEmployee,
            provinceIds: selectedProvinceIds,
            wardIds: addedWardIds,
          }),
        });
      }
      removedWardIds.forEach((wardId) => {
        operations.push({
          label: `gỡ phường/xã #${wardId}`,
          promise: wardApi.revokeWard(selectedEmployee, wardId),
        });
      });

      const results = await Promise.allSettled(
        operations.map((operation) => operation.promise),
      );
      const failed = results
        .map((result, index) => ({ result, operation: operations[index] }))
        .filter(({ result }) => result.status === "rejected");

      await loadAssignedWards();

      if (failed.length > 0) {
        const details = failed
          .map(({ result, operation }) => {
            const reason =
              result.status === "rejected" ? (result.reason as any) : null;
            return `${operation.label}: ${getApiErrorMessage(reason, "Thất bại")}`;
          })
          .join("\n");
        toast.error(`Một số thay đổi chưa được lưu:\n${details}`);
        return;
      }

      // assignRegion chỉ trả về những dòng vừa tạo mới — ward đã gán trước đó
      // bị bỏ qua ở backend nên không có trong response, không phải lỗi.
      const assignResult =
        assignOperationIndex >= 0 &&
        results[assignOperationIndex].status === "fulfilled"
          ? (results[assignOperationIndex] as PromiseFulfilledResult<any>).value
          : null;
      const createdCount = Array.isArray(assignResult)
        ? assignResult.length
        : addedWardIds.length;
      const alreadyAssignedCount = addedWardIds.length - createdCount;

      const parts: string[] = [];
      if (createdCount > 0) parts.push(`đã thêm ${createdCount} khu vực`);
      if (alreadyAssignedCount > 0)
        parts.push(`${alreadyAssignedCount} khu vực đã được gán trước đó`);
      if (removedWardIds.length > 0)
        parts.push(`đã gỡ ${removedWardIds.length} khu vực`);

      toast.success(
        parts.length > 0 ? `Đã cập nhật: ${parts.join(", ")}` : "Phân khu vực thành công",
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Có lỗi xảy ra"));
    } finally {
      setLoading(false);
    }
  };

  if (viewMode === "ward") {
    return (
      <AssignByWardModal
        employees={employees}
        onClose={onClose}
        onSwitch={() => setViewMode("employee")}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white w-[95%] max-w-md rounded-2xl p-5">
        <h2 className="text-xl font-semibold mb-3 text-center">Phân khu vực</h2>
        <ViewModeTabs mode="employee" onChange={setViewMode} />

        {/* Employee */}
        <div className="mb-4">
          <p className="font-medium mb-2">Chọn nhân viên</p>

          <SearchableSelect
            value={String(selectedEmployee || "")}
            onChange={(value) => setSelectedEmployee(value ? Number(value) : null)}
            options={employees}
            placeholder="-- Chọn nhân viên --"
            searchPlaceholder="Tìm nhân viên…"
          />
          {assignedLoading && (
            <p className="mt-2 text-sm text-blue-600">
              Đang tải khu vực hiện tại...
            </p>
          )}
          {assignedLoadError && (
            <div className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-600">
              {assignedLoadError}
              <button
                type="button"
                onClick={() => void loadAssignedWards()}
                className="ml-2 font-semibold underline"
              >
                Thử lại
              </button>
            </div>
          )}
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
                    onClick={() => void toggleProvinceExpansion(province.id)}
                    className={`
        p-4 flex cursor-pointer items-center justify-between
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
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white">
                          Đã chọn
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleAllProvinceWards(province.id);
                        }}
                        className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                      >
                        {provinceSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      </button>
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
                              toggleWard(ward.id, province.id);
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
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`text-xs ${
                                        wardSelected
                                          ? "text-white/90"
                                          : "text-red-500"
                                      }`}
                                    >
                                      Phụ trách:
                                    </span>
                                    {assignedEmployees.map((employee: any) => {
                                      const assignmentKey = `${employee.id}-${ward.id}`;
                                      const removing =
                                        removingAssignment === assignmentKey;
                                      return (
                                        <span
                                          key={employee.id}
                                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                                            wardSelected
                                              ? "bg-white/20 text-white"
                                              : "bg-red-50 text-red-600"
                                          }`}
                                        >
                                          {employee.name}
                                          <button
                                            type="button"
                                            disabled={Boolean(removingAssignment)}
                                            title={`Gỡ ${employee.name} khỏi ${ward.name}`}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void removeEmployeeFromWard(
                                                employee,
                                                ward,
                                                province.id,
                                              );
                                            }}
                                            className="grid h-4 w-4 place-items-center rounded-full bg-red-500 font-bold leading-none text-white hover:bg-red-600 disabled:opacity-50"
                                          >
                                            {removing ? "…" : "×"}
                                          </button>
                                        </span>
                                      );
                                    })}
                                  </div>
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
                                        toast.error(getApiErrorMessage(err, "Xoá ward thất bại"));
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
            disabled={loading || assignedLoading || Boolean(assignedLoadError)}
            onClick={handleSubmit}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewModeTabs({
  mode,
  onChange,
}: {
  mode: "employee" | "ward";
  onChange: (mode: "employee" | "ward") => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
      <button
        type="button"
        onClick={() => onChange("employee")}
        className={`rounded-lg px-2 py-2 text-sm font-medium ${
          mode === "employee" ? "bg-white text-blue-600 shadow" : "text-gray-500"
        }`}
      >
        Theo nhân viên
      </button>
      <button
        type="button"
        onClick={() => onChange("ward")}
        className={`rounded-lg px-2 py-2 text-sm font-medium ${
          mode === "ward" ? "bg-white text-blue-600 shadow" : "text-gray-500"
        }`}
      >
        Theo khu vực
      </button>
    </div>
  );
}

function AssignByWardModal({
  employees,
  onClose,
  onSwitch,
}: Props & { onSwitch: () => void }) {
  const [provinces, setProvinces] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [provinceId, setProvinceId] = useState(0);
  const [wardId, setWardId] = useState(0);
  const [initialEmployeeIds, setInitialEmployeeIds] = useState<number[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingWards, setLoadingWards] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    provinceApi
      .getAll()
      .then((response) =>
        setProvinces(Array.isArray(response) ? response : response?.data || []),
      )
      .catch((reason: any) =>
        setError(
          reason?.response?.data?.message ||
            (reason?.message === "Network Error"
              ? "Không thể kết nối máy chủ"
              : "Không tải được tỉnh/thành"),
        ),
      )
      .finally(() => setLoadingProvinces(false));
  }, []);

  const loadWards = async (nextProvinceId: number, keepWardId = 0) => {
    setLoadingWards(true);
    setError("");
    try {
      const response = await wardApi.getByProvince(nextProvinceId);
      const rows = Array.isArray(response) ? response : response?.data || [];
      const grouped: any[] = Array.from(
        rows.reduce((map: Map<number, any>, row: any) => {
          const current = map.get(Number(row.id)) || {
            id: Number(row.id),
            name: row.name,
            employees: [],
          };
          const related = Array.isArray(row.employees)
            ? row.employees
            : row.employee
              ? [row.employee]
              : [];
          related.forEach((employee: any) => {
            if (!current.employees.some((item: any) => item.id === employee.id)) {
              current.employees.push(employee);
            }
          });
          map.set(current.id, current);
          return map;
        }, new Map<number, any>()).values(),
      );
      setWards(grouped);
      if (keepWardId) {
        const current = grouped.find((ward: any) => ward.id === keepWardId);
        const ids = (current?.employees || []).map((item: any) => Number(item.id));
        setInitialEmployeeIds(ids);
        setSelectedEmployeeIds(ids);
      }
    } catch (reason: any) {
      setError(
        reason?.response?.data?.message ||
          (reason?.message === "Network Error"
            ? "Không thể kết nối máy chủ"
            : "Không tải được phường/xã"),
      );
    } finally {
      setLoadingWards(false);
    }
  };

  const selectProvince = (value: number) => {
    setProvinceId(value);
    setWardId(0);
    setWards([]);
    setInitialEmployeeIds([]);
    setSelectedEmployeeIds([]);
    if (value) void loadWards(value);
  };

  const selectWard = (value: number) => {
    setWardId(value);
    const ward = wards.find((item) => item.id === value);
    const ids = (ward?.employees || []).map((item: any) => Number(item.id));
    setInitialEmployeeIds(ids);
    setSelectedEmployeeIds(ids);
  };

  const save = async () => {
    if (!provinceId || !wardId || submitting) return;
    const added = selectedEmployeeIds.filter(
      (id) => !initialEmployeeIds.includes(id),
    );
    const removed = initialEmployeeIds.filter(
      (id) => !selectedEmployeeIds.includes(id),
    );
    if (added.length === 0 && removed.length === 0) {
      toast.error("Không có thay đổi khu vực");
      return;
    }

    setSubmitting(true);
    const operations = [
      ...added.map((employeeId) => ({
        employeeId,
        action: "gán",
        promise: employeeApi.assignRegion({
          employeeId,
          provinceIds: [provinceId],
          wardIds: [wardId],
        }),
      })),
      ...removed.map((employeeId) => ({
        employeeId,
        action: "gỡ",
        promise: wardApi.revokeWard(employeeId, wardId),
      })),
    ];
    const results = await Promise.allSettled(
      operations.map((operation) => operation.promise),
    );
    const failed = results
      .map((result, index) => ({ result, operation: operations[index] }))
      .filter(({ result }) => result.status === "rejected");

    await loadWards(provinceId, wardId);
    setSubmitting(false);

    if (failed.length) {
      const details = failed.map(({ result, operation }) => {
        const employee = employees.find((item) => item.id === operation.employeeId);
        const who = `${operation.action} ${employee?.name || `#${operation.employeeId}`}`;
        const reason =
          result.status === "rejected" ? getApiErrorMessage(result.reason, "Thất bại") : "Thất bại";
        return `${who}: ${reason}`;
      });
      toast.error(`Một số thao tác thất bại:\n${details.join("\n")}`);
      return;
    }
    toast.success("Cập nhật người phụ trách thành công");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[95%] max-w-md rounded-2xl bg-white p-5">
        <h2 className="mb-3 text-center text-xl font-semibold">Phân khu vực</h2>
        <ViewModeTabs mode="ward" onChange={(mode) => mode === "employee" && onSwitch()} />
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <label className="block text-sm font-medium">
          Tỉnh/Thành phố
          <select
            value={provinceId || ""}
            disabled={loadingProvinces}
            onChange={(event) => selectProvince(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">{loadingProvinces ? "Đang tải..." : "-- Chọn --"}</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>{province.name}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">
          Phường/Xã
          <select
            value={wardId || ""}
            disabled={!provinceId || loadingWards}
            onChange={(event) => selectWard(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">{loadingWards ? "Đang tải..." : "-- Chọn --"}</option>
            {wards.map((ward) => (
              <option key={ward.id} value={ward.id}>{ward.name}</option>
            ))}
          </select>
        </label>
        {wardId > 0 && (
          <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto">
            <p className="text-sm font-medium">Nhân viên cùng phụ trách</p>
            {employees.map((employee) => {
              const checked = selectedEmployeeIds.includes(employee.id);
              return (
                <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedEmployeeIds((current) =>
                        checked
                          ? current.filter((id) => id !== employee.id)
                          : [...current, employee.id],
                      )
                    }
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">{employee.name}</span>
                </label>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl bg-gray-300 py-3">Huỷ</button>
          <button
            onClick={() => void save()}
            disabled={!wardId || submitting || loadingWards || Boolean(error)}
            className="flex-1 rounded-xl bg-orange-500 py-3 text-white disabled:opacity-50"
          >
            {submitting ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
