import { formatNumber, parseNumber } from "../../../../utils/formatNumber";
import { formatVND } from "../../../../utils/formatVND";
import { RowType, policyPercentBase } from '../../../../types/policy';
import React, { useEffect, useState } from "react";
const MoneyDisplay = ({ value }: { value: number }) => (
    <div className="text-xs text-green-600 mt-1">
        ≈ {value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} %
    </div>
);


const otherCostFieldClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2.5 text-[15px] text-gray-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";

const OtherCostItem = ({ item, onChange, onRemove }: any) => {
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
                <input
                    value={item.name}
                    onChange={(e) => onChange({ ...item, name: e.target.value })}
                    placeholder="Tên chi phí"
                    className={`${otherCostFieldClass} bg-white`}
                />
                <button
                    onClick={onRemove}
                    className="shrink-0 rounded-lg bg-red-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-600"
                >
                    Xoá
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Số tiền (VNĐ)
                    </label>
                    <input
                        value={item.percent ? formatNumber(item.percent) : ""}
                        onChange={(e) =>
                            onChange({ ...item, percent: parseNumber(e.target.value) })
                        }
                        placeholder="0"
                        inputMode="numeric"
                        className={`${otherCostFieldClass} bg-white`}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        Thuế (VNĐ)
                    </label>
                    <input
                        value={item.tax ? formatNumber(item.tax) : ""}
                        onChange={(e) =>
                            onChange({ ...item, tax: parseNumber(e.target.value) })
                        }
                        placeholder="0"
                        inputMode="numeric"
                        className={`${otherCostFieldClass} bg-white`}
                    />
                </div>
            </div>
        </div>
    );
};
type Props = {
    rows: RowType[];
    fee: number;
    updateRow: (id: number, field: keyof RowType, value: any) => void;
    removeRow: (id: number) => void;
    addRow: () => void;
    setGrandTotal: (value: number) => void;
    setfee: (value: number) => void;
    setTotalTax: (value: number) => void;
    activeTab?: "TIET" | "HS";
    studentPerClass?: number;
    periods?: number;
    students?: number;
    months?: number;
};

/**
 * Chi phí khác tính theo đầu HS giống Tiền mặt/Thiết bị, thay vì cộng thẳng:
 * - Tab HP/TIẾT: Số tiền / số học sinh / số tiết × sĩ số lớp.
 * - Tab HP/HS: Số tiền / số tháng / số học sinh.
 */
const otherCostAmount = (
    item: { percent?: number; tax?: number },
    ctx: { activeTab?: string; students?: number; periods?: number; studentPerClass?: number; months?: number },
) => {
    const raw = (Number(item.percent) || 0) - (Number(item.tax) || 0);
    const { activeTab, students = 0, periods = 0, studentPerClass = 0, months = 0 } = ctx;
    if (activeTab === "TIET" && students > 0 && periods > 0 && studentPerClass > 0) {
        return Math.round((raw / students / periods) * studentPerClass);
    }
    if (activeTab === "HS" && months > 0 && students > 0) {
        return Math.round(raw / months / students);
    }
    return raw;
};

