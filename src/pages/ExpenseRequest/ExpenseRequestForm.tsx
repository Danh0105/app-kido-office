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
  CASHFLOW_SOURCE_META,
  statusLabel,
  type CashflowSheetResponse,
  type CashflowSource,
  type ExpenseRequest,
  type PolicySupport,
} from "@/types/expenseRequest";
import { canDoStep, cashflowSourceOf, expenseBasePath, todayISO } from "./lib";
import PolicySupportTables from "./components/PolicySupportTables";
import CashflowSheetPreview from "./components/CashflowSheetPreview";
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

const periodLabel = (period: ExpensePeriod) =>
  period.name ||
  (period.month <= 12
    ? `Tháng ${period.month}/${period.year}`
    : `Kỳ ${period.month}/${period.year}`);

// Hình thức: Chi Năm (phường/xã hoặc "Đề xuất ngoài chính sách" cho trường —
// trường phải có hỗ trợ tiền mặt/thiết bị trong chính sách đã duyệt, form hiện
// bảng cho kinh doanh xem) hoặc chi theo QL thu chi — Chi Ngoài (Chi chính sách
// tháng), Chi Trường, Chi GV trường: chọn một trường + một kỳ kế toán Kế toán đã
// tạo, form hiện toàn bộ số liệu bảng ở QL thu chi (Chi Trường: dòng "Có trong
// HĐ" tính đã chi, không đề xuất); Kế toán nhập số liệu bảng rồi gửi Kế toán trưởng →
// Giám đốc → Kế toán công nợ → Thủ quỹ → kinh doanh. Có `:id` trên URL = chế độ
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
  const [deductPolicy, setDeductPolicy] = useState(false);
  // null = Chi Năm; còn lại = bảng nguồn ở QL thu chi.
  const [cashflowSource, setCashflowSource] = useState<CashflowSource | null>(
    null
  );
  const isMonthlyExpense = cashflowSource !== null;
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
  // Toàn bộ số liệu bảng nguồn của trường trong kỳ đã chọn.
  const [sheet, setSheet] = useState<CashflowSheetResponse | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState("");
  // Chi Năm cho trường: hỗ trợ tiền mặt / thiết bị trong chính sách đã duyệt.
  const [policySupport, setPolicySupport] = useState<PolicySupport | null>(null);
  const [policySupportLoading, setPolicySupportLoading] = useState(false);
  const [policySupportError, setPolicySupportError] = useState("");

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
        setCashflowSource(source);
        setProposalTarget(monthlyExpense || req.schoolId ? "SCHOOL" : "WARD");
        setContent(req.content ?? "");
        setDescription(req.description ?? "");
        setParticipants(req.participants ?? "");
        setExpectedPaymentDate((req.expectedPaymentDate ?? "").slice(0, 10));
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

  // Chi theo QL thu chi: số liệu Kế toán đã nhập ở bảng của trường trong kỳ.
  useEffect(() => {
    setSheet(null);
    setSheetError("");
    if (!cashflowSource || !selectedSchool || !selectedPeriodId) return;
    let active = true;
    setSheetLoading(true);
    expenseRequestApi
      .getCashflowSheet({
        source: cashflowSource,
        schoolId: Number(selectedSchool),
        expensePeriodId: Number(selectedPeriodId),
        excludeSuggestId: isEdit ? editId : undefined,
      })
      .then((data) => {
        if (active) setSheet(data);
      })
      .catch((err) => {
        if (active) {
          setSheetError(
            err?.response?.data?.message || "Không tải được số liệu QL thu chi"
          );
        }
      })
      .finally(() => {
        if (active) setSheetLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cashflowSource, selectedSchool, selectedPeriodId, isEdit, editId]);

  // Chi Năm cho trường: bảng hỗ trợ tiền mặt / thiết bị trong chính sách.
  useEffect(() => {
    setPolicySupport(null);
    setPolicySupportError("");
    if (
      isMonthlyExpense ||
      proposalTarget !== "SCHOOL" ||
      !selectedSchool ||
      !selectedSchoolYear
    ) {
      return;
    }
    let active = true;
    setPolicySupportLoading(true);
    expenseRequestApi
      .policySupport(Number(selectedSchool), String(selectedSchoolYear))
      .then((support) => {
        if (active) setPolicySupport(support);
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
  }, [isMonthlyExpense, proposalTarget, selectedSchool, selectedSchoolYear]);

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
      if (sheetLoading) return "Đang tải số liệu QL thu chi";
      if (sheet?.openSheetRequest)
        return `Bảng này đã có đề xuất ${sheet.openSheetRequest.code || `#${sheet.openSheetRequest.id}`} đang chạy`;
      if (sheet?.hasData && !(sheet.proposableTotal > 0))
        return `Bảng ${sheet.table} không còn khoản nào cần đề xuất`;
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
      if (policySupportLoading) return "Đang tải chính sách của trường";
      if (policySupport && !policySupport.hasCash && !policySupport.hasEquipment)
        return "Chính sách đã duyệt của trường không có hỗ trợ tiền mặt hoặc thiết bị";
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
          ? "Lưu thay đổi sẽ đưa đề xuất về Chờ Kế toán nhập số liệu và chạy lại quy trình từ đầu. Tiếp tục?"
          : "Lưu thay đổi sẽ đưa đề xuất về Chờ duyệt và gửi duyệt lại từ đầu. Tiếp tục?"
      )
    ) {
      return;
    }
    setSaving(true);
    // Chi theo QL thu chi: một trường + kỳ đã có hoặc kỳ tháng mới.
    const monthlySheet = isMonthlyExpense
      ? {
          schoolId: Number(selectedSchool),
          schoolYear: monthlySchoolYear,
          expensePeriodId: Number(selectedPeriodId),
        }
      : {};
    const singleSchool = !isMonthlyExpense && proposalTarget === "SCHOOL";
    try {
      if (isEdit) {
        await expenseRequestApi.update(editId, {
          content: content.trim(),
          description: description.trim() || undefined,
          participants: participants.trim() || undefined,
          deductPolicy,
          isMonthlyExpense,
          cashflowSource: cashflowSource ?? undefined,
          expectedPaymentDate: dateChanged ? expectedPaymentDate : undefined,
          schoolId:
            singleSchool && selectedSchool ? Number(selectedSchool) : undefined,
          schoolYear:
            singleSchool && selectedSchool && selectedSchoolYear
              ? String(selectedSchoolYear)
              : undefined,
          ...monthlySheet,
          wardId:
            !isMonthlyExpense && proposalTarget === "WARD" && selectedWard
              ? Number(selectedWard)
              : undefined,
          file: file || undefined,
        });
        toast.success(
          isMonthlyExpense
            ? "Đã sửa đề xuất, chờ Kế toán nhập số liệu lại"
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
        cashflowSource: cashflowSource ?? undefined,
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
        file: file || undefined,
      });
      toast.success(
        isMonthlyExpense
          ? "Đã gửi đề xuất, chờ Kế toán nhập số liệu"
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
                    { value: null, label: "Đề xuất chi Năm" },
                    {
                      value: "MANAGEMENT",
                      label: CASHFLOW_SOURCE_META.MANAGEMENT.label,
                    },
                    {
                      value: "SCHOOL_EXPENSE",
                      label: CASHFLOW_SOURCE_META.SCHOOL_EXPENSE.label,
                    },
                    {
                      value: "SCHOOL_TEACHER",
                      label: "Đề xuất Chi Giáo viên Trường",
                    },
                  ] as { value: CashflowSource | null; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.value ?? "YEAR"}
                    type="button"
                    onClick={() => {
                      if (tab.value === cashflowSource) return;
                      setCashflowSource(tab.value);
                      if (tab.value) {
                        setProposalTarget("SCHOOL");
                        setSelectedRegion(null);
                        setSelectedWard(null);
                        if (!teacherFinanceWorkspace) setWards([]);
                      }
                      setError("");
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-medium leading-tight transition ${
                      cashflowSource === tab.value
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {cashflowSource && (
                <p className="mt-1 text-xs text-blue-600">
                  Chọn trường và kỳ kế toán; form hiện toàn bộ số liệu bảng ở
                  QL thu chi. Đề xuất gửi Kế toán nhập số liệu bảng{" "}
                  {CASHFLOW_SOURCE_META[cashflowSource].table} ở QL thu chi →
                  Kế toán trưởng duyệt → Giám đốc duyệt → Kế toán công nợ lập
                  lệnh chi → Thủ quỹ xuất tiền → bạn nhận tiền và xác nhận đã
                  chi. Số tiền = Còn lại của bảng lúc Kế toán gửi.
                </p>
              )}
            </div>

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
              proposalTarget === "SCHOOL" &&
              selectedSchool &&
              selectedSchoolYear && (
                <PolicySupportTables
                  support={policySupport}
                  loading={policySupportLoading}
                  error={policySupportError}
                />
              )}

            {cashflowSource && selectedSchool && (
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
                    onChange={(value) =>
                      setSelectedPeriodId(value ? Number(value) : null)
                    }
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

            {cashflowSource && selectedSchool && selectedPeriodId && (
              <CashflowSheetPreview
                sheet={sheet}
                loading={sheetLoading}
                error={sheetError}
              />
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
              ? "Sau khi gửi, đề xuất chuyển Kế toán nhập số liệu. Có thể sửa lại trước khi Thủ quỹ xuất tiền; mỗi lần sửa sẽ chạy lại quy trình từ đầu."
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
