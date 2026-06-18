import { formatNumber, parseNumber } from "../../../../../utils/formatNumber";
import React, { useEffect } from "react";

type FormType = {
    type: string;
    money: number;
    months: number;
    students: number;
    realStudents: number;
    realPeriods: number;
};

export default function MoneyForm({
    onTotalChange,
    data,
    setRowsM,
    forms,
    activeTab,
    studentPerClass,
    setPeriods,
    periods,
}: any) {

    const handleChange = (
        index: number,
        key: keyof FormType,
        value: string | number
    ) => {
        const newForms = [...forms];
        newForms[index][key] = value as never;
        setRowsM(newForms);
    };

    const addForm = () => {
        setRowsM([
            ...forms,
            {
                type: "Chính sách",
                money: 0,
                months: 9,
                students: 1000,
                periods: periods,
                realStudents: data,
                realPeriods: periods,
            },
        ]);
    };

    const removeForm = (index: number) => {
        const newForms = forms.filter((_: any, i: number) => i !== index);
        setRowsM(newForms);
    };

    // ✅ tính tổng theo REAL nếu có
    useEffect(() => {
        const totalTienMoiHS = forms.reduce((sum: number, form: FormType) => {
            const divisor =
                activeTab === "TIET"
                    ? periods
                    : form.months;

            const studentBase =
                activeTab === "TIET"
                    ? (form.realStudents > 0 ? form.realStudents : form.students)
                    : form.students;

            let tienMoiHS =
                studentBase > 0 && divisor > 0
                    ? Math.round(
                        (form.money / divisor / studentBase) *
                        (activeTab === "TIET" ? studentPerClass : 1)
                    )
                    : 0;

            if (activeTab === "TIET" && form.realPeriods > 0) {
                tienMoiHS = Math.round(
                    (tienMoiHS * form.realPeriods) / divisor
                );
            }

            return sum + tienMoiHS;
        }, 0);

        onTotalChange?.(totalTienMoiHS);
    }, [forms, periods, studentPerClass, activeTab]);

    return (
        <div className="max-w-3xl mx-auto mt-6 space-y-6">
            {forms.map((form: FormType, index: number) => {
                const divisor =
                    activeTab === "TIET"
                        ? periods
                        : form.months;

                const studentBase =
                    activeTab === "TIET"
                        ? (form.realStudents > 0 ? form.realStudents : form.students)
                        : form.students;

                let tienMoiHS =
                    studentBase > 0 && divisor > 0
                        ? Math.round(
                            (form.money / divisor / studentBase) *
                            (activeTab === "TIET" ? studentPerClass : 1)
                        )
                        : 0;

                if (activeTab === "TIET" && form.realPeriods > 0) {
                    tienMoiHS = Math.round(
                        (tienMoiHS * form.realPeriods) / divisor
                    );
                }

                return (
                    <div
                        key={index}
                        className="bg-white p-6 rounded-2xl shadow space-y-4 relative"
                    >
                        {/* Xoá */}
                        {forms.length > 1 && (
                            <button
                                onClick={() => removeForm(index)}
                                className="absolute top-3 right-3 text-red-500 text-sm"
                            >
                                Xoá
                            </button>
                        )}

                        <h2 className="text-lg font-semibold text-center bg-yellow-200 py-2 rounded">
                            Tiền mặt #{index + 1}
                        </h2>

                        {/* Loại */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Loại hỗ trợ
                            </label>
                            <input
                                type="text"
                                value={form.type}
                                onChange={(e) =>
                                    handleChange(index, "type", e.target.value)
                                }
                                className="flex-1 border rounded-lg px-3 py-2"
                            />
                        </div>

                        {/* Số tiền */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Số tiền
                            </label>
                            <input
                                type="text"
                                value={formatNumber(form.money)}
                                onChange={(e) =>
                                    handleChange(
                                        index,
                                        "money",
                                        parseNumber(e.target.value)
                                    )
                                }
                                className="flex-1 border rounded-lg px-3 py-2 text-blue-600 font-semibold"
                            />
                        </div>

                        {/* Số tiết / tháng */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                {activeTab === "TIET" ? "Số tiết" : "Số tháng"}
                            </label>
                            <input
                                type="number"
                                value={
                                    activeTab === "TIET"
                                        ? (periods || "")
                                        : (form.months || "")
                                }
                                onChange={(e) => {
                                    const val = e.target.value;

                                    if (activeTab === "TIET") {
                                        setPeriods(val === "" ? 0 : Number(val));
                                    } else {
                                        handleChange(
                                            index,
                                            "months",
                                            val === "" ? 0 : Number(val)
                                        );
                                    }
                                }}
                                className="flex-1 border rounded-lg px-3 py-2"
                            />
                        </div>

                        {/* Tiết thực */}
                        {activeTab === "TIET" && (
                            <div className="flex items-center gap-4">
                                <label className="w-32 text-sm font-medium">
                                    Tiết thực
                                </label>
                                <input
                                    type="number"
                                    value={form.realPeriods || 0}
                                    onChange={(e) =>
                                        handleChange(
                                            index,
                                            "realPeriods",
                                            Number(e.target.value)
                                        )
                                    }
                                    className="flex-1 border rounded-lg px-3 py-2"
                                />
                            </div>
                        )}

                        {/* Số HS */}
                        {activeTab === "TIET" && (
                            <div className="flex items-center gap-4">
                                <label className="w-32 text-sm font-medium">
                                    Số học sinh
                                </label>
                                <input
                                    type="number"
                                    value={form.students}
                                    onChange={(e) =>
                                        handleChange(
                                            index,
                                            "students",
                                            Number(e.target.value)
                                        )
                                    }
                                    className="flex-1 border rounded-lg px-3 py-2"
                                />
                            </div>
                        )}
                        {/* HS thực */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                HS thực
                            </label>
                            <input
                                type="number"
                                value={form.realStudents || 0}
                                onChange={(e) =>
                                    handleChange(
                                        index,
                                        "realStudents",
                                        Number(e.target.value)
                                    )
                                }
                                className="flex-1 border rounded-lg px-3 py-2"
                            />
                        </div>

                        {/* Kết quả */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Tiền / HS
                            </label>

                            <div className="flex-1 font-semibold">
                                {activeTab === "TIET" && (!studentPerClass || studentPerClass <= 0) ? (
                                    <span className="text-red-500 italic">
                                        Chưa nhập sĩ số lớp
                                    </span>
                                ) : (
                                    <span className="text-gray-700">
                                        {tienMoiHS.toLocaleString()} đ
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <label className="w-32 text-sm font-medium">
                                Công thức tính
                            </label>
                            <div className="flex-1 font-semibold text-red-700">
                                {activeTab === "TIET" ? (
                                    <label className="w-32 text-sm font-medium">
                                        Số tiền / số học sinh / số tiết * sỉ số lớp
                                    </label>
                                ) : (
                                    <label className="w-32 text-sm font-medium">
                                        Số tiền / số tháng / số học sinh
                                    </label>
                                )}

                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Add */}
            <button
                onClick={addForm}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
                + Thêm hỗ trợ tiền
            </button>
        </div>
    );
}