import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import MobileSelect from "@/pages/Employee/Sales/Suggest/MobileSelect";
import { getEmployeeId, hasRole } from "@/utils/auth";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { teacherApi } from "@/service/teaching";
import { expenseRequestApi } from "@/service/expenseRequest";
import { expensePeriodApi, type ExpensePeriod } from "@/service/expensePeriod";
import {
  SALES_PICK_SOURCES,
  SALES_PICK_SOURCE_META,
  statusLabel,
  type CashflowSheetResponse,
  type CashflowSource,
  type ExpenseRequest,
  type MonthlyCashflowItemInput,
  type PolicySupport,
} from "@/types/expenseRequest";
import DecimalInput from "@/components/DecimalInput";
import { formatVnd } from "@/utils/decimal";
import {
  canDoStep,
  cashflowSourceOf,
  expenseBasePath,
  isSalesPick,
  todayISO,
} from "./lib";
import PolicySupportTables, {
  type PolicySupportSelection,
} from "./components/PolicySupportTables";
import { sheetGroupBlockReason } from "./components/CashflowSheetPreview";
import SalesPickSourceSheet from "./components/SalesPickSourceSheet";
import ExpenseFlowSteps from "./components/ExpenseFlowSteps";
import {
  DEFAULT_SCHOOL_YEAR,
  includeDefaultSchoolYear,
} from "@/constants/schoolYear";

const MAX_SIZE = 50 * 1024 * 1024;

type Option = { id: number | string; name: string };
type ProposalTarget = "WARD" | "SCHOOL";

/** Năm học của kỳ tháng thật (tháng 8 trở đi thuộc năm học bắt đầu năm đó). */
const schoolYearOfMonth = (month: number, year: number) =>
  month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

/** Kỳ thuộc năm học: kỳ tháng theo tháng; kỳ tuỳ chỉnh (> 12) theo năm chạm năm học. */
const periodInSchoolYear = (period: ExpensePeriod, schoolYear: string | null) => {
  if (!schoolYear) return true;
  if (period.month >= 1 && period.month <= 12) {
    return schoolYearOfMonth(period.month, period.year) === schoolYear;
  }
  return schoolYear.split("-").map(Number).includes(Number(period.year));
};

/** Khoá khoản như BE `cashflowItemKey`: trường:kỳ:s<môn> / trường:kỳ:t<giáo viên>. */
const itemKey = (
  source: CashflowSource,
  item: {
    schoolId?: number | null;
    expensePeriodId?: number | null;
    subjectId?: number | null;
    schoolTeacherId?: number | null;
  }
) =>
  `${item.schoolId ?? 0}:${item.expensePeriodId ?? 0}:${
    source === "SCHOOL_TEACHER"
      ? `t${item.schoolTeacherId ?? 0}`
      : `s${item.subjectId ?? 0}`
  }`;

const money = (value: number) => `${formatVnd(value) || "0"} đ`;

const periodLabel = (period: ExpensePeriod) =>
  period.name ||
  (period.month <= 12
    ? `Tháng ${period.month}/${period.year}`
    : `Kỳ ${period.month}/${period.year}`);

