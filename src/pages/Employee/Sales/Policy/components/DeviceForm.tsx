import { formatNumber, parseNumber } from "../../../../../utils/formatNumber";
import React, { useEffect } from "react";

type FormType = {
  category: string;
  qty: number;
  price: number;
  depreciationYears: number;
  months: number;
  students: number;
  realPeriods: number; // ✅ FIX
  realStudents: number;
};

// Mốc mặc định cố định để tính đơn giá — không cho sửa.
const DEFAULT_STUDENTS = 1000;
const DEFAULT_MONTHS = 9;
const DEFAULT_PERIODS = 36;

export default function DeviceForm({
  onTotalChange,
  data,
  setRowsD,
  formsD,
  activeTab,
  studentPerClass,
  onStudentPerClassChange,
  sharedValues,
  onSharedFieldChange,
}: any) {
  const handleChange = (
    index: number,
    key: keyof FormType,
    value: string | number,
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
        depreciationYears: 1,
        months: 0,
        students: sharedValues.students || data || 0,
        realPeriods: sharedValues.realPeriods || 0,
        realStudents: sharedValues.realStudents || 0,
      },
    ]);
  };

  const removeForm = (index: number) => {
    setRowsD(formsD.filter((_: any, i: number) => i !== index));
  };

  // ✅ TOTAL giống MoneyForm
  useEffect(() => {
    const total = formsD.reduce((sum: number, form: FormType) => {
      const thanhTienGoc = form.qty * form.price;
      const depreciationYears = Number(form.depreciationYears) || 0;
      const depreciatedAmount =
        depreciationYears > 0 ? thanhTienGoc / depreciationYears : 0;

      if (activeTab === "TIET") {
        // HP/TIẾT: khấu hao thành tiền theo năm trước khi phân bổ.
        const csKyHD =
          depreciatedAmount > 0 &&
          form.realPeriods > 0 &&
          form.realStudents > 0 &&
          studentPerClass > 0
            ? Math.round(
                (depreciatedAmount / form.realPeriods / form.realStudents) *
                  studentPerClass,
              )
            : 0;
        return sum + csKyHD;
      }

      // HP/HS: khấu hao thành tiền theo năm trước khi phân bổ.
      const csKyHDHS =
        depreciatedAmount > 0 && form.months > 0 && form.realStudents > 0
          ? Math.round(depreciatedAmount / form.months / form.realStudents)
          : 0;

      return sum + csKyHDHS;
    }, 0);

    onTotalChange?.(total);
  }, [formsD, studentPerClass, activeTab]);

  const fieldClass =
    "w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3.5 py-2.5 text-[15px] text-gray-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-400";
  const fieldLabelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  return (
    <div className="mx-auto mt-6 max-w-3xl space-y-4 px-1 sm:px-0">
      {formsD.map((form: FormType, index: number) => {
        const thanhTien = form.qty * form.price;
        const depreciationYears = Number(form.depreciationYears) || 0;
        const depreciatedAmount =
          depreciationYears > 0 ? thanhTien / depreciationYears : 0;

        // HP/TIẾT = Thành tiền / Số năm khấu hao / 1.000 / 36.
        const donGia1Tiet =
          activeTab === "TIET"
            ? depreciatedAmount / DEFAULT_STUDENTS / DEFAULT_PERIODS
            : 0;

        // HP/HS = Thành tiền / Số năm khấu hao / 1.000 / 9.
        const donGiaMacDinh =
          activeTab !== "TIET"
            ? depreciatedAmount / DEFAULT_STUDENTS / DEFAULT_MONTHS
            : 0;
        // Thành tiền thực tế = Đơn giá mặc định × Số học sinh thực nhập × Số tháng nhập.
        const thanhTienThucTe =
          donGiaMacDinh > 0 && form.realStudents > 0 && form.months > 0
            ? Math.round(donGiaMacDinh * form.realStudents * form.months)
            : 0;

        // Khớp với dòng "Thiết bị" ở Bảng tính chi phí (totalD dùng cùng công thức này).
        const csKyHDHS =
          depreciatedAmount > 0 && form.months > 0 && form.realStudents > 0
            ? Math.round(depreciatedAmount / form.months / form.realStudents)
            : 0;

        // Thành tiền thực tế (TIET mode) = Đơn giá 1 tiết × số học sinh thực × số tiết thực.
        const thanhTienThucTeTiet =
          donGia1Tiet > 0 && form.realStudents > 0 && form.realPeriods > 0
            ? Math.round(donGia1Tiet * form.realStudents * form.realPeriods)
            : 0;

        // Khớp với dòng "Thiết bị" ở Bảng tính chi phí (totalD dùng cùng công thức này).
        const csKyHD =
          depreciatedAmount > 0 &&
          form.realPeriods > 0 &&
          form.realStudents > 0 &&
          studentPerClass > 0
            ? Math.round(
                (depreciatedAmount / form.realPeriods / form.realStudents) *
                  studentPerClass,
              )
            : 0;

        const missingInput =
          activeTab === "TIET"
            ? !thanhTien || depreciationYears <= 0
            : !thanhTien ||
              depreciationYears <= 0 ||
              !form.realStudents ||
              !form.months;

        const missingRealInput =
          activeTab === "TIET" && (!form.realStudents || !form.realPeriods);

        return (
          <div
            key={index}
            className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-yellow-200 px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold tracking-wide text-gray-800 sm:text-base">
                Thiết bị #{index + 1}
              </h2>
              {formsD.length > 1 && (
                <button
                  onClick={() => removeForm(index)}
                  className="rounded-lg bg-red-500 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-600"
                >
                  Xoá
                </button>
              )}
            </div>

            {/* Body */}
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <label className={fieldLabelClass}>Danh mục</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) =>
                    handleChange(index, "category", e.target.value)
                  }
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={fieldLabelClass}>Số lượng</label>
                  <input
                    type="number"
                    value={form.qty || ""}
                    onChange={(e) =>
                      handleChange(index, "qty", Number(e.target.value))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Đơn giá</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.price ? formatNumber(form.price) || "" : ""}
                    onChange={(e) =>
                      handleChange(index, "price", parseNumber(e.target.value))
                    }
                    className={`${fieldClass} font-semibold text-blue-600`}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Số năm khấu hao</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.depreciationYears || ""}
                    onChange={(e) =>
                      handleChange(
                        index,
                        "depreciationYears",
                        Number(e.target.value),
                      )
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Số tiền khấu hao</label>
                  <input
                    type="text"
                    readOnly
                    aria-readonly="true"
                    value={
                      depreciatedAmount > 0
                        ? formatNumber(depreciatedAmount)
                        : ""
                    }
                    className={`${fieldClass} cursor-not-allowed bg-gray-100 font-semibold text-gray-600`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Thành tiền
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  {thanhTien.toLocaleString()} đ
                </span>
              </div>

              {activeTab === "TIET" ? (
                <div>
                  <label className={fieldLabelClass}>Sĩ số lớp</label>
                  <input
                    type="number"
                    value={studentPerClass || ""}
                    onChange={(e) =>
                      onStudentPerClassChange?.(Number(e.target.value))
                    }
                    className={fieldClass}
                  />
                </div>
              ) : (
                <div>
                  <label className={fieldLabelClass}>Số học sinh</label>
                  <input
                    type="number"
                    value={
                      index === 0
                        ? sharedValues.realStudents || ""
                        : form.realStudents || ""
                    }
                    onChange={(e) =>
                      index === 0
                        ? onSharedFieldChange(
                            "realStudents",
                            Number(e.target.value),
                          )
                        : handleChange(
                            index,
                            "realStudents",
                            Number(e.target.value),
                          )
                    }
                    className={fieldClass}
                  />
                </div>
              )}

              {activeTab !== "TIET" && (
                <div>
                  <label className={fieldLabelClass}>Số tháng</label>
                  <input
                    type="number"
                    min="0"
                    step={0.1}
                    value={form.months || ""}
                    onChange={(e) => {
                      handleChange(index, "months", Number(e.target.value));
                    }}
                    className={fieldClass}
                  />
                </div>
              )}

              {activeTab === "TIET" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelClass}>Số học sinh thực</label>
                    <input
                      type="number"
                      min="0"
                      value={
                        index === 0
                          ? sharedValues.realStudents || ""
                          : form.realStudents || ""
                      }
                      onChange={(e) =>
                        index === 0
                          ? onSharedFieldChange(
                              "realStudents",
                              Number(e.target.value),
                            )
                          : handleChange(
                              index,
                              "realStudents",
                              Number(e.target.value),
                            )
                      }
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelClass}>Số tiết thực</label>
                    <input
                      type="number"
                      min="0"
                      value={
                        index === 0
                          ? sharedValues.realPeriods || ""
                          : form.realPeriods || ""
                      }
                      onChange={(e) =>
                        index === 0
                          ? onSharedFieldChange(
                              "realPeriods",
                              Number(e.target.value),
                            )
                          : handleChange(
                              index,
                              "realPeriods",
                              Number(e.target.value),
                            )
                      }
                      className={fieldClass}
                    />
                  </div>
                </div>
              )}

              {/* Kết quả */}
              {activeTab === "TIET" ? (
                <div className="grid grid-cols-2 gap-3">
                  {/* Cột trái: mốc mặc định để so sánh */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Mặc định
                    </div>
                    <div className="text-xs text-gray-500">
                      {DEFAULT_STUDENTS.toLocaleString()} HS · {DEFAULT_PERIODS}{" "}
                      tiết
                    </div>
                    <div className="text-xs text-gray-500">Đơn giá 1 tiết</div>
                    {missingInput ? (
                      <div className="text-[11px] italic text-red-500">
                        Chưa nhập số lượng/đơn giá thiết bị
                      </div>
                    ) : (
                      <div className="font-semibold text-gray-700">
                        {Math.round(donGia1Tiet).toLocaleString()} đ
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">
                      = Thành tiền / {depreciationYears || "Số năm khấu hao"}{" "}
                      năm / {DEFAULT_STUDENTS.toLocaleString()} / {DEFAULT_PERIODS}
                    </div>
                  </div>

                  {/* Cột phải: số kinh doanh thực nhập */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                      Thực tế nhập
                    </div>
                    <div className="text-xs text-blue-700">
                      {form.realStudents || 0} HS · {form.realPeriods || 0} tiết
                    </div>
                    <div className="text-xs font-semibold text-blue-700 pt-1 border-t border-blue-200">
                      Thiết bị
                    </div>
                    {missingRealInput || !studentPerClass ? (
                      <div className="text-[11px] italic text-red-500">
                        Chưa nhập đủ sĩ số lớp, số học sinh thực hoặc số tiết
                        thực
                      </div>
                    ) : (
                      <div className="text-base font-bold text-blue-800">
                        {csKyHD.toLocaleString()} đ
                      </div>
                    )}
                    <div className="text-[10px] text-blue-500">
                      = Thành tiền / Số năm khấu hao / Số tiết thực / Số học
                      sinh thực × Sĩ số lớp
                    </div>
                    <div className="text-xs text-blue-700 pt-1 border-t border-blue-200">
                      Thành tiền
                    </div>
                    {missingRealInput ? (
                      <div className="text-[11px] italic text-red-500">
                        Chưa nhập số học sinh thực hoặc số tiết thực
                      </div>
                    ) : (
                      <div className="font-semibold text-blue-700">
                        {thanhTienThucTeTiet.toLocaleString()} đ
                      </div>
                    )}
                    <div className="text-[10px] text-blue-500">
                      = Đơn giá 1 tiết × Số học sinh thực × Số tiết thực
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {/* Cột trái: mốc mặc định để so sánh */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Mặc định
                    </div>
                    <div className="text-xs text-gray-500">
                      {DEFAULT_STUDENTS.toLocaleString()} HS · {DEFAULT_MONTHS}{" "}
                      tháng
                    </div>
                    <div className="text-xs text-gray-500">Đơn giá</div>
                    <div className="font-semibold text-gray-700">
                      {Math.round(donGiaMacDinh).toLocaleString()} đ
                    </div>
                    <div className="text-[10px] text-gray-400">
                      = Thành tiền / {depreciationYears || "Số năm khấu hao"}{" "}
                      năm / {DEFAULT_STUDENTS.toLocaleString()} / {DEFAULT_MONTHS}
                    </div>
                  </div>

                  {/* Cột phải: số kinh doanh thực nhập */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                      Thực tế nhập
                    </div>
                    <div className="text-xs text-blue-700">
                      {form.realStudents || 0} HS · {form.months || 0} tháng
                    </div>
                    <div className="text-xs font-semibold text-blue-700 pt-1 border-t border-blue-200">
                      Thiết bị{" "}
                    </div>
                    {missingInput ? (
                      <div className="text-[11px] italic text-red-500">
                        Chưa nhập đủ số học sinh hoặc số tháng
                      </div>
                    ) : (
                      <div className="text-base font-bold text-blue-800">
                        {csKyHDHS.toLocaleString()} đ
                      </div>
                    )}
                    <div className="text-[10px] text-blue-500">
                      = Thành tiền / Số năm khấu hao / Số tháng / Số học sinh
                      thực
                    </div>
                    <div className="text-xs text-blue-700 pt-1 border-t border-blue-200">
                      Thành tiền
                    </div>
                    {missingInput ? (
                      <div className="text-[11px] italic text-red-500">
                        Chưa nhập đủ số học sinh hoặc số tháng
                      </div>
                    ) : (
                      <div className="font-semibold text-blue-700">
                        {thanhTienThucTe.toLocaleString()} đ
                      </div>
                    )}
                    <div className="text-[10px] text-blue-500">
                      = Đơn giá × Số học sinh × Số tháng
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add */}
      <button
        onClick={addForm}
        className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
      >
        + Thêm thiết bị
      </button>
    </div>
  );
}
