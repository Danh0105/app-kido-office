import React from "react";
import policy from '../static/policy.png'
import statistics from '../static/statistics.png'
import report from "../static/report.png";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";

const menus = [
    {
        title: "Chính sách",
        icon: policy,
        path: (id: number) => `/director/school-list/${id}`
    },
    {
        title: "Thống kê",
        icon: statistics,
        path: (id: number) => `/director/statistics/${id}`
    },
    {
        title: "Báo cáo",
        icon: report,
        path: (id: number) => `/director/daily-report/${id}`
    },
];
export default function Profile() {
    const navigate = useNavigate();
    const location = useLocation();
    const data = location.state;
    return (
        <div className="bg-gray-100 min-h-screen">
            <HeaderWithBack title="Thông tin chi tiết nhân viên" />
            <div className="p-4" style={{ marginTop: "60px" }}>
                <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                    <div className="w-20 h-20 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-3xl mb-3">
                        👤
                    </div>

                    <h2 className="font-semibold text-lg">{data.name}</h2>


                    <div className="grid grid-cols-3 gap-y-6 text-center mt-5">
                        {menus.map((item, i) => (
                            <div
                                key={i}
                                onClick={() => navigate(item.path(data.id), { state: data })}
                                className="flex flex-col items-center cursor-pointer active:scale-95 transition"
                            >
                                <div className="w-16 h-16 bg-white rounded-xl shadow flex items-center justify-center">
                                    <img src={item.icon} className="w-12 h-12" />
                                </div>
                                <p className="text-xs mt-2 text-gray-700 px-1">
                                    {item.title}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </div>
    );
}