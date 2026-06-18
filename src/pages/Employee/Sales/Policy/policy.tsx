import { formatNumber, parseNumber } from "../../../../utils/formatNumber";
import { formatVND } from "../../../../utils/formatVND";
import { RowType } from '../../../../types/policy';
import React, { useEffect, useState } from "react";
const MoneyDisplay = ({ value }: { value: number }) => (
    <div className="text-xs text-green-600 mt-1">
        ≈ {value} %
    </div>
);


const OtherCostItem = ({ item, onChange, onRemove }: any) => {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

            {/* tên */}
            <input
                value={item.name}
                onChange={(e) => onChange({ ...item, name: e.target.value })}
                placeholder="Tên chi phí"
                className="w-full px-3 py-2 border rounded-lg text-sm"
            />

            {/* %HP */}
            <input
                value={formatNumber(item.percent)}
                onChange={(e) =>
                    onChange({ ...item, percent: parseNumber(e.target.value) })
                }
                placeholder="%HP"
                className="w-full sm:w-32 px-3 py-2 border rounded-lg text-sm"
            />

            {/* Thuế */}
            <input
                value={formatNumber(item.tax)}
                onChange={(e) =>
                    onChange({ ...item, tax: parseNumber(e.target.value) })
                }
                placeholder="Thuế"
                className="w-full sm:w-32 px-3 py-2 border rounded-lg text-sm"
            />

            <button
                onClick={onRemove}
                className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
            >
                Xóa
            </button>
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
};

const PolicyFormItem = ({ row, updateRow, removeRow }: any) => {
    const calcPercent = (fee: number, money: number) => {
        if (!fee) return 0;
        return Math.round((money / fee) * 100);
    };

    const cscv = calcPercent(row.fee, row.qlCsvc);
    const tax = calcPercent(row.fee, row.tax);
    const gv = calcPercent(row.fee, row.teacher);

    const ql1Money = calcPercent(row.fee, row.ql1Percent);
    const ql1TaxMoney = calcPercent(row.ql1Percent, row.ql1Tax);

    const ql2Money = calcPercent(row.fee, row.ql2Percent);
    const ql2TaxMoney = calcPercent(row.ql2Percent, row.ql2Tax);

    const otherTotal = (row.otherCosts || []).reduce(
        (sum: number, item) =>
            sum + (Number(item.percent) || 0) - (Number(item.tax) || 0),
        0
    );
    const total =
        (row.ql1Percent || 0) - (row.ql1Tax || 0) +
        (row.ql2Percent || 0) - (row.ql2Tax || 0) +
        (row.tgPercent || 0) - (row.tgTax || 0) +
        otherTotal;

    const totalPercent = ql1TaxMoney + ql2TaxMoney;

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
                <label className={labelClass}>Thuế (%)</label>
                <input
                    value={formatNumber(row.tax)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "tax", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={tax} />
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
                <label className={labelClass}>QL1 Thuế</label>
                <input
                    value={formatNumber(row.ql1Tax)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "ql1Tax", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={ql1TaxMoney} />
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
                <label className={labelClass}>QL2 Thuế</label>
                <input
                    value={formatNumber(row.ql2Tax)}
                    onChange={(e) => {
                        const number = parseNumber(e.target.value);
                        updateRow(row.id, "ql2Tax", number);
                    }}
                    className={inputClass}
                />
                <MoneyDisplay value={ql2TaxMoney} />
            </div>
            {/* Chi phí khác */}
            <div>
                <label className={labelClass}>Chi phí khác</label>

                <div className="space-y-2 mt-2">
                    {(row.otherCosts || []).map((item) => (
                        <>
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
                            <MoneyDisplay value={calcPercent(row.fee, item.percent)} />
                        </>
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
                    className="mt-2 text-blue-500 text-sm"
                >
                    + Thêm chi phí khác
                </button>
            </div>
            {/* Tổng */}
            <div>
                <label className={labelClass}>Tổng chi ngoài</label>
                <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {formatVND(total)} ≈ {totalPercent}%
                </div>
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
                    sum + (Number(item.percent) || 0) - (Number(item.tax) || 0),
                0
            );
            return sum + ql1 + ql2 + tg + otherTotal;
        }, 0);

        setGrandTotal(totalAll);

    }, [rows]);


    return (
        <div className="max-w-3xl mx-auto mt-6 bg-white p-6 rounded-2xl shadow space-y-4">
            {/* FOOTER TITLE */}
            {rows.map((row) => (
                <PolicyFormItem
                    key={row.id}
                    row={row}
                    updateRow={updateRow}
                    removeRow={removeRow}
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