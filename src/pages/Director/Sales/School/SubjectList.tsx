import React, { useEffect, useState } from "react";
import { subjectApi } from "../../../../service/subject.api";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
type Subject = {
    id: number;
    name: string;
    status: number;

    studentCount: number;
    totalLessons: number;
    contractDuration: number;
    appendixDuration: number;
    startDate: string;
    contractNumber: string;
    policyCount: number;
    note: string;
    schoolYear: string;
};
export default function SubjectList() {
    const navigate = useNavigate();
    const location = useLocation();
    const data = location.state;
    console.log("🚀 ~ file: SubjectList.tsx:17 ~ SubjectList ~ data:", data)
    const { id } = useParams();
    const schoolId = Number(id);
    const [subjects, setSubjects] = useState<Subject[]>([]);



    // ================== HANDLE ==================
    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await subjectApi.getBySchool(schoolId);
                console.log("🚀 ~ file: SubjectList.tsx:30 ~ fetchData ~ data:", data);
                setSubjects(data);

            } catch (err) {
                console.error("Load subjects failed", err);
            }
        };

        if (schoolId) fetchData();
    }, [schoolId]);

    // ================== UI ==================



    return (
        <div className="bg-gray-100 min-h-screen">

            <HeaderWithBack title="Danh sách môn học" />
            {/* LIST */}
            <div className="p-4 mt-[60px] space-y-3">
                <div className="p-4 space-y-3">
                    {subjects.map((item) => {


                        return (
                            <div
                                key={item.id}
                                onClick={() => navigate(`/director/policy-list/${item.id}`, {
                                    state: data
                                })}
                                className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm active:scale-95 transition space-y-3"
                            >
                                {/* TOP */}
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        {/* Icon */}
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                            📘
                                        </div>

                                        {/* Name */}
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm dark:text-white">
                                                {item.name}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Số học sinh: {item.studentCount}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Tổng số tiết: {item.totalLessons}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Thời hạn HĐ: {item.contractDuration}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Thời hạn PL: {item.appendixDuration}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Ngày khai giảng: {item.startDate ? new Date(item.startDate).toLocaleDateString("vi-VN") : ""}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-white">
                                                Số HĐ: {item.contractNumber}
                                            </p>
                                        </div>
                                    </div>
                                    {/* STATUS BADGE */}
                                    <div className="flex flex-col items-center gap-2">
                                        <p
                                            className={`text-xs text-center px-4 py-1 rounded-full font-medium inline-flex items-center justify-center bg-red-100 text-red-600`}
                                        >
                                            Tổng CS
                                        </p>

                                        <div

                                            onClick={(e) => {
                                                e.stopPropagation();
                                            }}
                                            className="flex items-center gap-2 text-gray-500 text-xs"
                                        >
                                            <p
                                                className={`text-xs text-center px-4 py-1 rounded-full font-medium inline-flex items-center justify-center  text-red-600`}
                                            >
                                                {item.policyCount}

                                            </p>
                                        </div>
                                    </div>

                                </div>

                                <h1 className="text-dark font-semibold text-sm text-center flex-1">
                                    Năm học: {item.schoolYear || "2024-2025"}
                                </h1>
                            </div>
                        );
                    })}
                </div>
            </div>




        </div>
    );
}