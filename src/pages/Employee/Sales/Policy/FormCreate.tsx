import PolicyPage from "./policy";
import React, { useEffect, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./Support";
import { X } from "lucide-react";
import { useExport } from "../../../../hook/ExportProvider";
import { policiesApi } from "../../../../service/policy";
import { RowType } from "../../../../types/policy";
import { useLocation } from "react-router-dom";
import { getEmployeeName, getUserFromToken } from "../../../../utils/auth";
const MoneyInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    onChange(Number(raw || 0));
  };

  return (
    <input
      value={value ? value.toLocaleString("vi-VN") : ""}
      onChange={handleChange}
      onFocus={(e) => {
        if (value === 0) {
          e.target.value = "";
        }
      }}
      className="w-full text-right bg-transparent outline-none px-1 py-1 rounded 
    focus:bg-white focus:ring-1 focus:ring-blue-400"
    />
  );
};

type FormTypeMoney = {
  type: string;
  money: number;
  months: number;
  students: number;
};
type FormTypeDevice = {
  category: string;
  qty: number;
  price: number;
  months: number;
  students: number;
};
type Props = {
  onClick?: () => void;
};

const NoteIcon = ({ onClick }: Props) => (
  <span
    onClick={onClick}
    className="cursor-pointer text-blue-500 hover:text-blue-700"
  >
    📝
  </span>
);
const NotePopup = ({ value, onChange, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-80 shadow-lg">
        <h3 className="font-bold mb-2">Nhập ghi chú</h3>
        <textarea
          className="w-full border p-2 rounded mb-3"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 bg-gray-300 rounded" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
export default function FormCreate({
  setShowModal,
  subjectId,
  setPolicy,
  defaultData,
  id,
}) {
  const [totalD, setTotalD] = useState<number>(0);
  const [totalM, setTotalM] = useState<number>(0);
  const [totalTax, setTotalTax] = useState<number>(0);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [giaoCu, setGiaoCu] = useState(0);
  const [vanHanh, setVanHanh] = useState(4000);
  const [fee, setFee] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"TIET" | "HS">("HS");
  const [teacherCompany, setTeacherCompany] = useState<number>(0);
  const [studentPerClass, setStudentPerClass] = useState<number>(0);
  const [realPeriods, setRealPeriods] = useState<number>(0);
  const [realStudentPerClass, setRealStudentPerClass] = useState<number>(0);
  const [periods, setPeriods] = useState<number>(36);
  const [rows, setRows] = useState<RowType[]>([
    {
      id: 1,
      name: "Học phí",
      qlCsvc: 0,
      tax: 0,
      teacher: 0,
      totalPercent: 0,
      company: 0,
      ql1Percent: 0,
      ql1Tax: 0,
      ql2Percent: 0,
      ql2Tax: 0,
      tgPercent: 0,
      tgTax: 0,
      total: 0,
      fee: 0,
      otherCosts: [],
      durationMonths: 0,
    },
  ]);
  const [rowsM, setRowsM] = useState<FormTypeMoney[]>([]);
  const [rowsD, setRowsD] = useState<FormTypeDevice[]>([]);
  const [durationMonths, setDurationMonths] = useState<number>(0);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const { exportPDF } = useExport();
  const calcPercent = (fee: number, money: number) => {
    if (!fee) return 0;
    return Math.round((money / fee) * 100);
  };

  // ===== UPDATE =====
  const updateRow = (id: number, field: keyof RowType, value: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const newRow = { ...row, [field]: value };

        newRow.totalPercent = newRow.qlCsvc + newRow.tax + newRow.teacher;

        newRow.company = 100 - newRow.totalPercent;

        const ql1Money = calcPercent(fee, newRow.ql1Percent);
        const ql1TaxMoney = calcPercent(ql1Money, newRow.ql1Tax);

        const ql2Money = calcPercent(fee, newRow.ql2Percent);
        const ql2TaxMoney = calcPercent(ql2Money, newRow.ql2Tax);

        const tgMoney = calcPercent(fee, newRow.tgPercent);
        const tgTaxMoney = calcPercent(tgMoney, newRow.tgTax);
        newRow.total =
          ql1Money +
          ql1TaxMoney +
          ql2Money +
          ql2TaxMoney +
          tgMoney +
          tgTaxMoney;

        return newRow;
      }),
    );
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        qlCsvc: 0,
        tax: 0,
        teacher: 0,
        totalPercent: 0,
        company: 0,
        ql1Percent: 0,
        ql1Tax: 0,
        ql2Percent: 0,
        ql2Tax: 0,
        tgPercent: 0,
        tgTax: 0,
        total: 0,
        fee: 0,
      },
    ]);
  };

  useEffect(() => {
    if (!defaultData) return;

    // 👉 destructure 1 lần cho rõ ràng
    const {
      fee = 0,
      giaoCu = 0,
      vanHanh = 4000,
      ttcs = [],
      httienmat = [],
      htthietbi = [],
      notes = {},
      studentPerClass = 0,
      mode = "TIET",
      teacherCompany = 0,
      durationMonths = 0,
    } = defaultData;

    // 👉 set state (group theo logic)
    setFee(fee);
    setGiaoCu(giaoCu);
    setVanHanh(vanHanh);

    setRows(ttcs.length ? ttcs : []);
    setRowsM(httienmat.length ? httienmat : []);
    setRowsD(htthietbi.length ? htthietbi : []);

    setNotes(notes);
    setStudentPerClass(studentPerClass);
    setTeacherCompany(teacherCompany);
    setDurationMonths(durationMonths);
    const nextTab =
      studentPerClass == null || studentPerClass > 0 ? "TIET" : "HS";

    setActiveTab(nextTab);
  }, [defaultData]);
  useEffect(() => {
    setRows((prev) => [...prev]); // trigger re-render
  }, [activeTab, studentPerClass]);
  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const totalQlCsvc = rows.reduce((sum, row) => sum + row.qlCsvc, 0);

  const totalTeach = rows.reduce((sum, row) => sum + row.teacher, 0);

  const companyProfit =
    fee -
    totalQlCsvc -
    totalTax -
    totalTeach -
    grandTotal -
    totalM -
    totalD -
    giaoCu -
    vanHanh -
    teacherCompany -
    (grandTotal + totalM) * 0.1;
  const companyProfitPerHS =
    studentPerClass > 0 ? (companyProfit * 4) / studentPerClass : 0;
  const buildPayload = () => {
    const clean = (obj: any) => JSON.parse(JSON.stringify(obj));

    return clean({
      fee: Number(fee) || 0,
      csvc: Number(totalQlCsvc) || 0,
      thue: Number(totalTax) || 0,
      giaovien: Number(totalTeach) || 0,
      csthang: Number(grandTotal) || 0,
      cdhd: Number(totalM) || 0,
      thietbi: Number(totalD) || 0,
      giaoCu: Number(giaoCu) || 0,
      thuetndn: Number(grandTotal * 0.1 + totalM * 0.1) || 0,
      vanHanh: Number(vanHanh) || 0,
      durationMonths: Number(durationMonths) || 0,
      notes: notes,
      companyProfit: Number(companyProfit) || 0,
      companyProfitPerHS: Number(companyProfitPerHS) || 0,
      studentPerClass: Number(studentPerClass) || 0,
      periods: Number(periods) || 0,
      teacherCompany: Number(teacherCompany) || 0,
      ttcs: rows.map((r) => ({
        ...r,
      })),
      httienmat: rowsM.map((r) => ({
        ...r,
      })),
      htthietbi: rowsD.map((r) => ({
        ...r,
      })),

      createdAt: new Date().toISOString(),
    });
  };
  const handleSubmit = async (status: "DRAFT" | "PENDING") => {
    try {
      // 🔥 Confirm khi gửi duyệt
      if (status === "PENDING") {
        const ok = confirm("Bạn có chắc muốn gửi duyệt chính sách này?");
        if (!ok) return;
      }

      const userInfo = await getUserFromToken();

      const payload = {
        data: buildPayload(),
        employeeInfo: userInfo,
        subjectId: subjectId,
        durationMonths: durationMonths,
        status,
      };
      if (id) {
        await policiesApi.update(id, payload);
      } else {
        await policiesApi.create(payload);
      }

      const data = await policiesApi.getBySubject(subjectId);
      setPolicy(data);

      // ✅ Alert thành công rõ ràng
      if (status === "DRAFT") {
        alert("✅ Đã lưu bản nháp thành công");
      } else {
        alert("🚀 Đã gửi duyệt thành công");
      }

      setShowModal(false);
    } catch (err: any) {
      console.error(err);

      // ❌ Alert lỗi rõ ràng hơn
      alert(
        err?.response?.data?.message || "❌ Có lỗi xảy ra, vui lòng thử lại",
      );
    }
  };
  const handleSaveDraft = async () => {
    await handleSubmit("DRAFT");
  };

  const handleSubmitApproval = async () => {
    await handleSubmit("PENDING");
  };
  const location = useLocation();
  const data = location.state;

  const renderContentHS = (data: any) => (
    <div className="bg-gray-50 p-4 text-[13px] space-y-6">
      <div className="flex gap-4 items-start ">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-green-200">
              <tr>
                <th
                  colSpan={3}
                  className="border border-gray-300 p-3 font-bold dark:text-gray-800"
                >
                  Giáo viên Công ty
                </th>
                <th className="border border-gray-300 p-3 font-bold dark:text-gray-800">
                  Ghi chú
                </th>
              </tr>
            </thead>

            <tbody className="bg-green-50">
              <tr>
                <td
                  rowSpan={13}
                  className="border border-gray-300 text-red-500 font-bold text-center w-20"
                >
                  {data?.name}
                </td>

                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Mức thu
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(fee)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("fee")} />
                </td>
              </tr>

              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  CSVC
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalQlCsvc)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Số tháng
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput
                    value={durationMonths}
                    onChange={setDurationMonths}
                  />
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Thuế
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalTax)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTax")} />
                </td>
              </tr>

              <tr>
                <td className="border border-gray-200 p-2 text-red-500 text-gray-800 dark:text-gray-800">
                  Giáo viên trường
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalTeach)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTeach")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-blue-600">
                  Giáo viên công ty
                </td>
                <td className="border border-gray-200 p-2 text-right bg-red-50">
                  <MoneyInput
                    value={teacherCompany}
                    onChange={setTeacherCompany}
                  />
                </td>
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("teacherCompany")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  CS tháng
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(grandTotal)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("grandTotal")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  CS ký HĐ{" "}
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalM)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalM")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  Thiết bị
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalD)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Giáo cụ
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={giaoCu} onChange={setGiaoCu} />
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  Thuế TNDN{" "}
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(grandTotal * 0.1 + totalM * 0.1)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("thuetndn")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2">Vận hành </td>
                <td className="border text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={vanHanh} onChange={setVanHanh} />
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("vanHanh")} />
                </td>
              </tr>

              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  Công ty thu về
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(companyProfit)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("companyProfit")} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <PolicyPage
        rows={rows}
        fee={fee}
        setfee={setFee}
        updateRow={updateRow}
        addRow={addRow}
        removeRow={removeRow}
        setGrandTotal={setGrandTotal}
        setTotalTax={setTotalTax}
      />
      <Support
        setTotalM={setTotalM}
        setTotalD={setTotalD}
        data={data.studentCount}
        studentPerClass={studentPerClass}
        activeTab={activeTab}
        setRowsM={setRowsM}
        formsM={rowsM}
        setRowsD={setRowsD}
        formsD={rowsD}
        setPeriods={setPeriods}
        periods={periods}
      />

      <div className="max-w-3xl mx-auto mt-6 space-y-6">
        <div
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg cursor-pointer transition"
          onClick={() => setOpenNoteKey("log")}
        >
          <NoteIcon />
          <span className="text-sm font-medium">Ghi chú</span>
        </div>
      </div>
      <div className="flex justify-center mt-4 gap-2">
        <button
          onClick={() => setShowModal(false)}
          className="w-[200px] py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow text-base font-semibold mb-2"
        >
          Hủy
        </button>
        <button
          onClick={handleSaveDraft}
          className="w-[200px] py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl shadow text-base font-semibold mb-2"
        >
          Lưu nháp
        </button>
        <button
          onClick={handleSubmitApproval}
          className="w-[200px] py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow text-base font-semibold mb-2"
        >
          Gửi duyệt
        </button>
      </div>

      {openNoteKey && (
        <NotePopup
          value={notes[openNoteKey] || ""}
          onChange={(val) =>
            setNotes((prev) => ({
              ...prev,
              [openNoteKey]: val,
            }))
          }
          onClose={() => setOpenNoteKey(null)}
        />
      )}
    </div>
  );
  const renderContentTiet = (data: any) => (
    <div className="bg-gray-50 p-4 text-[13px] space-y-6">
      <div className="flex gap-4 items-start ">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-green-200">
              <tr>
                <th
                  colSpan={3}
                  className="border border-gray-300 p-3 font-bold dark:text-gray-800"
                >
                  Giáo viên Công ty
                </th>
                <th className="border border-gray-300 p-3 font-bold dark:text-gray-800">
                  Ghi chú
                </th>
              </tr>
            </thead>

            <tbody className="bg-green-50">
              <tr>
                <td
                  rowSpan={15}
                  className="border border-gray-300 text-red-500 font-bold text-center w-20"
                >
                  {data?.name}
                </td>

                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Mức thu
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(fee)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("fee")} />
                </td>
              </tr>

              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  CSVC
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalQlCsvc)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Số tháng
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput
                    value={durationMonths}
                    onChange={setDurationMonths}
                  />
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Sĩ số HS/lớp</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput
                    value={studentPerClass}
                    onChange={setStudentPerClass}
                  />
                </td>
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("studentPerClass")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Thuế
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalTax)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTax")} />
                </td>
              </tr>

              <tr>
                <td className="border border-gray-200 p-2 text-red-500 text-gray-800 dark:text-gray-800">
                  Giáo viên trường
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalTeach)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTeach")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-blue-600">
                  Giáo viên công ty
                </td>
                <td className="border border-gray-200 p-2 text-right bg-red-50">
                  <MoneyInput
                    value={teacherCompany}
                    onChange={setTeacherCompany}
                  />
                </td>
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("teacherCompany")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  CS tháng
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(grandTotal)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("grandTotal")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  CS ký HĐ{" "}
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalM)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalM")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  Thiết bị
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalD)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Giáo cụ
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={giaoCu} onChange={setGiaoCu} />
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  Thuế TNDN{" "}
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(grandTotal * 0.1 + totalM * 0.1)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("thuetndn")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2">Vận hành </td>
                <td className="border text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={vanHanh} onChange={setVanHanh} />
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("vanHanh")} />
                </td>
              </tr>

              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  Công ty thu về
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(companyProfit)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("companyProfit")} />
                </td>
              </tr>

              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  HP/HS
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(companyProfitPerHS)}
                </td>
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon
                    onClick={() => setOpenNoteKey("companyProfitPerHS")}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {activeTab === "TIET" && (
        <>
          <PolicyPage
            rows={rows}
            fee={activeTab === "TIET" ? fee : fee}
            setfee={setFee}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            setGrandTotal={setGrandTotal}
            setTotalTax={setTotalTax}
          />

          <Support
            setTotalM={setTotalM}
            setTotalD={setTotalD}
            data={data.studentCount}
            studentPerClass={studentPerClass}
            activeTab={activeTab}
            setRowsM={setRowsM}
            formsM={rowsM}
            setRowsD={setRowsD}
            formsD={rowsD}
            setPeriods={setPeriods}
            periods={periods}
            realPeriods={realPeriods}
            setRealPeriods={setRealPeriods}
            realStudentPerClass={realStudentPerClass}
            setRealStudentPerClass={setRealStudentPerClass}
          />
        </>
      )}
      {activeTab === "HS" && (
        <>
          <PolicyPage
            rows={rows}
            fee={fee}
            setfee={setFee}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            setGrandTotal={setGrandTotal}
            setTotalTax={setTotalTax}
          />

          <Support
            setTotalM={setTotalM}
            setTotalD={setTotalD}
            data={data.studentCount}
            studentPerClass={studentPerClass}
            activeTab={activeTab}
            setRowsM={setRowsM}
            formsM={rowsM}
            setRowsD={setRowsD}
            formsD={rowsD}
            setPeriods={setPeriods}
            periods={periods}
            realPeriods={realPeriods}
            setRealPeriods={setRealPeriods}
            realStudentPerClass={realStudentPerClass}
            setRealStudentPerClass={setRealStudentPerClass}
          />
        </>
      )}
      <div className="max-w-3xl mx-auto mt-6 space-y-6">
        <div
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg cursor-pointer transition"
          onClick={() => setOpenNoteKey("log")}
        >
          <NoteIcon />
          <span className="text-sm font-medium">Ghi chú</span>
        </div>
      </div>
      <div className="flex justify-center mt-4 gap-2">
        <button
          onClick={() => setShowModal(false)}
          className="w-[200px] py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow text-base font-semibold mb-2"
        >
          Hủy
        </button>
        <button
          onClick={handleSaveDraft}
          className="w-[200px] py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl shadow text-base font-semibold mb-2"
        >
          Lưu nháp
        </button>
        <button
          onClick={handleSubmitApproval}
          className="w-[200px] py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow text-base font-semibold mb-2"
        >
          Gửi duyệt
        </button>
      </div>

      {openNoteKey && (
        <NotePopup
          value={notes[openNoteKey] || ""}
          onChange={(val) =>
            setNotes((prev) => ({
              ...prev,
              [openNoteKey]: val,
            }))
          }
          onClose={() => setOpenNoteKey(null)}
        />
      )}
    </div>
  );
  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="fixed top-0 left-0 w-full h-14 bg-blue-500 flex items-center px-4 z-50">
        <h1 className="text-white font-semibold text-sm">
          {decodeURIComponent("Danh sách chính sách")}
        </h1>
      </div>
      <button
        onClick={() => setShowModal(false)}
        className="fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center 
                   bg-white/90 backdrop-blur rounded-full shadow-md 
                   active:scale-95 transition"
      >
        <X size={18} className="text-gray-700" />
      </button>
      <div className="flex justify-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("HS")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === "HS" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
          >
            HP / HS
          </button>
          <button
            onClick={() => setActiveTab("TIET")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === "TIET" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
          >
            HP / Tiết
          </button>
        </div>
      </div>
      <div
        className="app-content"
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "INPUT") {
            (target as any).readOnly = false;
            target.focus();
          }
        }}
      >
        {activeTab === "TIET" && renderContentTiet(data)}
        {activeTab === "HS" && renderContentHS(data)}
      </div>
    </div>
  );
}
