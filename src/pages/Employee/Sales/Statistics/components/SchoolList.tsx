import { useState } from "react";
import SubjectList from "./SubjectList";

export default function SchoolList({ data }: any) {
    if (!data.length) {
        return (
            <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">
                Không có dữ liệu
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-4">Trường học</h2>

            {data.map((s: any) => (
                <div
                    key={s.schoolId}
                    className="p-3 border rounded mb-2 flex justify-between hover:bg-gray-50"
                >
                    <span>{s.schoolName}</span>
                    <span className="font-semibold">{s.count}</span>
                </div>
            ))}
        </div>
    );
}