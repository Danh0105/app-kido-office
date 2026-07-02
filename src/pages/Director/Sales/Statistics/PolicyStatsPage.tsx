import { useEffect, useMemo, useState } from "react";
import { usePolicyStats } from "./hooks/usePolicyStats";
import SidebarRegion from "./components/SidebarRegion";
import HeaderWithBack from "@/components/HeaderWithBack";
import PolicyPopup from "./components/PolicyPopup";
import SchoolInfoCard from "./components/SchoolInfoCard";
import { useParams } from "react-router-dom";
import { suggestApi } from "@/service/suggest";
import { Boxes, Calendar, MapPin, PackageSearch, School } from "lucide-react";
import ExpenseStatsSection from "./components/ExpenseStatsSection";
import { expensePeriodApi } from "@/service/expensePeriod";
import { schoolExpenseApi } from "@/service/schoolExpense";

const groupByProvince = (rows: any[]) => {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.provinceName;

    if (!map.has(key)) {
      map.set(key, {
        policyId: row.policyId,
        schoolId: row.schoolId,
        wardId: row.wardId,
        provinceId: row.provinceId,
        provinceName: row.provinceName,
        total: 0,
        schools: new Set(),
        wards: new Set(),
      });
    }

    const item = map.get(key);

    item.total += 1;
    item.schools.add(row.schoolId);
    item.wards.add(row.wardId);
  });

  return Array.from(map.values()).map((p) => ({
    provinceId: p.provinceId,
    provinceName: p.provinceName,
    total: p.total,
    schoolCount: p.schools.size,
    wardCount: p.wards.size,
  }));
};
type Subject = {
  id: number;
  name: string;
  policy: any;
};

type DeviceOption = {
  key: string;
  name: string;
};

type DeviceAllocation = {
  schoolId: number;
  schoolName: string;
  wardName?: string;
  provinceName?: string;
  quantity: number;
  details: {
    policyId: number;
    subjectName?: string;
    schoolYear?: string;
    quantity: number;
  }[];
};

const normalizeDeviceName = (value: unknown) =>
  String(value || "").trim().toLocaleLowerCase("vi-VN");

const getPolicyDevices = (policy: any) => {
  const devices = policy?.policyData?.htthietbi;
  return Array.isArray(devices) ? devices : [];
};

const getDeviceName = (device: any) =>
  String(device?.category || device?.name || device?.type || "").trim();

const getDeviceQuantity = (device: any) => {
  const quantity = Number(device?.qty ?? device?.quantity ?? 0);
  return Number.isFinite(quantity) ? quantity : 0;
};

