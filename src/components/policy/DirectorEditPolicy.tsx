import PolicyPage from "@/pages/Employee/Sales/Policy/policy";
import React, { useEffect, useState } from "react";
import { formatVND } from "@/utils/formatVND";
import Support from "@/pages/Employee/Sales/Policy/Support";
import { X } from "lucide-react";
import PolicyPie from "@/components/PolicyPie";
import DepreciationRemainingSummary, {
  calculateDepreciationRemainingTotals,
} from "@/pages/Employee/Sales/Policy/components/DepreciationRemainingSummary";
import { policiesApi } from "@/service/policy";
import { POLICY_TAX_RATE, RowType, policyPercentBase } from "@/types/policy";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "@/utils/apiError";
import PolicyHistoryTimeline from "./PolicyHistoryTimeline";
import { Employee, getSalesEmployees } from "@/service/employee";
import SearchableSelect from "@/components/SearchableSelect";

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

const DecimalInput = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const [text, setText] = useState(value ? String(value) : "");

  useEffect(() => {
    setText(value ? String(value) : "");
  }, [value]);

  return (
    <input
      type="number"
      min="0"
      step="0.1"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (next !== "" && Number.isFinite(Number(next))) onChange(Number(next));
        if (next === "") onChange(0);
      }}
      className="w-full bg-transparent px-1 py-1 text-right outline-none rounded focus:bg-white focus:ring-1 focus:ring-blue-400"
    />
  );
};

/** Vận hành mặc định 5.000đ/HS — thành tiền = 5.000 × sĩ số HS/lớp / 4. */
const DEFAULT_VAN_HANH_PER_HS = 5000;

const PerStudentTotal = ({
  students,
  perHS,
  total,
}: {
  students: number;
  perHS: number;
  total: number;
}) => {
  if (students <= 0) {
    return (
      <span className="block text-[11px] text-red-500">
        Nhập Sĩ số HS/lớp để tính
      </span>
    );
  }

  const matchesFormula = Math.round((perHS * students) / 4) === total;

  return (
    <span className="mt-1 block text-right text-[11px] leading-snug text-gray-500">
      {matchesFormula ? (
        <>
          × {students} HS / 4 = <b className="text-gray-700">{formatVND(total)}</b>
        </>
      ) : (
        <>
          <b className="text-gray-700">{formatVND(total)}</b>{" "}
          <span className="text-amber-600">(số cũ, sửa đơn giá để tính lại)</span>
        </>
      )}
    </span>
  );
};

