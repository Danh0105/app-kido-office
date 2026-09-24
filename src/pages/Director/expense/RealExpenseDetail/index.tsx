// pages/RealExpenseDetail/index.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import HeaderWithBack from "@/components/HeaderWithBack";
import Tabs from "./components/Tabs";
import Pagination from "./components/Pagination";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { subjectApi } from "@/service/subject.api";

import { expensePeriodApi } from "@/service/expensePeriod";
import { suggestApi } from "@/service/suggest";
import { revenueItemApi } from "@/service/revenueItem";
import { schoolExpenseItemApi } from "@/service/schoolExpenseItem";
import { managementExpenseItemApi } from "@/service/managementExpenseItem";
import ExpenseFormTable from "../component/expense/ExpenseFormTable";
import DevicePolicyTable from "../component/policy/DevicePolicyTable";
import CashPolicyTable from "../component/policy/CashPolicyTable";
import TtcsTable from "../component/policy/TtcsTable";
import PolicyFinanceTable from "../component/policy/PolicyFinanceTable";
import InputExpenseTable from "../component/expense/InputExpenseTable";
import PolicyYearListPage from "../PolicyYear";
import { InputExpenseRow } from "./type/InputExpenseRow";
import { RevenueRow } from "./type/RevenueRow";
import { ManagementRow } from "./type/ManagementRow";
import { getApiErrorMessage } from "@/utils/apiError";
import { hasRole } from "@/utils/auth";
import ExpenseSummary from "./components/ExpenseSummary";
import ExpenseSummaryTable from "./components/ExpenseSummaryTable";
import SubjectContractCard from "./components/SubjectContractCard";
import {
  getOtherCostGrossPrice,
  getOtherCostKey,
  getOtherCostTax,
  getPolicyOtherCosts,
} from "../utils/policyOtherCosts";

type CashPolicyRowType = {
  payer: string;
  cashPolicyAmount: string;
  otherAmount: string;
  paymentDate: string;
  note: string;
};

type RealExpenseDetailProps = {
  schoolExpenseId?: number | null;
  school?: any;
  selectedSchoolYear?: string;
  onSchoolYearChange?: (schoolYear: string) => void;
  onSchoolYearsChange?: (schoolYears: string[]) => void;
};
const invoiceTypeLabel = (r: any) =>
  r.invoiceType === "company"
    ? "Xuất HĐ Cty"
    : r.invoiceType === "student"
      ? "Xuất HĐ HS"
      : r.invoiceType === "none"
        ? "Không xuất"
        : r.invoiceType === "other"
          ? r.invoiceOther || "Khác"
          : "-";

const initialInputData: InputExpenseRow = {
  content: "",
  totalPeriods: 0,
  unitPrice: 0,
  studentCount: 0,
  monthsCount: 0,
  invoiced: false,
  invoiceLocked: false,
  invoiceType: "",
  invoiceOther: "",
  invoiceNumber: "",
  invoiceDate: "",
  invoiceUnit: "",
  invoiceNote: "",
  paidAmount: 0,
  paymentMethod: "",
  paymentDate: "",
};

const initialRevenueRow: RevenueRow = {
  subjectId: 0,
  invoiceAmount: 0,
  collectedDate: "",
  paidAmount: 0,
  paymentDate: "",
  remainingOutsideExpense: 0,
  payer: "",
  note: "",
};

const initialManagementRow: ManagementRow = {
  ql1UnitPrice: undefined,
  ql2UnitPrice: undefined,
  totalOutsideExpense: 0,
  paidAmount: 0,
  remainingOutsideExpense: 0,
  paymentDate: "",
  payer: "",
  note: "",
};

const ALL_HISTORY_EMPLOYEES = "__all__";

const padRows = <T extends Record<string, any>>(
  rows: T[],
  minLength: number,
  emptyRow: T,
) => {
  const nextRows = rows.map((row) => ({ ...row }));
  const targetLength = Math.max(minLength, 1);

  while (nextRows.length < targetLength) {
    nextRows.push({ ...emptyRow });
  }

  return nextRows.length ? nextRows : [{ ...emptyRow }];
};