const PolicyFormItem = ({ row, updateRow, removeRow, activeTab, studentPerClass, periods, students, months }: any) => {
    const calcPercent = (fee: number, money: number) => {
        if (!fee) return 0;
        return Number(((money / fee) * 100).toFixed(1));
    };

    // % chính sách quy trên học phí, hoặc học phí sau thuế 2% nếu khoản này bật cờ.
    const percentBase = policyPercentBase(row);
    const cscv = calcPercent(percentBase, row.qlCsvc);
    const gv = calcPercent(percentBase, row.teacher);
    const ql1Money = calcPercent(percentBase, row.ql1Percent);
    const ql2Money = calcPercent(percentBase, row.ql2Percent);

    const otherTotal = (row.otherCosts || []).reduce(
        (sum: number, item) =>
            sum + otherCostAmount(item, { activeTab, students, periods, studentPerClass, months }),
        0
    );
    const total =
        (row.ql1Percent || 0) - (row.ql1Tax || 0) +
        (row.ql2Percent || 0) - (row.ql2Tax || 0) +
        (row.tgPercent || 0) - (row.tgTax || 0) +
        otherTotal;
    const totalAsPercent = calcPercent(percentBase, total);

    // ✅ input style dùng chung
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

    // ✅ label style
    const labelClass = `
        text-sm 
        text-gray-500 dark:text-gray-400
        font-medium
    `;

    return (
        <div className="
            bg-white dark:bg-gray-900
            p-5 
            rounded-2xl 
            shadow-sm 
            space-y-4
        ">

            {/* Header */}
            <div className="flex justify-between items-center">
                <input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, "name", e.target.value)}
                    className="
                        text-lg font-semibold 
                        border-b 
                        bg-transparent
                        outline-none
                        border-gray-300 dark:border-gray-600
                        text-black dark:text-white
                    "
                />
                <button
                    onClick={() => removeRow(row.id)}
                    className="
                        text-red-500 
                        text-sm 
                        font-medium
                        active:scale-95
                    "
                >
                    Xóa
                </button>
            </div>

            {/* Khoản thu */}
            <div>
                <label className={labelClass}>Khoản thu</label>
                <input
                    value={row.name}
                    onChange={(e) =>
                        updateRow(row.id, "name", String(e.target.value))
                    }
                    className={inputClass}
                />
            </div>

            {/* Mức thu */}
            <div>
                <label className={labelClass}>Mức thu</label>
                <input
                    value={formatNumber(row.fee)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "fee", number);
                    }}
                    className={inputClass}
                />
            </div>

            {/* CSVC */}
            <div>
                <label className={labelClass}>CSVC (VNĐ)</label>
                <input
                    value={formatNumber(row.qlCsvc)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "qlCsvc", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={cscv} />
            </div>

            {/* Thuế */}
            <div>
                <label className={labelClass}>Thuế (VNĐ)</label>
                <input
                    value={formatNumber(row.tax)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "tax", number);
                    }}
                    className={inputClass}
                />
            </div>

            {/* Giáo viên */}
            <div>
                <label className={labelClass}>Giáo viên (%)</label>
                <input
                    value={formatNumber(row.teacher)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "teacher", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={gv} />
            </div>

            {/* QL1 */}
            <div>
                <label className={labelClass}>QL1 %</label>
                <input
                    value={formatNumber(row.ql1Percent)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "ql1Percent", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={ql1Money} />
            </div>

            <div>
                <label className={labelClass}>QL1 Thuế (VNĐ)</label>
                <input
                    value={formatNumber(row.ql1Tax)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "ql1Tax", number);
                    }}
                    className={inputClass}
                />
            </div>

            {/* QL2 */}
            <div>
                <label className={labelClass}>QL2 %</label>
                <input
                    value={formatNumber(row.ql2Percent)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "ql2Percent", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={ql2Money} />
            </div>

            <div>
                <label className={labelClass}>QL2 Thuế (VNĐ)</label>
                <input
                    value={formatNumber(row.ql2Tax)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "ql2Tax", number);
                    }}
                    className={inputClass}
                />
            </div>
            {/* Chi phí khác */}
            <div>
                <label className={labelClass}>Chi phí khác</label>

                <div className="space-y-2.5 mt-2">
                    {(row.otherCosts || []).map((item) => (
                        <OtherCostItem
                            key={item.id}
                            item={item}
                            onChange={(newItem) => {
                                const newArr = row.otherCosts.map((i) =>
                                    i.id === item.id ? newItem : i
                                );
                                updateRow(row.id, "otherCosts", newArr);
                            }}
                            onRemove={() => {
                                const newArr = row.otherCosts.filter((i) => i.id !== item.id);
                                updateRow(row.id, "otherCosts", newArr);
                            }}
                        />
                    ))}

                </div>

                {/* nút thêm */}
                <button
                    onClick={() => {
                        const newArr = [
                            ...(row.otherCosts || []),
                            {
                                id: Date.now().toString(),
                                name: "",
                                percent: 0,
                                tax: 0,
                            },
                        ];
                        updateRow(row.id, "otherCosts", newArr);
                    }}
                    className="mt-2.5 text-blue-500 text-sm"
                >
                    + Thêm chi phí khác
                </button>
            </div>
            {/* Tổng */}
            <div>
                <label className={labelClass}>Tổng chi ngoài</label>
                <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {formatVND(total)} ≈ {totalAsPercent}%
                </div>
                {(row.otherCosts || []).length > 0 && (
                    <div className="text-[11px] text-red-700 font-semibold mt-1">
                        Chi phí khác — Công thức tính:{" "}
                        {activeTab === "TIET"
                            ? "Số tiền / số học sinh / số tiết × sĩ số lớp"
                            : "Số tiền / số tháng / số học sinh"}
                    </div>
                )}
            </div>
        </div>
    );
};


export default function PolicyPage({
    rows,
    updateRow,
    removeRow,
    setGrandTotal,
    addRow,
    setfee,
    setTotalTax,
    activeTab,
    studentPerClass,
    periods,
    students,
    months,
}: Props) {
    useEffect(() => {
        const totalFee = rows.reduce((sum, row) => {
            return sum + (row.fee || 0);
        }, 0);

        setfee(totalFee);

        const totalCsvcTax = rows.reduce((sum, row) => {

            const csvcTax = row.tax;
            return sum + csvcTax;
        }, 0);

        setTotalTax(Number(totalCsvcTax));


        const totalAll = rows.reduce((sum, row) => {
            const ql1 = (row.ql1Percent || 0) - (row.ql1Tax || 0);
            const ql2 = (row.ql2Percent || 0) - (row.ql2Tax || 0);
            const tg = (row.tgPercent || 0) - (row.tgTax || 0);


            const otherTotal = (row.otherCosts || []).reduce(
                (sum: number, item) =>
                    sum + otherCostAmount(item, { activeTab, students, periods, studentPerClass, months }),
                0
            );
            return sum + ql1 + ql2 + tg + otherTotal;
        }, 0);

        setGrandTotal(totalAll);

    }, [rows, activeTab, studentPerClass, periods, students, months]);


    return (
        <div className="max-w-3xl mx-auto mt-6 bg-white p-6 rounded-2xl shadow space-y-4">
            {/* FOOTER TITLE */}
            {rows.map((row) => (
                <PolicyFormItem
                    key={row.id}
                    row={row}
                    updateRow={updateRow}
                    removeRow={removeRow}
                    activeTab={activeTab}
                    studentPerClass={studentPerClass}
                    periods={periods}
                    students={students}
                    months={months}
                />
            ))}
            <button
                onClick={addRow}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded m-3"
            >
                + Thêm
            </button>
        </div>
    );
}
