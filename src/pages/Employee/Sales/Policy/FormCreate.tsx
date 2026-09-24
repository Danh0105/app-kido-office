import PolicyPage from "./policy";
import React, { useEffect, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./Support";
import { X } from "lucide-react";
import { useExport } from "../../../../hook/ExportProvider";
import PolicyPie from "@/components/PolicyPie";
import DepreciationRemainingSummary, {
  calculateDepreciationRemainingTotals,
} from "./components/DepreciationRemainingSummary";
import { policiesApi } from "../../../../service/policy";
import { subjectApi } from "@/service/subject.api";
import { POLICY_TAX_RATE, RowType, policyPercentBase } from "../../../../types/policy";
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

/**
 * Hiện phép nhân ngay dưới ô đơn giá. Không hiện thì người nhập không biết con
 * số nào đang được cộng vào "Công ty thu về" — nhập 4.000 mà cột tổng nhảy
 * 140.000 thì tưởng sai.
 */
export const PerStudentTotal = ({
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

  // Chính sách lưu trước khi có quy tắc nhân theo đầu HS thì thành tiền không
  // khớp phép nhân. Vẫn giữ nguyên số đã lưu — sửa lén số của chính sách đã
  // duyệt thì nguy hơn nhiều — nhưng nói rõ ra, không vẽ một phép tính sai.
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
type PickerOption = { value: string; label: string };

/**
 * Chọn Trường → Năm học → Môn học ngay trong màn tạo chính sách, thay vì một
 * popup riêng phải hoàn tất trước khi thấy được form — 1 màn thay vì 2 bước.
 * Chỉ truyền prop này khi gọi FormCreate mà chưa biết `subjectId` (tạo chính
 * sách mới từ nút "Tạo chính sách"); các nơi đã có `subjectId` cố định (mở từ
 * danh sách môn học) thì bỏ qua, giữ nguyên hành vi cũ.
 */
type SubjectPicker = {
  schools: PickerOption[];
  schoolId: string;
  onSchoolChange: (value: string) => void;
  years: PickerOption[];
  schoolYear: string;
  onYearChange: (value: string) => void;
  subjects: PickerOption[];
  subjectId: string;
  onSubjectChange: (value: string) => void;
  loading: boolean;
};

const PickerField = ({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = "— Chọn —",
}: {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) => (
  <label className="block text-sm font-semibold text-slate-600">
    {label}
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export default function FormCreate({
  setShowModal,
  subjectId,
  setPolicy,
  defaultData,
  id,
  picker,
  onExistingPolicy,
}: {
  setShowModal: (open: boolean) => void;
  subjectId?: number;
  setPolicy: (data: any) => void;
  defaultData?: any;
  id?: number;
  picker?: SubjectPicker;
  onExistingPolicy?: (policy: any, subjectId: number) => void | Promise<void>;
}) {
  // Chưa chọn xong môn (đang ở bước picker) thì chưa có id thật để lưu.
  const effectiveSubjectId = subjectId || Number(picker?.subjectId || 0) || 0;
  const [totalD, setTotalD] = useState<number>(0);
  const [totalM, setTotalM] = useState<number>(0);
  const [totalTax, setTotalTax] = useState<number>(0);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  // HP/HS và HP/TIẾT tách state riêng: đổi tab không được đè mất số đã nhập
  // của tab kia. `giaoCuHS`/`vanHanhHS` là thành tiền, chỉ dùng ở tab HP/HS.
  const [giaoCuHS, setGiaoCuHS] = useState(0);
  const [vanHanhHS, setVanHanhHS] = useState(5000);
  // Ở tab HP/TIẾT thì ô nhập là **đơn giá 1 HS**, thành tiền = đơn giá × sĩ số
  // / 4 — suy ra ngay từ giaoCuPerHS/vanHanhPerHS + studentPerClass bên dưới,
  // không cần state riêng cho thành tiền nên luôn khớp công thức.
  const [giaoCuPerHS, setGiaoCuPerHS] = useState(0);
  const [vanHanhPerHS, setVanHanhPerHS] = useState(DEFAULT_VAN_HANH_PER_HS);
  const [fee, setFee] = useState<number>(0);
  const [percentAfterTax, setPercentAfterTax] = useState(false);
  const [activeTab, setActiveTab] = useState<"TIET" | "HS">("HS");
  const [teacherCompany, setTeacherCompany] = useState<number>(0);
  const [studentPerClass, setStudentPerClass] = useState<number>(0);
  const giaoCuTiet = Math.round((giaoCuPerHS * studentPerClass) / 4);
  const vanHanhTiet = Math.round((vanHanhPerHS * studentPerClass) / 4);
  // `giaoCu` / `vanHanh` = giá trị của tab đang mở — mọi chỗ khác (thành tiền
  // lưu, duyệt, thống kê, biểu đồ) chỉ cần đọc đúng hai khoá này.
  const giaoCu = activeTab === "TIET" ? giaoCuTiet : giaoCuHS;
  const vanHanh = activeTab === "TIET" ? vanHanhTiet : vanHanhHS;
  const [supportStudentCount, setSupportStudentCount] = useState<number>(0);
  const [realPeriods, setRealPeriods] = useState<number>(0);
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
      percentAfterTax: false,
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
  // ===== UPDATE =====
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

  useEffect(() => {
    if (!defaultData) return;

    // 👉 destructure 1 lần cho rõ ràng
    const {
      fee = 0,
      giaoCu = 0,
      vanHanh = 5000,
      ttcs = [],
      httienmat = [],
      htthietbi = [],
      notes = {},
      studentPerClass = 0,
      supportStudentCount: savedSupportStudentCount,
      mode,
      teacherCompany = 0,
      durationMonths = 0,
      percentAfterTax = false,
      giaoCuPerHS: savedGiaoCuPerHS,
      vanHanhPerHS: savedVanHanhPerHS,
    } = defaultData;

    // 👉 set state (group theo logic)
    setFee(fee);
    setGiaoCuHS(giaoCu);
    setVanHanhHS(vanHanh);

    /**
     * Chính sách lưu trước khi có ô đơn giá thì chỉ có thành tiền — suy ngược ra
     * đơn giá để ô nhập không trống trơn. Thành tiền vẫn giữ nguyên như đã lưu,
     * chỉ đổi khi người dùng thật sự sửa đơn giá hoặc sĩ số.
     */
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
    const resolvedStudentCount =
      Number(savedSupportStudentCount) ||
      (httienmat?.[0] as any)?.realStudents ||
      (htthietbi?.[0] as any)?.realStudents ||
      httienmat?.[0]?.students ||
      htthietbi?.[0]?.students ||
      0;
    setRowsM(
      httienmat.length
        ? httienmat.map((row: FormTypeMoney) => ({
            ...row,
            depreciationYears: Number(row.depreciationYears) || 1,
            students: resolvedStudentCount,
            realStudents: resolvedStudentCount,
          }))
        : [],
    );
    setRowsD(
      htthietbi.length
        ? htthietbi.map((row: FormTypeDevice) => ({
            ...row,
            depreciationYears: Number(row.depreciationYears) || 1,
            students: resolvedStudentCount,
            realStudents: resolvedStudentCount,
          }))
        : [],
    );
    setSupportStudentCount(resolvedStudentCount);

    setNotes(notes);
    setStudentPerClass(studentPerClass);
    setTeacherCompany(teacherCompany);
    setDurationMonths(durationMonths);
    // Dữ liệu mới lưu rõ loại chính sách qua `mode`. Dữ liệu cũ không có
    // `mode` thì không đoán qua studentPerClass nữa — field này vẫn giữ giá
    // trị cũ khi đổi tab (theo thiết kế) nên không đáng tin, từng khiến
    // chính sách HP/HS bị mở nhầm sang tab HP/TIẾT. Mặc định an toàn: HS.
    const nextTab: "TIET" | "HS" =
      mode === "TIET" || mode === "HS" ? mode : "HS";

    setActiveTab(nextTab);
  }, [defaultData]);
  useEffect(() => {
    setRows((prev) => [...prev]); // trigger re-render
  }, [activeTab, studentPerClass]);

  // ===== HP/TIẾT: giáo cụ và vận hành tính theo đầu học sinh =====
  // Ba hàm dưới đây chỉ dùng ở tab HP/TIẾT (tab HP/HS không có sĩ số nên vẫn
  // nhập thẳng thành tiền như cũ).

  const changeGiaoCuPerHS = (value: number) => {
    setGiaoCuPerHS(value);
  };

  const changeVanHanhPerHS = (value: number) => {
    setVanHanhPerHS(value);
  };

  /** Đổi sĩ số → thành tiền HP/TIẾT tự suy lại vì đã là giá trị derive. */
  const changeStudentPerClass = (value: number) => {
    setStudentPerClass(value);
  };

  const changeSupportStudentCount = (value: number) => {
    setSupportStudentCount(value);
    setRowsM((current) =>
      current.map((row) => ({ ...row, students: value, realStudents: value })),
    );
    setRowsD((current) =>
      current.map((row) => ({ ...row, students: value, realStudents: value })),
    );
  };

  const changePercentAfterTax = (checked: boolean) => {
    setPercentAfterTax(checked);
    setRows((current) =>
      current.map((row) => ({ ...row, percentAfterTax: checked })),
    );
  };
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
    (grandTotal + totalM) * 0.22;
  const companyProfitPerHS =
    studentPerClass > 0 ? (companyProfit * 4) / studentPerClass : 0;

  /**
   * Số liệu cho biểu đồ phân bổ chi phí. Lấy đúng các field mà `buildPayload`
   * gửi lên, nên biểu đồ trong form và biểu đồ ở màn xem chính sách vẽ ra cùng
   * một hình — chỉ khác là ở đây cập nhật ngay theo từng ô đang nhập.
   */
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
      // Đơn giá 1 HS của tab HP/TIẾT — lưu thêm để mở lại còn sửa được đúng số
      // đã nhập; các màn khác vẫn chỉ đọc `giaoCu` / `vanHanh` (thành tiền).
      giaoCuPerHS: Number(giaoCuPerHS) || 0,
      vanHanhPerHS: Number(vanHanhPerHS) || 0,
      mode: activeTab,
      durationMonths: Number(durationMonths) || 0,
      notes: notes,
      companyProfit: Number(companyProfit) || 0,
      companyProfitPerHS: Number(companyProfitPerHS) || 0,
      studentPerClass: Number(studentPerClass) || 0,
      supportStudentCount: Number(supportStudentCount) || 0,
      periods: Number(periods) || 0,
      teacherCompany: Number(teacherCompany) || 0,
      ttcs: rows.map((r) => ({
        ...r,
        percentAfterTax,
      })),
      // Giữ nguyên `realStudents`/`realPeriods` — PolicyView đọc 2 trường này
      // để hiện "HS thực"/"Tiết thực"; lọc bỏ trước đây làm mất dữ liệu sau khi lưu.
      httienmat: rowsM,
      htthietbi: rowsD,
      remainingCashDepreciationAmount:
        depreciationRemaining.remainingMoney,
      remainingDeviceDepreciationAmount:
        depreciationRemaining.remainingDevice,

      createdAt: new Date().toISOString(),
    });
  };
  const handleSubmit = async (status: "DRAFT" | "PENDING") => {
    try {
      if (!effectiveSubjectId) {
        alert("Vui lòng chọn trường, năm học và môn học trước.");
        return;
      }

      if (activeTab === "HS" && durationMonths <= 0) {
        alert("Vui lòng nhập Số tháng cho chính sách HP / HS.");
        return;
      }

      if (activeTab === "TIET" && studentPerClass <= 0) {
        alert("Vui lòng nhập Sĩ số HS/lớp cho chính sách HP / TIẾT.");
        return;
      }

      if (
        [...rowsM, ...rowsD].some(
          (row) => Number(row.depreciationYears) <= 0,
        )
      ) {
        alert(
          "Vui lòng nhập Số năm khấu hao lớn hơn 0 cho mọi dòng Tiền mặt và Thiết bị.",
        );
        return;
      }

      // Một môn học đã thuộc đúng một trường + năm học, vì vậy subjectId là
      // khoá phạm vi để bảo đảm mỗi môn/năm chỉ có một chính sách.
      if (!id) {
        const existingRows = await policiesApi.getBySubject(effectiveSubjectId);
        const existingPolicy = (Array.isArray(existingRows)
          ? existingRows
          : existingRows?.data || [])[0];
        if (existingPolicy) {
          alert("Môn học này đã có chính sách. Hệ thống sẽ mở chính sách hiện có để chỉnh sửa.");
          await onExistingPolicy?.(existingPolicy, effectiveSubjectId);
          return;
        }
      }

      // 🔥 Confirm khi gửi duyệt
      if (status === "PENDING") {
        const ok = confirm("Bạn có chắc muốn gửi duyệt chính sách này?");
        if (!ok) return;
      }

      const userInfo = await getUserFromToken();

      const payload = {
        data: buildPayload(),
        employeeInfo: userInfo,
        subjectId: effectiveSubjectId,
        durationMonths: durationMonths,
        status,
      };
      if (id) {
        await policiesApi.update(id, payload);
      } else {
        await policiesApi.create(payload);
      }

      const data = await policiesApi.getBySubject(effectiveSubjectId);
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

      // Backend phải giữ ràng buộc duy nhất để chặn hai yêu cầu tạo đồng thời.
      // Nếu yêu cầu này thua xung đột, mở bản vừa được tạo thay vì để người dùng
      // tiếp tục nhập trên một form không còn hợp lệ.
      if (!id && effectiveSubjectId && err?.response?.status === 409) {
        try {
          const existingRows = await policiesApi.getBySubject(effectiveSubjectId);
          const existingPolicy = (Array.isArray(existingRows)
            ? existingRows
            : existingRows?.data || [])[0];
          if (existingPolicy) {
            alert("Môn học này đã có chính sách. Hệ thống sẽ mở chính sách hiện có để chỉnh sửa.");
            await onExistingPolicy?.(existingPolicy, effectiveSubjectId);
            return;
          }
        } catch (loadError) {
          console.error("Load existing policy after conflict failed", loadError);
        }
      }

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
  /**
   * Môn học của chính sách. Đi từ danh sách môn thì có sẵn trong `location.state`;
   * mở form trong popup (màn Chính sách) thì không điều hướng nên state rỗng —
   * phải tự lấy theo `subjectId`, nếu không tên môn / số HS đều trống.
   */
  const navSubject: any = location.state;
  const [fetchedSubject, setFetchedSubject] = useState<any>(null);

  useEffect(() => {
    if (!effectiveSubjectId || navSubject?.name) {
      setFetchedSubject(null);
      return;
    }

    let alive = true;
    subjectApi
      .findOne(effectiveSubjectId)
      .then((res: any) => {
        if (alive) setFetchedSubject(res || null);
      })
      .catch(() => {
        if (alive) setFetchedSubject(null);
      });

    return () => {
      alive = false;
    };
  }, [effectiveSubjectId, navSubject?.name]);

  // Chưa gọi xong API thì lấy tạm nhãn môn ở ô chọn môn của popup.
  const pickerSubjectName = picker?.subjects?.find(
    (option) => option.value === String(picker?.subjectId || ""),
  )?.label;

  const data = navSubject?.name
    ? navSubject
    : fetchedSubject
      ? { ...navSubject, ...fetchedSubject }
      : navSubject;

  const subjectName = data?.name || pickerSubjectName || "";
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

  useEffect(() => {
    if (supportStudentCount > 0) return;
    const defaultStudentCount = Number(data?.studentCount || 0);
    if (defaultStudentCount > 0) changeSupportStudentCount(defaultStudentCount);
  }, [data?.studentCount, supportStudentCount]);

  const renderContentHS = (data: any) => (
    <div className="bg-gray-50 p-4 text-[13px] space-y-6">
      <div className="flex gap-4 items-start ">
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">
          <table className="w-full border-collapse text-xs rounded-xl overflow-hidden shadow-sm [&_td]:align-top [&_td]:py-3 [&_th]:align-middle [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-green-100/60 [&_td]:tabular-nums">
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
                  rowSpan={14}
                  className="border border-gray-300 text-red-500 font-bold text-center w-20"
                >
                  {data?.name}
                </td>

                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Mức thu
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
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
                        <b className="ml-1 text-gray-700">
                          ({formatVND(percentBase)})
                        </b>
                      )}
                    </span>
                  </label>
                </td>
                {greenPercentCell(percentBase)}
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
                {greenPercentCell(totalQlCsvc)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Số tháng
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <DecimalInput
                    value={durationMonths}
                    onChange={setDurationMonths}
                  />
                </td>
                {greenPercentCell(null)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Số học sinh
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput
                    value={supportStudentCount}
                    onChange={changeSupportStudentCount}
                  />
                </td>
                {greenPercentCell(null)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("supportStudentCount")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Thuế
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalTax)}
                </td>
                {greenPercentCell(totalTax)}
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
                {greenPercentCell(totalTeach)}
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
                {greenPercentCell(teacherCompany)}
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
                {greenPercentCell(grandTotal)}
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
                {greenPercentCell(totalM)}
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
                {greenPercentCell(totalD)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Giáo cụ
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={giaoCuHS} onChange={setGiaoCuHS} />
                </td>
                {greenPercentCell(giaoCu)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  Thuế TNDN{" "}
                  <span className="mt-0.5 block text-[11px] font-normal text-red-500">
                    (CS tháng + CS ký HĐ) × 22%
                  </span>
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(grandTotal * 0.22 + totalM * 0.22)}
                </td>
                {greenPercentCell(grandTotal * 0.22 + totalM * 0.22)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("thuetndn")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2">Vận hành </td>
                <td className="border text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={vanHanhHS} onChange={setVanHanhHS} />
                </td>
                {greenPercentCell(vanHanh)}
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
                {greenPercentCell(companyProfit)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("companyProfit")} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>


      {/* Biểu đồ phân bổ chi phí — cùng biểu đồ với màn xem chính sách, ở đây
          cập nhật ngay theo số đang nhập. */}
      <div className="max-w-4xl mx-auto">
        <PolicyPie
          data={chartData}
          subjectName={subjectName}
          companyProfit={companyProfit}
          className=""
        />
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
        data={data?.studentCount ?? 0}
        studentPerClass={studentPerClass}
        onStudentPerClassChange={changeStudentPerClass}
        activeTab={activeTab}
        setRowsM={setRowsM}
        formsM={rowsM}
        setRowsD={setRowsD}
        formsD={rowsD}
        setPeriods={setPeriods}
        periods={periods}
        supportStudentCount={supportStudentCount}
        setSupportStudentCount={setSupportStudentCount}
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
          <table className="w-full border-collapse text-xs rounded-xl overflow-hidden shadow-sm [&_td]:align-top [&_td]:py-3 [&_th]:align-middle [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-green-100/60 [&_td]:tabular-nums">
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
                  rowSpan={16}
                  className="border border-gray-300 text-red-500 font-bold text-center w-20"
                >
                  {data?.name}
                </td>

                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Mức thu
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
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
                        <b className="ml-1 text-gray-700">
                          ({formatVND(percentBase)})
                        </b>
                      )}
                    </span>
                  </label>
                </td>
                {greenPercentCell(percentBase)}
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
                {greenPercentCell(totalQlCsvc)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalQlCsvc")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Số tháng
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <DecimalInput
                    value={durationMonths}
                    onChange={setDurationMonths}
                  />
                </td>
                {greenPercentCell(null)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("durationMonths")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Sĩ số HS/lớp</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput
                    value={studentPerClass}
                    onChange={changeStudentPerClass}
                  />
                </td>
                {greenPercentCell(null)}
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("studentPerClass")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800">Số học sinh</td>
                <td className="border p-2 text-right bg-red-50">
                  <MoneyInput
                    value={supportStudentCount}
                    onChange={changeSupportStudentCount}
                  />
                </td>
                {greenPercentCell(null)}
                <td className="border text-center">
                  <NoteIcon onClick={() => setOpenNoteKey("supportStudentCount")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  Thuế
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(totalTax)}
                </td>
                {greenPercentCell(totalTax)}
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
                {greenPercentCell(totalTeach)}
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
                {greenPercentCell(teacherCompany)}
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
                {greenPercentCell(grandTotal)}
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
                {greenPercentCell(totalM)}
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
                {greenPercentCell(totalD)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("totalD")} />
                </td>
              </tr>
              <tr>
                <td className="border p-2 text-gray-800 dark:text-gray-800">
                  Giáo cụ
                  <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                    Đơn giá 1 HS
                  </span>
                </td>
                <td className="border p-2 text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={giaoCuPerHS} onChange={changeGiaoCuPerHS} />
                  <PerStudentTotal
                    students={studentPerClass}
                    perHS={giaoCuPerHS}
                    total={giaoCu}
                  />
                </td>
                {greenPercentCell(giaoCu)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
                  <NoteIcon onClick={() => setOpenNoteKey("giaoCu")} />
                </td>
              </tr>
              <tr>
                <td className="border border-gray-200 p-2 text-gray-800 dark:text-gray-800">
                  {" "}
                  Thuế TNDN{" "}
                  <span className="mt-0.5 block text-[11px] font-normal text-red-500">
                    (CS tháng + CS ký HĐ) × 22%
                  </span>
                </td>
                <td className="border border-gray-200 p-2 text-right text-gray-800 dark:text-gray-800">
                  {formatVND(grandTotal * 0.22 + totalM * 0.22)}
                </td>
                {greenPercentCell(grandTotal * 0.22 + totalM * 0.22)}
                <td className="border border-gray-200 p-2 text-center text-gray-800 dark:text-gray-800">
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
                <td className="border text-right bg-red-50 text-gray-800 dark:text-gray-800">
                  <MoneyInput value={vanHanhPerHS} onChange={changeVanHanhPerHS} />
                  <PerStudentTotal
                    students={studentPerClass}
                    perHS={vanHanhPerHS}
                    total={vanHanh}
                  />
                </td>
                {greenPercentCell(vanHanh)}
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
                {greenPercentCell(companyProfit)}
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
                {greenPercentCell(companyProfitPerHS)}
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


      {/* Biểu đồ phân bổ chi phí — cùng biểu đồ với màn xem chính sách, ở đây
          cập nhật ngay theo số đang nhập. */}
      <div className="max-w-4xl mx-auto">
        <PolicyPie
          data={chartData}
          subjectName={subjectName}
          companyProfit={companyProfit}
          className=""
        />
      </div>
      <DepreciationRemainingSummary moneyRows={rowsM} deviceRows={rowsD} />
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
            activeTab={activeTab}
            studentPerClass={studentPerClass}
            periods={periods}
            students={supportStudentCount}
            months={durationMonths}
          />

          <Support
            setTotalM={setTotalM}
            setTotalD={setTotalD}
            data={data?.studentCount ?? 0}
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
            activeTab={activeTab}
            studentPerClass={studentPerClass}
            periods={periods}
            students={supportStudentCount}
            months={durationMonths}
          />

          <Support
            setTotalM={setTotalM}
            setTotalD={setTotalD}
            data={data?.studentCount ?? 0}
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
      {picker && !effectiveSubjectId && (
        <div className="pt-20 px-4 pb-6 max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tạo chính sách</h2>
              <p className="mt-1 text-sm text-slate-500">
                Chọn trường, năm học và môn học để bắt đầu nhập chính sách.
              </p>
            </div>
            <PickerField
              label="Trường *"
              value={picker.schoolId}
              options={picker.schools}
              onChange={picker.onSchoolChange}
              placeholder="Chọn trường"
            />
            <PickerField
              label="Năm học *"
              value={picker.schoolYear}
              options={picker.years}
              onChange={picker.onYearChange}
              disabled={!picker.schoolId}
              placeholder={!picker.schoolId ? "Chọn trường trước" : "Chọn năm học"}
            />
            <PickerField
              label="Môn học *"
              value={picker.subjectId}
              options={picker.subjects}
              onChange={picker.onSubjectChange}
              disabled={!picker.schoolYear || picker.loading}
              placeholder={
                !picker.schoolYear
                  ? "Chọn năm học trước"
                  : picker.loading
                  ? "Đang tải môn học…"
                  : picker.subjects.length
                  ? "Chọn môn học"
                  : "Trường/năm học này chưa có môn học"
              }
            />
          </div>
        </div>
      )}

      {!!effectiveSubjectId && (
        <>
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
            {activeTab === "TIET" && renderContentTiet(data)}
            {activeTab === "HS" && renderContentHS(data)}
          </div>
        </>
      )}
    </div>
  );
}
