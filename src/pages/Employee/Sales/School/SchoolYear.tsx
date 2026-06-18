import HeaderWithBack from "@/components/HeaderWithBack";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function SchoolYearPage() {
    const navigate = useNavigate();
    const [years, setYears] = useState<string[]>([]);
    const { id } = useParams();
    useEffect(() => {
        const currentYear = new Date().getFullYear();
        const arr: string[] = [];

        for (let y = 2021; y <= currentYear; y++) {
            arr.push(`${y}-${y + 1}`);

            arr.push(`Hè ${y}-${y + 1}`);
        }

        setYears(arr.reverse());
    }, []);


    return (
        <div className="bg-gray-100 min-h-screen">

            <HeaderWithBack title="Chọn năm học" />
            {/* LIST */}
            <div className="mt-[60px] p-4 space-y-3">
                {years.map((year) => (
                    <div
                        key={year}
                        onClick={() => {
                            navigate(`/employee/subject-list/${id}`, { state: year });
                        }}
                        className="bg-white rounded-2xl p-4 shadow-sm active:scale-95 transition flex justify-between items-center"
                    >
                        <p className="font-medium text-gray-800">
                            {year}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}