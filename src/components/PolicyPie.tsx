import { useState } from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
const COLORS = [
    "#6366f1", // indigo
    "#22c55e", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#0ea5e9", // sky
    "#8b5cf6", // violet
    "#14b8a6", // teal
    "#f97316", // orange
    "#64748b", // gray
];
const buildChartData = (data: any, companyProfit: number) => {
    const fee = data?.fee || 0;
    console.log(companyProfit)
    const raw = [
        { key: "csvc", name: "CSVC" },
        { key: "thue", name: "Thuế" },
        { key: "giaovien", name: "Giáo viên" },
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

    return items.filter(i => i.value > 0);
};
export default function PolicyPie({ data, subjectName, companyProfit }: { data: any; subjectName?: string, companyProfit: number }) {
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
        <div className="bg-white rounded-2xl shadow-md p-3 border border-gray-100 mt-[50px]">

            <h3 className="text-sm font-semibold mb-2 text-gray-700 text-center">
                📊 Phân bổ chi phí
            </h3>
            {/* SUBJECT + FEE */}
            <div className="text-center mb-3">
                <div className="text-sm font-medium text-gray-800 truncate">
                    {`Môn học: ${subjectName || "Tên môn"}`}
                </div>

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