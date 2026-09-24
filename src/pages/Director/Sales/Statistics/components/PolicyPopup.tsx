import { useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

/** Một hue duy nhất cho mọi mark — cả hai biểu đồ đều chỉ có 1 chuỗi số liệu. */
const SERIES = "#2563eb";
const GRID = "#e2e8f0";
const AXIS_TEXT = "#64748b";

/**
 * Các khoản trừ vào học phí. Cùng danh sách với `getProfit` của trang thống kê —
 * lệch một khoản là biểu đồ và cột "CTY thu" của bảng nói hai con số khác nhau.
 */
const COST_FIELDS: { key: string; label: string }[] = [
    { key: "csvc", label: "CSVC" },
    { key: "thue", label: "Thuế" },
    { key: "giaovien", label: "Giáo viên" },
    { key: "csthang", label: "CS tháng" },
    { key: "thietbi", label: "Thiết bị" },
    { key: "giaoCu", label: "Giáo cụ" },
    { key: "vanHanh", label: "Vận hành" },
    { key: "thuetndn", label: "Thuế TNDN" },
];

const num = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatVND = (value: number) => `${Math.round(value).toLocaleString("vi-VN")}đ`;

// Mốc mặc định cố định — khớp với MoneyForm/DeviceForm bên màn nhân viên.
const DEFAULT_STUDENTS = 1000;
const DEFAULT_MONTHS = 9;
const DEFAULT_PERIODS = 36;

/**
 * CS ký HĐ + Thành tiền của 1 dòng tiền mặt/thiết bị — công thức giống hệt
 * `MoneyForm.tsx` / `DeviceForm.tsx` bên form nhân viên, để số director xem ở
 * đây khớp với số nhân viên đã nhập, không lệch theo cách tính riêng.
 */
const computeRowAmounts = (thanhTienGoc: number, item: any, mode: "TIET" | "HS", studentPerClass: number) => {
    const realStudents = num(item.realStudents ?? item.students);
    const months = num(item.months);
    const realPeriods = num(item.realPeriods);

    if (mode === "TIET") {
        const donGia1Tiet = thanhTienGoc / DEFAULT_STUDENTS / DEFAULT_PERIODS;
        const thanhTienThucTe =
            donGia1Tiet > 0 && realStudents > 0 && realPeriods > 0
                ? Math.round(donGia1Tiet * realStudents * realPeriods)
                : 0;
        const csKyHD =
            thanhTienGoc > 0 && realPeriods > 0 && realStudents > 0 && studentPerClass > 0
                ? Math.round((thanhTienGoc / realPeriods / realStudents) * studentPerClass)
                : 0;
        return { csKyHD, thanhTienThucTe, realStudents, realPeriods, months };
    }

    const donGiaMacDinh = thanhTienGoc / DEFAULT_STUDENTS / DEFAULT_MONTHS;
    const thanhTienThucTe =
        donGiaMacDinh > 0 && realStudents > 0 && months > 0
            ? Math.round(donGiaMacDinh * realStudents * months)
            : 0;
    const csKyHD =
        thanhTienGoc > 0 && months > 0 && realStudents > 0
            ? Math.round(thanhTienGoc / months / realStudents)
            : 0;
    return { csKyHD, thanhTienThucTe, realStudents, realPeriods, months };
};

/** Trục tiền: 1.250.000.000 → "1,3 tỷ" để nhãn không tràn trong popup. */
const formatCompact = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} tỷ`;
    if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)} tr`;
    if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
    return String(Math.round(value));
};

