import { useEffect, useMemo, useState } from "react";
import { usePolicyStats } from "./hooks/usePolicyStats";
import SidebarRegion from "./components/SidebarRegion";
import HeaderWithBack from "@/components/HeaderWithBack";
import PolicyPopup from "./components/PolicyPopup";
import SchoolInfoCard from "./components/SchoolInfoCard";
import { useParams } from "react-router-dom";

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
    const { data, isLoading, isFetching } = usePolicyStats(filters);
    console.log("data", data)
    const [openPolicy, setOpenPolicy] = useState<any>(null);
    const [viewMode, setViewMode] = useState<"card" | "table">("card");
    const [allPolicies, setAllPolicies] = useState<any[]>([]);
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
    }, [allPolicies, selectedProvince, selectedSchool, selectedYear, selectedSubject]);
    useEffect(() => {
        if (data) {
            setAllPolicies(data);
        }
    }, [data]);
    const resetFilters = () => {
        setSelectedProvince(null);
        setSelectedSchool(null);
        setSelectedSubject(null);
        setSelectedYear(null);
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
                filteredPolicies
                    .map((i: any) => i.schoolYear)
                    .filter(Boolean)
            ),
        ];
    }, [filteredPolicies]);
    const getProfit = (p: any) => {
        const d = p.policyData || {};

        return (d.fee || 0)
            - (d.csvc || 0)
            - (d.thue || 0)
            - (d.giaovien || 0)
            - (d.csthang || 0)
            - (d.thietbi || 0)
            - (d.giaoCu || 0)
            - (d.vanHanh || 0)
            - (d.thuetndn || 0);
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
                (p: any) => p.policyId === item.policyId
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
                            onChange={(e) =>
                                setSelectedYear(e.target.value || null)
                            }
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
                                    e.target.value
                                        ? Number(e.target.value)
                                        : null
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
                </div>
                {/* ===== DESKTOP FILTER ===== */}
                <div className="hidden md:flex items-center gap-3 mb-4 bg-white p-4 rounded-2xl shadow-sm border">

                    {/* NĂM HỌC */}
                    <select
                        className="border rounded-xl px-3 py-2 text-sm min-w-[180px]"
                        value={selectedYear || ""}
                        onChange={(e) =>
                            setSelectedYear(e.target.value || null)
                        }
                    >
                        <option value="">🎓 Tất cả năm học</option>

                        {schoolYears.map((y: string) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>

                    {/* MÔN HỌC */}
                    <select
                        className="border rounded-xl px-3 py-2 text-sm min-w-[220px]"
                        value={selectedSubject || ""}
                        onChange={(e) =>
                            setSelectedSubject(
                                e.target.value
                                    ? Number(e.target.value)
                                    : null
                            )
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
                {/* ===== LOADING ===== */}
                {(isLoading || isFetching) && <LoadingOverlay />}

                {viewMode === "table" && (
                    <div className="space-y-6 mt-4">

                        {treeData.map((school: any) => (
                            <div key={school.schoolId} className="bg-white rounded-xl shadow border">

                                {/* ===== SCHOOL HEADER ===== */}
                                <SchoolHeader school={school} />

                                <div className="overflow-x-auto">
                                    <table className="min-w-[1200px] text-sm w-full">
                                        <thead className="bg-blue-600 text-white">
                                            <tr>
                                                <th className="px-3 py-2 text-left sticky left-0 bg-blue-600 z-20">Môn học</th>
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
                                                            <td className="bg-yellow-100 px-3 py-2">{p.studentCount}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.totalLessons}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.contractNumber}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.schoolYear}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.fee?.toLocaleString()}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.durationMonths || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.studentPerClass || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.csvc?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.tax?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.giaovien?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.teacherCompany?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.csthang?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.cdhd?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.thietbi?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.giaoCu?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.thuetndn?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{p.policyData.vanHanh?.toLocaleString() || 'N/A'}</td>
                                                            <td className="bg-yellow-100 px-3 py-2">{getProfit(p)?.toLocaleString() || 'N/A'}</td>
                                                        </tr>,

                                                        // ===== DEVICES =====
                                                        ...devices.map((d: any, i: number) => (
                                                            <tr key={`device-${p.policyId}-${i}`} className="bg-gray-100 text-xs">
                                                                <td className="bg-gray-200">Thiết bị</td>
                                                                <td className="px-3 py-2 sticky left-0 bg-gray-100 pl-6">
                                                                    └ {d.category}
                                                                </td>
                                                                <td className="px-3 py-2">SL: {d.qty}</td>
                                                                <td className="px-3 py-2">{d.price?.toLocaleString()}</td>
                                                                <td className="px-3 py-2">{d.students} HS</td>
                                                                <td className="px-3 py-2">{d.months} tháng</td>
                                                            </tr>
                                                        )),

                                                        // ===== CASH =====
                                                        ...cash.map((m: any, i: number) => (
                                                            <tr key={`cash-${p.policyId}-${i}`} className="bg-blue-100 text-xs">
                                                                <td className="bg-blue-200">Tiền mặt</td>
                                                                <td className="px-3 py-2 sticky left-0 bg-blue-100 pl-6">
                                                                    └ 💰 {m.type}
                                                                </td>
                                                                <td className="px-3 py-2">{m.money?.toLocaleString()}</td>
                                                                <td className="px-3 py-2">{m.students} HS</td>
                                                                <td className="px-3 py-2">{m.months} tháng</td>
                                                                <td></td>
                                                            </tr>
                                                        )),
                                                    ];
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
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
 */}                                                    {sub.policies.map((p: any) => (
                                                        <div
                                                            key={p.id}
                                                            className="bg-white rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3 mt-2"
                                                        >
                                                            {/* TOP (click mở/đóng) */}
                                                            <div
                                                                onClick={() => {
                                                                    setSelectedSubject(sub.id);
                                                                    setOpenPolicy(p);
                                                                }

                                                                }
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
                                                                            ⏳ Thời hạn HĐ: {p?.contractYears || 0} năm
                                                                        </p>

                                                                        <p className="text-xs text-gray-400">
                                                                            📎 Phụ lục: {p?.appendixYears || 0} năm
                                                                        </p>

                                                                        <p className="text-xs text-gray-400">
                                                                            📅 Khai giảng:{" "}
                                                                            {p?.startDate
                                                                                ? new Date(p.startDate).toLocaleDateString("vi-VN")
                                                                                : ""}
                                                                        </p>
                                                                    </div>
                                                                </div>


                                                            </div>

                                                            {/* SCHOOL YEAR */}
                                                            <div className="text-center text-sm font-medium text-gray-700">
                                                                🎓 {p?.schoolYear || "-"}
                                                            </div>

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
                                                    ))}
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
            {
                openPolicy && (
                    <PolicyPopup
                        data={openPolicy}
                        onClose={() => setOpenPolicy(null)}
                    />
                )
            }
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white shadow-lg rounded-full px-2 py-1 flex gap-1 border">
                <button
                    onClick={() => setViewMode("card")}
                    className={`px-4 py-2 rounded-full text-sm ${viewMode === "card"
                        ? "bg-blue-500 text-white"
                        : "text-gray-600"
                        }`}
                >
                    Card
                </button>

                <button
                    onClick={() => setViewMode("table")}
                    className={`px-4 py-2 rounded-full text-sm ${viewMode === "table"
                        ? "bg-blue-500 text-white"
                        : "text-gray-600"
                        }`}
                >
                    Excel
                </button>
            </div>
        </div >
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
            <div className="bg-white px-6 py-3 rounded-lg shadow">
                Loading...
            </div>
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
                <div>📍 <b>Địa chỉ:</b> {school.address}</div>
                <div>👤 <b>Đại diện:</b> {school.representative}</div>
                <div>📞 <b>SĐT:</b> {school.phone}</div>
                <div>🧾 <b>MST:</b> {school.taxCode}</div>
                <div>🏙 <b>Khu vực:</b> {school.wardName}, {school.provinceName}</div>
                <div>👨‍🎓 <b>Sĩ số:</b> {school.scale}</div>
                <div>🏫 <b>Số lớp:</b> {school.classCount}</div>
                <div>📚 <b>Số môn:</b> {school.subjects?.length}</div>
            </div>
        </div>
    );
}