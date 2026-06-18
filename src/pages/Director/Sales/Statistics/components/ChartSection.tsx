import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

type Props = {
    data: {
        month: string;
        count: number;
    }[];
};

export function ChartSection({ data }: Props) {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-white p-4 rounded-xl shadow mb-6">
            <h2 className="font-semibold mb-4">Theo tháng</h2>

            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}