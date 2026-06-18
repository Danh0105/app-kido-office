import { formatNumber, parseNumber } from "../../../../../utils/formatNumber";
import React, { useEffect } from "react";

type FormType = {
    category: string;
    qty: number;
    price: number;
    months: number;
    students: number;
    realStudents: number;     // ✅ FIX
    realPeriods: number;      // ✅ FIX
};

const inputClass = `
    w-full 
    px-3 py-2.5 
    rounded-xl 
    border 
    outline-none 
    text-sm
    transition-all duration-200

    border-gray-300 dark:border-gray-600
    bg-white dark:bg-gray-800
    text-black dark:text-white
    placeholder-gray-400 dark:placeholder-gray-500

    focus:border-blue-500 focus:ring-2 focus:ring-blue-400
`;

export default function DeviceForm({
    onTotalChange,
    data,
    setRowsD,
    formsD,
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
        const newForms = [...formsD];
        newForms[index][key] = value as never;
        setRowsD(newForms);
    };

    const addForm = () => {
        setRowsD([
            ...formsD,
            {
                category: "Thiết bị",
                qty: 1,
                price: 0,
                months: 0,
                students: data,
                realStudents: 0,     // ✅ thêm
                realPeriods: 0,      // ✅ thêm
            },
        ]);
    };

    const removeForm = (index: number) => {
        setRowsD(formsD.filter((_: any, i: number) => i !== index));
    };

    // ✅ TOTAL giống MoneyForm
    useEffect(() => {
        const total = formsD.reduce((sum: number, form: FormType) => {
            const thanhTien = form.qty * form.price;

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
                        (thanhTien / divisor / studentBase) *
                        (activeTab === "TIET" ? studentPerClass : 1)
                    )
                    : 0;

            // ✅ xử lý tiết thực
            if (activeTab === "TIET" && form.realPeriods > 0) {
                tienMoiHS = Math.round(
                    (tienMoiHS * form.realPeriods) / divisor
                );
            }

            return sum + tienMoiHS;
        }, 0);

        onTotalChange?.(total);
    }, [formsD, periods, studentPerClass, activeTab]);

    return (
        <div className="max-w-3xl mx-auto mt-6 space-y-6">
            {formsD.map((form: FormType, index: number) => {

                const thanhTien = form.qty * form.price;

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
                            (thanhTien / divisor / studentBase) *
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
                        {formsD.length > 1 && (
                            <button
                                onClick={() => removeForm(index)}
                                className="absolute top-3 right-3 text-red-500 text-sm"
                            >
                                Xoá
                            </button>
                        )}

                        <h2 className="text-lg font-semibold text-center bg-yellow-200 py-2 rounded">
                            Thiết bị #{index + 1}
                        </h2>

                        {/* Danh mục */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Danh mục
                            </label>
                            <input
                                type="text"
                                value={form.category}
                                onChange={(e) =>
                                    handleChange(index, "category", e.target.value)
                                }
                                className={inputClass}
                            />
                        </div>

                        {/* Số lượng */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Số lượng
                            </label>
                            <input
                                type="number"
                                value={form.qty}
                                onChange={(e) =>
                                    handleChange(index, "qty", Number(e.target.value))
                                }
                                className={inputClass}
                            />
                        </div>

                        {/* Đơn giá */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Đơn giá
                            </label>
                            <input
                                type="text"
                                value={form.price ? formatNumber(form.price) || "" : ""}
                                onChange={(e) =>
                                    handleChange(index, "price", parseNumber(e.target.value))
                                }
                                className="flex-1 border rounded-lg px-3 py-2 text-blue-600 font-semibold"
                            />
                        </div>

                        {/* Thành tiền */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Thành tiền
                            </label>
                            <div className="flex-1 font-semibold text-gray-700">
                                {thanhTien.toLocaleString()} đ
                            </div>
                        </div>

                        <hr />

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
                                    if (activeTab === "TIET") {
                                        setPeriods(Number(e.target.value));
                                    } else {
                                        handleChange(index, "months", Number(e.target.value));
                                    }
                                }}
                                className={inputClass}
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
                                        handleChange(index, "realPeriods", Number(e.target.value))
                                    }
                                    className={inputClass}
                                />
                            </div>
                        )}

                        {/* Số HS */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                Số học sinh
                            </label>
                            <input
                                type="number"
                                value={form.students}
                                onChange={(e) =>
                                    handleChange(index, "students", Number(e.target.value))
                                }
                                className={inputClass}
                            />
                        </div>

                        {/* HS thực */}
                        {activeTab === "TIET" && (
                            <div className="flex items-center gap-4">
                                <label className="w-32 text-sm font-medium">
                                    HS thực
                                </label>
                                <input
                                    type="number"
                                    value={form.realStudents || 0}
                                    onChange={(e) =>
                                        handleChange(index, "realStudents", Number(e.target.value))
                                    }
                                    className={inputClass}
                                />
                            </div>
                        )}
                        {/* Tiền / HS */}
                        <div className="flex items-center gap-4">
                            <label className="w-32 text-sm font-medium">
                                {activeTab !== "TIET" ? (
                                    `Tiền / HS`) : (`Tiền / Tiết`)}
                            </label>
                            <div className="flex-1 font-semibold text-gray-700">
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
                        </div>
                        <div className="flex items-center gap-1">
                            <label className="w-32 text-sm font-medium">
                                Công thức tính
                            </label>
                            <div className="flex-1 font-semibold text-red-700">
                                <label className="w-32 text-sm font-medium">
                                    Thành tiền / số học sinh / số tiết * sỉ số lớp
                                </label>
                            </div>
                        </div>
                    </div>

                );
            })}

            {/* Add */}
            <button
                onClick={addForm}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold"
            >
                + Thêm thiết bị
            </button>
        </div>
    );
}