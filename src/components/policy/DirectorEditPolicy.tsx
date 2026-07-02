import PolicyPage from "@/pages/Employee/Sales/Policy/policy";
import React, { useEffect, useState } from "react";
import { formatVND } from "@/utils/formatVND";
import Support from "@/pages/Employee/Sales/Policy/Support";
import { X } from "lucide-react";
import { policiesApi } from "@/service/policy";
import { RowType } from "@/types/policy";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "@/utils/apiError";
import PolicyHistoryTimeline from "./PolicyHistoryTimeline";

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
        if (value === 0) e.target.value = "";
      }}
      className="w-full text-right bg-transparent outline-none px-1 py-1 rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
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

const NoteIcon = ({ onClick }: { onClick?: () => void }) => (
  <span
    onClick={onClick}
    className="cursor-pointer text-blue-500 hover:text-blue-700"
  >
    📝
  </span>
);

const NotePopup = ({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) => (
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

type Props = {
  policyId: number;
  employeeId: number;
  defaultData: any;
  studentCount?: number;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function DirectorEditPolicy({
  policyId,
  employeeId,
  defaultData,
  studentCount,
  onClose,
  onSuccess,
}: Props) {
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
  const [rows, setRows] = useState<RowType[]>([]);
  const [rowsM, setRowsM] = useState<FormTypeMoney[]>([]);
  const [rowsD, setRowsD] = useState<FormTypeDevice[]>([]);
  const [durationMonths, setDurationMonths] = useState<number>(0);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);

  const [directorNote, setDirectorNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [histories, setHistories] = useState<any[] | null>(null);

  const calcPercent = (feeVal: number, money: number) => {
    if (!feeVal) return 0;
    return Math.round((money / feeVal) * 100);
  };

  const updateRow = (id: number, field: keyof RowType, value: any) => {
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
          ql1Money + ql1TaxMoney + ql2Money + ql2TaxMoney + tgMoney + tgTaxMoney;
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

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    if (!defaultData) return;
    const {
      fee = 0,
      giaoCu = 0,
      vanHanh = 4000,
      ttcs = [],
      httienmat = [],
      htthietbi = [],
      notes = {},
      studentPerClass = 0,
      teacherCompany = 0,
      durationMonths = 0,
      periods = 36,
    } = defaultData;

    setFee(fee);
    setGiaoCu(giaoCu);
    setVanHanh(vanHanh);
    setRows(ttcs.length ? ttcs : []);
    setRowsM(httienmat.length ? httienmat : []);
    setRowsD(htthietbi.length ? htthietbi : []);
    setNotes(notes || {});
    setStudentPerClass(studentPerClass);
    setTeacherCompany(teacherCompany);
    setDurationMonths(durationMonths);
    setPeriods(periods);

    const nextTab =
      studentPerClass == null || studentPerClass > 0 ? "TIET" : "HS";
    setActiveTab(nextTab);
  }, [defaultData]);

  useEffect(() => {
    setRows((prev) => [...prev]);
  }, [activeTab, studentPerClass]);

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
      notes,
      companyProfit: Number(companyProfit) || 0,
      companyProfitPerHS: Number(companyProfitPerHS) || 0,
      studentPerClass: Number(studentPerClass) || 0,
      periods: Number(periods) || 0,
      teacherCompany: Number(teacherCompany) || 0,
      ttcs: rows.map((r) => ({ ...r })),
      httienmat: rowsM.map((r) => ({ ...r })),
      htthietbi: rowsD.map((r) => ({ ...r })),
    });
  };

  const handleSubmit = async () => {
    const ok = confirm("Xác nhận lưu chỉnh sửa chính sách?");
    if (!ok) return;

    try {
      setSaving(true);
      const res = await policiesApi.directorUpdate(policyId, {
        employeeId,
        data: buildPayload(),
        note: directorNote || undefined,
        durationMonths: durationMonths || undefined,
      });
      setHistories(res.histories || []);
      toast.success("Cập nhật chính sách thành công.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Không thể cập nhật chính sách"));
    } finally {
      setSaving(false);
    }
  };

  const renderCostTable = (data: any) => (
    <div className="flex gap-4 items-start">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-amber-200">
            <tr>
              <th
                colSpan={3}
                className="border border-gray-300 p-3 font-bold text-gray-800"
              >
                Giám đốc chỉnh sửa
              </th>
              <th className="border border-gray-300 p-3 font-bold text-gray-800">
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody className="bg-amber-50">
            <tr>
              <td
                rowSpan={activeTab === "TIET" ? 15 : 13}
                className="border border-gray-300 text-amber-600 font-bold text-center w-20"
              >
                {data?.name || "Chính sách"}
              </td>
              <td className="border border-gray-200 p-2 text-gray-800">
                Mức thu
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(fee)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("fee")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-gray-800">CSVC</td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(totalQlCsvc)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
              </td>
            </tr>
            <tr>
              <td className="border p-2 text-gray-800">Số tháng</td>
              <td className="border p-2 text-right bg-red-50">
                <MoneyInput value={durationMonths} onChange={setDurationMonths} />
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
              </td>
            </tr>
            {activeTab === "TIET" && (
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
            )}
            <tr>
              <td className="border border-gray-200 p-2 text-gray-800">Thuế</td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(totalTax)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("totalTax")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-red-500">
                Giáo viên trường
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(totalTeach)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("totalTeach")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-blue-600">
                Giáo viên công ty
              </td>
              <td className="border border-gray-200 p-2 text-right bg-red-50">
                <MoneyInput value={teacherCompany} onChange={setTeacherCompany} />
              </td>
              <td className="border text-center">
                <NoteIcon onClick={() => setOpenNoteKey("teacherCompany")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-gray-800">
                CS tháng
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(grandTotal)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("grandTotal")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-gray-800">
                CS ký HĐ
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(totalM)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("totalM")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-gray-800">
                Thiết bị
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(totalD)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
              </td>
            </tr>
            <tr>
              <td className="border p-2 text-gray-800">Giáo cụ</td>
              <td className="border p-2 text-right bg-red-50">
                <MoneyInput value={giaoCu} onChange={setGiaoCu} />
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
              </td>
            </tr>
            <tr>
              <td className="border border-gray-200 p-2 text-gray-800">
                Thuế TNDN
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(grandTotal * 0.1 + totalM * 0.1)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("thuetndn")} />
              </td>
            </tr>
            <tr>
              <td className="border p-2">Vận hành</td>
              <td className="border text-right bg-red-50">
                <MoneyInput value={vanHanh} onChange={setVanHanh} />
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("vanHanh")} />
              </td>
            </tr>
            <tr className="font-semibold text-red-500">
              <td className="border border-gray-200 p-2 text-center text-gray-800">
                Công ty thu về
              </td>
              <td className="border border-gray-200 p-2 text-right text-gray-800">
                {formatVND(companyProfit)}
              </td>
              <td className="border border-gray-200 p-2 text-center">
                <NoteIcon onClick={() => setOpenNoteKey("companyProfit")} />
              </td>
            </tr>
            {activeTab === "TIET" && (
              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800">
                  HP/HS
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(companyProfitPerHS)}
                </td>
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon
                    onClick={() => setOpenNoteKey("companyProfitPerHS")}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (histories) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="fixed top-0 left-0 w-full h-14 bg-amber-500 flex items-center px-4 z-50">
          <h1 className="text-white font-semibold text-sm">
            Cập nhật thành công
          </h1>
        </div>
        <button
          onClick={onClose}
          className="fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur rounded-full shadow-md active:scale-95 transition"
        >
          <X size={18} className="text-gray-700" />
        </button>
        <div className="p-4 mt-[60px]">
          <PolicyHistoryTimeline histories={histories} title="Kết quả chỉnh sửa" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="fixed top-0 left-0 w-full h-14 bg-amber-500 flex items-center px-4 z-50">
        <h1 className="text-white font-semibold text-sm">
          Giám đốc chỉnh sửa chính sách
        </h1>
      </div>
      <button
        onClick={onClose}
        className="fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur rounded-full shadow-md active:scale-95 transition"
      >
        <X size={18} className="text-gray-700" />
      </button>

      <div className="flex justify-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("HS")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === "HS" ? "bg-amber-500 text-white" : "bg-gray-200"
            }`}
          >
            HP / HS
          </button>
          <button
            onClick={() => setActiveTab("TIET")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === "TIET" ? "bg-amber-500 text-white" : "bg-gray-200"
            }`}
          >
            HP / Tiết
          </button>
        </div>
      </div>

      <div className="bg-gray-50 p-4 text-[13px] space-y-6">
        {renderCostTable(null)}

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
          data={studentCount || 0}
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

        <div className="max-w-3xl mx-auto mt-6 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Lý do chỉnh sửa
            </label>
            <textarea
              value={directorNote}
              onChange={(e) => setDirectorNote(e.target.value)}
              placeholder="Nhập lý do chỉnh sửa cho nhân viên..."
              className="w-full border border-gray-300 rounded-xl p-3 h-24 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>

          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg cursor-pointer transition"
            onClick={() => setOpenNoteKey("log")}
          >
            <NoteIcon />
            <span className="text-sm font-medium">Ghi chú nội bộ</span>
          </div>
        </div>

        <div className="flex justify-center mt-4 gap-2 pb-6">
          <button
            onClick={onClose}
            className="w-[200px] py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-xl shadow text-base font-semibold"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`w-[200px] py-3 rounded-xl shadow text-base font-semibold text-white ${
              saving
                ? "bg-amber-300 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600"
            }`}
          >
            {saving ? "Đang lưu..." : "Lưu chỉnh sửa"}
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
    </div>
  );
}
