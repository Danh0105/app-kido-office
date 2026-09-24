import { formatVND } from "../../../../utils/formatVND";
import React, { useEffect } from "react";
import { POLICY_TAX_RATE, policyPercentBase } from "../../../../types/policy";


export default function PolicyPage({ data, diff, renderRowValue, studentPerClass, periods }: any) {
    console.log("data2", data)

    const percent = (value: number, total: number) => {
        if (!total) return "0.00";
        return ((value / total) * 100).toFixed(2);
    };
    const otherCostKeys: string[] = Array.from(
        new Set(
            data.flatMap((row: any) =>
                (row.otherCosts || []).map((item: any) => item.name)
            )
        )
    );
    const policyKeys = ["QL1", "QL2", ...otherCostKeys];
    return (
        <div className="p-4  text-sm text-gray-800">
            <table className="border border-gray-300 border-collapse  w-full text-center">
                <thead className="bg-yellow-200">
                    <tr>
                        <th rowSpan={3} className="border border-gray-300 p-2">STT</th>
                        <th rowSpan={3} className="border border-gray-300 p-2">Khoản</th>
                        <th rowSpan={3} className="border border-gray-300 p-2">Mức thu</th>
                        <th colSpan={5} className="border border-gray-300 p-2">PHẦN THU</th>

                    </tr>

                    <tr className="bg-yellow-100">
                        <th colSpan={4} className="border border-gray-300 p-2">NHÀ TRƯỜNG</th>
                        <th rowSpan={1} className="border border-gray-300 p-2">Cty</th>
                    </tr>

                    <tr className="bg-gray-100 text-[13px]">
                        <th className="border border-gray-200">CSVC</th>
                        <th className="border border-gray-200">Thuế</th>
                        <th className="border border-gray-200">GV</th>
                        <th className="border border-gray-200">Tổng %</th>
                        <th className="border border-gray-200">PT chương trình</th>



                    </tr>

                </thead>

                <tbody>
                    {data?.map((row, index) => {
                        const otherTotal = (row.otherCosts || []).reduce(
                            (s, i) => s + (Number(i.value) || 0),
                            0
                        );

                        const total =
                            (row.ql1Percent || 0) - (row.ql1Tax || 0) +
                            (row.ql2Percent || 0) - (row.ql2Tax || 0) +
                            (row.tgPercent || 0) - (row.tgTax || 0) +
                            otherTotal;
                        const percentBase = policyPercentBase(row);
                        const totalPercent = percent(Number(row.ql1Percent || 0), percentBase) + percent(Number(row.ql2Percent || 0), percentBase)
                        const totalCsvc = (Number(row.teacher || 0) / percentBase * 100) + (Number(row.tax || 0) / percentBase * 100) + (Number(row.qlCsvc || 0) / percentBase * 100);
                        return (
                            <React.Fragment key={row.id}>

                                <tr className="hover:bg-blue-50 transition bg-gray-50">


                                    <td rowSpan={7} className="border border-gray-200 font-bold text-red-500">
                                        {index + 1}
                                    </td>

                                    <td rowSpan={7} className="border border-gray-200 text-red-500">
                                        {row.name}
                                        {row.percentAfterTax && (
                                            <div className="text-xs text-gray-500">
                                                % tính trên HP sau thuế {POLICY_TAX_RATE * 100}%
                                            </div>
                                        )}
                                    </td>
                                    <td rowSpan={7} className="border border-gray-200">
                                        {row.fee}
                                    </td>

                                    <td>{percent(Number(row.qlCsvc || 0), percentBase)} %</td>
                                    <td>{percent(Number(row.tax || 0), percentBase)} %</td>
                                    <td>{percent(Number(row.teacher || 0), percentBase)} %</td>

                                    <td>
                                        {(
                                            Number(percent(row.teacher || 0, percentBase)) +
                                            Number(percent(row.tax || 0, percentBase)) +
                                            Number(percent(row.qlCsvc || 0, percentBase))
                                        ).toFixed(2)} %
                                    </td>

                                    <td>{(100 - totalCsvc).toFixed(2)} %</td>


                                    {/*  <td className="border border-gray-200 font-bold text-blue-600">
                                        {totalPercent} %
                                    </td> */}
                                </tr>

                                <tr className="bg-gray-50">


                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "qlCsvc", row.qlCsvc)}
                                    </td>

                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "tax", row.tax)}
                                    </td>

                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "teacher", row.teacher)}
                                    </td>

                                    <td className="border border-gray-200 font-semibold relative" >
                                        {formatVND(row.qlCsvc + row.tax + row.teacher)}
                                    </td>

                                    <td className="border border-gray-200 text-red-500 font-semibold">
                                        {renderRowValue(row.id, "total", row.fee - row.qlCsvc - row.tax - row.teacher)}
                                    </td>





                                    {/*   <td rowSpan={2} colSpan={2} className="border border-gray-200 font-bold text-blue-600">
                                        <div>{formatVND(total)}</div>

                                    </td> */}
                                </tr>

                            </React.Fragment>
                        );
                    })}
                </tbody>
                <thead className="bg-yellow-200">
                    <tr>
                        <th colSpan={policyKeys.length * 2} className="border border-gray-300 p-2">CHÍNH SÁCH</th>
                    </tr>
                    <tr>
                        <th colSpan={2} className="border border-gray-300 p-2">QL1</th>
                        <th colSpan={2} className="border border-gray-300 p-2">QL2</th>
                        {otherCostKeys.map((name, costIndex) => (

                            <th key={`policy-group-${costIndex}-${name}`} colSpan={2} className="border border-gray-300 p-2"> {name}</th>
                        ))}
                    </tr>
                    <th className="border border-gray-200">%HP</th>
                    <th className="border border-gray-200">Thuế</th>

                    <th className="border border-gray-200">%HP</th>
                    <th className="border border-gray-200">Thuế</th>


                    {otherCostKeys.map((name, costIndex) => (
                        <React.Fragment key={`policy-heading-${costIndex}-${name}`}>
                            <th className="border border-gray-200">
                                %HP
                            </th>
                            <th className="border border-gray-200">
                                Thuế
                            </th>
                        </React.Fragment>
                    ))}
                </thead>
                <tbody>
                    {data?.map((row, index) => {
                        const otherTotal = (row.otherCosts || []).reduce(
                            (s, i) => s + (Number(i.value) || 0),
                            0
                        );

                        const total =
                            (row.ql1Percent || 0) - (row.ql1Tax || 0) +
                            (row.ql2Percent || 0) - (row.ql2Tax || 0) +
                            (row.tgPercent || 0) - (row.tgTax || 0) +
                            otherTotal;
                        // % chính sách: trên học phí, hoặc học phí sau thuế 2% nếu khoản này bật cờ.
                        const percentBase = policyPercentBase(row);
                        const totalPercent = percent(Number(row.ql1Percent || 0), percentBase) + percent(Number(row.ql2Percent || 0), percentBase)
                        const totalCsvc = (Number(row.teacher || 0) / percentBase * 100) + (Number(row.tax || 0) / percentBase * 100) + (Number(row.qlCsvc || 0) / percentBase * 100);
                        return (
                            <React.Fragment key={row.id ?? `policy-row-${index}`}>

                                <tr className="hover:bg-blue-50 transition bg-gray-50">
                                    <td>{percent(Number(row.ql1Percent || 0), percentBase)} %</td>
                                    <td>{percent(Number(row.ql1Tax || 0), row.ql1Percent)} %</td>

                                    <td>{percent(Number(row.ql2Percent || 0), percentBase)} %</td>
                                    <td>{percent(Number(row.ql2Tax || 0), row.ql2Percent)} %</td>

                                    {otherCostKeys.map((name, costIndex) => {
                                        const item = (row.otherCosts || []).find(i => i.name === name);

                                        return (
                                            <React.Fragment key={`policy-percent-${index}-${costIndex}-${name}`}>
                                                <td className="border border-gray-200">

                                                    {percent(Number(item?.percent || 0), percentBase)} %
                                                </td>
                                                <td className="border border-gray-200">

                                                    {percent(Number(item?.tax || 0), percentBase)} %
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}

                                </tr>

                                <tr className="bg-gray-50">

                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "ql1Percent", row.ql1Percent)}
                                    </td>

                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "ql1Tax", row.ql1Tax)}
                                    </td>

                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "ql2Percent", row.ql2Percent)}
                                    </td>

                                    <td className="border border-gray-200">
                                        {renderRowValue(row.id, "ql2Tax", row.ql2Tax)}
                                    </td>

                                    {otherCostKeys.map((name, costIndex) => {
                                        const item = (row.otherCosts || []).find(i => i.name === name);

                                        return (
                                            <React.Fragment key={`policy-value-${index}-${costIndex}-${name}`}>
                                                <td className="border border-gray-200">
                                                    {formatVND(item?.percent || 0)}
                                                </td>
                                                <td className="border border-gray-200">
                                                    {formatVND(item?.tax || 0)}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}




                                </tr>

                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>

        </div >
    );
}