export default function PolicyPopup({ data, onClose }: any) {
    const [tab, setTab] = useState<"doanhthu" | "tienmat" | "thietbi">("doanhthu");

    const raw = data?.policyData;

    // 🔥 normalize
    const tienmat = useMemo(() => {
        if (!raw) return [];

        if (Array.isArray(raw)) return raw; // case bạn test

        return raw?.httienmat || [];
    }, [raw]);

    const thietbi = useMemo(() => {
        if (!raw) return [];

        if (Array.isArray(raw)) return []; // array hiện tại là tiền mặt

        return raw?.htthietbi || [];
    }, [raw]);

    // Suy luận mode giống hệt FormCreate/DirectorEditPolicy: dữ liệu mới lưu rõ
    // `mode`, dữ liệu cũ suy theo có sĩ số lớp hay không.
    const policyMode = useMemo(() => {
        const p = Array.isArray(raw) ? {} : raw || {};
        if (p.mode === "TIET" || p.mode === "HS") return p.mode;
        return num(p.studentPerClass) > 0 ? "TIET" : "HS";
    }, [raw]);

    const studentPerClass = useMemo(() => {
        const p = Array.isArray(raw) ? {} : raw || {};
        return num(p.studentPerClass);
    }, [raw]);

    /**
     * Số liệu doanh thu. Các field trong `policyData` là **đơn giá 1 HS mỗi
     * tháng**, nên doanh thu = học phí × số HS của môn × số tháng hợp đồng.
     */
    const revenue = useMemo(() => {
        const policy = Array.isArray(raw) ? {} : raw || {};

        const feePerStudent = num(policy.fee);
        const students = num(data?.studentCount);
        const months = num(policy.durationMonths);

        const costs = COST_FIELDS.map((field) => ({
            label: field.label,
            value: num((policy as any)[field.key]),
        }));
        const costPerStudent = costs.reduce((sum, item) => sum + item.value, 0);
        const profitPerStudent = feePerStudent - costPerStudent;

        // Cơ cấu 1 HS/tháng: bỏ khoản bằng 0 để biểu đồ không đầy dòng trống.
        const breakdown = [
            { label: "Học phí", value: feePerStudent },
            ...costs,
            { label: "CTY thu", value: profitPerStudent },
        ].filter((item) => item.value !== 0);

        const monthly = feePerStudent * students;
        const cumulative = Array.from({ length: months }, (_, index) => ({
            month: `T${index + 1}`,
            value: monthly * (index + 1),
        }));

        return {
            feePerStudent,
            students,
            months,
            profitPerStudent,
            costPerStudent,
            breakdown,
            monthly,
            total: monthly * months,
            totalProfit: profitPerStudent * students * months,
            cumulative,
        };
    }, [raw, data?.studentCount]);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
            <div className="bg-white w-full md:w-[520px] rounded-t-2xl md:rounded-2xl p-4 space-y-4">

                {/* HEADER */}
                <div className="flex justify-between">
                    <div className="min-w-0">
                        <p className="font-semibold">Chi tiết policy</p>
                        {(data?.subjectName || data?.schoolName) && (
                            <p className="truncate text-xs text-slate-500">
                                {[data?.subjectName, data?.schoolName, data?.schoolYear]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose}>✕</button>
                </div>

                {/* TAB */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setTab("doanhthu")}
                        className={`px-3 py-1 rounded-full ${tab === "doanhthu"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100"
                            }`}
                    >
                        Doanh thu
                    </button>

                    <button
                        onClick={() => setTab("tienmat")}
                        className={`px-3 py-1 rounded-full ${tab === "tienmat"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100"
                            }`}
                    >
                        Tiền mặt
                    </button>

                    <button
                        onClick={() => setTab("thietbi")}
                        className={`px-3 py-1 rounded-full ${tab === "thietbi"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100"
                            }`}
                    >
                        Thiết bị
                    </button>
                </div>

                {/* CONTENT */}
                <div className="max-h-[70vh] overflow-auto space-y-3">

                    {/* ===== DOANH THU ===== */}
                    {tab === "doanhthu" && (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                <StatTile
                                    label="Doanh thu / tháng"
                                    value={formatCompact(revenue.monthly)}
                                />
                                <StatTile
                                    label={`Tổng ${revenue.months || 0} tháng`}
                                    value={formatCompact(revenue.total)}
                                />
                                <StatTile
                                    label="CTY thu"
                                    value={formatCompact(revenue.totalProfit)}
                                />
                            </div>

                            <p className="text-[11px] leading-relaxed text-slate-500">
                                Học phí {formatVND(revenue.feePerStudent)}/HS/tháng ·{" "}
                                {revenue.students.toLocaleString("vi-VN")} HS ·{" "}
                                {revenue.months} tháng hợp đồng.
                            </p>

                            {/* Doanh thu luỹ kế — 1 chuỗi số liệu nên không cần chú giải. */}
                            <section className="rounded-xl border border-slate-200 p-3">
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Doanh thu luỹ kế theo tháng
                                </h3>

                                {revenue.cumulative.length > 0 && revenue.monthly > 0 ? (
                                    <ResponsiveContainer width="100%" height={190}>
                                        <AreaChart
                                            data={revenue.cumulative}
                                            margin={{ top: 12, right: 8, bottom: 0, left: 4 }}
                                        >
                                            <CartesianGrid stroke={GRID} vertical={false} />
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fontSize: 11, fill: AXIS_TEXT }}
                                                stroke={GRID}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: AXIS_TEXT }}
                                                stroke={GRID}
                                                width={48}
                                                tickFormatter={formatCompact}
                                            />
                                            <Tooltip
                                                formatter={(value: any) => [formatVND(num(value)), "Doanh thu luỹ kế"]}
                                                labelFormatter={(label: any) => `Tháng ${String(label).replace("T", "")}`}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke={SERIES}
                                                strokeWidth={2}
                                                fill={SERIES}
                                                fillOpacity={0.12}
                                                dot={false}
                                                activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="py-8 text-center text-xs text-slate-400">
                                        {revenue.months === 0
                                            ? "Chính sách chưa khai số tháng hợp đồng."
                                            : "Môn học chưa khai số học sinh nên chưa tính được doanh thu."}
                                    </p>
                                )}
                            </section>

                            {/* Cơ cấu học phí — nhãn trục y đã mang danh tính, không tô màu theo hạng. */}
                            <section className="rounded-xl border border-slate-200 p-3">
                                <h3 className="text-sm font-semibold text-slate-800">
                                    Cơ cấu trên 1 HS mỗi tháng
                                </h3>

                                {revenue.breakdown.length > 0 ? (
                                    <ResponsiveContainer
                                        width="100%"
                                        height={Math.max(160, revenue.breakdown.length * 28)}
                                    >
                                        <BarChart
                                            data={revenue.breakdown}
                                            layout="vertical"
                                            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
                                            barCategoryGap={2}
                                        >
                                            <CartesianGrid stroke={GRID} horizontal={false} />
                                            <XAxis
                                                type="number"
                                                hide
                                                domain={[0, (max: number) => max * 1.15]}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: AXIS_TEXT }}
                                                stroke={GRID}
                                                width={72}
                                            />
                                            <Tooltip
                                                formatter={(value: any) => [formatVND(num(value)), "1 HS/tháng"]}
                                            />
                                            <Bar
                                                dataKey="value"
                                                fill={SERIES}
                                                radius={[0, 4, 4, 0]}
                                                maxBarSize={14}
                                            >
                                                <LabelList
                                                    dataKey="value"
                                                    position="right"
                                                    formatter={(value: any) => formatCompact(num(value))}
                                                    style={{ fontSize: 11, fill: AXIS_TEXT }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="py-8 text-center text-xs text-slate-400">
                                        Chính sách chưa có số liệu học phí / chi phí.
                                    </p>
                                )}
                            </section>
                        </>
                    )}

                    {/* ===== TIỀN MẶT ===== */}
                    {tab === "tienmat" &&
                        (tienmat.length ? (
                            tienmat.map((i: any, idx: number) => {
                                const { csKyHD, thanhTienThucTe, realStudents, realPeriods, months } =
                                    computeRowAmounts(num(i.money), i, policyMode, studentPerClass);

                                return (
                                    <div key={idx} className="bg-green-50 p-3 rounded-xl space-y-2">
                                        <div className="flex justify-between">
                                            <span className="font-medium">{i.type}</span>
                                            <span className="font-semibold text-green-600">
                                                {formatVND(num(i.money))} (Số tiền)
                                            </span>
                                        </div>

                                        <div className="text-xs text-gray-500">
                                            {policyMode === "TIET"
                                                ? `${realStudents} HS thực · ${realPeriods} tiết thực`
                                                : `${realStudents} HS · ${months} tháng`}
                                        </div>

                                        <div className="flex justify-between rounded-lg bg-white/70 px-2 py-1.5 text-sm">
                                            <span className="text-gray-500">CS ký HĐ</span>
                                            <span className="font-semibold text-green-700">
                                                {formatVND(csKyHD)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between rounded-lg bg-white/70 px-2 py-1.5 text-sm">
                                            <span className="text-gray-500">Thành tiền</span>
                                            <span className="font-semibold text-green-700">
                                                {formatVND(thanhTienThucTe)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-gray-400 text-sm">
                                Không có dữ liệu
                            </div>
                        ))}

                    {/* ===== THIẾT BỊ ===== */}
                    {tab === "thietbi" &&
                        (thietbi.length ? (
                            thietbi.map((i: any, idx: number) => {
                                const thanhTienGoc = num(i.qty) * num(i.price);
                                const { csKyHD, thanhTienThucTe, realStudents, realPeriods, months } =
                                    computeRowAmounts(thanhTienGoc, i, policyMode, studentPerClass);

                                return (
                                    <div key={idx} className="bg-blue-50 p-3 rounded-xl space-y-2">
                                        <div className="font-medium">📺 {i.category}</div>

                                        <div className="flex justify-between text-sm text-gray-700">
                                            <span>Số lượng: {i.qty}</span>
                                            <span>Giá: {formatVND(num(i.price))}</span>
                                        </div>

                                        <div className="text-xs text-gray-500">
                                            {policyMode === "TIET"
                                                ? `${realStudents} HS thực · ${realPeriods} tiết thực`
                                                : `${realStudents} HS · ${months} tháng`}
                                        </div>

                                        <div className="flex justify-between rounded-lg bg-white/70 px-2 py-1.5 text-sm">
                                            <span className="text-gray-500">CS ký HĐ</span>
                                            <span className="font-semibold text-blue-700">
                                                {formatVND(csKyHD)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between rounded-lg bg-white/70 px-2 py-1.5 text-sm">
                                            <span className="text-gray-500">Thành tiền</span>
                                            <span className="font-semibold text-blue-700">
                                                {formatVND(thanhTienThucTe)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-gray-400 text-sm">
                                Không có dữ liệu thiết bị
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}

function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200 p-2">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
        </div>
    );
}
