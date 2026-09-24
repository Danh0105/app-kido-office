import React from "react";
import { formatVND } from "../../../../utils/formatVND";
import { POLICY_TAX_RATE, policyPercentBase } from "../../../../types/policy";

export default function PolicyPage({ data = [], renderRowValue }: any) {
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
    <div className="overflow-x-auto p-4 text-sm text-gray-800">
      <table className="w-full min-w-max border-collapse border border-gray-300 text-center">
        <thead>
          <tr className="bg-yellow-200">
            <th rowSpan={3} className="min-w-[72px] border border-gray-300 p-2">
              STT
            </th>
            <th
              rowSpan={3}
              className="min-w-[120px] border border-gray-300 p-2"
            >
              Khoản
            </th>
            <th
              rowSpan={3}
              className="min-w-[120px] border border-gray-300 p-2"
            >
              Mức thu
            </th>
            <th colSpan={5} className="border border-gray-300 p-2">
              PHẦN THU
            </th>
            <th
              colSpan={policyKeys.length * 2}
              className="border border-gray-300 p-2"
            >
              CHÍNH SÁCH
            </th>
          </tr>

          <tr className="bg-yellow-100">
            <th colSpan={4} className="border border-gray-300 p-2">
              NHÀ TRƯỜNG
            </th>
            <th className="border border-gray-300 p-2">Cty</th>
            {policyKeys.map((name, keyIndex) => (
              <th key={`policy-group-${keyIndex}-${name}`} colSpan={2} className="border border-gray-300 p-2">
                {name}
              </th>
            ))}
          </tr>

          <tr className="bg-gray-100 text-[13px]">
            <th className="min-w-[100px] border border-gray-200 p-2">CSVC</th>
            <th className="min-w-[100px] border border-gray-200 p-2">Thuế</th>
            <th className="min-w-[100px] border border-gray-200 p-2">GV</th>
            <th className="min-w-[110px] border border-gray-200 p-2">Tổng %</th>
            <th className="min-w-[130px] border border-gray-200 p-2">
              PT chương trình
            </th>
            {policyKeys.map((name, keyIndex) => (
              <React.Fragment key={`policy-heading-${keyIndex}-${name}`}>
                <th className="min-w-[100px] border border-gray-200 p-2">
                  %HP
                </th>
                <th className="min-w-[100px] border border-gray-200 p-2">
                  Thuế
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row: any, index: number) => {
            const fee = Number(row.fee || 0);
            const qlCsvc = Number(row.qlCsvc || 0);
            const tax = Number(row.tax || 0);
            const teacher = Number(row.teacher || 0);
            // % chính sách: trên học phí, hoặc học phí sau thuế 2% nếu khoản này bật cờ.
            const percentBase = policyPercentBase(row);
            const schoolPercent =
              Number(percent(qlCsvc, percentBase)) +
              Number(percent(tax, percentBase)) +
              Number(percent(teacher, percentBase));

            return (
              <React.Fragment key={row.id ?? index}>
                <tr className="bg-gray-50 transition hover:bg-blue-50">
                  <td
                    rowSpan={2}
                    className="border border-gray-200 p-2 font-bold text-red-500"
                  >
                    {index + 1}
                  </td>
                  <td
                    rowSpan={2}
                    className="border border-gray-200 p-2 text-red-500"
                  >
                    {row.name}
                    {row.percentAfterTax && (
                      <div className="text-xs font-normal text-gray-500">
                        % tính trên HP sau thuế {POLICY_TAX_RATE * 100}%
                      </div>
                    )}
                  </td>
                  <td
                    rowSpan={2}
                    className="border border-gray-200 p-2 font-medium"
                  >
                    {formatVND(fee)}
                  </td>

                  <td className="border border-gray-200 p-2">
                    {percent(qlCsvc, percentBase)} %
                  </td>
                  <td className="border border-gray-200 p-2">
                    {percent(tax, percentBase)} %
                  </td>
                  <td className="border border-gray-200 p-2">
                    {percent(teacher, percentBase)} %
                  </td>
                  <td className="border border-gray-200 p-2 font-semibold">
                    {schoolPercent.toFixed(2)} %
                  </td>
                  <td className="border border-gray-200 p-2">
                    {(100 - schoolPercent).toFixed(2)} %
                  </td>

                  <td className="border border-gray-200 p-2">
                    {percent(Number(row.ql1Percent || 0), percentBase)} %
                  </td>
                  <td className="border border-gray-200 p-2">
                    {percent(
                      Number(row.ql1Tax || 0),
                      Number(row.ql1Percent || 0)
                    )}{" "}
                    %
                  </td>
                  <td className="border border-gray-200 p-2">
                    {percent(Number(row.ql2Percent || 0), percentBase)} %
                  </td>
                  <td className="border border-gray-200 p-2">
                    {percent(
                      Number(row.ql2Tax || 0),
                      Number(row.ql2Percent || 0)
                    )}{" "}
                    %
                  </td>
                  {otherCostKeys.map((name, costIndex) => {
                    const item = (row.otherCosts || []).find(
                      (cost: any) => cost.name === name
                    );
                    return (
                      <React.Fragment key={`policy-percent-${index}-${costIndex}-${name}`}>
                        <td className="border border-gray-200 p-2">
                          {percent(Number(item?.percent || 0), percentBase)} %
                        </td>
                        <td className="border border-gray-200 p-2">
                          {percent(Number(item?.tax || 0), percentBase)} %
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>

                <tr className="bg-white transition hover:bg-blue-50">
                  <td className="border border-gray-200 p-2">
                    {renderRowValue(row.id, "qlCsvc", qlCsvc)}
                  </td>
                  <td className="border border-gray-200 p-2">
                    {renderRowValue(row.id, "tax", tax)}
                  </td>
                  <td className="border border-gray-200 p-2">
                    {renderRowValue(row.id, "teacher", teacher)}
                  </td>
                  <td className="border border-gray-200 p-2 font-semibold">
                    {formatVND(qlCsvc + tax + teacher)}
                  </td>
                  <td className="border border-gray-200 p-2 font-semibold text-red-500">
                    {renderRowValue(
                      row.id,
                      "total",
                      fee - qlCsvc - tax - teacher
                    )}
                  </td>

                  <td className="border border-gray-200 p-2">
                    {renderRowValue(
                      row.id,
                      "ql1Percent",
                      Number(row.ql1Percent || 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2">
                    {renderRowValue(row.id, "ql1Tax", Number(row.ql1Tax || 0))}
                  </td>
                  <td className="border border-gray-200 p-2">
                    {renderRowValue(
                      row.id,
                      "ql2Percent",
                      Number(row.ql2Percent || 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2">
                    {renderRowValue(row.id, "ql2Tax", Number(row.ql2Tax || 0))}
                  </td>
                  {otherCostKeys.map((name, costIndex) => {
                    const item = (row.otherCosts || []).find(
                      (cost: any) => cost.name === name
                    );
                    return (
                      <React.Fragment key={`policy-value-${index}-${costIndex}-${name}`}>
                        <td className="border border-gray-200 p-2">
                          {formatVND(item?.percent || 0)}
                        </td>
                        <td className="border border-gray-200 p-2">
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
    </div>
  );
}