export default function PolicyStatsPage() {
  const { employeeId } = useParams();
  const [filters, setFilters] = useState<{
    employeeId: number;
    fromDate?: string;
    toDate?: string;
  }>({
    employeeId: Number(employeeId) || 0,
    fromDate: "",
    toDate: "",
  });
  const [schoolData, setSchoolData] = useState<any>(null);
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [openSidebar, setOpenSidebar] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState("");
  const { data, isLoading, isFetching } = usePolicyStats(filters);
  console.log("data", data);
  const [openPolicy, setOpenPolicy] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [allPolicies, setAllPolicies] = useState<any[]>([]);
  const [suggestStats, setSuggestStats] = useState<Record<number, any>>({});
  const [expensePeriods, setExpensePeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [schoolExpenses, setSchoolExpenses] = useState<Map<number, any>>(new Map());
  const [expenseLoading, setExpenseLoading] = useState(false);
  const byProvince = useMemo(() => {
    if (!data) return [];
    return groupByProvince(data);
  }, [data]);
  const filteredPolicies = useMemo(() => {
    return allPolicies.filter((p) => {
      if (selectedProvince && p.provinceId !== selectedProvince) return false;
      if (selectedSchool && p.schoolId !== selectedSchool) return false;
      if (selectedYear && p.schoolYear !== selectedYear) return false;
      if (selectedSubject && p.subjectId !== selectedSubject) return false;
      return true;
    });
  }, [
    allPolicies,
    selectedProvince,
    selectedSchool,
    selectedYear,
    selectedSubject,
  ]);
  useEffect(() => {
    if (data) {
      setAllPolicies(data);
    }
  }, [data]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await suggestApi.getStatsByPolicy();

        console.log("Data suggest", res);

        const map: Record<number, any> = {};

        res.forEach((item: any) => {
          map[item.policyId] = item;
        });

        console.log("Map suggest", map);

        setSuggestStats(map);
      } catch (err) {
        console.error("Lỗi getStatsByPolicy:", err);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    expensePeriodApi.getAll().then((res) => {
      const list = Array.isArray(res) ? res : res?.data || [];
      setExpensePeriods(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    const fetchExpenses = async () => {
      setExpenseLoading(true);
      try {
        const params: any = { limit: 500 };
        if (selectedPeriodId) params.periodId = selectedPeriodId;

        const res = await schoolExpenseApi.getAll(params);
        const list = Array.isArray(res) ? res : res?.data || [];

        const enriched = await Promise.all(
          list.map(async (record: any) => {
            try {
              const summary = await schoolExpenseApi.getSummary(
                record.id,
                selectedSubject || undefined,
              );
              return { ...record, summary };
            } catch {
              return record;
            }
          }),
        );

        if (active) {
          const map = new Map<number, any>();
          enriched.forEach((record: any) => {
            const schoolId = Number(record.schoolId || record.school?.id || 0);
            if (!schoolId) return;
            const existing = map.get(schoolId);
            if (existing) {
              const s1 = existing.summary?.summary || existing.summary || {};
              const s2 = record.summary?.summary || record.summary || {};
              const mergeArrays = (a: any[], b: any[]) => [...(a || []), ...(b || [])];
              existing.summary = {
                ...existing.summary,
                summary: {
                  revenueItems: mergeArrays(s1.revenueItems, s2.revenueItems),
                  schoolExpenseItems: mergeArrays(s1.schoolExpenseItems, s2.schoolExpenseItems),
                  managementExpenseItems: mergeArrays(s1.managementExpenseItems, s2.managementExpenseItems),
                },
              };
            } else {
              map.set(schoolId, record);
            }
          });
          setSchoolExpenses(map);
        }
      } catch {
        if (active) setSchoolExpenses(new Map());
      } finally {
        if (active) setExpenseLoading(false);
      }
    };

    fetchExpenses();
    return () => { active = false; };
  }, [selectedPeriodId, selectedSubject]);

  const resetFilters = () => {
    setSelectedProvince(null);
    setSelectedSchool(null);
    setSelectedSubject(null);
    setSelectedYear(null);
    setSelectedDevice("");
    setSelectedPeriodId(null);
  };
  const subjectsFilter = useMemo<Subject[]>(() => {
    if (!filteredPolicies) return [];

    const map = new Map<string, Subject>();

    filteredPolicies.forEach((item: any) => {
      if (!item.subjectName) return;

      const key = item.subjectName.trim().toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          id: item.subjectId, // giữ 1 id đại diện
          name: item.subjectName,
          policy: item,
        });
      }
    });

    return Array.from(map.values());
  }, [filteredPolicies]);
  const schoolYears = useMemo(() => {
    if (!filteredPolicies) return [];

    return [
      ...new Set(
        filteredPolicies.map((i: any) => i.schoolYear).filter(Boolean),
      ),
    ];
  }, [filteredPolicies]);

  const deviceOptions = useMemo<DeviceOption[]>(() => {
    const devices = new Map<string, DeviceOption>();

    filteredPolicies.forEach((policy: any) => {
      getPolicyDevices(policy).forEach((device: any) => {
        const name = getDeviceName(device);
        const key = normalizeDeviceName(name);

        if (key && !devices.has(key)) {
          devices.set(key, { key, name });
        }
      });
    });

    return Array.from(devices.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "vi"),
    );
  }, [filteredPolicies]);

  const deviceAllocations = useMemo<DeviceAllocation[]>(() => {
    if (!selectedDevice) return [];

    const schools = new Map<number, DeviceAllocation>();

    filteredPolicies.forEach((policy: any) => {
      getPolicyDevices(policy).forEach((device: any) => {
        if (normalizeDeviceName(getDeviceName(device)) !== selectedDevice) {
          return;
        }

        const quantity = getDeviceQuantity(device);
        const schoolId = Number(policy.schoolId);
        let current = schools.get(schoolId);

        if (!current) {
          current = {
            schoolId,
            schoolName: policy.schoolName || `Trường #${schoolId}`,
            wardName: policy.wardName,
            provinceName: policy.provinceName,
            quantity: 0,
            details: [],
          };
        }

        current.quantity += quantity;
        current.details.push({
          policyId: Number(policy.policyId || policy.id),
          subjectName: policy.subjectName,
          schoolYear: policy.schoolYear,
          quantity,
        });
        schools.set(schoolId, current);
      });
    });

    return Array.from(schools.values()).sort(
      (left, right) =>
        right.quantity - left.quantity ||
        left.schoolName.localeCompare(right.schoolName, "vi"),
    );
  }, [filteredPolicies, selectedDevice]);

  const selectedDeviceName =
    deviceOptions.find((device) => device.key === selectedDevice)?.name || "";
  const totalSelectedDeviceQuantity = deviceAllocations.reduce(
    (total, school) => total + school.quantity,
    0,
  );
  const expenseScopedPolicies = useMemo(() => {
    if (!selectedDevice) return filteredPolicies;

    const deviceSchoolIds = new Set(
      deviceAllocations.map((allocation) => allocation.schoolId),
    );
    return filteredPolicies.filter((policy: any) =>
      deviceSchoolIds.has(Number(policy.schoolId)),
    );
  }, [deviceAllocations, filteredPolicies, selectedDevice]);
  const getProfit = (p: any) => {
    const d = p.policyData || {};

    return (
      (d.fee || 0) -
      (d.csvc || 0) -
      (d.thue || 0) -
      (d.giaovien || 0) -
      (d.csthang || 0) -
      (d.thietbi || 0) -
      (d.giaoCu || 0) -
      (d.vanHanh || 0) -
      (d.thuetndn || 0)
    );
  };
  const getPolicyId = (p: any) => {
    return Number(p.policyId || p.id);
  };
  const treeData = useMemo(() => {
    if (!filteredPolicies) return [];

    const schoolMap = new Map();

    filteredPolicies.forEach((item: any) => {
      // ===== SCHOOL =====
      if (!schoolMap.has(item.schoolId)) {
        schoolMap.set(item.schoolId, {
          schoolId: item.schoolId,
          schoolName: item.schoolName,
          address: item.schoolAddress,
          representative: item.representative,
          phone: item.phone,
          taxCode: item.taxCode,
          scale: item.scale,
          wardName: item.wardName,
          provinceName: item.provinceName,
          classCount: item.classCount,
          subjects: new Map(),
        });
      }

      const school = schoolMap.get(item.schoolId);

      // ===== SUBJECT =====
      if (!school.subjects.has(item.subjectId)) {
        school.subjects.set(item.subjectId, {
          id: item.subjectId,
          name: item.subjectName,
          policies: [],
        });
      }

      const subject = school.subjects.get(item.subjectId);

      // ===== POLICY (KHÔNG TRÙNG) =====
      const exists = subject.policies.find(
        (p: any) => p.policyId === item.policyId,
      );

      if (!exists) {
        subject.policies.push(item);
      }
    });

    // convert Map → Array
    return Array.from(schoolMap.values()).map((s: any) => ({
      ...s,
      subjects: Array.from(s.subjects.values()),
    }));
  }, [filteredPolicies]);

  return (
    <div className="flex h-screen bg-gray-50">
      <HeaderWithBack title="Thống kê" />

      {/* ===== SIDEBAR DESKTOP ===== */}
      <div className="hidden md:block w-72 mt-[64px] h-[calc(100vh-64px)]">
        <SidebarRegion
          employeeId={employeeId}
          data={byProvince}
          selected={selectedProvince}
          onSelect={(id: number) => {
            setSelectedProvince(id);
            setSelectedSchool(null);
            setSelectedSubject(null);
          }}
          onSelectSchool={(schoolId: number) => {
            setSelectedSchool(schoolId);
            setSelectedSubject(null);
          }}
        />
      </div>

      {/* ===== SIDEBAR MOBILE (DRAWER) ===== */}
      {openSidebar && (
        <div className="fixed inset-0 z-50 flex mt-[56px]">
          <div className="w-72 bg-white shadow">
            <SidebarRegion
              employeeId={employeeId}
              data={byProvince}
              selected={selectedProvince}
              onSelect={(id: number) => {
                setSelectedProvince(id);
                setSelectedSchool(null);
                setSelectedSubject(null);
              }}
              onSelectSchool={(schoolId: number) => {
                setSelectedSchool(schoolId);
                setSelectedSubject(null);
              }}
            />
          </div>
          <div
            className="flex-1 bg-black/30"
            onClick={() => setOpenSidebar(false)}
          />
        </div>
      )}

      {/* ===== MAIN ===== */}
      <div className="flex-1 p-4 md:p-6 overflow-auto mt-[45px]">
        {/* ===== MOBILE HEADER ===== */}
        <div className="md:hidden mb-4">
          <div className="flex items-center gap-2">
            {/* MENU */}
            <button
              onClick={() => setOpenSidebar(true)}
              className="
                h-11 w-11 shrink-0
                flex items-center justify-center
                rounded-xl border
                bg-white shadow-sm
                active:scale-95 transition
            "
            >
              ☰
            </button>

            {/* NĂM HỌC */}
            <select
              className="
                h-11 flex-1 min-w-0
                rounded-xl border bg-white
                px-2 text-sm
                shadow-sm
                outline-none
                focus:ring-2 focus:ring-blue-200
            "
              value={selectedYear || ""}
              onChange={(e) => setSelectedYear(e.target.value || null)}
            >
              <option value="">🎓 Năm học</option>

              {schoolYears.map((y: string) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* MÔN HỌC */}
            <select
              className="
                h-11 flex-1 min-w-0
                rounded-xl border bg-white
                px-2 text-sm
                shadow-sm
                outline-none
                focus:ring-2 focus:ring-blue-200
            "
              value={selectedSubject || ""}
              onChange={(e) =>
                setSelectedSubject(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
            >
              <option value="">📚 Môn học</option>

              {subjectsFilter.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* RESET */}
            <button
              onClick={resetFilters}
              className="
                h-11 px-3 shrink-0
                rounded-xl
                bg-red-50
                text-red-600
                border border-red-100
                text-sm font-medium
                active:scale-95 transition
            "
            >
              ✕
            </button>
          </div>
          {/* KỲ THU CHI MOBILE */}
          <select
            className="h-11 w-full rounded-xl border bg-white px-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-200 mt-2"
            value={selectedPeriodId || ""}
            onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">📅 Kỳ thu chi</option>
            {expensePeriods.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name || `${String(p.month).padStart(2, "0")}/${p.year}`}
              </option>
            ))}
          </select>
        </div>
        {/* ===== DESKTOP FILTER ===== */}
        <div className="hidden md:flex items-center gap-3 mb-4 bg-white p-4 rounded-2xl shadow-sm border">
          {/* NĂM HỌC */}
          <select
            className="border rounded-xl px-3 py-2 text-sm min-w-[180px]"
            value={selectedYear || ""}
            onChange={(e) => setSelectedYear(e.target.value || null)}
          >
            <option value="">🎓 Tất cả năm học</option>

            {schoolYears.map((y: string) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            className="border rounded-xl px-3 py-2 text-sm min-w-[220px]"
            value={selectedDevice}
            onChange={(event) => setSelectedDevice(event.target.value)}
          >
            <option value="">📦 Chọn thiết bị</option>
            {deviceOptions.map((device) => (
              <option key={device.key} value={device.key}>
                {device.name}
              </option>
            ))}
          </select>

          {/* KỲ THU CHI */}
          <select
            className="border rounded-xl px-3 py-2 text-sm min-w-[200px]"
            value={selectedPeriodId || ""}
            onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">📅 Kỳ thu chi</option>
            {expensePeriods.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name || `${String(p.month).padStart(2, "0")}/${p.year}`}
              </option>
            ))}
          </select>

          {/* MÔN HỌC */}
          <select
            className="border rounded-xl px-3 py-2 text-sm min-w-[220px]"
            value={selectedSubject || ""}
            onChange={(e) =>
              setSelectedSubject(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">📚 Tất cả môn học</option>

            {subjectsFilter.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* RESET */}
          <button
            onClick={resetFilters}
            className="
            px-4 py-2 rounded-xl
            bg-red-50 text-red-600
            hover:bg-red-100
            text-sm font-medium
            transition
        "
          >
            Reset filter
          </button>
        </div>
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <PackageSearch size={18} className="text-blue-600" />
            Lọc thiết bị đã cấp
          </label>
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={selectedDevice}
            onChange={(event) => setSelectedDevice(event.target.value)}
          >
            <option value="">Chọn loại thiết bị</option>
            {deviceOptions.map((device) => (
              <option key={device.key} value={device.key}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        {selectedDevice && (
          <section className="mb-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            <div className="flex flex-col gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                  Thiết bị đã cấp
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-xl font-bold">
                  <Boxes size={22} />
                  {selectedDeviceName}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
                  <p className="text-xs text-blue-100">Số trường</p>
                  <p className="text-xl font-bold">{deviceAllocations.length}</p>
                </div>
                <div className="rounded-xl bg-white/15 px-4 py-2 text-center backdrop-blur">
                  <p className="text-xs text-blue-100">Tổng số lượng</p>
                  <p className="text-xl font-bold">
                    {totalSelectedDeviceQuantity.toLocaleString("vi-VN", {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>

            {deviceAllocations.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {deviceAllocations.map((allocation, index) => (
                  <div
                    key={allocation.schoolId}
                    className="grid gap-3 px-5 py-4 transition hover:bg-blue-50/40 sm:grid-cols-[44px_minmax(0,1fr)_140px] sm:items-center"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700">
                      {index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-bold text-slate-800">
                        <School size={17} className="shrink-0 text-blue-600" />
                        <span className="truncate">{allocation.schoolName}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin size={14} className="shrink-0" />
                        {[allocation.wardName, allocation.provinceName]
                          .filter(Boolean)
                          .join(", ") || "Chưa có thông tin khu vực"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {allocation.details.map((detail, detailIndex) => (
                          <span
                            key={`${detail.policyId}-${detailIndex}`}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                          >
                            {detail.subjectName || "Chính sách"}
                            {detail.schoolYear ? ` • ${detail.schoolYear}` : ""}
                            {allocation.details.length > 1
                              ? ` • SL ${detail.quantity.toLocaleString("vi-VN", {
                                  maximumFractionDigits: 2,
                                })}`
                              : ""}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
                      <p className="text-xs font-semibold uppercase text-emerald-600">
                        Số lượng
                      </p>
                      <p className="mt-1 text-2xl font-black text-emerald-700">
                        {allocation.quantity.toLocaleString("vi-VN", {
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Không có trường nào được cấp thiết bị này trong bộ lọc hiện tại.
              </div>
            )}
          </section>
        )}
        <ExpenseStatsSection
          policies={expenseScopedPolicies}
          restrictToPolicySchools
          subjectId={selectedSubject}
          employeeId={Number(employeeId) || undefined}
        />
        {/* ===== LOADING ===== */}
        {(isLoading || isFetching) && <LoadingOverlay />}

        {viewMode === "table" && (
          <div className="space-y-6 mt-4">
            {treeData.map((school: any) => (
              <div
                key={school.schoolId}
                className="bg-white rounded-xl shadow border"
              >
                {/* ===== SCHOOL HEADER ===== */}
                <SchoolHeader school={school} />

                <div className="overflow-x-auto">
                  <table className="min-w-[1200px] text-sm w-full">
                    <thead className="bg-blue-600 text-white">
                      <tr>
                        <th className="px-3 py-2 text-left sticky left-0 bg-blue-600 z-20">
                          Môn học
                        </th>
                        <th className="px-3 py-2 text-left">Sĩ số</th>
                        <th className="px-3 py-2 text-left">Số tiết</th>
                        <th className="px-3 py-2 text-left">Hợp đồng</th>
                        <th className="px-3 py-2 text-left">Năm học</th>
                        <th className="px-3 py-2 text-left">Học phí</th>
                        <th className="px-3 py-2 text-left">Số tháng</th>
                        <th className="px-3 py-2 text-left">Sĩ số lớp</th>
                        <th className="px-3 py-2 text-left">CSVC</th>
                        <th className="px-3 py-2 text-left">Thuế</th>
                        <th className="px-3 py-2 text-left">GV trường</th>
                        <th className="px-3 py-2 text-left">GV công ty</th>
                        <th className="px-3 py-2 text-left">CS tháng</th>
                        <th className="px-3 py-2 text-left">CS ký HĐ</th>
                        <th className="px-3 py-2 text-left">Thiết bị</th>
                        <th className="px-3 py-2 text-left">Giáo cụ</th>
                        <th className="px-3 py-2 text-left">Thuế TNDN</th>
                        <th className="px-3 py-2 text-left">Vận hành</th>
                        <th className="px-3 py-2 text-left">CTY thu</th>
                      </tr>
                    </thead>

                    <tbody>
                      {school.subjects.flatMap((sub: any) =>
                        sub.policies.flatMap((p: any) => {
                          const devices = p.policyData?.htthietbi || [];
                          const cash = p.policyData?.httienmat || [];

                          return [
                            // ===== MAIN ROW =====
                            <tr
                              key={`main-${p.policyId}`}
                              className="border-b hover:bg-gray-50 cursor-pointer"
                              onClick={() => setOpenPolicy(p)}
                            >
                              <td className="px-3 py-2 sticky left-0 bg-yellow-200 font-medium">
                                {sub.name}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.studentCount}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.totalLessons}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.contractNumber}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.schoolYear}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.fee?.toLocaleString()}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.durationMonths || "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.studentPerClass || "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.csvc?.toLocaleString() || "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.tax?.toLocaleString() || "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.giaovien?.toLocaleString() ||
                                  "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.teacherCompany?.toLocaleString() ||
                                  "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.csthang?.toLocaleString() ||
                                  "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.cdhd?.toLocaleString() || "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.thietbi?.toLocaleString() ||
                                  "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.giaoCu?.toLocaleString() || "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.thuetndn?.toLocaleString() ||
                                  "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {p.policyData.vanHanh?.toLocaleString() ||
                                  "N/A"}
                              </td>
                              <td className="bg-yellow-100 px-3 py-2">
                                {getProfit(p)?.toLocaleString() || "N/A"}
                              </td>
                            </tr>,

                            // ===== DEVICES =====
                            ...devices.map((d: any, i: number) => (
                              <tr
                                key={`device-${p.policyId}-${i}`}
                                className="bg-gray-100 text-xs"
                              >
                                <td className="bg-gray-200">Thiết bị</td>
                                <td className="px-3 py-2 sticky left-0 bg-gray-100 pl-6">
                                  └ {d.category}
                                </td>
                                <td className="px-3 py-2">SL: {d.qty}</td>
                                <td className="px-3 py-2">
                                  {d.price?.toLocaleString()}
                                </td>
                                <td className="px-3 py-2">{d.students} HS</td>
                                <td className="px-3 py-2">{d.months} tháng</td>
                              </tr>
                            )),

                            // ===== CASH =====
                            ...cash.map((m: any, i: number) => (
                              <tr
                                key={`cash-${p.policyId}-${i}`}
                                className="bg-blue-100 text-xs"
                              >
                                <td className="bg-blue-200">Tiền mặt</td>
                                <td className="px-3 py-2 sticky left-0 bg-blue-100 pl-6">
                                  └ 💰 {m.type}
                                </td>
                                <td className="px-3 py-2">
                                  {m.money?.toLocaleString()}
                                </td>
                                <td className="px-3 py-2">{m.students} HS</td>
                                <td className="px-3 py-2">{m.months} tháng</td>
                                <td></td>
                              </tr>
                            )),

                            // ===== SUGGEST STATS =====
                            ...(suggestStats[p.policyId]?.suggests?.map(
                              (sg: any, i: number) => (
                                <tr
                                  key={`suggest-${p.policyId}-${i}`}
                                  className="bg-orange-50 text-xs"
                                >
                                  <td className="bg-orange-200 px-3 py-2 font-medium sticky left-0">
                                    📝 Đề xuất #{sg.id}
                                  </td>
                                  <td className="px-3 py-2">
                                    {sg.fileUrl && (
                                      <a
                                        href={`https://sales.kidoedu.vn${sg.fileUrl}`}
                                        target="_blank"
                                        className="text-blue-500"
                                      >
                                        📎 File đính kèm
                                      </a>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">{sg.content}</td>
                                  <td className="px-3 py-2 text-gray-500">
                                    {sg.component}
                                  </td>
                                  <td className="px-3 py-2 text-gray-500">
                                    {sg.issueDate}
                                  </td>
                                  <td className="px-3 py-2" colSpan={13}>
                                    {sg.description}
                                  </td>
                                </tr>
                              ),
                            ) || []),
                          ];
                        }),
                      )}
                    </tbody>
                  </table>
                </div>

                {/* EXPENSE INLINE */}
                {(() => {
                  const expense = schoolExpenses.get(school.schoolId);
                  if (!expense) return null;

                  const s = expense.summary?.summary || expense.summary || {};
                  const revenueItems = s.revenueItems || [];
                  const schoolItems = s.schoolExpenseItems || [];
                  const mgmtItems = s.managementExpenseItems || [];

                  const totalRevenue = revenueItems.reduce((sum: number, r: any) =>
                    sum + Number(r.unitPrice || 0) * Number(r.studentCount || 0) * Number(r.monthsCount || 0), 0);
                  const totalRevenuePaid = revenueItems.reduce((sum: number, r: any) =>
                    sum + Number(r.paidAmount || 0), 0);
                  const totalSchoolExp = schoolItems.reduce((sum: number, r: any) => {
                    const st = Number(r.studentCount || 0);
                    const mo = Number(r.monthsCount || 0);
                    return sum + (Number(r.teacherUnitPrice || r.giaovien || 0) + Number(r.taxUnitPrice || r.thue || 0) + Number(r.csvcUnitPrice || r.csvc || 0)) * st * mo;
                  }, 0);
                  const totalSchoolPaid = schoolItems.reduce((sum: number, r: any) =>
                    sum + Number(r.paidAmount || 0), 0);
                  const totalMgmt = mgmtItems.reduce((sum: number, r: any) => {
                    const st = Number(r.studentCount || 0);
                    const mo = Number(r.monthsCount || 0);
                    return sum + (Number(r.ql1UnitPrice || 0) + Number(r.ql2UnitPrice || 0)) * st * mo;
                  }, 0);
                  const totalMgmtPaid = mgmtItems.reduce((sum: number, r: any) =>
                    sum + Number(r.paidAmount || 0), 0);

                  const fmt = (v: number) => v.toLocaleString("vi-VN");

                  return (
                    <div className="border-t-2 border-emerald-300 bg-emerald-50 p-4">
                      <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <Calendar size={16} />
                        Thu chi {selectedPeriodId
                          ? `kỳ: ${expensePeriods.find((p: any) => p.id === selectedPeriodId)?.name || ""}`
                          : "(tất cả kỳ)"}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Doanh thu</p>
                          <p className="text-lg font-bold text-emerald-700">{fmt(totalRevenue)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Đã thu</p>
                          <p className="text-lg font-bold text-blue-700">{fmt(totalRevenuePaid)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Công nợ thu</p>
                          <p className="text-lg font-bold text-amber-700">{fmt(totalRevenue - totalRevenuePaid)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Chi trường</p>
                          <p className="text-lg font-bold text-violet-700">{fmt(totalSchoolExp)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Đã chi trường</p>
                          <p className="text-lg font-bold text-rose-700">{fmt(totalSchoolPaid)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Còn chi trường</p>
                          <p className="text-lg font-bold text-orange-700">{fmt(totalSchoolExp - totalSchoolPaid)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Chi ngoài</p>
                          <p className="text-lg font-bold text-cyan-700">{fmt(totalMgmt)}đ</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border">
                          <p className="text-slate-500 font-medium">Còn chi ngoài</p>
                          <p className="text-lg font-bold text-orange-700">{fmt(totalMgmt - totalMgmtPaid)}đ</p>
                        </div>
                      </div>

                      {/* DETAIL TABLES */}
                      {revenueItems.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <p className="text-xs font-bold text-emerald-700 mb-1">Doanh thu chi tiết</p>
                          <table className="w-full text-xs border-collapse">
                            <thead className="bg-emerald-700 text-white">
                              <tr>
                                <th className="px-2 py-1 text-left">Nội dung</th>
                                <th className="px-2 py-1">Số tiết</th>
                                <th className="px-2 py-1">Học sinh</th>
                                <th className="px-2 py-1">Tháng</th>
                                <th className="px-2 py-1">Đơn giá</th>
                                <th className="px-2 py-1">Thành tiền</th>
                                <th className="px-2 py-1">Đã thu</th>
                                <th className="px-2 py-1">Còn lại</th>
                              </tr>
                            </thead>
                            <tbody>
                              {revenueItems.map((r: any, i: number) => {
                                const amount = Number(r.unitPrice || 0) * Number(r.studentCount || 0) * Number(r.monthsCount || 0);
                                const paid = Number(r.paidAmount || 0);
                                return (
                                  <tr key={i} className="border-b hover:bg-emerald-100">
                                    <td className="px-2 py-1">{r.content || "-"}</td>
                                    <td className="px-2 py-1 text-center">{r.totalPeriods}</td>
                                    <td className="px-2 py-1 text-center">{r.studentCount}</td>
                                    <td className="px-2 py-1 text-center">{r.monthsCount}</td>
                                    <td className="px-2 py-1 text-right">{fmt(Number(r.unitPrice || 0))}</td>
                                    <td className="px-2 py-1 text-right font-semibold">{fmt(amount)}</td>
                                    <td className="px-2 py-1 text-right text-blue-600">{fmt(paid)}</td>
                                    <td className="px-2 py-1 text-right text-amber-600 font-semibold">{fmt(amount - paid)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {schoolItems.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <p className="text-xs font-bold text-violet-700 mb-1">Chi trường chi tiết</p>
                          <table className="w-full text-xs border-collapse">
                            <thead className="bg-violet-700 text-white">
                              <tr>
                                <th className="px-2 py-1">HS</th>
                                <th className="px-2 py-1">Tháng</th>
                                <th className="px-2 py-1">ĐG GV</th>
                                <th className="px-2 py-1">ĐG Thuế</th>
                                <th className="px-2 py-1">ĐG CSVC</th>
                                <th className="px-2 py-1">Tổng chi</th>
                                <th className="px-2 py-1">Đã chi</th>
                                <th className="px-2 py-1">Còn lại</th>
                              </tr>
                            </thead>
                            <tbody>
                              {schoolItems.map((r: any, i: number) => {
                                const st = Number(r.studentCount || 0);
                                const mo = Number(r.monthsCount || 0);
                                const total = (Number(r.teacherUnitPrice || r.giaovien || 0) + Number(r.taxUnitPrice || r.thue || 0) + Number(r.csvcUnitPrice || r.csvc || 0)) * st * mo;
                                const paid = Number(r.paidAmount || 0);
                                return (
                                  <tr key={i} className="border-b hover:bg-violet-100">
                                    <td className="px-2 py-1 text-center">{st}</td>
                                    <td className="px-2 py-1 text-center">{mo}</td>
                                    <td className="px-2 py-1 text-right">{fmt(Number(r.teacherUnitPrice || r.giaovien || 0))}</td>
                                    <td className="px-2 py-1 text-right">{fmt(Number(r.taxUnitPrice || r.thue || 0))}</td>
                                    <td className="px-2 py-1 text-right">{fmt(Number(r.csvcUnitPrice || r.csvc || 0))}</td>
                                    <td className="px-2 py-1 text-right font-semibold">{fmt(total)}</td>
                                    <td className="px-2 py-1 text-right text-rose-600">{fmt(paid)}</td>
                                    <td className="px-2 py-1 text-right text-orange-600 font-semibold">{fmt(total - paid)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {mgmtItems.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <p className="text-xs font-bold text-cyan-700 mb-1">Chi ngoài chi tiết</p>
                          <table className="w-full text-xs border-collapse">
                            <thead className="bg-cyan-700 text-white">
                              <tr>
                                <th className="px-2 py-1">HS</th>
                                <th className="px-2 py-1">Tháng</th>
                                <th className="px-2 py-1">ĐG QL1</th>
                                <th className="px-2 py-1">ĐG QL2</th>
                                <th className="px-2 py-1">Tổng chi</th>
                                <th className="px-2 py-1">Đã chi</th>
                                <th className="px-2 py-1">Còn lại</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mgmtItems.map((r: any, i: number) => {
                                const st = Number(r.studentCount || 0);
                                const mo = Number(r.monthsCount || 0);
                                const total = (Number(r.ql1UnitPrice || 0) + Number(r.ql2UnitPrice || 0)) * st * mo;
                                const paid = Number(r.paidAmount || 0);
                                return (
                                  <tr key={i} className="border-b hover:bg-cyan-100">
                                    <td className="px-2 py-1 text-center">{st}</td>
                                    <td className="px-2 py-1 text-center">{mo}</td>
                                    <td className="px-2 py-1 text-right">{fmt(Number(r.ql1UnitPrice || 0))}</td>
                                    <td className="px-2 py-1 text-right">{fmt(Number(r.ql2UnitPrice || 0))}</td>
                                    <td className="px-2 py-1 text-right font-semibold">{fmt(total)}</td>
                                    <td className="px-2 py-1 text-right text-rose-600">{fmt(paid)}</td>
                                    <td className="px-2 py-1 text-right text-orange-600 font-semibold">{fmt(total - paid)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {expenseLoading && (
                  <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 italic flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    Đang tải thu chi...
                  </div>
                )}
                {!schoolExpenses.has(school.schoolId) && !expenseLoading && (
                  <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 italic">
                    Chưa có dữ liệu thu chi
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {viewMode === "card" && (
          <div className="space-y-4 mt-4">
            {treeData.map((school: any) => (
              <div key={school.schoolId} className="space-y-2">
                <SchoolInfoCard p={school} />
                <div className="relative ml-3 mt-2">
                  {/* TRỤC CHÍNH nối từ school xuống */}
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-500" />

                  <div className="space-y-4 pl-6">
                    {/* SUBJECT */}
                    {school.subjects.map((sub: any) => (
                      <div key={sub.id} className="space-y-2 ml-2">
                        <div className="relative flex items-center gap-2">
                          {/* LINE ngang */}
                          <span className="absolute -left-4 top-1/2 w-4 h-px bg-gray-500" />

                          <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">
                            Môn
                          </span>

                          <p className="font-semibold text-gray-800 text-sm">
                            {sub.name}
                          </p>
                        </div>

                        {/* CARD */}
                        <div className="ml-4 mt-2 relative">
                          {/*                                                     <div className="absolute left-[-10px] top-0 bottom-0 w-px bg-gray-400" />
                           */}{" "}
                          {sub.policies.map((p: any) => {
                            const policyId = getPolicyId(p);
                            const suggestOfPolicy = suggestStats[policyId];

                            console.log("CARD policyId:", policyId);
                            console.log(
                              "ALL suggest keys:",
                              Object.keys(suggestStats),
                            );
                            console.log(
                              "CARD suggestOfPolicy:",
                              suggestOfPolicy,
                            );
                            return (
                              <div
                                key={policyId}
                                className="bg-white rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3 mt-2"
                              >
                                {/* TOP (click mở/đóng) */}
                                <div
                                  onClick={() => {
                                    setSelectedSubject(sub.id);
                                    setOpenPolicy(p);
                                  }}
                                  className="flex justify-between items-start cursor-pointer"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                      📘
                                    </div>

                                    <div>
                                      <p className="font-semibold text-gray-900 text-sm">
                                        {p.name}
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        👨‍🎓 Học sinh: {p?.studentCount || 0}
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        📚 Số tiết: {p?.totalLessons || 0}
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        📄 HĐ: {p?.contractNumber || "-"}
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        ⏳ Thời hạn HĐ: {p?.contractYears || 0}{" "}
                                        năm
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        📎 Phụ lục: {p?.appendixYears || 0} năm
                                      </p>

                                      <p className="text-xs text-gray-400">
                                        📅 Khai giảng:{" "}
                                        {p?.startDate
                                          ? new Date(
                                              p.startDate,
                                            ).toLocaleDateString("vi-VN")
                                          : ""}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* SCHOOL YEAR */}
                                <div className="text-center text-sm font-medium text-gray-700">
                                  🎓 {p?.schoolYear || "-"}
                                </div>

                                {/* SUGGEST STATS */}
                                {/*         {suggestOfPolicy?.suggests?.length > 0 && (
                                  <div className="space-y-2">
                                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                                      📝 {suggestOfPolicy.total} đề xuất
                                    </span>
                                    {suggestOfPolicy.suggests.map((sg: any) => (
                                      <div
                                        key={sg.id}
                                        className="bg-orange-50 rounded-xl p-3 text-xs space-y-1"
                                      >
                                        <div className="flex justify-between">
                                          <span className="font-medium text-gray-800">
                                            {sg.content}
                                          </span>
                                          <span className="text-gray-400">
                                            {sg.issueDate}
                                          </span>
                                        </div>
                                        {sg.description && (
                                          <p className="text-gray-500">
                                            {sg.description}
                                          </p>
                                        )}
                                        <div className="flex gap-3 text-gray-400">
                                          {sg.component && (
                                            <span>🧩 {sg.component}</span>
                                          )}
                                          {sg.fileUrl && (
                                            <a
                                              href={`https://sales.kidoedu.vn${sg.fileUrl}`}
                                              target="_blank"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="text-blue-500"
                                            >
                                              📎 File
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )} */}

                                {/* EXPAND POLICY */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  className="p-3 bg-gray-50 rounded-xl cursor-pointer active:scale-95"
                                >
                                  📄Mã hợp đồng: {p?.contractNumber}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {openPolicy && (
        <PolicyPopup data={openPolicy} onClose={() => setOpenPolicy(null)} />
      )}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 border">
        <button
          onClick={() => setViewMode("card")}
          className={`px-4 py-2 rounded-full text-sm ${
            viewMode === "card" ? "bg-blue-500 text-white" : "text-gray-600"
          }`}
        >
          Card
        </button>

        <button
          onClick={() => setViewMode("table")}
          className={`px-4 py-2 rounded-full text-sm ${
            viewMode === "table" ? "bg-blue-500 text-white" : "text-gray-600"
          }`}
        >
          Excel
        </button>
      </div>
    </div>
  );
}

//
// ===== COMPONENTS =====
//

function StatCard({ title, value }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <div className="text-gray-500 text-sm">{title}</div>
      <div className="text-2xl font-bold">{value || 0}</div>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
      <div className="bg-white px-6 py-3 rounded-lg shadow">Loading...</div>
    </div>
  );
}
function SchoolHeader({ school }: any) {
  return (
    <div className="bg-white rounded-xl shadow border p-4 mb-4 space-y-2">
      <div className="text-xl font-bold text-blue-700">
        🏫 {school.schoolName}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
        <div>
          📍 <b>Địa chỉ:</b> {school.address}
        </div>
        <div>
          👤 <b>Đại diện:</b> {school.representative}
        </div>
        <div>
          📞 <b>SĐT:</b> {school.phone}
        </div>
        <div>
          🧾 <b>MST:</b> {school.taxCode}
        </div>
        <div>
          🏙 <b>Khu vực:</b> {school.wardName}, {school.provinceName}
        </div>
        <div>
          👨‍🎓 <b>Sĩ số:</b> {school.scale}
        </div>
        <div>
          🏫 <b>Số lớp:</b> {school.classCount}
        </div>
        <div>
          📚 <b>Số môn:</b> {school.subjects?.length}
        </div>
      </div>
    </div>
  );
}