export default function RealExpenseDetail({
  schoolExpenseId,
  school,
  selectedSchoolYear: controlledSchoolYear,
  onSchoolYearChange,
  onSchoolYearsChange,
}: RealExpenseDetailProps) {
  // Kế toán trưởng dùng đầy đủ giao diện nhập liệu như Kế toán/Giám đốc.
  // Dùng hasRole trực tiếp để tài khoản kiêm nhiệm vẫn giữ quyền KTT đối với
  // bảng "Chi Ngoài" đã được Sales Admin xác nhận.
  const isChief = hasRole("ketoan_truong");
  // Sales admin chỉnh sửa DUY NHẤT bảng "Chi Ngoài" — xem ManagementExpenseTable.
  const isSalesAdmin = hasRole("saleadmin", "salesadmin", "salesadmin_la");
  const [managementConfirmed, setManagementConfirmed] = useState(false);
  const [managementConfirmedByName, setManagementConfirmedByName] =
    useState<string | null>(null);
  const [managementConfirmedAt, setManagementConfirmedAt] = useState<
    string | null
  >(null);
  const [confirmingManagement, setConfirmingManagement] = useState(false);
  const { schoolId: schoolIdParam, schoolExpenseId: schoolExpenseIdParam } =
    useParams();
  const [tab, setTab] = useState<string>("expense");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [summaryTableData, setSummaryTableData] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const [keyword, setKeyword] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [periods, setPeriods] = useState<any[]>([]);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);

  const [data, setData] = useState<any[]>([]);

  const [editingItem, setEditingItem] = useState<any>(null);

  const [subjectId, setSubjectId] = useState<number>(0);

  const [localSchoolYear, setLocalSchoolYear] = useState("");
  const selectedSchoolYear = controlledSchoolYear ?? localSchoolYear;
  const setSelectedSchoolYear = onSchoolYearChange ?? setLocalSchoolYear;
  const [subTab, setSubTab] = useState<"expense" | "cash-policy">("expense");
  const [suggestStats, setSuggestStats] = useState<Record<number, any>>({});

  const [inputRows, setInputRows] = useState<InputExpenseRow[]>([
    initialInputData,
  ]);
  const [savedRevenues, setSavedRevenues] = useState<any[]>([]);
  const [savedSchoolItems, setSavedSchoolItems] = useState<any[]>([]);
  const [savedMgmtItems, setSavedMgmtItems] = useState<any[]>([]);
  const [showSavedData, setShowSavedData] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryEmployee, setSelectedHistoryEmployee] = useState(
    ALL_HISTORY_EMPLOYEES,
  );
  const [routeSchool, setRouteSchool] = useState<any>(null);
  const [routeSchoolExpenseId, setRouteSchoolExpenseId] = useState<
    number | null
  >(null);

  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([
    initialRevenueRow,
  ]);

  const [managementRows, setManagementRows] = useState<ManagementRow[]>([
    initialManagementRow,
  ]);

  const pageSize = 5;
  const resolvedSchoolExpenseId =
    schoolExpenseId ??
    routeSchoolExpenseId ??
    Number(schoolExpenseIdParam || 0) ??
    null;
  const resolvedSchool = school || routeSchool;
  const resolvedSchoolId =
    Number(resolvedSchool?.id || schoolIdParam || 0) || null;

  // Trạng thái khoá bảng "Chi Ngoài" — mọi vai trò xem trang này đều cần biết
  // (để hiện badge đã khoá và disable form), không chỉ salesadmin/kế toán trưởng.
  useEffect(() => {
    if (!resolvedSchoolExpenseId) {
      setManagementConfirmed(false);
      setManagementConfirmedByName(null);
      setManagementConfirmedAt(null);
      return;
    }
    let active = true;
    schoolExpenseApi
      .getById(resolvedSchoolExpenseId)
      .then((res: any) => {
        if (!active) return;
        setManagementConfirmed(!!res?.managementExpenseConfirmed);
        setManagementConfirmedByName(
          res?.managementExpenseConfirmedByName || null,
        );
        setManagementConfirmedAt(res?.managementExpenseConfirmedAt || null);
      })
      .catch(() => {
        if (!active) return;
        setManagementConfirmed(false);
        setManagementConfirmedByName(null);
        setManagementConfirmedAt(null);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSchoolExpenseId]);

  const handleConfirmManagementExpense = async () => {
    if (!resolvedSchoolExpenseId) return;
    setConfirmingManagement(true);
    try {
      const res: any = await schoolExpenseApi.confirmManagementExpense(
        resolvedSchoolExpenseId,
      );
      setManagementConfirmed(true);
      setManagementConfirmedByName(
        res?.managementExpenseConfirmedByName || null,
      );
      setManagementConfirmedAt(res?.managementExpenseConfirmedAt || null);
      toast.success('Đã xác nhận bảng "Chi Ngoài" — bảng đã được khoá');
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xác nhận thất bại"));
    } finally {
      setConfirmingManagement(false);
    }
  };

  // FETCH PERIODS
  const fetchPeriods = async () => {
    try {
      const res = await expensePeriodApi.getAll({
        page: 1,
        limit: 100,
        ...(resolvedSchoolId ? { schoolId: resolvedSchoolId } : {}),
      });

      setPeriods(res || []);
    } catch (error) {
      console.log(error);
    }
  };

  // FETCH SUBJECTS
  const fetchSubjects = async (schoolId: number) => {
    try {
      const res = await subjectApi.getFinanceBySchool(schoolId);
      console.log("Fetched subjects:", res);
      const subjectList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];

      setAllSubjects(subjectList);
    } catch (error) {
      console.log(error);
      setAllSubjects([]);
    }
  };

  useEffect(() => {
    if (resolvedSchoolId) {
      fetchSubjects(resolvedSchoolId);
    } else {
      setAllSubjects([]);
    }
    fetchPeriods();
  }, [resolvedSchoolId]);

  const filteredSubjects = useMemo(
    () =>
      allSubjects
        .filter(
          (subject: any) =>
            !selectedSchoolYear || subject.schoolYear === selectedSchoolYear,
        )
        .map((subject: any) => ({
          ...subject,
          expenseItems: (subject.expenseItems || []).filter((item: any) => {
            const itemSchoolYear =
              item.subject?.schoolYear || subject.schoolYear;

            return !selectedSchoolYear || itemSchoolYear === selectedSchoolYear;
          }),
        })),
    [allSubjects, selectedSchoolYear],
  );

  useEffect(() => {
    setData(filteredSubjects);
    setSubjects(filteredSubjects);
    setCurrentPage(1);
  }, [filteredSubjects]);

  useEffect(() => {
    if (
      tab.startsWith("subject-") &&
      !filteredSubjects.some((subject: any) => `subject-${subject.id}` === tab)
    ) {
      setTab("summary");
      setSubjectId(0);
    }
  }, [filteredSubjects, tab]);

  useEffect(() => {
    const fetchRouteExpense = async () => {
      const routeExpenseId = Number(schoolExpenseIdParam || 0);
      if (!routeExpenseId || schoolExpenseId || school) return;

      try {
        const detail = await schoolExpenseApi.getById(routeExpenseId);
        setRouteSchoolExpenseId(Number(detail?.id || routeExpenseId));
        setRouteSchool(detail?.school || null);
      } catch (error) {
        console.log(error);
        setRouteSchoolExpenseId(routeExpenseId);
      }
    };

    fetchRouteExpense();
  }, [schoolExpenseIdParam, schoolExpenseId, school]);

  useEffect(() => {
    suggestApi
      .getStatsByPolicy()
      .then((res: any[]) => {
        const map: Record<number, any> = {};
        res.forEach((item: any) => {
          if (item.policyId) map[item.policyId] = item;
        });
        setSuggestStats(map);
      })
      .catch(() => {});
  }, []);

  // MONEY FORMAT
  const money = (value: number) => {
    return Number(value || 0).toLocaleString("vi-VN");
  };

  const loadSummary = async () => {
    if (!resolvedSchoolExpenseId) {
      setSummary(null);
      setSummaryError("Chưa có phiếu thu chi cho kỳ đã chọn");
      return;
    }

    setSummaryLoading(true);
    setSummaryError("");
    setSummaryTableData(null);
    try {
      const currentSummary = await schoolExpenseApi.getSummary(
        resolvedSchoolExpenseId,
      );
      setSummary(currentSummary);

      const expenseResponse = await schoolExpenseApi.getAll({
        schoolId: resolvedSchoolId,
        page: 1,
        limit: 100,
      });
      const expenseRecords = Array.isArray(expenseResponse)
        ? expenseResponse
        : Array.isArray(expenseResponse?.data)
          ? expenseResponse.data
          : [];
      const schoolRecords = expenseRecords.filter(
        (record: any) =>
          !resolvedSchoolId ||
          Number(record.schoolId ?? record.school?.id) === resolvedSchoolId,
      );
      const summaryResults = await Promise.allSettled(
        schoolRecords.map(async (record: any) => ({
          record,
          summary: await schoolExpenseApi.getSummary(Number(record.id)),
        })),
      );
      const summaries = summaryResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const merged = {
        expenseItems: [] as any[],
        revenueItems: [] as any[],
        schoolExpenseItems: [] as any[],
        managementExpenseItems: [] as any[],
      };

      summaries.forEach(({ record, summary: response }) => {
        const payload =
          response?.data && !Array.isArray(response.data)
            ? response.data
            : response || {};
        const source = payload.summary || payload;
        const period =
          record.period ||
          record.expensePeriod ||
          source.period ||
          source.expensePeriod ||
          {};
        const periodInfo = {
          id: period.id ?? record.periodId,
          month: period.month,
          year: period.year,
          name:
            period.name ||
            (period.month && period.year
              ? `${String(period.month).padStart(2, "0")}/${period.year}`
              : ""),
        };

        (
          [
            "expenseItems",
            "revenueItems",
            "schoolExpenseItems",
            "managementExpenseItems",
          ] as const
        ).forEach((key) => {
          const items = Array.isArray(source[key]) ? source[key] : [];
          merged[key].push(
            ...items.map((item: any) => ({
              ...item,
              summaryPeriod: periodInfo,
              schoolExpenseId: record.id,
            })),
          );
        });
      });

      setSummaryTableData(
        summaries.length ? merged : currentSummary,
      );
    } catch (error) {
      setSummaryError(getApiErrorMessage(error, "Không thể tải tổng hợp thu chi"));
      setSummaryTableData(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "summary") loadSummary();
  }, [tab, resolvedSchoolExpenseId]);

  const normalizeHistory = (history: any) => {
    const list = Array.isArray(history)
      ? history
      : Array.isArray(history?.data)
      ? history.data
      : [];

    return [...list].sort((a: any, b: any) => {
      const left = new Date(a?.createdAt || 0).getTime();
      const right = new Date(b?.createdAt || 0).getTime();
      return right - left;
    });
  };

  const parseHistoryPayload = (payload: any) => {
    if (!payload) return null;
    if (typeof payload !== "string") return payload;

    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  };

  const historyFieldLabels: Record<string, string> = {
    id: "ID",
    rowIndex: "Dòng",
    subjectId: "Môn",
    content: "Nội dung",
    totalPeriods: "Số tiết",
    studentCount: "HS",
    monthsCount: "Tháng",
    unitPrice: "ĐG học phí",
    teacherUnitPrice: "ĐG giáo viên",
    taxUnitPrice: "ĐG thuế",
    csvcUnitPrice: "ĐG CSVC",
    ql1UnitPrice: "ĐG QL1",
    ql2UnitPrice: "ĐG QL2",
    invoiceAmount: "Tiền HĐ",
    schoolExpenseAmount: "Chi trường",
    totalOutside: "Chi ngoài",
    remaining: "Còn lại",
    paidAmount: "Đã thu/chi",
    invoiced: "Xuất HĐ",
    invoiceType: "Loại HĐ",
    invoiceOther: "HĐ khác",
    invoiceNumber: "Số HĐ",
    invoiceDate: "Ngày HĐ",
    paymentMethod: "PT thanh toán",
    paymentDate: "Ngày thanh toán",
    expenseDate: "Ngày chi",
    payer: "Người thực hiện",
    note: "Ghi chú",
  };

  const historySectionLabels: Record<string, string> = {
    revenueItems: "Doanh thu",
    revenueItem: "Doanh thu",
    schoolExpenseItems: "Chi trường",
    schoolExpenseItem: "Chi trường",
    managementExpenseItems: "Chi ngoài",
    managementExpenseItem: "Chi ngoài",
  };

  const historyActionMap: Record<string, { label: string; color: string }> = {
    CREATE: { label: "Tạo mới", color: "bg-green-100 text-green-700" },
    UPDATE: { label: "Cập nhật", color: "bg-blue-100 text-blue-700" },
    DELETE: { label: "Xoá", color: "bg-red-100 text-red-700" },
    SAVE_ALL: { label: "Lưu tất cả", color: "bg-indigo-100 text-indigo-700" },
    CONFIRM_MANAGEMENT_EXPENSE: {
      label: "Xác nhận & khoá Chi Ngoài",
      color: "bg-emerald-100 text-emerald-700",
    },
  };

  const hiddenHistoryFields = new Set([
    "createdAt",
    "updatedAt",
    "deletedAt",
    "schoolExpenseId",
  ]);

  const formatHistoryValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Có" : "Không";
    if (typeof value === "number") {
      return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
    }
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return new Date(value).toLocaleDateString("vi-VN");
      }
      return value;
    }
    return JSON.stringify(value);
  };

  const formatHistoryKey = (key: string) => historyFieldLabels[key] || key;

  const getHistoryEmployeeName = (history: any) =>
    history?.updatedByName ||
    history?.updatedBy?.name ||
    history?.employee?.name ||
    "Hệ thống";

  const getHistoryActionInfo = (action: string) =>
    historyActionMap[action] || {
      label: action || "Thao tác",
      color: "bg-slate-100 text-slate-700",
    };

  const formatHistoryTime = (createdAt: any) =>
    createdAt
      ? new Date(createdAt).toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const renderHistoryRecord = (record: any, index = 0) => {
    const entries = Object.entries(record || {}).filter(
      ([key]) => !hiddenHistoryFields.has(key),
    );

    if (!entries.length) {
      return (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
          Không có dữ liệu
        </div>
      );
    }

    const title =
      record?.content ||
      record?.payer ||
      (record?.rowIndex !== undefined
        ? `Dòng ${Number(record.rowIndex) + 1}`
        : `Dòng ${index + 1}`);

    return (
      <div
        key={record?.id ?? record?.rowIndex ?? index}
        className="rounded-xl border border-slate-100 bg-slate-50 p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-800">{title}</p>
          {record?.id && (
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">
              #{record.id}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-slate-100 bg-white px-3 py-2"
            >
              <p className="text-[11px] font-bold uppercase text-slate-400">
                {formatHistoryKey(key)}
              </p>
              <p className="mt-0.5 break-words text-sm font-semibold text-slate-800">
                {formatHistoryValue(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHistoryPayload = (payload: any, emptyText: string) => {
    const parsed = parseHistoryPayload(payload);
    if (!parsed) {
      return (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
          {emptyText}
        </p>
      );
    }

    if (Array.isArray(parsed)) {
      return (
        <div className="space-y-2">
          {parsed.map((item, index) =>
            typeof item === "object" && item !== null ? (
              renderHistoryRecord(item, index)
            ) : (
              <p
                key={`${item}-${index}`}
                className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                {formatHistoryValue(item)}
              </p>
            ),
          )}
        </div>
      );
    }

    if (typeof parsed !== "object") {
      return (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          {formatHistoryValue(parsed)}
        </p>
      );
    }

    const entries = Object.entries(parsed);
    const scalarEntries = entries.filter(
      ([, value]) => value === null || typeof value !== "object",
    );
    const objectEntries = entries.filter(
      ([, value]) => value && typeof value === "object",
    );

    return (
      <div className="space-y-3">
        {scalarEntries.length > 0 &&
          renderHistoryRecord(Object.fromEntries(scalarEntries))}

        {objectEntries.map(([key, value]) => (
          <div key={key} className="space-y-2">
            <p className="text-xs font-black uppercase text-slate-500">
              {historySectionLabels[key] || formatHistoryKey(key)}
              {Array.isArray(value) ? ` (${value.length})` : ""}
            </p>

            {Array.isArray(value) ? (
              value.length > 0 ? (
                value.map((item: any, index: number) =>
                  typeof item === "object" && item !== null ? (
                    renderHistoryRecord(item, index)
                  ) : (
                    <p
                      key={`${key}-${index}`}
                      className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      {formatHistoryValue(item)}
                    </p>
                  ),
                )
              ) : (
                <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
                  Không có dữ liệu
                </p>
              )
            ) : (
              renderHistoryPayload(value, "Không có dữ liệu")
            )}
          </div>
        ))}
      </div>
    );
  };

  // TOTALS
  const totalRevenue = useMemo(() => {
    return data.reduce(
      (sum: number, schoolExpense: any) =>
        sum + Number(schoolExpense.totalRevenue || 0),
      0,
    );
  }, [data]);

  const totalExpense = useMemo(() => {
    return data.reduce(
      (sum: number, schoolExpense: any) =>
        sum + Number(schoolExpense.totalExpense || 0),
      0,
    );
  }, [data]);

  const totalCashPolicy = useMemo(() => {
    return data.reduce(
      (sum: number, schoolExpense: any) =>
        sum + Number(schoolExpense.totalCashPolicy || 0),
      0,
    );
  }, [data]);

  const addRevenueRow = () => {
    setRevenueRows((prev) => [...prev, { ...initialRevenueRow }]);
  };

  const addManagementRow = () => {
    setManagementRows((prev) => [...prev, { ...initialManagementRow }]);
  };

  const updateInputRow = (
    index: number,
    field: keyof InputExpenseRow,
    value: any,
  ) => {
    setInputRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addInputRow = () => {
    const fee = Number(activeSubject?.policies?.[0]?.data?.fee || 0);

    setInputRows((prev) => [
      ...prev,
      {
        ...initialInputData,
        unitPrice: fee,
      },
    ]);
    setRevenueRows((prev) => [...prev, { ...initialRevenueRow }]);
    setManagementRows((prev) => [...prev, { ...initialManagementRow }]);
  };

  const removeInputRow = (index: number) => {
    setInputRows((prev) => prev.filter((_, i) => i !== index));
    setRevenueRows((prev) => {
      const nextRows = prev.filter((_, i) => i !== index);
      return nextRows.length ? nextRows : [{ ...initialRevenueRow }];
    });
    setManagementRows((prev) => {
      const nextRows = prev.filter((_, i) => i !== index);
      return nextRows.length ? nextRows : [{ ...initialManagementRow }];
    });
  };

  const removeRevenueRow = (index: number) => {
    setRevenueRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRevenueRow = (
    index: number,
    field: keyof RevenueRow,
    value: string | number,
  ) => {
    setRevenueRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const updateManagementRow = (
    index: number,
    field: keyof ManagementRow,
    value: ManagementRow[keyof ManagementRow],
  ) => {
    setManagementRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const removeManagementRow = (index: number) => {
    setManagementRows((prev) => prev.filter((_, i) => i !== index));
  };

  // LOAD SAVED EXPENSE DATA
  const loadExpenseData = async (subId: number) => {
    if (!resolvedSchoolExpenseId || !subId) return;

    try {
      const [revenues, schoolItems, mgmtItems, history] = await Promise.all([
        revenueItemApi.getAll({
          schoolExpenseId: resolvedSchoolExpenseId,
          subjectId: subId,
        }),
        schoolExpenseItemApi.getAll({
          schoolExpenseId: resolvedSchoolExpenseId,
          subjectId: subId,
        }),
        managementExpenseItemApi.getAll({
          schoolExpenseId: resolvedSchoolExpenseId,
          subjectId: subId,
        }),
        schoolExpenseApi
          .getHistory(resolvedSchoolExpenseId, { subjectId: subId })
          .catch(() => []),
      ]);

      setSavedRevenues(revenues || []);
      setSavedSchoolItems(schoolItems || []);
      setHistoryList(normalizeHistory(history));
      setSavedMgmtItems(mgmtItems || []);

      const loadedPolicyData =
        subjects.find((s: any) => s.id === subId)?.policies?.[0]?.data || {};
      const loadedSubject = subjects.find((s: any) => s.id === subId);
      const policyOtherCosts = getPolicyOtherCosts(loadedSubject);
      const fee = Number(loadedPolicyData?.fee || 0);

      const nextInputRows =
        revenues?.length > 0
          ? revenues.map((r: any) => ({
              content: r.content || "",
              totalPeriods: r.totalPeriods || 0,
              unitPrice: r.unitPrice || fee,
              studentCount: r.studentCount || 0,
              monthsCount: r.monthsCount ?? 0,
              invoiced: r.invoiced || false,
              invoiceType: r.invoiceType || (r.invoiced ? "company" : ""),
              invoiceOther: r.invoiceOther || "",
              invoiceNumber: r.invoiceNumber || "",
              invoiceDate: r.invoiceDate || "",
              paidAmount: r.paidAmount || 0,
              paymentMethod: r.paymentMethod || "",
              paymentDate: r.paymentDate || "",
            }))
          : [{ ...initialInputData, unitPrice: fee }];

      setInputRows(nextInputRows);

      if (schoolItems?.length > 0) {
        setRevenueRows(
          padRows(
            schoolItems.map((r: any) => ({
              subjectId: r.subjectId || subId,
              invoiceAmount: r.schoolExpenseAmount || 0,
              teacherUnitPrice:
                r.teacherUnitPrice ?? r.giaovien ?? loadedPolicyData.giaovien,
              taxUnitPrice:
                r.taxUnitPrice ??
                r.thue ??
                r.tax ??
                loadedPolicyData.thue ??
                loadedPolicyData.tax,
              csvcUnitPrice: r.csvcUnitPrice ?? r.csvc ?? loadedPolicyData.csvc,
              collectedDate: r.expenseDate || "",
              paidAmount: r.paidAmount || 0,
              paymentDate: r.expenseDate || "",
              remainingOutsideExpense: r.remaining || 0,
              payer: r.payer || "",
              note: r.note || "",
            })),
            nextInputRows.length,
            initialRevenueRow,
          ),
        );
      } else {
        setRevenueRows(padRows([], nextInputRows.length, initialRevenueRow));
      }

      if (mgmtItems?.length > 0) {
        setManagementRows(
          padRows(
            mgmtItems.map((r: any) => {
              const savedOtherCosts = Array.isArray(r.otherCosts)
                ? r.otherCosts
                : [];
              const savedCostByPolicyKey = policyOtherCosts.map(
                (policyCost, policyCostIndex) => {
                  const policyId = String(policyCost.id ?? "");
                  const policyName = String(policyCost.name ?? "")
                    .trim()
                    .toLocaleLowerCase("vi-VN");
                  const savedCost =
                    savedOtherCosts.find(
                      (item: any) =>
                        policyId && String(item?.id ?? "") === policyId,
                    ) ??
                    savedOtherCosts.find(
                      (item: any) =>
                        policyName &&
                        String(item?.name ?? "")
                          .trim()
                          .toLocaleLowerCase("vi-VN") === policyName,
                    ) ??
                    savedOtherCosts[policyCostIndex];

                  return {
                    key: getOtherCostKey(policyCost, policyCostIndex),
                    savedCost,
                  };
                },
              );

              return {
                ql1UnitPrice: r.ql1UnitPrice,
                ql1Tax: r.ql1Tax,
                ql2UnitPrice: r.ql2UnitPrice,
                ql2Tax: r.ql2Tax,
                otherCostUnitPrices: Object.fromEntries(
                  savedCostByPolicyKey
                    .filter(({ savedCost }) => savedCost)
                    .map(({ key, savedCost }) => [
                      key,
                      getOtherCostGrossPrice(savedCost),
                    ]),
                ),
                otherCostTaxes: Object.fromEntries(
                  savedCostByPolicyKey
                    .filter(
                      ({ savedCost }) =>
                        savedCost?.tax !== undefined &&
                        savedCost?.tax !== null,
                    )
                    .map(({ key, savedCost }) => [
                      key,
                      getOtherCostTax(savedCost),
                    ]),
                ),
                totalOutsideExpense: r.totalOutside || 0,
                paidAmount: r.paidAmount || 0,
                remainingOutsideExpense: r.remaining || 0,
                paymentDate: r.expenseDate || "",
                payer: r.payer || "",
                note: r.note || "",
              };
            }),
            nextInputRows.length,
            initialManagementRow,
          ),
        );
      } else {
        setManagementRows(
          padRows([], nextInputRows.length, initialManagementRow),
        );
      }
    } catch (error: any) {
      console.error("Failed to load expense data", error);
      toast.error(getApiErrorMessage(error, "Không thể tải dữ liệu thu chi"));
    }
  };

  // SUBMIT EXPENSE
  const handleSubmit = async () => {
    if (!resolvedSchoolExpenseId || !activeSubjectId) {
      toast.error("Vui lòng chọn môn học");
      return;
    }

    try {
      setLoading(true);

      const policy = activeSubject?.policies?.[0];
      const policyData = policy?.data || {};
      const ttcs = policyData.ttcs?.[0] || {};

      await schoolExpenseApi.saveAll(resolvedSchoolExpenseId, {
        subjectId: activeSubjectId,
        revenueItems: inputRows.map((row, index) => ({
          rowIndex: index,
          subjectId: activeSubjectId,
          content: (row.content || "").slice(0, 500),
          totalPeriods: Number(row.totalPeriods || 0),
          studentCount: Number(row.studentCount || 0),
          monthsCount: Number(row.monthsCount ?? 0),
          unitPrice: Number(row.unitPrice || 0),
          invoiced: row.invoiced || false,
          invoiceType: row.invoiceType || undefined,
          invoiceOther:
            row.invoiceType === "other" ? row.invoiceOther : undefined,
          invoiceNumber:
            row.invoiceType === "company"
              ? row.invoiceNumber || undefined
              : undefined,
          invoiceDate: row.invoiceDate || undefined,
          paidAmount: Number(row.paidAmount || 0),
          paymentMethod: row.paymentMethod || undefined,
          paymentDate: row.paymentDate || undefined,
        })),
        schoolExpenseItems: revenueRows.map((row, index) => {
          const inputRow = inputRows[index] || inputRows[0] || initialInputData;

          return {
            rowIndex: index,
            subjectId: activeSubjectId,
            totalPeriods: Number(inputRow.totalPeriods || 0),
            studentCount: Number(inputRow.studentCount || 0),
            monthsCount: Number(inputRow.monthsCount ?? 0),
            teacherUnitPrice: Number(
              row.teacherUnitPrice ?? policyData.giaovien ?? 0,
            ),
            taxUnitPrice: Number(
              row.taxUnitPrice ?? policyData.thue ?? policyData.tax ?? 0,
            ),
            csvcUnitPrice: Number(row.csvcUnitPrice ?? policyData.csvc ?? 0),
            paidAmount: Number(row.paidAmount || 0),
            expenseDate: row.paymentDate || undefined,
            payer: row.payer || "",
            note: row.note || "",
          };
        }),
        managementExpenseItems: managementRows.map((row, index) => {
          const inputRow = inputRows[index] || inputRows[0] || initialInputData;

          return {
            rowIndex: index,
            subjectId: activeSubjectId,
            totalPeriods: Number(inputRow.totalPeriods || 0),
            studentCount: Number(inputRow.studentCount || 0),
            monthsCount: Number(inputRow.monthsCount ?? 0),
            ql1UnitPrice: Number(
              row.ql1UnitPrice ??
                Number(ttcs.ql1Percent || 0),
            ),
            ql1Tax: Number(row.ql1Tax ?? ttcs.ql1Tax ?? 0),
            ql2UnitPrice: Number(
              row.ql2UnitPrice ??
                Number(ttcs.ql2Percent || 0),
            ),
            ql2Tax: Number(row.ql2Tax ?? ttcs.ql2Tax ?? 0),
            otherCosts: getPolicyOtherCosts(activeSubject).map(
              (item, otherCostIndex) => {
                const key = getOtherCostKey(item, otherCostIndex);
                return {
                  id: item.id,
                  name: item.name,
                  unitPrice: Number(
                    row.otherCostUnitPrices?.[key] ??
                      getOtherCostGrossPrice(item),
                  ),
                  tax: Number(
                    row.otherCostTaxes?.[key] ?? getOtherCostTax(item),
                  ),
                };
              },
            ),
            invoiceAmount: 0,
            paidAmount: Number(row.paidAmount || 0),
            expenseDate: row.paymentDate || undefined,
            payer: row.payer || "",
            note: row.note || "",
          };
        }),
      });

      toast.success("Lưu dữ liệu thành công");
      await loadExpenseData(activeSubjectId);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không thể lưu dữ liệu thu chi"));
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = async () => {
    if (!resolvedSchoolExpenseId) {
      toast.error("Không tìm thấy kỳ thu chi");
      return;
    }

    try {
      setHistoryLoading(true);
      const history = await schoolExpenseApi.getHistory(
        resolvedSchoolExpenseId,
      );
      console.log("handleViewHistory", history);
      setHistoryList(normalizeHistory(history));
      setShowHistory(true);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không thể tải lịch sử thao tác"));
    } finally {
      setHistoryLoading(false);
    }
  };

  // CANCEL EDIT
  const handleCancelEdit = () => {
    setEditingItem(null);

    setRevenueRows([initialRevenueRow]);
  };

  // CASH POLICY
  /*   const updateCashPolicyRow = (
    index: number,
    field: keyof CashPolicyRowType,
    value: string,
  ) => {
    setCashPolicyRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }; */
  /* 
  const removeCashPolicyRow = (index: number) => {
    setCashPolicyRows((prev) => prev.filter((_, i) => i !== index));
  }; */

  // FILTERED ITEMS
  const filteredExpenseItems = useMemo(() => {
    const items =
      data?.flatMap((schoolExpense: any) => schoolExpense.expenseItems || []) ||
      [];

    return items.filter((item: any) => {
      const keywordLower = keyword.toLowerCase();

      return (
        item.subject?.name?.toLowerCase().includes(keywordLower) ||
        item.payer?.toLowerCase().includes(keywordLower) ||
        item.note?.toLowerCase().includes(keywordLower)
      );
    });
  }, [data, keyword]);

  const totalPages = Math.ceil(filteredExpenseItems.length / pageSize);
  const activeSubjectId = tab.startsWith("subject-")
    ? Number(tab.replace("subject-", ""))
    : null;

  const activeSubject = subjects.find((s: any) => s.id === activeSubjectId);
  const activeOtherCosts = getPolicyOtherCosts(activeSubject);
  const activeTtcs = activeSubject?.policies?.[0]?.data?.ttcs?.[0] || {};
  useEffect(() => {
    if (activeSubjectId) {
      loadExpenseData(activeSubjectId);
    } else {
      const fee = Number(activeSubject?.policies?.[0]?.data?.fee || 0);
      setInputRows([{ ...initialInputData, unitPrice: fee || 0 }]);
      setRevenueRows([initialRevenueRow]);
      setManagementRows([initialManagementRow]);
    }
  }, [activeSubjectId]);

  useEffect(() => {
    if (activeSubjectId && resolvedSchoolExpenseId) {
      loadExpenseData(activeSubjectId);
    }
  }, [activeSubjectId, resolvedSchoolExpenseId]);

  const schoolYears = useMemo(() => {
    const uniqueYears = [
      ...new Set(
        allSubjects
          .map((subject: any) => subject.schoolYear)
          .filter((schoolYear): schoolYear is string => Boolean(schoolYear)),
      ),
    ];

    return uniqueYears.sort((firstYear, secondYear) => {
      const firstStartYear = Number(firstYear.match(/\d{4}/)?.[0] || 0);
      const secondStartYear = Number(secondYear.match(/\d{4}/)?.[0] || 0);

      return secondStartYear - firstStartYear;
    });
  }, [allSubjects]);

  useEffect(() => {
    onSchoolYearsChange?.(schoolYears);

    if (!schoolYears.length) {
      if (selectedSchoolYear) setSelectedSchoolYear("");
      return;
    }

    if (!schoolYears.includes(selectedSchoolYear)) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentStartYear =
        today.getMonth() + 1 >= 8 ? currentYear : currentYear - 1;
      const currentSchoolYear = schoolYears.find((schoolYear) => {
        const years = schoolYear.match(/\d{4}/g)?.map(Number) || [];

        return (
          years[0] === currentStartYear &&
          (years[1] || years[0]) === currentStartYear + 1
        );
      });

      setSelectedSchoolYear(currentSchoolYear || schoolYears[0]);
    }
  }, [
    onSchoolYearsChange,
    schoolYears,
    selectedSchoolYear,
    setSelectedSchoolYear,
  ]);

  const historyEmployeeGroups = useMemo(() => {
    const groupMap = new Map<string, any[]>();

    historyList.forEach((item) => {
      const employeeName = getHistoryEmployeeName(item);
      groupMap.set(employeeName, [...(groupMap.get(employeeName) || []), item]);
    });

    return Array.from(groupMap.entries()).map(([employeeName, items]) => ({
      employeeName,
      items,
    }));
  }, [historyList]);

  const selectedHistoryGroups = useMemo(() => {
    if (selectedHistoryEmployee === ALL_HISTORY_EMPLOYEES) {
      return historyEmployeeGroups;
    }

    return historyEmployeeGroups.filter(
      (group) => group.employeeName === selectedHistoryEmployee,
    );
  }, [historyEmployeeGroups, selectedHistoryEmployee]);

  const selectedHistoryCount = selectedHistoryGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  );

  useEffect(() => {
    if (
      selectedHistoryEmployee !== ALL_HISTORY_EMPLOYEES &&
      !historyEmployeeGroups.some(
        (group) => group.employeeName === selectedHistoryEmployee,
      )
    ) {
      setSelectedHistoryEmployee(ALL_HISTORY_EMPLOYEES);
    }
  }, [historyEmployeeGroups, selectedHistoryEmployee]);

  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Chi tiết thu chi" />

      <div className="space-y-5 pb-32">
        {/* STEP 2: CHỌN MÔN */}
        <Tabs
          tab={tab}
          setTab={setTab}
          subjects={subjects}
          setSubjectId={setSubjectId}
        />

        {tab === "summary" && (
          <div className="space-y-5">
            <ExpenseSummary
              data={summary}
              loading={summaryLoading}
              error={summaryError}
              onRetry={loadSummary}
              school={resolvedSchool}
            />
            {!summaryLoading && !summaryError && (
              <ExpenseSummaryTable
                data={summaryTableData || summary}
                subjects={allSubjects}
                school={resolvedSchool}
              />
            )}
          </div>
        )}

        {tab === "policy-year" && (
          <PolicyYearListPage
            key={`${resolvedSchoolId || "school"}-${
              selectedSchoolYear || "school-year"
            }`}
            schoolId={resolvedSchoolId}
            schoolName={resolvedSchool?.name || "Trường đã chọn"}
            schoolYear={selectedSchoolYear}
            databaseSubjects={subjects}
          />
        )}

        {/* SUBJECT */}
        {tab.startsWith("subject-") && activeSubject && (
          <div className="space-y-5">
            {/* Hợp đồng của chính sách môn — hiện ở mọi tab môn học. */}
            <SubjectContractCard
              policy={activeSubject.policies?.[0]}
              subjectName={activeSubject.catalog?.name || activeSubject.name}
            />

            {/* POLICY OVERVIEW */}
            {!!activeSubject.policies?.length && (
              <div className="space-y-6">
                <PolicyFinanceTable
                  policy={activeSubject.policies?.[0]}
                  classCount={activeSubject.classCount}
                />

                <TtcsTable policy={activeSubject.policies?.[0]} />

                <CashPolicyTable policy={activeSubject.policies?.[0]} />

                <DevicePolicyTable policy={activeSubject.policies?.[0]} />

                {/* SUGGEST LIST */}
                {(() => {
                  const policyId = activeSubject.policies?.[0]?.id;
                  const stats = policyId ? suggestStats[policyId] : null;
                  if (!stats?.suggests?.length) return null;

                  return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                        <span className="text-lg font-bold text-orange-700">
                          📝 Đề xuất ngoài chính sách({stats.total})
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-base">
                          <thead>
                            <tr className="bg-orange-500 text-white">
                              <th className="px-5 py-4 text-left text-sm font-bold uppercase">
                                #
                              </th>

                              <th className="px-5 py-4 text-left text-sm font-bold uppercase">
                                Nội dung
                              </th>

                              <th className="px-5 py-4 text-left text-sm font-bold uppercase">
                                Thành phần
                              </th>

                              <th className="px-5 py-4 text-left text-sm font-bold uppercase">
                                Diễn giải
                              </th>

                              <th className="px-5 py-4 text-left text-sm font-bold uppercase">
                                Ngày
                              </th>

                              <th className="px-5 py-4 text-left text-sm font-bold uppercase">
                                File
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {stats.suggests.map((sg: any, idx: number) => (
                              <tr
                                key={sg.id}
                                className={
                                  idx % 2 === 0 ? "bg-orange-50/40" : "bg-white"
                                }
                              >
                                <td className="px-5 py-4 text-base font-semibold text-slate-600">
                                  {sg.id}
                                </td>

                                <td className="px-5 py-4 text-base font-bold text-slate-900">
                                  {sg.content}
                                </td>

                                <td className="px-5 py-4 text-base font-semibold text-slate-800">
                                  {sg.component || "-"}
                                </td>

                                <td className="px-5 py-4 text-base font-semibold text-slate-800">
                                  {sg.description || "-"}
                                </td>

                                <td className="px-5 py-4 text-base font-semibold text-slate-700 whitespace-nowrap">
                                  {sg.issueDate || "-"}
                                </td>

                                <td className="px-5 py-4 text-base font-semibold">
                                  {sg.fileUrl ? (
                                    <a
                                      href={`https://sales.kidoedu.vn${sg.fileUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-600 font-bold hover:underline"
                                    >
                                      📎 Xem
                                    </a>
                                  ) : (
                                    <span className="text-slate-500 font-semibold">
                                      -
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* SUB TABS */}

            <div className="space-y-5">
              {!isSalesAdmin && <InputExpenseTable
                rows={inputRows}
                defaultFee={Number(
                  activeSubject?.policies?.[0]?.data?.fee || 0,
                )}
                onUpdate={updateInputRow}
                onAdd={addInputRow}
                onRemove={removeInputRow}
                classCount={activeSubject.classCount}
              />}
              {!isSalesAdmin && <ExpenseFormTable
                inputRows={inputRows}
                revenueRows={revenueRows}
                managementRows={managementRows}
                subjects={activeSubject}
                editingItem={editingItem}
                loading={loading}
                addRevenueRow={addRevenueRow}
                addManagementRow={addManagementRow}
                removeRevenueRow={removeRevenueRow}
                removeManagementRow={removeManagementRow}
                updateInputRow={updateInputRow}
                updateRevenueRow={updateRevenueRow}
                updateManagementRow={updateManagementRow}
                handleSubmit={handleSubmit}
                handleCancelEdit={handleCancelEdit}
                handleViewHistory={handleViewHistory}
                historyLoading={historyLoading}
                managementConfirmed={managementConfirmed}
                managementReadOnly={managementConfirmed && !isChief}
                managementConfirmedByName={managementConfirmedByName}
                managementConfirmedAt={managementConfirmedAt}
                historyCount={historyList.length}
                isChief={isChief}
              />}

              {/*
                Sales admin: chỉnh sửa DUY NHẤT bảng "Chi Ngoài" + nút xác nhận.
                Kế toán trưởng đi qua form đầy đủ phía trên giống Kế toán/Giám đốc.
              */}
              {isSalesAdmin && <ExpenseFormTable
                inputRows={inputRows}
                revenueRows={revenueRows}
                managementRows={managementRows}
                subjects={activeSubject}
                editingItem={editingItem}
                loading={loading}
                addRevenueRow={addRevenueRow}
                addManagementRow={addManagementRow}
                removeRevenueRow={removeRevenueRow}
                removeManagementRow={removeManagementRow}
                updateInputRow={updateInputRow}
                updateRevenueRow={updateRevenueRow}
                updateManagementRow={updateManagementRow}
                handleSubmit={handleSubmit}
                handleCancelEdit={handleCancelEdit}
                managementOnly
                managementConfirmed={managementConfirmed}
                managementReadOnly={managementConfirmed}
                managementConfirmedByName={managementConfirmedByName}
                managementConfirmedAt={managementConfirmedAt}
                canConfirmManagement={isSalesAdmin}
                confirmingManagement={confirmingManagement}
                onConfirmManagement={handleConfirmManagementExpense}
              />}

              {/* SAVED DATA */}
              {(savedRevenues.length > 0 ||
                savedSchoolItems.length > 0 ||
                savedMgmtItems.length > 0) && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowSavedData((prev) => !prev)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-slate-800 text-white font-bold text-xl"
                  >
                    <span>📋 Dữ liệu đã lưu</span>
                    <span className="text-sm font-normal">
                      {showSavedData ? "Ẩn ▲" : "Hiện ▼"}
                    </span>
                  </button>

                  {showSavedData && (
                  <>
                  {/* REVENUE */}
                  {savedRevenues.length > 0 && (
                    <div>
                      <div className="px-6 py-3 bg-indigo-50 text-indigo-700 text-base font-bold border-b">
                        💰 Doanh Thu ({savedRevenues.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-max whitespace-nowrap">
                          <thead style={{ fontSize: "14px", lineHeight: "20px" }}>
                            <tr className="bg-slate-900 text-white font-bold">
                              <th className="px-5 py-4 text-left">Số tiết</th>
                              <th className="px-5 py-4 text-left">HS</th>
                              <th className="px-5 py-4 text-left">Tháng</th>
                              <th className="px-5 py-4 text-right">Đơn giá</th>
                              <th className="px-5 py-4 text-right">
                                Thành tiền
                              </th>
                              <th className="px-5 py-4 text-right">Đã thu</th>
                              <th className="px-5 py-4 text-left">Hình thức</th>
                              <th className="px-5 py-4 text-left">Ngày thu</th>
                              <th className="px-5 py-4 text-right">Còn lại</th>
                              <th className="px-5 py-4 text-left">Nội dung</th>
                            </tr>
                          </thead>
                          <tbody style={{ fontSize: "32px", lineHeight: "42px" }}>
                            {savedRevenues.map((r: any) => {
                              const invoiceAmount =
                                Number(r.invoiceAmount || 0) ||
                                Number(r.studentCount || 0) *
                                  Number(r.monthsCount || 0) *
                                  Number(r.unitPrice || 0);
                              const remaining =
                                invoiceAmount - Number(r.paidAmount || 0);

                              return (
                                <tr
                                  key={r.id}
                                  className="border-t hover:bg-slate-50"
                                >
                                  <td className="px-5 py-4 font-semibold">
                                    {r.totalPeriods}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.studentCount}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.monthsCount}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold">
                                    {Number(r.unitPrice || 0).toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-blue-700">
                                    {invoiceAmount.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-green-700">
                                    {Number(r.paidAmount || 0).toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.paymentMethod === "cash"
                                      ? "Tiền mặt"
                                      : r.paymentMethod === "bank_transfer"
                                      ? "Chuyển khoản"
                                      : "-"}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.paymentDate || "-"}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-orange-700">
                                    {remaining.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 font-semibold whitespace-normal break-words">
                                    {r.content || "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SCHOOL EXPENSE */}
                  {savedSchoolItems.length > 0 && (
                    <div>
                      <div className="px-6 py-3 bg-blue-50 text-blue-700 text-base font-bold border-y">
                        🏫 Chi Trường ({savedSchoolItems.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-max whitespace-nowrap">
                          <thead style={{ fontSize: "14px", lineHeight: "20px" }}>
                            <tr className="bg-slate-900 text-white font-bold">
                              <th className="px-5 py-4 text-left">Số tiết</th>
                              <th className="px-5 py-4 text-left">HS</th>
                              <th className="px-5 py-4 text-left">Tháng</th>
                              <th className="px-5 py-4 text-right">ĐG GV</th>
                              <th className="px-5 py-4 text-right">
                                Giáo viên
                              </th>
                              <th className="px-5 py-4 text-right">ĐG Thuế</th>
                              <th className="px-5 py-4 text-right">Thuế</th>
                              <th className="px-5 py-4 text-right">ĐG CSVC</th>
                              <th className="px-5 py-4 text-right">CSVC</th>
                              <th className="px-5 py-4 text-right">
                                Chi trường
                              </th>
                              <th className="px-5 py-4 text-right">Đã chi</th>
                              <th className="px-5 py-4 text-right">Còn lại</th>
                              <th className="px-5 py-4 text-left">Ngày chi</th>
                              <th className="px-5 py-4 text-left">Người chi</th>
                              <th className="px-5 py-4 text-left">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody style={{ fontSize: "32px", lineHeight: "42px" }}>
                            {savedSchoolItems.map((r: any) => {
                              const students = Number(r.studentCount || 0);
                              const months = Number(r.monthsCount || 0);
                              const teacherUP = Number(
                                r.teacherUnitPrice ?? r.giaovien ?? 0,
                              );
                              const taxUP = Number(
                                r.taxUnitPrice ?? r.thue ?? r.tax ?? 0,
                              );
                              const csvcUP = Number(
                                r.csvcUnitPrice ?? r.csvc ?? 0,
                              );
                              const teacherAmt = students * months * teacherUP;
                              const taxAmt = students * months * taxUP;
                              const csvcAmt = students * months * csvcUP;
                              const totalSchool =
                                Number(r.schoolExpenseAmount || 0) ||
                                teacherAmt + taxAmt + csvcAmt;
                              const remaining =
                                totalSchool - Number(r.paidAmount || 0);

                              return (
                                <tr
                                  key={r.id}
                                  className="border-t hover:bg-slate-50"
                                >
                                  <td className="px-5 py-4 font-semibold">
                                    {r.totalPeriods}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.studentCount}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.monthsCount}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold">
                                    {teacherUP.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-amber-700">
                                    {teacherAmt.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold">
                                    {taxUP.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-rose-700">
                                    {taxAmt.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold">
                                    {csvcUP.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-emerald-700">
                                    {csvcAmt.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-blue-700">
                                    {totalSchool.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-green-700">
                                    {Number(r.paidAmount || 0).toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-orange-700">
                                    {remaining.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.expenseDate || "-"}
                                  </td>
                                  <td className="px-5 py-4 font-semibold whitespace-normal break-words">
                                    {r.payer || "-"}
                                  </td>
                                  <td className="px-5 py-4 font-semibold whitespace-normal break-words">
                                    {r.note || "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* INVOICE — hóa đơn của từng dòng doanh thu */}
                  {savedRevenues.length > 0 && (
                    <div>
                      <div className="px-6 py-3 bg-amber-50 text-amber-700 text-base font-bold border-y">
                        🧾 Hóa Đơn ({savedRevenues.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-max whitespace-nowrap">
                          <thead style={{ fontSize: "14px", lineHeight: "20px" }}>
                            <tr className="bg-slate-900 text-white font-bold">
                              <th className="px-5 py-4 text-left">Nội dung</th>
                              <th className="px-5 py-4 text-center">HĐ</th>
                              <th className="px-5 py-4 text-left">Số HĐ</th>
                              <th className="px-5 py-4 text-left">Ngày xuất HĐ</th>
                              <th className="px-5 py-4 text-right">
                                Tổng thanh toán công ty
                              </th>
                            </tr>
                          </thead>
                          <tbody style={{ fontSize: "32px", lineHeight: "42px" }}>
                            {savedRevenues.map((r: any, idx: number) => {
                              // Đơn giá trên doanh thu - Đơn giá Chi trường của dòng cùng rowIndex
                              const revenueUnitPrice = Number(r.unitPrice || 0);
                              const sc =
                                savedSchoolItems.find(
                                  (x: any) => x.rowIndex === r.rowIndex,
                                ) || savedSchoolItems[idx];
                              const schoolUnitPrice = sc
                                ? Number(sc.teacherUnitPrice ?? sc.giaovien ?? 0) +
                                  Number(sc.taxUnitPrice ?? sc.thue ?? sc.tax ?? 0) +
                                  Number(sc.csvcUnitPrice ?? sc.csvc ?? 0)
                                : 0;
                              const companyPayment =
                                sc?.paymentType === "not_in_contract"
                                  ? revenueUnitPrice
                                  : revenueUnitPrice - schoolUnitPrice;

                              return (
                              <tr key={r.id} className="border-t hover:bg-slate-50">
                                <td className="px-5 py-4 font-semibold whitespace-normal break-words">
                                  {r.content || "-"}
                                </td>
                                <td className="px-5 py-4 text-center font-semibold">
                                  {invoiceTypeLabel(r)}
                                </td>
                                <td className="px-5 py-4 font-semibold">
                                  {r.invoiceType === "company"
                                    ? r.invoiceNumber || "-"
                                    : "-"}
                                </td>
                                <td className="px-5 py-4 font-semibold">
                                  {r.invoiceDate || "-"}
                                </td>
                                <td className="px-5 py-4 text-right font-bold text-violet-700">
                                  {companyPayment.toLocaleString()}
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* MANAGEMENT */}
                  {savedMgmtItems.length > 0 && (
                    <div>
                      <div className="px-6 py-3 bg-emerald-50 text-emerald-700 text-base font-bold border-y">
                        💸 Chi Ngoài ({savedMgmtItems.length})
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-max whitespace-nowrap">
                          <thead style={{ fontSize: "14px", lineHeight: "20px" }}>
                            <tr className="bg-slate-900 text-white font-bold">
                              <th className="px-5 py-4 text-left">Số tiết</th>
                              <th className="px-5 py-4 text-left">HS</th>
                              <th className="px-5 py-4 text-left">Tháng</th>
                              <th className="px-5 py-4 text-right">ĐG QL1</th>
                              <th className="px-5 py-4 text-right">
                                Thuế QL1
                              </th>
                              <th className="px-5 py-4 text-right">Chi QL1</th>
                              <th className="px-5 py-4 text-right">ĐG QL2</th>
                              <th className="px-5 py-4 text-right">
                                Thuế QL2
                              </th>
                              <th className="px-5 py-4 text-right">Chi QL2</th>
                              {activeOtherCosts.map((item, index) => {
                                const label =
                                  item.name || `Chi khác ${index + 1}`;
                                const key = getOtherCostKey(item, index);

                                return [
                                  <th
                                    key={`${key}-unit`}
                                    className="px-5 py-4 text-right"
                                  >
                                    ĐG {label}
                                  </th>,
                                  <th
                                    key={`${key}-tax`}
                                    className="px-5 py-4 text-right"
                                  >
                                    Thuế {label}
                                  </th>,
                                  <th
                                    key={`${key}-expense`}
                                    className="px-5 py-4 text-right"
                                  >
                                    Chi {label}
                                  </th>,
                                ];
                              })}
                              <th className="px-5 py-4 text-right">
                                Tổng chi ngoài
                              </th>
                              <th className="px-5 py-4 text-right">Tiền HĐ</th>
                              <th className="px-5 py-4 text-right">Đã chi</th>
                              <th className="px-5 py-4 text-right">Còn chi</th>
                              <th className="px-5 py-4 text-left">Ngày chi</th>
                              <th className="px-5 py-4 text-left">Người chi</th>
                              <th className="px-5 py-4 text-left">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody style={{ fontSize: "32px", lineHeight: "42px" }}>
                            {savedMgmtItems.map((r: any) => {
                              const students = Number(r.studentCount || 0);
                              const months = Number(r.monthsCount || 0);
                              const ql1UP = Number(
                                r.ql1UnitPrice ?? activeTtcs.ql1Percent ?? 0,
                              );
                              const ql2UP = Number(
                                r.ql2UnitPrice ?? activeTtcs.ql2Percent ?? 0,
                              );
                              const ql1Tax = Number(
                                r.ql1Tax ?? activeTtcs.ql1Tax ?? 0,
                              );
                              const ql2Tax = Number(
                                r.ql2Tax ?? activeTtcs.ql2Tax ?? 0,
                              );
                              const ql1Amt =
                                Math.max(0, ql1UP - ql1Tax) *
                                students *
                                months;
                              const ql2Amt =
                                Math.max(0, ql2UP - ql2Tax) *
                                students *
                                months;
                              const otherCostValues = activeOtherCosts.map(
                                (item, otherCostIndex) => {
                                  const key = getOtherCostKey(
                                    item,
                                    otherCostIndex,
                                  );
                                  const savedCost = (r.otherCosts || []).find(
                                    (cost: any, savedIndex: number) =>
                                      getOtherCostKey(cost, savedIndex) === key ||
                                      (cost.name &&
                                        item.name &&
                                        cost.name === item.name),
                                  );
                                  const unitPrice = savedCost
                                    ? getOtherCostGrossPrice(savedCost)
                                    : getOtherCostGrossPrice(item);
                                  const tax =
                                    savedCost?.tax !== undefined &&
                                    savedCost?.tax !== null
                                      ? getOtherCostTax(savedCost)
                                      : getOtherCostTax(item);

                                  return {
                                    unitPrice,
                                    tax,
                                    expense: Math.max(0, unitPrice - tax),
                                  };
                                },
                              );
                              const otherCostTotal = otherCostValues.reduce(
                                (total, item) => total + item.expense,
                                0,
                              );
                              const calculatedTotalOutside =
                                ql1Amt + ql2Amt + otherCostTotal;
                              const totalOutside = calculatedTotalOutside;
                              const remaining =
                                totalOutside - Number(r.paidAmount || 0);

                              return (
                                <tr
                                  key={r.id}
                                  className="border-t hover:bg-slate-50"
                                >
                                  <td className="px-5 py-4 font-semibold">
                                    {r.totalPeriods}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.studentCount}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.monthsCount}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold">
                                    {ql1UP.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold text-rose-700">
                                    {ql1Tax.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-emerald-700">
                                    {ql1Amt.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold">
                                    {ql2UP.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-semibold text-rose-700">
                                    {ql2Tax.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-cyan-700">
                                    {ql2Amt.toLocaleString()}
                                  </td>
                                  {activeOtherCosts.map((item, index) => {
                                    const key = getOtherCostKey(item, index);
                                    const values = otherCostValues[index];

                                    return [
                                      <td
                                        key={`${key}-unit`}
                                        className="px-5 py-4 text-right font-semibold text-fuchsia-700"
                                      >
                                        {values.unitPrice.toLocaleString(
                                          "vi-VN",
                                        )}
                                      </td>,
                                      <td
                                        key={`${key}-tax`}
                                        className="px-5 py-4 text-right font-semibold text-rose-700"
                                      >
                                        {values.tax.toLocaleString("vi-VN")}
                                      </td>,
                                      <td
                                        key={`${key}-expense`}
                                        className="px-5 py-4 text-right font-bold text-fuchsia-700"
                                      >
                                        {values.expense.toLocaleString("vi-VN")}
                                      </td>,
                                    ];
                                  })}
                                  <td className="px-5 py-4 text-right font-bold text-red-600">
                                    {totalOutside.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-blue-600">
                                    {Number(
                                      r.invoiceAmount || 0,
                                    ).toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-green-700">
                                    {Number(r.paidAmount || 0).toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 text-right font-bold text-orange-700">
                                    {remaining.toLocaleString()}
                                  </td>
                                  <td className="px-5 py-4 font-semibold">
                                    {r.expenseDate || "-"}
                                  </td>
                                  <td className="px-5 py-4 font-semibold whitespace-normal break-words">
                                    {r.payer || "-"}
                                  </td>
                                  <td className="px-5 py-4 font-semibold whitespace-normal break-words">
                                    {r.note || "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </div>
              )}
            </div>

            {/* CASH POLICY */}
            {/*      {subTab === "cash-policy" && (
              <div className="space-y-5">
                <CashPolicyEditorTable
                  cashPolicyRows={cashPolicyRows}
                  updateCashPolicyRow={updateCashPolicyRow}
                  removeCashPolicyRow={removeCashPolicyRow}
                />

                <CashPolicyList
                  data={data}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )} */}
          </div>
        )}
        {/* PAGINATION */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          onNext={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
        />
      </div>

      {/* HISTORY POPUP */}
      {showHistory && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="bg-white w-[95%] max-w-5xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-800 text-white">
              <span className="font-bold text-lg">
                📜 Lịch sử thao tác thu chi ({historyList.length})
              </span>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-600 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {historyList.length > 0 && (
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="block flex-1">
                    <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                      Nhân viên thao tác
                    </span>
                    <select
                      value={selectedHistoryEmployee}
                      onChange={(event) =>
                        setSelectedHistoryEmployee(event.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value={ALL_HISTORY_EMPLOYEES}>
                        Tất cả nhân viên ({historyList.length})
                      </option>
                      {historyEmployeeGroups.map((group) => (
                        <option
                          key={group.employeeName}
                          value={group.employeeName}
                        >
                          {group.employeeName} ({group.items.length})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600">
                    {selectedHistoryCount} thao tác
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto bg-white p-5">
              {historyList.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    Chưa có lịch sử thao tác thu chi
                  </p>
                </div>
              ) : selectedHistoryGroups.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    Không có thao tác của nhân viên này
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedHistoryGroups.map((group) => (
                    <details
                      key={group.employeeName}
                      open={
                        selectedHistoryEmployee !== ALL_HISTORY_EMPLOYEES ||
                        historyEmployeeGroups.length === 1
                      }
                      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                        <div>
                          <p className="text-base font-black text-slate-800">
                            {group.employeeName}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">
                            Chọn để xem chi tiết thao tác
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-white">
                          {group.items.length} thao tác
                        </span>
                      </summary>

                      <div className="border-t border-slate-100 bg-slate-50 p-4">
                        <ol className="relative border-l-2 border-slate-200 ml-2">
                          {group.items.map((h: any, idx: number) => {
                            const info = getHistoryActionInfo(h.action);
                            const time = formatHistoryTime(h.createdAt);
                            const isConfirmAction =
                              h.action === "CONFIRM_MANAGEMENT_EXPENSE";

                            return (
                              <li
                                key={h.id || `${group.employeeName}-${idx}`}
                                className="mb-5 ml-5"
                              >
                                <span
                                  className={`absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full border-2 border-white ${
                                    isConfirmAction
                                      ? "bg-emerald-500"
                                      : "bg-blue-500"
                                  }`}
                                />
                                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${info.color}`}
                                    >
                                      {info.label}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-400">
                                      {time || "-"}
                                    </span>
                                  </div>

                                  {h.oldData && h.newData && (
                                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                      <div className="rounded-xl bg-red-50 p-3">
                                        <div className="mb-2 font-bold text-red-600">
                                          Trước
                                        </div>
                                        {renderHistoryPayload(
                                          h.oldData,
                                          "Không có dữ liệu trước",
                                        )}
                                      </div>
                                      <div className="rounded-xl bg-green-50 p-3">
                                        <div className="mb-2 font-bold text-green-600">
                                          Sau
                                        </div>
                                        {renderHistoryPayload(
                                          h.newData,
                                          "Không có dữ liệu sau",
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {!h.oldData && h.newData && (
                                    <div className="mt-3 rounded-xl bg-green-50 p-3">
                                      <div className="mb-2 font-bold text-green-600">
                                        Dữ liệu mới
                                      </div>
                                      {renderHistoryPayload(
                                        h.newData,
                                        "Không có dữ liệu mới",
                                      )}
                                    </div>
                                  )}

                                  {h.oldData && !h.newData && (
                                    <div className="mt-3 rounded-xl bg-red-50 p-3">
                                      <div className="mb-2 font-bold text-red-600">
                                        Dữ liệu đã xoá
                                      </div>
                                      {renderHistoryPayload(
                                        h.oldData,
                                        "Không có dữ liệu đã xoá",
                                      )}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