// Hình thức: Chi Năm (phường/xã hoặc "Đề xuất ngoài chính sách" cho trường —
// trường phải có hỗ trợ tiền mặt/thiết bị trong chính sách đã duyệt, form hiện
// bảng cho kinh doanh xem) hoặc "Đề xuất chi tháng" (từ 19/11/2026): chọn một
// trường + một kỳ kế toán Kế toán đã tạo, tích Chi trường (bảng Chi Trường) /
// Chi Ban quản lí (bảng Chi Ngoài) — chỉ môn đã xác nhận BBCS — / Chi giáo viên
// (bảng Giáo viên trường Kế toán đã nhập), tích khoản và nhập số tiền ≤ tổng Còn
// chi đã chọn; Kế toán / Kế toán công nợ nhập số tiền từng khoản → Giám đốc →
// Kế toán công nợ → Thủ quỹ → kinh doanh. Có `:id` trên URL = chế độ
// sửa: chủ đơn được sửa ở mọi trạng thái; sau khi lưu, đề xuất chạy lại quy
// trình từ đầu. Nhân viên không chọn loại Chi Năm; Giám đốc phân loại khi duyệt.
export default function ExpenseRequestForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editId = Number(id);
  const isEdit = Number.isInteger(editId) && editId > 0;
  const base = expenseBasePath();
  const teacherFinanceWorkspace =
    hasRole("giaovien_congty") && !hasRole("sales");

  const [editing, setEditing] = useState<ExpenseRequest | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);

  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState("");
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  // Form mở ở Chi Năm nên mặc định trừ chính sách; người dùng có thể bỏ chọn
  // để đề xuất không phụ thuộc chính sách hỗ trợ tiền mặt/thiết bị.
  const [deductPolicy, setDeductPolicy] = useState(true);
  // false = Chi Năm; true = Đề xuất chi tháng (tích chọn khoản ở QL thu chi).
  const [isMonthlyExpense, setIsMonthlyExpense] = useState(false);
  // Loại đã tích + khoản đã chọn (khoá `itemKey`) + số liệu bảng từng loại.
  const [pickSources, setPickSources] = useState<CashflowSource[]>([]);
  const [picked, setPicked] = useState<Partial<Record<CashflowSource, string[]>>>(
    {}
  );
  const [sheets, setSheets] = useState<
    Partial<Record<CashflowSource, CashflowSheetResponse | null>>
  >({});
  const [salesAmount, setSalesAmount] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [proposalTarget, setProposalTarget] = useState<ProposalTarget>("WARD");

  // Đề xuất phường/xã: khu vực → phường/xã.
  // Đề xuất trường: chọn trực tiếp trong danh sách trường được phụ trách.
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [wards, setWards] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [schoolYears, setSchoolYears] = useState<Option[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string | null>(
    null
  );
  const [schoolYearsLoading, setSchoolYearsLoading] = useState(false);
  // Chi theo QL thu chi: một trường + một kỳ kế toán Kế toán đã tạo.
  const [periods, setPeriods] = useState<ExpensePeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  // Chi Năm cho trường: hỗ trợ tiền mặt / thiết bị trong chính sách đã duyệt.
  const [policySupport, setPolicySupport] = useState<PolicySupport | null>(null);
  const [policySupportLoading, setPolicySupportLoading] = useState(false);
  const [policySupportError, setPolicySupportError] = useState("");
  // Dòng hỗ trợ đã tích + số tiền (theo rowKey `policyId:CASH|EQUIPMENT:itemIndex`).
  const [policySelection, setPolicySelection] = useState<PolicySupportSelection>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Chế độ sửa: nạp đề xuất, kiểm tra quyền rồi đổ vào form.
  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    expenseRequestApi
      .getById(editId)
      .then(async (req) => {
        if (!active) return;
        if (!canDoStep("edit", req)) {
          toast.error("Đề xuất này không thể sửa");
          navigate(`${base}/${editId}`, { replace: true });
          return;
        }
        setEditing(req);
        const source = cashflowSourceOf(req);
        const monthlyExpense = source !== null;
        setIsMonthlyExpense(monthlyExpense);
        if (monthlyExpense) {
          // Đề xuất tích chọn: chọn sẵn loại + khoản đã lưu. Đề xuất chi tháng
          // cũ (một bảng): tích sẵn loại đó, kinh doanh chọn lại khoản.
          const items = isSalesPick(req) ? req.monthlyItems ?? [] : [];
          const sources = isSalesPick(req)
            ? SALES_PICK_SOURCES.filter((src) =>
                items.some((item) => (item.cashflowSource ?? source) === src)
              )
            : [source];
          setPickSources(sources);
          setPicked(
            Object.fromEntries(
              sources.map((src) => [
                src,
                items
                  .filter((item) => (item.cashflowSource ?? source) === src)
                  .map((item) => itemKey(src, item)),
              ])
            )
          );
          setSalesAmount(Number(req.salesAmount) || 0);
        }
        setProposalTarget(monthlyExpense || req.schoolId ? "SCHOOL" : "WARD");
        setContent(req.content ?? "");
        setDescription(req.description ?? "");
        setParticipants(req.participants ?? "");
        setExpectedPaymentDate((req.expectedPaymentDate ?? "").slice(0, 10));
        // Chi Năm cho trường: chọn sẵn các dòng chính sách đã tích.
        setPolicySelection(
          Object.fromEntries(
            (req.policySupportItems ?? []).map((item) => [
              `${item.policyId}:${item.supportType}:${item.itemIndex}`,
              Number(item.amount) || 0,
            ])
          )
        );
        setDeductPolicy(Boolean(req.deductPolicy));
        if (source) {
          // Một trường + một kỳ (đề xuất cũ nhiều trường: lấy trường đầu).
          const schoolId = Number(req.schoolId ?? req.school?.id ?? 0) || null;
          if (req.school?.id) {
            setSchools([{ id: Number(req.school.id), name: req.school.name }]);
          }
          setSelectedSchool(schoolId);
          setSelectedSchoolYear(req.schoolYear ?? null);
          setSelectedPeriodId(
            Number(req.expensePeriodId ?? req.expensePeriod?.id ?? 0) || null
          );
          return;
        }
        setSelectedSchoolYear(req.schoolYear ?? null);

        // Chọn sẵn đúng Khu vực → Phường/Xã → Trường đang lưu. Detail API
        // trả ward trực tiếp cho đề xuất theo xã, hoặc school.ward cho đề xuất
        // theo trường.
        let currentSchool: any = req.school ?? null;
        let currentWard: any = req.ward ?? req.school?.ward ?? null;

        // Tương thích response backend cũ chưa trả nested relation: dùng ID
        // đang lưu để tra lại trường/phường và vẫn hiện đúng lựa chọn cũ.
        if (req.schoolId && !currentWard) {
          try {
            const employeeSchools = await schoolApi.getByEmployee(
              getEmployeeId()
            );
            const schoolList = Array.isArray(employeeSchools)
              ? employeeSchools
              : [];
            currentSchool =
              schoolList.find(
                (school: any) => Number(school.id) === Number(req.schoolId)
              ) ?? currentSchool;
            currentWard = currentSchool?.ward ?? currentWard;
          } catch (locationError) {
            console.error("Không tải được địa bàn của trường", locationError);
          }
        }

        if (req.wardId && !currentWard) {
          try {
            currentWard = await wardApi.getById(Number(req.wardId));
          } catch (locationError) {
            console.error("Không tải được phường/xã đã chọn", locationError);
          }
        }

        if (!active) return;
        const currentProvinceId = Number(
          currentWard?.province_id ?? currentWard?.province?.id ?? 0
        );
        if (currentWard?.id) {
          setWards([{ id: Number(currentWard.id), name: currentWard.name }]);
        }
        if (currentSchool?.id) {
          setSchools([
            { id: Number(currentSchool.id), name: currentSchool.name },
          ]);
        }
        if (currentWard?.province?.id) {
          setProvinces((current) =>
            current.some(
              (province) =>
                Number(province.id) === Number(currentWard.province.id)
            )
              ? current
              : [
                  ...current,
                  {
                    id: Number(currentWard.province.id),
                    name: currentWard.province.name,
                  },
                ]
          );
        }
        if (currentProvinceId > 0) setSelectedRegion(currentProvinceId);
        if (currentWard?.id) setSelectedWard(Number(currentWard.id));
        setSelectedSchool(req.schoolId ? Number(req.schoolId) : null);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || "Không tải được đề xuất");
        navigate(base, { replace: true });
      })
      .finally(() => {
        if (active) setLoadingEdit(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId]);

  // Khu vực (province) theo nhân viên
  useEffect(() => {
    if (teacherFinanceWorkspace) {
      teacherApi
        .me()
        .then((teacher) => {
          const teacherWards = teacher.allowedWards || [];
          const teacherSchools = teacher.allowedSchools || [];
          setWards(teacherWards);
          setSchools(teacherSchools);
          setSelectedWard((current) =>
            current || teacherWards.length !== 1
              ? current
              : Number(teacherWards[0].id),
          );
        })
        .catch((e) => console.error("Không tải được phạm vi giáo viên", e));
      return;
    }
    provinceApi
      .getProvincesByEmployee(getEmployeeId())
      .then((res: any[]) => {
        const assigned = res.map((r) => ({ id: r.id, name: r.name }));
        // Giữ option hiện tại đã khôi phục từ đề xuất nếu địa bàn vừa được
        // bàn giao cho người khác, để giá trị cũ vẫn hiển thị trước khi đổi.
        setProvinces((current) => [
          ...assigned,
          ...current.filter(
            (province) =>
              !assigned.some((item) => Number(item.id) === Number(province.id))
          ),
        ]);
      })
      .catch((e) => console.error(e));
  }, [teacherFinanceWorkspace]);

  // Tab phường/xã: chọn khu vực → tải danh sách phường/xã.
  useEffect(() => {
    if (teacherFinanceWorkspace) return;
    if (proposalTarget !== "WARD" || !selectedRegion) return;
    setWards([]);

    wardApi
      .getByEmployee(getEmployeeId(), selectedRegion)
      .then((res: any[]) => {
        const options = res.map((w) => ({ id: w.id, name: w.name }));
        setWards((currentOptions) => [
          ...options,
          ...currentOptions.filter(
            (ward) =>
              !options.some((item) => Number(item.id) === Number(ward.id))
          ),
        ]);
        setSelectedWard((current) => {
          if (current) return current;
          return options.length === 1 ? Number(options[0].id) : null;
        });
      })
      .catch((e) => console.error(e));
  }, [proposalTarget, selectedRegion, teacherFinanceWorkspace]);

  // Tab trường: tải thẳng toàn bộ trường thuộc phạm vi nhân viên, không bắt
  // người dùng chọn khu vực/phường-xã trung gian.
  useEffect(() => {
    if (proposalTarget !== "SCHOOL") return;
    if (teacherFinanceWorkspace) return;

    let active = true;
    setSchoolsLoading(true);
    schoolApi
      .getByEmployee(getEmployeeId())
      .then((res: any) => {
        if (!active) return;
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];
        const options = list.map((school: any) => ({
          id: school.id,
          name: school?.ward?.name
            ? `${school.name} — ${school.ward.name}`
            : school.name,
        }));
        setSchools((currentOptions) => [
          ...options,
          ...currentOptions.filter(
            (school) =>
              !options.some((item) => Number(item.id) === Number(school.id))
          ),
        ]);
      })
      .catch((e) => {
        console.error(e);
        if (active) setSchools([]);
      })
      .finally(() => {
        if (active) setSchoolsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [proposalTarget, teacherFinanceWorkspace]);

  // Trường có thể chỉ khai môn học cho một số năm học nhất định — tải danh
  // sách năm có dữ liệu để chọn, tự chọn sẵn năm hiện tại nếu trường có.
  useEffect(() => {
    setSchoolYears([]);

    if (!selectedSchool) {
      setSelectedSchoolYear(null);
      return;
    }

    let active = true;
    setSchoolYearsLoading(true);

    subjectApi
      .getFinanceBySchool(selectedSchool)
      .then((response: any) => {
        if (!active) return;

        const subjects = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : [];
        const schoolYearValues: string[] = subjects
          .map((subject: any) => String(subject?.schoolYear || "").trim())
          .filter((schoolYear: string) => Boolean(schoolYear));
        const options: Option[] = includeDefaultSchoolYear(schoolYearValues)
          .sort((first, second) => second.localeCompare(first))
          .map((schoolYear) => ({ id: schoolYear, name: schoolYear }));

        setSchoolYears(options);

        if (options.length > 0) {
          const preferred =
            options.find((option) => option.id === DEFAULT_SCHOOL_YEAR) ||
            options[0];

          setSelectedSchoolYear((current) =>
            current && options.some((option) => option.id === current)
              ? current
              : String(preferred.id)
          );
        }
      })
      .catch((e) => {
        console.error(e);
        if (active) setSchoolYears([]);
      })
      .finally(() => {
        if (active) setSchoolYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSchool]);

  // Chi theo QL thu chi: kỳ kế toán đã có của trường.
  useEffect(() => {
    setPeriods([]);
    if (!isMonthlyExpense || !selectedSchool) return;
    let active = true;
    setPeriodsLoading(true);
    expensePeriodApi
      .getAll({ schoolId: Number(selectedSchool) })
      .then((list) => {
        if (!active) return;
        setPeriods(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        console.error(e);
        if (active) setPeriods([]);
      })
      .finally(() => {
        if (active) setPeriodsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isMonthlyExpense, selectedSchool]);

  // Chi Năm cho trường: bảng hỗ trợ tiền mặt / thiết bị trong chính sách.
  useEffect(() => {
    setPolicySupport(null);
    setPolicySupportError("");
    if (
      isMonthlyExpense ||
      !deductPolicy ||
      proposalTarget !== "SCHOOL" ||
      !selectedSchool ||
      !selectedSchoolYear
    ) {
      return;
    }
    let active = true;
    setPolicySupportLoading(true);
    expenseRequestApi
      .policySupport(
        Number(selectedSchool),
        String(selectedSchoolYear),
        isEdit ? editId : undefined
      )
      .then((support) => {
        if (!active) return;
        setPolicySupport(support);
        // Bỏ các dòng không thuộc chính sách của trường / năm học đang chọn.
        const keys = new Set(
          [...support.cash, ...support.equipment].map((row) => row.rowKey)
        );
        setPolicySelection((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([key]) => keys.has(key))
          )
        );
      })
      .catch((err) => {
        if (active) {
          setPolicySupportError(
            err?.response?.data?.message || "Không tải được chính sách của trường"
          );
        }
      })
      .finally(() => {
        if (active) setPolicySupportLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    isMonthlyExpense,
    deductPolicy,
    proposalTarget,
    selectedSchool,
    selectedSchoolYear,
    isEdit,
    editId,
  ]);

  const yearPeriods = periods
    .filter((period) => periodInSchoolYear(period, selectedSchoolYear))
    .sort((a, b) => b.year - a.year || b.month - a.month);
  const selectedPeriod =
    periods.find((period) => period.id === selectedPeriodId) ?? null;
  // Năm học gửi kèm: kỳ tháng tự suy ra; kỳ tuỳ chỉnh lấy năm học đang chọn.
  const monthlySchoolYear =
    selectedPeriod && selectedPeriod.month <= 12
      ? schoolYearOfMonth(selectedPeriod.month, selectedPeriod.year)
      : selectedSchoolYear || undefined;

  // Khoản đã chọn (theo số liệu bảng hiện tại) + tổng Còn chi = trần số tiền.
  const pickedGroups = pickSources.flatMap((src) => {
    const keys = new Set(picked[src] ?? []);
    return (sheets[src]?.groups ?? [])
      .filter((group) => keys.has(group.key))
      .map((group) => ({ source: src, group }));
  });
  const pickedTotal =
    Math.round(
      pickedGroups.reduce(
        (sum, { group }) => sum + Math.max(0, Number(group.remainingAmount) || 0),
        0
      ) * 100
    ) / 100;

  const toggleSource = (src: CashflowSource, checked: boolean) => {
    setPickSources((current) =>
      checked
        ? SALES_PICK_SOURCES.filter((item) => item === src || current.includes(item))
        : current.filter((item) => item !== src)
    );
    if (!checked) {
      setPicked((current) => ({ ...current, [src]: [] }));
      setSheets((current) => ({ ...current, [src]: null }));
    }
    setError("");
  };

  const toggleItem = (
    src: CashflowSource,
    group: CashflowSheetResponse["groups"][number],
    checked: boolean
  ) => {
    setPicked((current) => {
      const keys = new Set(current[src] ?? []);
      if (checked) keys.add(group.key);
      else keys.delete(group.key);
      return { ...current, [src]: [...keys] };
    });
    setError("");
  };

  const pickFile = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      setError("Tệp tối đa 50MB");
      return;
    }
    setError("");
    setFile(f);
  };

  const dateChanged =
    !editing ||
    expectedPaymentDate !== (editing.expectedPaymentDate ?? "").slice(0, 10);

  const validate = () => {
    if (!content.trim()) return "Vui lòng nhập tiêu đề";
    if (content.length > 500) return "Tiêu đề tối đa 500 ký tự";
    if (!expectedPaymentDate)
      return isMonthlyExpense
        ? "Vui lòng chọn ngày chi"
        : "Vui lòng chọn ngày mong muốn";
    // Sửa mà giữ nguyên ngày cũ (có thể đã qua) thì không bắt "từ hôm nay".
    if (dateChanged && expectedPaymentDate < todayISO())
      return isMonthlyExpense
        ? "Ngày chi phải từ hôm nay trở đi"
        : "Ngày mong muốn phải từ hôm nay trở đi";
    if (isMonthlyExpense) {
      if (!selectedSchool) return "Vui lòng chọn trường";
      if (!selectedPeriodId) return "Vui lòng chọn kỳ kế toán";
      if (!pickSources.length)
        return "Tích ít nhất một loại: Chi trường, Chi Ban quản lí hoặc Chi giáo viên";
      for (const src of pickSources) {
        const label = SALES_PICK_SOURCE_META[src].label;
        const sheet = sheets[src];
        if (!sheet) return `Đang tải bảng ${label}`;
        const keys = new Set(picked[src] ?? []);
        const groups = sheet.groups.filter((group) => keys.has(group.key));
        if (!groups.length)
          return `Chọn khoản cần chi của ${label} hoặc bỏ tích ${label}`;
        for (const group of groups) {
          const reason = sheetGroupBlockReason(sheet, group);
          if (reason)
            return `${label} · ${group.subjectName || group.teacherName || group.label}: ${reason} — bỏ chọn khoản này`;
        }
      }
      if (!(salesAmount > 0)) return "Nhập số tiền đề xuất";
      if (salesAmount > pickedTotal + 0.005)
        return `Số tiền đề xuất vượt tổng Còn chi các khoản đã chọn (${money(pickedTotal)})`;
      return "";
    }
    if (proposalTarget === "WARD" && !selectedWard)
      return "Vui lòng chọn phường/xã";
    if (proposalTarget === "SCHOOL" && !selectedSchool)
      return "Vui lòng chọn trường";
    if (proposalTarget === "SCHOOL" && selectedSchool) {
      if (schoolYearsLoading) return "Đang tải danh sách năm học";
      if (schoolYears.length === 0) return "Trường chưa có dữ liệu năm học";
      if (!selectedSchoolYear) return "Vui lòng chọn năm học";
      if (deductPolicy && policySupportLoading)
        return "Đang tải chính sách của trường";
      if (
        deductPolicy &&
        policySupport &&
        !policySupport.hasCash &&
        !policySupport.hasEquipment
      )
        return "Chính sách đã duyệt của trường không có hỗ trợ tiền mặt hoặc thiết bị";
      if (deductPolicy && policySupport) {
        const rows = new Map(
          [...policySupport.cash, ...policySupport.equipment].map((row) => [
            row.rowKey,
            row,
          ])
        );
        const picked = Object.entries(policySelection);
        if (picked.length === 0)
          return "Tích ít nhất một dòng tiền mặt hoặc thiết bị trong chính sách và nhập số tiền";
        for (const [key, amount] of picked) {
          const row = rows.get(key);
          if (!row) return "Có dòng chính sách đã chọn không còn — chọn lại";
          if (!(Number(amount) > 0)) return "Nhập số tiền cho các dòng đã tích";
          if (Number(amount) > row.remainingAmount)
            return "Số tiền vượt phần còn lại của dòng chính sách";
        }
      }
    }
    return "";
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    if (
      isEdit &&
      !window.confirm(
        isMonthlyExpense
          ? "Lưu thay đổi sẽ đưa đề xuất về Chờ Kế toán nhập số tiền và chạy lại quy trình từ đầu. Tiếp tục?"
          : "Lưu thay đổi sẽ đưa đề xuất về Chờ duyệt và gửi duyệt lại từ đầu. Tiếp tục?"
      )
    ) {
      return;
    }
    setSaving(true);
    // Đề xuất chi tháng: một trường + một kỳ + các khoản đã tích + số tiền.
    const cashflowItems: MonthlyCashflowItemInput[] = pickedGroups.map(
      ({ source, group }) =>
        source === "SCHOOL_TEACHER"
          ? { source, schoolTeacherId: Number(group.schoolTeacherId) }
          : { source, subjectId: Number(group.subjectId) }
    );
    const monthlySheet = isMonthlyExpense
      ? {
          schoolId: Number(selectedSchool),
          schoolYear: monthlySchoolYear,
          expensePeriodId: Number(selectedPeriodId),
          cashflowItems,
          salesAmount,
        }
      : {};
    const singleSchool = !isMonthlyExpense && proposalTarget === "SCHOOL";
    const policySupportItems = singleSchool && deductPolicy
      ? Object.entries(policySelection).map(([key, amount]) => {
          const [policyId, supportType, itemIndex] = key.split(":");
          return {
            policyId: Number(policyId),
            supportType: supportType as "CASH" | "EQUIPMENT",
            itemIndex: Number(itemIndex),
            amount: Number(amount),
          };
        })
      : undefined;
    try {
      if (isEdit) {
        await expenseRequestApi.update(editId, {
          content: content.trim(),
          description: description.trim() || undefined,
          participants: participants.trim() || undefined,
          deductPolicy,
          isMonthlyExpense,
          expectedPaymentDate: dateChanged ? expectedPaymentDate : undefined,
          schoolId:
            singleSchool && selectedSchool ? Number(selectedSchool) : undefined,
          schoolYear:
            singleSchool && selectedSchool && selectedSchoolYear
              ? String(selectedSchoolYear)
              : undefined,
          ...monthlySheet,
          policySupportItems,
          wardId:
            !isMonthlyExpense && proposalTarget === "WARD" && selectedWard
              ? Number(selectedWard)
              : undefined,
          file: file || undefined,
        });
        toast.success(
          isMonthlyExpense
            ? "Đã sửa đề xuất, chờ Kế toán nhập số tiền lại"
            : "Đã sửa đề xuất và gửi duyệt lại từ đầu"
        );
        navigate(`${base}/${editId}`, { replace: true });
        return;
      }
      const created = await expenseRequestApi.create({
        content: content.trim(),
        description: description.trim() || undefined,
        participants: participants.trim() || undefined,
        deductPolicy,
        isMonthlyExpense,
        expectedPaymentDate,
        wardId:
          !isMonthlyExpense && proposalTarget === "WARD" && selectedWard
            ? Number(selectedWard)
            : undefined,
        schoolId:
          singleSchool && selectedSchool ? Number(selectedSchool) : undefined,
        schoolYear:
          singleSchool && selectedSchool && selectedSchoolYear
            ? String(selectedSchoolYear)
            : undefined,
        ...monthlySheet,
        policySupportItems,
        file: file || undefined,
      });
      toast.success(
        isMonthlyExpense
          ? "Đã gửi đề xuất, chờ Kế toán nhập số tiền"
          : "Đã gửi đề xuất, chờ Giám đốc duyệt"
      );
      navigate(`${base}/${created.id}`, { replace: true });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          (isEdit ? "Sửa thất bại" : "Gửi thất bại")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack
        title={
          teacherFinanceWorkspace
            ? isEdit
              ? "Sửa đề nghị tài chính"
              : "Tạo đề nghị tài chính"
            : isEdit
              ? "Sửa đề xuất chi"
              : "Tạo đề xuất chi"
        }
      />

      {loadingEdit ? (
        <p className="mt-[80px] text-center text-sm text-gray-400">Đang tải…</p>
      ) : (
        <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
          {editing &&
            !["PENDING_ACCOUNTING", "PENDING_APPROVAL"].includes(
              editing.status
            ) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                ⚠️ Đề xuất <b>{editing.code}</b> đang ở trạng thái{" "}
                <b>
                  {statusLabel(editing.status, editing.requestKind ?? "CASH")}
                </b>
                . Sau khi lưu, đề xuất sẽ quay về <b>Chờ duyệt</b> và chạy lại
                quy trình từ đầu.
              </div>
            )}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <div>
              <label className="text-sm text-gray-600">Hình thức đề xuất</label>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
                {(
                  [
                    { value: false, label: "Đề xuất chi Năm" },
                    { value: true, label: "Đề xuất chi tháng" },
                  ] as { value: boolean; label: string }[]
                ).map((tab) => (
                  <button
                    key={String(tab.value)}
                    type="button"
                    onClick={() => {
                      if (tab.value === isMonthlyExpense) return;
                      setIsMonthlyExpense(tab.value);
                      setDeductPolicy(!tab.value);
                      if (tab.value) {
                        setProposalTarget("SCHOOL");
                        setSelectedRegion(null);
                        setSelectedWard(null);
                        if (!teacherFinanceWorkspace) setWards([]);
                      }
                      setError("");
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-medium leading-tight transition ${
                      isMonthlyExpense === tab.value
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {isMonthlyExpense && (
                <p className="mt-1 text-xs text-blue-600">
                  Chọn trường và kỳ kế toán, tích Chi trường / Chi Ban quản lí /
                  Chi giáo viên rồi chọn khoản cần chi ở bảng QL thu chi.
                </p>
              )}
            </div>

            <ExpenseFlowSteps source={null} salesPick={isMonthlyExpense} />

            {!isMonthlyExpense && (
              <div>
                <label className="text-sm text-gray-600">
                  Đối tượng đề xuất
                </label>
                <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1">
                  {(
                    [
                      { value: "WARD", label: "Đề xuất phường/xã" },
                      { value: "SCHOOL", label: "Đề xuất ngoài chính sách" },
                    ] as { value: ProposalTarget; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => {
                        if (tab.value === proposalTarget) return;
                        setProposalTarget(tab.value);
                        setSelectedRegion(null);
                        setSelectedWard(null);
                        setSelectedSchool(null);
                        setSelectedSchoolYear(null);
                        // Giáo viên công ty: phường/trường lấy từ hồ sơ giáo viên, giữ nguyên.
                        if (!teacherFinanceWorkspace) {
                          setWards([]);
                          setSchools([]);
                        }
                        setError("");
                      }}
                      className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                        proposalTarget === tab.value
                          ? "bg-blue-500 text-white shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {isEdit && (
                  <p className="mt-1 text-xs text-gray-400">
                    Đổi đối tượng sẽ chuyển đề xuất sang phường/xã hoặc trường
                    mới đã chọn.
                  </p>
                )}
              </div>
            )}

            {!isMonthlyExpense && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Giám đốc sẽ quyết định đây là đề xuất tiền, thiết bị hay sửa
                chữa khi duyệt.
              </div>
            )}

            <div>
              <label className="text-sm text-gray-600">
                Tiêu đề <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={content}
                maxLength={500}
                onChange={(e) => setContent(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="VD: Sửa máy chiếu phòng học hoặc chi tiếp khách"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">Nội dung / lý do</label>
              <textarea
                value={description}
                rows={3}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="Mô tả chi tiết nhu cầu và lý do đề xuất"
              />
            </div>

            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={deductPolicy}
                onChange={(e) => setDeductPolicy(e.target.checked)}
                className="h-4 w-4"
              />
              Trừ chính sách
            </label>
            {!isMonthlyExpense && (
              <p className="-mt-2 text-xs text-gray-500">
                Bỏ chọn nếu khoản chi không phụ thuộc chính sách hỗ trợ tiền mặt
                hoặc thiết bị.
              </p>
            )}

            <div>
              <label className="text-sm text-gray-600">
                Thành phần tham gia
              </label>
              <textarea
                value={participants}
                rows={2}
                maxLength={500}
                onChange={(e) => setParticipants(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="VD: Giám đốc, kế toán, khách hàng dự án X"
              />
            </div>

            {!teacherFinanceWorkspace && proposalTarget === "WARD" && (
              <MobileSelect
                label="Khu vực"
                placeholder="Chọn khu vực"
                value={selectedRegion}
                options={provinces}
                onChange={(value) => {
                  setSelectedRegion(value ? Number(value) : null);
                  setSelectedWard(null);
                  setWards([]);
                }}
              />
            )}

            {proposalTarget === "WARD" && wards.length > 0 && (
              <MobileSelect
                label="Phường/Xã *"
                placeholder="Chọn phường/xã"
                value={selectedWard}
                options={wards}
                onChange={(value) => {
                  setSelectedWard(value ? Number(value) : null);
                }}
              />
            )}

            {proposalTarget === "SCHOOL" && (
              <MobileSelect
                label="Trường *"
                placeholder={
                  schoolsLoading ? "Đang tải trường..." : "Chọn trường"
                }
                value={selectedSchool}
                options={schools}
                onChange={(value) => {
                  setSelectedSchool(value ? Number(value) : null);
                  setSelectedSchoolYear(null);
                  setSelectedPeriodId(null);
                  setPolicySelection({});
                  setPicked({});
                }}
                disabled={schoolsLoading}
              />
            )}

            {proposalTarget === "WARD" && selectedWard && (
              <p className="-mt-2 text-xs text-blue-600">
                Đề xuất này sẽ được ghi nhận cho xã/phường đã chọn.
              </p>
            )}

            {proposalTarget === "SCHOOL" && selectedSchool && (
              <MobileSelect
                label={isMonthlyExpense ? "Năm học (lọc kỳ)" : "Năm học *"}
                placeholder={
                  schoolYearsLoading ? "Đang tải năm học..." : "Chọn năm học"
                }
                value={selectedSchoolYear}
                options={schoolYears}
                onChange={(value) => {
                  setSelectedSchoolYear(value ? String(value) : null);
                }}
                disabled={schoolYearsLoading || schoolYears.length === 0}
              />
            )}

            {!isMonthlyExpense &&
              deductPolicy &&
              proposalTarget === "SCHOOL" &&
              selectedSchool &&
              selectedSchoolYear && (
                <PolicySupportTables
                  support={policySupport}
                  loading={policySupportLoading}
                  error={policySupportError}
                  selection={policySelection}
                  onSelectionChange={setPolicySelection}
                />
              )}

            {isMonthlyExpense && selectedSchool && (
              <div>
                <label className="text-sm text-gray-600">
                  Kỳ kế toán <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <MobileSelect
                    label=""
                    placeholder={
                      periodsLoading
                        ? "Đang tải kỳ kế toán..."
                        : yearPeriods.length
                        ? "Chọn kỳ kế toán"
                        : "Trường chưa có kỳ kế toán trong năm học này"
                    }
                    value={selectedPeriodId}
                    options={yearPeriods.map((period) => ({
                      id: period.id,
                      name: periodLabel(period),
                    }))}
                    onChange={(value) => {
                      setSelectedPeriodId(value ? Number(value) : null);
                      setPicked({});
                    }}
                    disabled={periodsLoading || yearPeriods.length === 0}
                  />
                  {!periodsLoading && yearPeriods.length === 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Kỳ kế toán do Kế toán tạo ở QL thu chi.
                    </p>
                  )}
                </div>
              </div>
            )}

            {isMonthlyExpense && selectedSchool && selectedPeriodId && (
              <div className="space-y-2">
                <label className="text-sm text-gray-600">
                  Loại chi <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  {SALES_PICK_SOURCES.map((src) => (
                    <label
                      key={src}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        pickSources.includes(src)
                          ? "border-blue-300 bg-blue-50 text-blue-800"
                          : "border-gray-200 text-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={pickSources.includes(src)}
                        onChange={(event) => toggleSource(src, event.target.checked)}
                      />
                      {SALES_PICK_SOURCE_META[src].icon}{" "}
                      {SALES_PICK_SOURCE_META[src].label}
                    </label>
                  ))}
                </div>
                {pickSources.includes("SCHOOL_TEACHER") && (
                  <p className="text-xs text-gray-500">
                    Chi giáo viên chỉ đề xuất được sau khi Kế toán nhập bảng Giáo
                    viên trường (dưới bảng Chi Ngoài) của trường trong kỳ này.
                  </p>
                )}
                {pickSources.map((src) => (
                  <SalesPickSourceSheet
                    key={`${src}:${selectedSchool}:${selectedPeriodId}`}
                    source={src}
                    schoolId={Number(selectedSchool)}
                    expensePeriodId={Number(selectedPeriodId)}
                    excludeSuggestId={isEdit ? editId : undefined}
                    selected={new Set(picked[src] ?? [])}
                    onToggle={toggleItem}
                    onLoaded={(source, data) =>
                      setSheets((current) => ({ ...current, [source]: data }))
                    }
                  />
                ))}
                {pickSources.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        Đã chọn {pickedGroups.length} khoản · Tổng Còn chi
                      </span>
                      <b className="tabular-nums text-orange-600">
                        {money(pickedTotal)}
                      </b>
                    </div>
                    <label className="text-sm text-gray-600">
                      Số tiền đề xuất <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <DecimalInput
                        value={salesAmount}
                        onValueChange={(value) => setSalesAmount(Number(value) || 0)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm ${
                          salesAmount > pickedTotal + 0.005 ? "border-red-300" : ""
                        }`}
                        placeholder="0"
                        allowDecimal={false}
                      />
                      <button
                        type="button"
                        onClick={() => setSalesAmount(pickedTotal)}
                        disabled={!(pickedTotal > 0)}
                        className="shrink-0 rounded-lg border border-blue-200 px-3 text-xs font-medium text-blue-600 disabled:opacity-40"
                      >
                        Tối đa
                      </button>
                    </div>
                    {salesAmount > pickedTotal + 0.005 ? (
                      <p className="text-[11px] text-red-600">
                        Vượt tổng Còn chi các khoản đã chọn ({money(pickedTotal)})
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-500">
                        Không vượt tổng Còn chi các khoản đã chọn. Kế toán sẽ nhập
                        số tiền từng khoản, tổng không vượt số này.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm text-gray-600">
                {isMonthlyExpense ? "Ngày chi" : "Ngày mong muốn"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expectedPaymentDate}
                min={isEdit ? undefined : todayISO()}
                onChange={(e) => setExpectedPaymentDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Tệp đính kèm
                {isEdit && editing?.attachments?.length
                  ? " (chọn tệp mới để thay)"
                  : ""}
              </label>
              <input
                type="file"
                onChange={(e) => pickFile(e.target.files)}
                className="w-full mt-1 text-sm"
              />
              {file && (
                <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1">
                  <span className="truncate">📎 {file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-500 ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <p className="text-xs text-gray-400 text-center px-4">
            {isEdit
              ? "Có thể sửa ở mọi trạng thái. Mỗi lần lưu sẽ gửi duyệt lại từ đầu."
              : isMonthlyExpense
              ? "Sau khi gửi, đề xuất chuyển Kế toán nhập số tiền từng khoản. Có thể sửa lại trước khi Thủ quỹ xuất tiền; mỗi lần sửa sẽ chạy lại quy trình từ đầu."
              : "Sau khi gửi, đề xuất sẽ chuyển đến giám đốc duyệt. Có thể sửa lại ở mọi trạng thái; mỗi lần sửa sẽ duyệt lại từ đầu."}
          </p>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium active:scale-95 disabled:opacity-60"
          >
            {saving
              ? isEdit
                ? "Đang lưu…"
                : "Đang gửi…"
              : isEdit
              ? "Lưu & gửi duyệt lại"
              : "Gửi đề xuất"}
          </button>
        </div>
      )}
    </div>
  );
}
