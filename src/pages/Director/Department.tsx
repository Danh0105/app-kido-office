import HeaderWithBack from "@/components/HeaderWithBack";
import { departmentApi } from "@/service/department";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";


export default function Department() {
    const navigate = useNavigate();
    const [departments, setDepartments] = React.useState<any[]>([]);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await departmentApi.findAll();
                console.log("Departments:", data);
                setDepartments(data);
            } catch (err) {
                console.error("Load departments failed", err);
            }
        };

        fetchData();
    }, []);
    return (
        <div className="bg-gray-100 min-h-screen">
            {/* Header */}
            <HeaderWithBack title="Danh sách phòng ban" />

            {/* Nội dung */}
            <div className="p-4">
                <h2 className="text-gray-700 font-semibold mb-3">
                    Danh sách phòng ban
                </h2>

                <div className="grid grid-cols-3 gap-4" style={{ marginTop: "50px" }}>
                    {
                        departments.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => navigate(`/director/khu-vuc/${item.id}`)}
                                className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center justify-center active:scale-95 transition"
                            >
                                <div className="text-3xl mb-2">{item.icon}</div>
                                <span className="text-sm text-gray-700 text-center">
                                    {item.name}
                                </span>
                            </div>
                        ))
                    }
                </div>
            </div>
        </div >
    );
}