type FormTypeMoney = {
  type: string;
  money: number;
  depreciationYears: number;
  months: number;
  students: number;
};
type FormTypeDevice = {
  category: string;
  qty: number;
  price: number;
  depreciationYears: number;
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
  // HP/HS và HP/TIẾT tách state riêng: đổi tab không được đè mất số đã nhập
  // của tab kia. `giaoCuHS`/`vanHanhHS` là thành tiền, chỉ dùng ở tab HP/HS.
  const [giaoCuHS, setGiaoCuHS] = useState(0);
  const [vanHanhHS, setVanHanhHS] = useState(5000);
  // Ở tab HP/TIẾT thì ô nhập là đơn giá 1 HS, thành tiền = đơn giá × sĩ số / 4
  // — suy ra ngay từ giaoCuPerHS/vanHanhPerHS + studentPerClass bên dưới.
  const [giaoCuPerHS, setGiaoCuPerHS] = useState(0);
  const [vanHanhPerHS, setVanHanhPerHS] = useState(DEFAULT_VAN_HANH_PER_HS);
  const [fee, setFee] = useState<number>(0);
  const [percentAfterTax, setPercentAfterTax] = useState(false);
  const [activeTab, setActiveTab] = useState<"TIET" | "HS">("HS");
  const [teacherCompany, setTeacherCompany] = useState<number>(0);
  const [studentPerClass, setStudentPerClass] = useState<number>(0);
  const giaoCuTiet = Math.round((giaoCuPerHS * studentPerClass) / 4);
  const vanHanhTiet = Math.round((vanHanhPerHS * studentPerClass) / 4);
  // `giaoCu` / `vanHanh` = giá trị của tab đang mở — mọi chỗ khác chỉ cần đọc
  // đúng hai khoá này.
  const giaoCu = activeTab === "TIET" ? giaoCuTiet : giaoCuHS;
  const vanHanh = activeTab === "TIET" ? vanHanhTiet : vanHanhHS;
  const [supportStudentCount, setSupportStudentCount] = useState<number>(0);
  const [realPeriods, setRealPeriods] = useState<number>(0);
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(
    Number(employeeId),
  );
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [employeesError, setEmployeesError] = useState("");

  useEffect(() => {
    let active = true;

    setEmployeesLoading(true);
    setEmployeesError("");
    getSalesEmployees()
      .then((result) => {
        if (active) setEmployees(Array.isArray(result) ? result : []);
      })
      .catch((error) => {
        if (!active) return;
        const status = error?.response?.status;
        setEmployeesError(
          status === 401
            ? "Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập."
            : status === 403
              ? "Tài khoản không có quyền tải danh sách nhân viên."
              : "Không thể tải danh sách nhân viên",
        );
      })
      .finally(() => {
        if (active) setEmployeesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateRow = (id: number, field: keyof RowType, value: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const newRow = { ...row, [field]: value };

        newRow.totalPercent = newRow.qlCsvc + newRow.tax + newRow.teacher;

        newRow.company = 100 - newRow.totalPercent;

        const otherTotal = (newRow.otherCosts || []).reduce((sum, item) => {
          const raw = (Number(item.percent) || 0) - (Number(item.tax) || 0);
          if (activeTab === "TIET" && studentPerClass > 0 && periods > 0 && supportStudentCount > 0) {
            return sum + Math.round((raw / supportStudentCount / periods) * studentPerClass);
          }
          if (activeTab === "HS" && durationMonths > 0 && supportStudentCount > 0) {
            return sum + Math.round(raw / durationMonths / supportStudentCount);
          }
          return sum + raw;
        }, 0);
        newRow.total =
          (newRow.ql1Percent || 0) -
          (newRow.ql1Tax || 0) +
          (newRow.ql2Percent || 0) -
          (newRow.ql2Tax || 0) +
          (newRow.tgPercent || 0) -
          (newRow.tgTax || 0) +
          otherTotal;

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
        percentAfterTax,
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
      vanHanh = 5000,
      ttcs = [],
      httienmat = [],
      htthietbi = [],
      notes = {},
      studentPerClass = 0,
      teacherCompany = 0,
      durationMonths = 0,
      periods = 36,
      mode,
      percentAfterTax = false,
      giaoCuPerHS: savedGiaoCuPerHS,
      vanHanhPerHS: savedVanHanhPerHS,
    } = defaultData;

    setFee(fee);
    setGiaoCuHS(giaoCu);
    setVanHanhHS(vanHanh);

    const perHSOf = (total: number, fallback: number) =>
      studentPerClass > 0 ? Math.round((total * 4) / studentPerClass) : fallback;

    setGiaoCuPerHS(savedGiaoCuPerHS ?? perHSOf(giaoCu, 0));
    setVanHanhPerHS(
      savedVanHanhPerHS ?? perHSOf(vanHanh, DEFAULT_VAN_HANH_PER_HS),
    );

    const nextPercentAfterTax =
      Boolean(percentAfterTax) || ttcs.some((row: RowType) => row.percentAfterTax);
    setPercentAfterTax(nextPercentAfterTax);
    setRows(
      ttcs.length
        ? ttcs.map((row: RowType) => ({
            ...row,
            percentAfterTax: Boolean(row.percentAfterTax ?? nextPercentAfterTax),
          }))
        : [],
    );
    setRowsM(
      httienmat.length
        ? httienmat.map((row: FormTypeMoney) => ({
            ...row,
            depreciationYears: Number(row.depreciationYears) || 1,
          }))
        : [],
    );
    setRowsD(
      htthietbi.length
        ? htthietbi.map((row: FormTypeDevice) => ({
            ...row,
            depreciationYears: Number(row.depreciationYears) || 1,
          }))
        : [],
    );
    setSupportStudentCount(
      httienmat?.[0]?.students ?? htthietbi?.[0]?.students ?? 0,
    );
    setNotes(notes || {});
    setStudentPerClass(studentPerClass);
    setTeacherCompany(teacherCompany);
    setDurationMonths(durationMonths);
    setPeriods(periods);

    // Không đoán mode qua studentPerClass — field này vẫn giữ giá trị cũ khi
    // đổi tab nên không đáng tin, từng khiến chính sách HP/HS bị mở nhầm
    // sang tab HP/TIẾT. Dữ liệu cũ không có `mode`: mặc định an toàn HS.
    const nextTab: "TIET" | "HS" =
      mode === "TIET" || mode === "HS" ? mode : "HS";
    setActiveTab(nextTab);
  }, [defaultData]);

  useEffect(() => {
    setRows((prev) => [...prev]);
  }, [activeTab, studentPerClass]);

  // ===== HP/TIẾT: giáo cụ và vận hành tính theo đầu học sinh =====
  const changeGiaoCuPerHS = (value: number) => {
    setGiaoCuPerHS(value);
  };

  const changeVanHanhPerHS = (value: number) => {
    setVanHanhPerHS(value);
  };

  const changeStudentPerClass = (value: number) => {
    setStudentPerClass(value);
  };

  const changeSupportStudentCount = (value: number) => {
    setSupportStudentCount(value);
    setRowsM((current) => current.map((row) => ({ ...row, students: value })));
    setRowsD((current) => current.map((row) => ({ ...row, students: value })));
  };

  const changePercentAfterTax = (checked: boolean) => {
    setPercentAfterTax(checked);
    setRows((current) =>
      current.map((row) => ({ ...row, percentAfterTax: checked })),
    );
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
    (grandTotal + totalM) * 0.22;

  const companyProfitPerHS =
    studentPerClass > 0 ? (companyProfit * 4) / studentPerClass : 0;

  const chartData = {
    fee: Number(fee) || 0,
    csvc: Number(totalQlCsvc) || 0,
    thue: Number(totalTax) || 0,
    giaovien: Number(totalTeach) || 0,
    teacherCompany: Number(teacherCompany) || 0,
    csthang: Number(grandTotal) || 0,
    cdhd: Number(totalM) || 0,
    thietbi: Number(totalD) || 0,
    giaoCu: Number(giaoCu) || 0,
    vanHanh: Number(vanHanh) || 0,
    thuetndn: Number(grandTotal * 0.22 + totalM * 0.22) || 0,
  };

  const percentBase = policyPercentBase({ fee, percentAfterTax });
  const greenPercent = (value: number) => {
    if (percentBase <= 0) return "—";
    return `${(((Number(value) || 0) / percentBase) * 100).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })}%`;
  };
  const greenPercentCell = (value?: number | null) => (
    <td className="border border-gray-200 p-2 text-right text-xs font-semibold text-gray-600">
      {value == null ? "—" : greenPercent(value)}
    </td>
  );

  const buildPayload = () => {
    const clean = (obj: any) => JSON.parse(JSON.stringify(obj));
    const depreciationRemaining = calculateDepreciationRemainingTotals(
      rowsM,
      rowsD,
    );
    return clean({
      fee: Number(fee) || 0,
      percentAfterTax,
      csvc: Number(totalQlCsvc) || 0,
      thue: Number(totalTax) || 0,
      giaovien: Number(totalTeach) || 0,
      csthang: Number(grandTotal) || 0,
      cdhd: Number(totalM) || 0,
      thietbi: Number(totalD) || 0,
      giaoCu: Number(giaoCu) || 0,
      thuetndn: Number(grandTotal * 0.22 + totalM * 0.22) || 0,
      vanHanh: Number(vanHanh) || 0,
      giaoCuPerHS: Number(giaoCuPerHS) || 0,
      vanHanhPerHS: Number(vanHanhPerHS) || 0,
      mode: activeTab,
      durationMonths: Number(durationMonths) || 0,
      notes,
      companyProfit: Number(companyProfit) || 0,
      companyProfitPerHS: Number(companyProfitPerHS) || 0,
      studentPerClass: Number(studentPerClass) || 0,
      periods: Number(periods) || 0,
      teacherCompany: Number(teacherCompany) || 0,
      ttcs: rows.map((r) => ({ ...r, percentAfterTax })),
      // Giữ nguyên `realStudents`/`realPeriods` — PolicyView đọc 2 trường này
      // để hiện "HS thực"/"Tiết thực"; lọc bỏ trước đây làm mất dữ liệu sau khi lưu.
      httienmat: rowsM,
      htthietbi: rowsD,
      remainingCashDepreciationAmount:
        depreciationRemaining.remainingMoney,
      remainingDeviceDepreciationAmount:
        depreciationRemaining.remainingDevice,
    });
  };

  const handleSubmit = async () => {
    if (
      [...rowsM, ...rowsD].some(
        (row) => Number(row.depreciationYears) <= 0,
      )
    ) {
      toast.error(
        "Vui lòng nhập Số năm khấu hao lớn hơn 0 cho mọi dòng Tiền mặt và Thiết bị.",
      );
      return;
    }

    const ok = confirm(
      "Xác nhận lưu chỉnh sửa? Chính sách sẽ được tự động duyệt.",
    );
    if (!ok) return;

    try {
      setSaving(true);
      const res = await policiesApi.directorUpdate(policyId, {
        employeeId: Number(selectedEmployeeId),
        data: buildPayload(),
        status: "DIRECTOR_APPROVED",
        note: directorNote || undefined,
        durationMonths: durationMonths || undefined,
      });
      setHistories(res.histories || []);
      toast.success("Cập nhật và duyệt chính sách thành công.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Không thể cập nhật chính sách"));
    } finally {
      setSaving(false);
    }
  };

  const renderDirectorFields = () => (
    <>
      <div className="max-w-4xl mx-auto mt-6 space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Nhân viên
          </label>
          <SearchableSelect
            value={String(selectedEmployeeId || "")}
            disabled={employeesLoading}
            onChange={(value) => setSelectedEmployeeId(Number(value))}
            options={[
              ...(!employees.some((employee) => employee.id === selectedEmployeeId) && selectedEmployeeId > 0
                ? [{ id: selectedEmployeeId, name: `Nhân viên #${selectedEmployeeId}` }]
                : []),
              ...employees.map((employee) => ({
                id: employee.id,
                name: employee.name || employee.email || employee.phone || `Nhân viên #${employee.id}`,
              })),
            ]}
            placeholder={employeesLoading ? "Đang tải danh sách nhân viên..." : "— Chọn nhân viên —"}
            searchPlaceholder="Tìm nhân viên…"
          />
          {employeesError && (
            <p className="text-sm font-medium text-red-600">{employeesError}</p>
          )}

          <label className="block text-sm font-semibold text-gray-700">
            Lý do chỉnh sửa
          </label>
          <textarea
            value={directorNote}
            onChange={(e) => setDirectorNote(e.target.value)}
            placeholder="Nhập lý do chỉnh sửa cho nhân viên..."
            className="w-full border border-gray-300 rounded-xl p-3 h-24 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
            saving ? "bg-blue-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
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
    </>
  );

  const renderContentHS = () => (
    <div className="bg-gray-50 p-4 text-[13px] space-y-6">
      <div className="flex gap-4 items-start">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">
          <table className="w-full border-collapse text-sm rounded-xl overflow-hidden shadow-sm [&_td]:align-top [&_td]:py-3 [&_th]:align-middle [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-green-100/60 [&_td]:tabular-nums">
            <thead className="bg-green-200">
              <tr>
                <th
                  colSpan={5}
                  className="border border-gray-300 p-3 text-left font-bold tracking-wide dark:text-gray-800"
                >
                  Bảng tính chi phí
                </th>
              </tr>
              <tr className="bg-green-100 text-[12px] font-semibold uppercase tracking-wide text-gray-600">
                <th className="border border-gray-300 p-2"></th>
                <th className="border border-gray-300 p-2 text-left">Khoản</th>
                <th className="border border-gray-300 p-2 text-right">Số tiền</th>
                <th className="border border-gray-300 p-2 text-right">% HP</th>
                <th className="border border-gray-300 p-2">Ghi chú</th>
              </tr>
            </thead>

            <tbody className="bg-green-50">
              <tr>
                <td
                  rowSpan={13}
                  className="border border-gray-300 text-red-500 font-bold text-center w-20"
                >
                  Chính sách
                </td>
                <td className="border border-gray-200 p-2 text-gray-800">Mức thu</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(fee)}
                  <label className="mt-2 flex items-center justify-end gap-2 text-left text-[11px] font-normal text-gray-600">
                    <input
                      type="checkbox"
                      checked={percentAfterTax}
                      onChange={(event) => changePercentAfterTax(event.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <span>
                      Trừ {POLICY_TAX_RATE * 100}% thuế trước, tính % trên học phí sau thuế
                      {percentAfterTax && (
                        <b className="ml-1 text-gray-700">({formatVND(percentBase)})</b>
                      )}
                    </span>
                  </label>
                </td>
                {greenPercentCell(percentBase)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("fee")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">CSVC</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalQlCsvc)}
                </td>
                {greenPercentCell(totalQlCsvc)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Số tháng</td>
                <td className="border p-2 text-right bg-red-50">
                  <DecimalInput value={durationMonths} onChange={setDurationMonths} />
                </td>
                {greenPercentCell(null)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Số học sinh</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput value={supportStudentCount} onChange={changeSupportStudentCount} />
                </td>
                {greenPercentCell(null)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("supportStudentCount")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">Thuế</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalTax)}
                </td>
                {greenPercentCell(totalTax)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTax")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-red-500">Giáo viên trường</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalTeach)}
                </td>
                {greenPercentCell(totalTeach)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTeach")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-blue-600">Giáo viên công ty</td>
                <td className="border border-gray-200 p-2 text-right bg-red-50">
                  <MoneyInput value={teacherCompany} onChange={setTeacherCompany} />
                </td>
                {greenPercentCell(teacherCompany)}
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("teacherCompany")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">CS tháng</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(grandTotal)}
                </td>
                {greenPercentCell(grandTotal)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("grandTotal")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">CS ký HĐ</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalM)}
                </td>
                {greenPercentCell(totalM)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalM")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">Thiết bị</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalD)}
                </td>
                {greenPercentCell(totalD)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Giáo cụ</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput value={giaoCuHS} onChange={setGiaoCuHS} />
                </td>
                {greenPercentCell(giaoCu)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">
                  Thuế TNDN
                  <span className="mt-0.5 block text-[11px] font-normal text-red-500">
                    (CS tháng + CS ký HĐ) × 22%
                  </span>
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(grandTotal * 0.22 + totalM * 0.22)}
                </td>
                {greenPercentCell(grandTotal * 0.22 + totalM * 0.22)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("thuetndn")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2">Vận hành</td>
                <td className="border text-right bg-red-50">
                  <MoneyInput value={vanHanhHS} onChange={setVanHanhHS} />
                </td>
                {greenPercentCell(vanHanh)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("vanHanh")} />
                </td>
              </tr>
              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800">Công ty thu về</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(companyProfit)}
                </td>
                {greenPercentCell(companyProfit)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("companyProfit")} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <PolicyPie data={chartData} subjectName="" companyProfit={companyProfit} className="" />
      </div>
      <DepreciationRemainingSummary moneyRows={rowsM} deviceRows={rowsD} />

      <PolicyPage
        rows={rows}
        fee={fee}
        setfee={setFee}
        updateRow={updateRow}
        addRow={addRow}
        removeRow={removeRow}
        setGrandTotal={setGrandTotal}
        setTotalTax={setTotalTax}
        activeTab={activeTab}
        studentPerClass={studentPerClass}
        periods={periods}
        students={supportStudentCount}
        months={durationMonths}
      />

      <Support
        setTotalM={setTotalM}
        setTotalD={setTotalD}
        data={studentCount || 0}
        studentPerClass={studentPerClass}
        onStudentPerClassChange={changeStudentPerClass}
        activeTab={activeTab}
        setRowsM={setRowsM}
        formsM={rowsM}
        setRowsD={setRowsD}
        formsD={rowsD}
        setPeriods={setPeriods}
        periods={periods}
        realPeriods={realPeriods}
        setRealPeriods={setRealPeriods}
        supportStudentCount={supportStudentCount}
        setSupportStudentCount={setSupportStudentCount}
      />

      {renderDirectorFields()}
    </div>
  );

  const renderContentTiet = () => (
    <div className="bg-gray-50 p-4 text-[13px] space-y-6">
      <div className="flex gap-4 items-start">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">
          <table className="w-full border-collapse text-sm rounded-xl overflow-hidden shadow-sm [&_td]:align-top [&_td]:py-3 [&_th]:align-middle [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-green-100/60 [&_td]:tabular-nums">
            <thead className="bg-green-200">
              <tr>
                <th
                  colSpan={5}
                  className="border border-gray-300 p-3 text-left font-bold tracking-wide dark:text-gray-800"
                >
                  Bảng tính chi phí
                </th>
              </tr>
              <tr className="bg-green-100 text-[12px] font-semibold uppercase tracking-wide text-gray-600">
                <th className="border border-gray-300 p-2"></th>
                <th className="border border-gray-300 p-2 text-left">Khoản</th>
                <th className="border border-gray-300 p-2 text-right">Số tiền</th>
                <th className="border border-gray-300 p-2 text-right">% HP</th>
                <th className="border border-gray-300 p-2">Ghi chú</th>
              </tr>
            </thead>

            <tbody className="bg-green-50">
              <tr>
                <td
                  rowSpan={15}
                  className="border border-gray-300 text-red-500 font-bold text-center w-20"
                >
                  Chính sách
                </td>
                <td className="border border-gray-200 p-2 text-gray-800">Mức thu</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(fee)}
                  <label className="mt-2 flex items-center justify-end gap-2 text-left text-[11px] font-normal text-gray-600">
                    <input
                      type="checkbox"
                      checked={percentAfterTax}
                      onChange={(event) => changePercentAfterTax(event.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    <span>
                      Trừ {POLICY_TAX_RATE * 100}% thuế trước, tính % trên học phí sau thuế
                      {percentAfterTax && (
                        <b className="ml-1 text-gray-700">({formatVND(percentBase)})</b>
                      )}
                    </span>
                  </label>
                </td>
                {greenPercentCell(percentBase)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("fee")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">CSVC</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalQlCsvc)}
                </td>
                {greenPercentCell(totalQlCsvc)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Số tháng</td>
                <td className="border p-2 text-right bg-red-50">
                  <DecimalInput value={durationMonths} onChange={setDurationMonths} />
                </td>
                {greenPercentCell(null)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Sĩ số HS/lớp</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput value={studentPerClass} onChange={changeStudentPerClass} />
                </td>
                {greenPercentCell(null)}
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("studentPerClass")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Số học sinh</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput value={supportStudentCount} onChange={changeSupportStudentCount} />
                </td>
                {greenPercentCell(null)}
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("supportStudentCount")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">Thuế</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalTax)}
                </td>
                {greenPercentCell(totalTax)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTax")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-red-500">Giáo viên trường</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalTeach)}
                </td>
                {greenPercentCell(totalTeach)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalTeach")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-blue-600">Giáo viên công ty</td>
                <td className="border border-gray-200 p-2 text-right bg-red-50">
                  <MoneyInput value={teacherCompany} onChange={setTeacherCompany} />
                </td>
                {greenPercentCell(teacherCompany)}
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("teacherCompany")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">CS tháng</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(grandTotal)}
                </td>
                {greenPercentCell(grandTotal)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("grandTotal")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">CS ký HĐ</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalM)}
                </td>
                {greenPercentCell(totalM)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalM")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">Thiết bị</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(totalD)}
                </td>
                {greenPercentCell(totalD)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">
                  Giáo cụ
                  <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                    Đơn giá 1 HS
                  </span>
                </td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput value={giaoCuPerHS} onChange={changeGiaoCuPerHS} />
                  <PerStudentTotal students={studentPerClass} perHS={giaoCuPerHS} total={giaoCu} />
                </td>
                {greenPercentCell(giaoCu)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800">
                  Thuế TNDN
                  <span className="mt-0.5 block text-[11px] font-normal text-red-500">
                    (CS tháng + CS ký HĐ) × 22%
                  </span>
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(grandTotal * 0.22 + totalM * 0.22)}
                </td>
                {greenPercentCell(grandTotal * 0.22 + totalM * 0.22)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("thuetndn")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2">
                  Vận hành
                  <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                    Đơn giá 1 HS
                  </span>
                </td>
                <td className="border text-right bg-red-50">
                  <MoneyInput value={vanHanhPerHS} onChange={changeVanHanhPerHS} />
                  <PerStudentTotal students={studentPerClass} perHS={vanHanhPerHS} total={vanHanh} />
                </td>
                {greenPercentCell(vanHanh)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("vanHanh")} />
                </td>
              </tr>
              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800">Công ty thu về</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(companyProfit)}
                </td>
                {greenPercentCell(companyProfit)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("companyProfit")} />
                </td>
              </tr>
              <tr className="font-semibold text-red-500">
                <td className="border border-gray-200 p-2 text-center text-gray-800">HP/HS</td>
                <td className="border border-gray-200 p-2 text-right text-gray-800">
                  {formatVND(companyProfitPerHS)}
                </td>
                {greenPercentCell(companyProfitPerHS)}
                <td className="border border-gray-200 p-2 text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("companyProfitPerHS")} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <PolicyPie data={chartData} subjectName="" companyProfit={companyProfit} className="" />
      </div>
      <DepreciationRemainingSummary moneyRows={rowsM} deviceRows={rowsD} />

      <PolicyPage
        rows={rows}
        fee={fee}
        setfee={setFee}
        updateRow={updateRow}
        addRow={addRow}
        removeRow={removeRow}
        setGrandTotal={setGrandTotal}
        setTotalTax={setTotalTax}
        activeTab={activeTab}
        studentPerClass={studentPerClass}
        periods={periods}
        students={supportStudentCount}
        months={durationMonths}
      />

      <Support
        setTotalM={setTotalM}
        setTotalD={setTotalD}
        data={studentCount || 0}
        studentPerClass={studentPerClass}
        onStudentPerClassChange={changeStudentPerClass}
        activeTab={activeTab}
        setRowsM={setRowsM}
        formsM={rowsM}
        setRowsD={setRowsD}
        formsD={rowsD}
        setPeriods={setPeriods}
        periods={periods}
        realPeriods={realPeriods}
        setRealPeriods={setRealPeriods}
        supportStudentCount={supportStudentCount}
        setSupportStudentCount={setSupportStudentCount}
      />

      {renderDirectorFields()}
    </div>
  );

  if (histories) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="fixed top-0 left-0 w-full h-14 bg-blue-500 flex items-center px-4 z-50">
          <h1 className="text-white font-semibold text-sm">Cập nhật thành công</h1>
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
      <div className="fixed top-0 left-0 w-full h-14 bg-blue-500 flex items-center px-4 z-50">
        <h1 className="text-white font-semibold text-sm">Giám đốc chỉnh sửa chính sách</h1>
      </div>
      <button
        onClick={onClose}
        className="fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur rounded-full shadow-md active:scale-95 transition"
      >
        <X size={18} className="text-gray-700" />
      </button>

      <div className="flex justify-center mb-4 mt-[60px]">
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
        {activeTab === "TIET" && renderContentTiet()}
        {activeTab === "HS" && renderContentHS()}
      </div>
    </div>
  );
}
