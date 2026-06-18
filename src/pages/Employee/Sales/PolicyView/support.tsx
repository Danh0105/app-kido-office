import React, { useEffect, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
type RowType = {
    type: string;
    money: string | number;
    months: string | number;
    students: string | number;

    device: string;
    qty: string | number;
    price: string | number;

    condMonths: string | number;
    condStudents: string | number;

    note?: string;
};

const toNumber = (v: string | number) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

const Cell = ({
    value,
    onChange,
}: {
    value: string | number;
    onChange: (v: string) => void;
}) => (
    <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-center outline-none px-1 py-1 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
    />
);

const MoneyCell = ({
    value,
    onChange
}: {
    value: string | number;
    onChange: (v: number) => void;
}) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        const num = Number(raw);

        if (!isNaN(num)) {
            onChange(num);
        }
    };

    return (
        <input
            value={Number(value || 0).toLocaleString("vi-VN")}
            onChange={handleChange}
            className="w-full bg-transparent text-center outline-none px-1 py-1 rounded focus:bg-white focus:ring-1 focus:ring-blue-400 text-blue-600 font-medium"
        />
    );
};

export default function Support({ cdhd, data, studentPerClass, periods }: any) {

    const totalMoney = data.reduce((sum, row) => {
        return sum + toNumber(row.money);
    }, 0);

    const totalDevice = data.reduce((sum, row) => {
        return sum + toNumber(row.qty) * toNumber(row.price);
    }, 0);

    const totalPerStudentMoney = data.reduce((sum, row) => {
        const money = toNumber(row.money);
        const students = toNumber(row.studentsM);
        const months = toNumber(row.monthsM);

        if (students > 0 && months > 0) {
            return sum + money / students / months;
        }
        return sum;
    }, 0);
    const totalPerStudentDevice = data.reduce((sum, row) => {
        const money = toNumber(row.price);
        const students = toNumber(row.studentsD);
        const months = toNumber(row.monthsD);

        if (students > 0 && months > 0) {
            return sum + money / students / months;
        }
        return sum;
    }, 0);
    return (
        <div className="p-4  text-sm text-gray-800">
            <table className="border border-gray-300 border-collapse w-full text-center">

                {/* HEADER */}
                <thead className="bg-yellow-200">
                    <tr>
                        <th rowSpan={3} className="border border-gray-300 p-2">STT</th>
                        <th colSpan={15} className="border border-gray-300 p-3 text-lg font-bold tracking-wide">
                            HỖ TRỢ / KHUYẾN MÃI
                        </th>

                    </tr>

                    <tr className="bg-yellow-100 text-gray-700">
                        <th colSpan={6} className="border border-gray-300 p-2">
                            Tiền mặt
                        </th>
                        <th colSpan={8} className="border border-gray-300 p-2">
                            Thiết bị
                        </th>

                    </tr>

                    <tr className="bg-gray-100 text-gray-800 text-[13px]">
                        <th className="border border-gray-200 p-2">Loại hỗ trợ</th>
                        <th className="border border-gray-200 p-2">Số tiền</th>


                        <th className="border border-gray-200 p-2">Số tiết</th>

                        <th className="border border-gray-200 p-2">Số tháng</th>
                        <th className="border border-gray-200 p-2">Số học sinh</th>
                        <th className="border border-gray-200 p-2">Tiền / HS</th>

                        <th className="border border-gray-200 p-2">Danh mục</th>
                        <th className="border border-gray-200 p-2">Số lượng</th>
                        <th className="border border-gray-200 p-2">Đơn giá</th>
                        <th className="border border-gray-200 p-2">Thành tiền</th>

                        {periods > 0 ? (
                            <th className="border border-gray-200 p-2">Số tiết</th>
                        ) : ``}
                        <th className="border border-gray-200 p-2">Số tháng</th>
                        <th className="border border-gray-200 p-2">Số HS</th>
                        <th colSpan={2} className="border border-gray-200 p-2">Tiền / HS</th>
                    </tr>
                </thead>

                {/* BODY */}
                <tbody>
                    {data.map((row, index) => {
                        let perStudentMoney = 0;

                        if (row.studentsM > 0) {
                            if (studentPerClass > 0) {
                                perStudentMoney =
                                    (row.money / row.studentsM / periods) * studentPerClass;

                                // scale theo tiết thực
                                if (row.realPeriods > 0) {
                                    perStudentMoney =
                                        (perStudentMoney * row.realPeriods) / periods;
                                }

                            } else if (row.monthsM > 0) {
                                perStudentMoney =
                                    row.money / row.studentsM / row.monthsM;
                            }
                        }
                        console.log(studentPerClass)
                        const perStudentDevice =
                            toNumber(row.qty) * toNumber(row.price) > 0 && row.monthsD > 0
                                ? toNumber(row.qty) * toNumber(row.price) / row.studentsD / row.monthsD
                                : 0;
                        return (
                            <tr key={index} className="hover:bg-blue-50 transition bg-gray-50">
                                <td className="border border-gray-200 font-bold text-red-500">
                                    {index + 1}
                                </td>
                                <td className="border border-gray-200 p-2">
                                    {row.type || ''}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {row.money !== 0 ? formatVND(row.money) : ""}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {periods > 0 ? periods : ''}
                                </td>
                                <td className="border border-gray-200 p-2">
                                    {row.monthsM || ''}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {row.studentsM || ''}
                                </td>

                                <td className="border border-gray-200 p-2 text-gray-700 font-medium">
                                    {perStudentMoney != 0 ? formatVND(perStudentMoney) : ''}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {row.device || ''}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {row.qty || ''}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {formatVND(row.price) || ''}
                                </td>

                                <td className="border border-gray-200 p-2 text-gray-700 font-medium">
                                    {(toNumber(row.qty) * toNumber(row.price)) != 0 ? formatVND(toNumber(row.qty) * toNumber(row.price)) : ''}
                                </td>
                                <td className="border border-gray-200 p-2">
                                    {periods > 0 ? periods : ''}
                                </td>
                                <td className="border border-gray-200 p-2">
                                    {row.monthsD || ''}
                                </td>

                                <td className="border border-gray-200 p-2">
                                    {row.studentsD || ''}
                                </td>

                                <td colSpan={2} className="border border-gray-200 p-2 text-gray-700 font-medium">
                                    {perStudentDevice != 0 ? formatVND(perStudentDevice) : ''}
                                </td>


                            </tr>
                        );
                    })}

                    {/* TOTAL */}
                    <tr className="font-semibold bg-gray-50 text-[13px]">
                        <td colSpan={2} className="border border-red-500 p-2 text-red-500">
                            Tổng chi TM
                        </td>
                        <td className="border border-red-500 p-2 text-red-500"></td>
                        <td className="border border-red-500 p-2 text-red-500">
                            {formatVND(totalMoney)}
                        </td>


                        <td colSpan={2} className="border border-red-500"></td>

                        <td className="border border-red-500 text-red-500">
                            {formatVND(cdhd)}
                        </td>

                        <td colSpan={2} className="border border-red-500 text-red-500">
                            Tổng thiết bị
                        </td>

                        <td className="border border-red-500 text-red-500">
                            {formatVND(totalDevice)}
                        </td>

                        <td colSpan={4} className="border border-red-500 p-2 text-red-500"></td>
                        <td className="border border-red-500 p-2 text-red-500">{formatVND(totalPerStudentDevice)}</td>
                    </tr>
                </tbody>
            </table>


            {/*  <div className="mt-3 italic text-gray-600">
                <p>Ghi chú khác:</p>

                {rows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                        <span>- Chi {index + 1}:</span>

                        <input
                            onChange={(e) =>
                                updateRow(index, "note", e.target.value)
                            }
                            className="flex-1 border-b border-gray-400 outline-none bg-transparent"
                        />
                    </div>
                ))}
            </div> */}
        </div>
    );
}