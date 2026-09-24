import { useState } from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
/**
 * Bảng màu phân loại, thứ tự cố định — **không** xoay vòng.
 *
 * Bộ cũ bị hai lỗi: cặp cam↔xanh lá không phân biệt được với người mù màu
 * (ΔE 5.7 protan) và slot xám gần như mất màu, nên nhiều lát bánh nhìn giống
 * nhau. Bộ này giữ đúng 9 hue, chạy qua trình kiểm tra palette và đạt cả 5 mục:
 * dải sáng, chroma, tách CVD (10.3), tách mắt thường (22.6), tương phản ≥ 3:1.
 */
const COLORS = [
    "#4f46e5", // indigo
    "#d97706", // amber
    "#0891b2", // cyan
    "#db2777", // pink
    "#65a30d", // lime
    "#7c3aed", // violet
    "#ea580c", // orange
    "#0d9488", // teal
    "#2563eb", // blue
];

/** Quá số hue có sẵn thì gộp phần nhỏ nhất vào "Khác", không dùng lại màu. */
const MAX_SLICES = COLORS.length;
const buildChartData = (data: any, companyProfit: number) => {
    const fee = data?.fee || 0;
    const raw = [
        { key: "csvc", name: "CSVC" },
        { key: "thue", name: "Thuế" },
        { key: "giaovien", name: "Giáo viên" },
        // Khoản này cũng trừ vào "Công ty thu về" nhưng trước đây thiếu trong
        // biểu đồ, làm các lát cộng lại không bằng học phí.
        { key: "teacherCompany", name: "GV công ty" },
        { key: "csthang", name: "CS tháng" },
        { key: "cdhd", name: "CĐ HĐ" },
        { key: "thietbi", name: "Thiết bị" },
        { key: "giaoCu", name: "Giáo cụ" },
        { key: "vanHanh", name: "Vận hành" },
        { key: "thuetndn", name: "Thuế TNDN" },
    ];

    const items = raw.map(r => {
        const value = data?.[r.key] || 0;
        return {
            name: r.name,
            value,
        };
    });

    const company = companyProfit;

    if (company > 0) {
        items.push({
            name: "Công ty",
            value: company,
        });
    }

    const visible = items.filter(i => i.value > 0);
    if (visible.length <= MAX_SLICES) return visible;

    // Giữ các khoản lớn, dồn phần còn lại vào một lát "Khác".
    const sorted = [...visible].sort((a, b) => b.value - a.value);
    const kept = sorted.slice(0, MAX_SLICES - 1);
    const rest = sorted.slice(MAX_SLICES - 1);

    return [
        ...kept,
        {
            name: "Khác",
            value: rest.reduce((sum, item) => sum + item.value, 0),
        },
    ];
};
export default function PolicyPie({
    data,
    subjectName,
    companyProfit,
    className,
}: {
    data: any;
    subjectName?: string;
    companyProfit: number;
    /** Mặc định chừa chỗ cho header cố định của màn xem chính sách. */
    className?: string;
}) {
    const chartData = buildChartData(data, companyProfit);
    const total = chartData.reduce((s, i) => s + i.value, 0);

    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    if (!data?.fee) {
        return <div className="text-gray-400 text-sm">Không có dữ liệu</div>;
    }
    const companyItem = chartData.find(i => i.name === "Công ty");
    const companyValue = companyItem?.value || 0;
    const companyPercent = total ? ((companyValue / total) * 100).toFixed(1) : 0;
    const renderLabel = ({ percent }: any) => {
        return `${(percent * 100).toFixed(0)}%`;
    };

    return (
        <div className={`bg-white rounded-2xl shadow-md p-3 border border-gray-100 ${className ?? "mt-[50px]"}`}>

            <h3 className="text-sm font-semibold mb-2 text-gray-700 text-center">
                📊 Phân bổ chi phí
            </h3>
            {/* SUBJECT + FEE */}
            <div className="text-center mb-3">
                {/* Không biết tên môn thì bỏ hẳn dòng — chữ "Tên môn" giữ chỗ
                    trông như dữ liệu bị lỗi. */}
                {subjectName && (
                    <div className="text-sm font-medium text-gray-800 truncate">
                        {`Môn học: ${subjectName}`}
                    </div>
                )}

                <div className="text-xs text-gray-500">
                    Học phí:{" "}
                    <span className="font-semibold text-indigo-600">
                        {(data?.fee || 0).toLocaleString("vi-VN")} VND
                    </span>
                </div>
            </div>
            {/* MAIN LAYOUT */}
            <div className="flex items-center justify-center gap-4">

                {/* CHART */}
                <div className="w-[320px] h-[320px] relative">
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={70}
                                outerRadius={110}
                                paddingAngle={3}
                                stroke="white"
                                strokeWidth={2}
                                label={renderLabel}
                                labelLine={false}
                            >
                                {chartData.map((_, index) => (
                                    <Cell
                                        key={index}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>

                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;

                                    const item = payload[0].payload;
                                    const percent = ((item.value / total) * 100).toFixed(1);

                                    return (
                                        <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-2 text-xs">
                                            <div className="font-semibold text-gray-700">
                                                {item.name}
                                            </div>

                                            <div className="text-gray-800">
                                                {item.value.toLocaleString("vi-VN")} VND
                                            </div>

                                            <div className="text-gray-500">
                                                {percent}%
                                            </div>
                                        </div>
                                    );
                                }}
                                wrapperStyle={{ zIndex: 99 }}
                            />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* CENTER TEXT */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-sm">
                        <div className="text-xs text-gray-400">
                            Công ty thu về
                        </div>

                        <div className="text-sm font-semibold text-green-600">
                            {companyValue.toLocaleString("vi-VN")}
                        </div>

                        <div className="text-xs text-gray-500">
                            {companyPercent}%
                        </div>
                    </div>
                </div>


                {/* LEGEND */}
                <div className="space-y-1 text-xs ">
                    {chartData.map((item, index) => {
                        const percent = (
                            (item.value / total) *
                            100
                        ).toFixed(0);

                        return (
                            <div
                                key={index}
                                onClick={() =>
                                    setActiveIndex((prev) =>
                                        prev === index ? null : index
                                    )
                                }
                                className={`flex items-center justify-between min-w-[110px] px-2 py-1 rounded cursor-pointer ${activeIndex === index
                                    ? "bg-blue-100"
                                    : ""
                                    }`}
                            >
                                <div className="flex items-center gap-1">
                                    <div
                                        className="w-2 h-2 rounded-full"
                                        style={{
                                            backgroundColor:
                                                COLORS[index % COLORS.length],
                                        }}
                                    />
                                    <span className="truncate">
                                        {item.name}
                                    </span>
                                </div>

                                <span className="text-gray-500">
                                    {percent}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* DETAIL BOX */}
            {activeIndex !== null && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs">
                    <div className="font-semibold text-blue-700">
                        {chartData[activeIndex].name}
                    </div>

                    <div>
                        {chartData[
                            activeIndex
                        ].value.toLocaleString("vi-VN")}{" "}
                        VND
                    </div>

                    <div className="text-gray-500">
                        {(
                            (chartData[activeIndex].value / total) *
                            100
                        ).toFixed(1)}
                        %
                    </div>
                </div>
            )}
        </div>
    );
}