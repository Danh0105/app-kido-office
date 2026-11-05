// pages/RealExpenseDetail/index.tsx

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import HeaderWithBack from "@/components/HeaderWithBack";
import Tabs from "./components/Tabs";
import Pagination from "./components/Pagination";
import {
  RevenueEInvoice,
  schoolExpenseApi,
} from "@/service/schoolExpense";
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
import SavedDataSection from "./components/SavedDataSection";
import {
  getOtherCostGrossPrice,
  getOtherCostKey,
  getOtherCostTax,
  getPolicyOtherCosts,
} from "../utils/policyOtherCosts";
import {
  getManagementRowInput,
  isStandaloneManagementRow,
  placeRowsByIndex,
} from "../utils/managementRows";
import { revenueQuantityDefaultsFromPolicy } from "@/utils/revenueAmount";

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
  invoicePaymentDate: "",
  invoiceCashAccount: "",
  invoiceCashDirection: "",
  invoiceCashAmount: null,
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
  cashAccount: "",
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
  cashAccount: "",
  payer: "",
  note: "",
};

/** Dòng thêm khi bảng đã khoá BBCS: chỉ có Nội dung + cột chi, không có số tiền chính sách. */
const lockedManagementRow = (subject: any): ManagementRow => {
  const zeroOtherCosts = Object.fromEntries(
    getPolicyOtherCosts(subject).map((item, index) => [
      getOtherCostKey(item, index),
      0,
    ]),
  );

  return {
    ...initialManagementRow,
    content: "",
    addedWhileLocked: true,
    totalPeriods: 0,
    studentCount: 0,
    monthsCount: 0,
    ql1UnitPrice: 0,
    ql1Tax: 0,
    ql2UnitPrice: 0,
    ql2Tax: 0,
    otherCostUnitPrices: zeroOtherCosts,
    otherCostTaxes: zeroOtherCosts,
  };
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
  // Kế toán / KT công nợ / thủ quỹ: bảng "Chi Ngoài" đã khoá vẫn nhập được cột
  // chi như KTT, nhưng chỉ trên dòng đã lưu (server không thêm dòng cho họ).
  // Trợ lý GĐ / giám đốc chỉ còn Ngày chi + Nguồn chi.
  const isLockedPaymentEditor = hasRole("accountant", "ketoan_congno", "thuquy");
  // Sales admin xem toàn bộ dữ liệu thu chi nhưng chỉ được xác nhận đúng BBCS.
  const isSalesAdmin = hasRole("saleadmin", "salesadmin", "salesadmin_la");
  const [managementConfirmed, setManagementConfirmed] = useState(false);
  const [managementConfirmedByName, setManagementConfirmedByName] =
    useState<string | null>(null);
  const [managementConfirmedAt, setManagementConfirmedAt] = useState<
    string | null
  >(null);
  const [confirmingManagement, setConfirmingManagement] = useState(false);
  // Kế toán trưởng "Kết thúc" kỳ thu chi → khoá toàn bộ, kể cả KTT (phải mở lại).
  const [finalized, setFinalized] = useState(false);
  const [finalizedByName, setFinalizedByName] = useState<string | null>(null);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);
  const [lockActionLoading, setLockActionLoading] = useState(false);
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
  // Hóa đơn điện tử (nháp Viettel) theo rowIndex của các dòng doanh thu.
  const [einvoices, setEInvoices] = useState<RevenueEInvoice[]>([]);
  const [exportingInvoices, setExportingInvoices] = useState(false);
  const [unlinkingEInvoiceId, setUnlinkingEInvoiceId] = useState<
    number | null
  >(null);
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

  /** Trạng thái khoá "Xác nhận đúng BBCS" + "Kết thúc" từ phiếu thu chi. */
  const applyLockState = (res: any) => {
    setManagementConfirmed(!!res?.managementExpenseConfirmed);
    setManagementConfirmedByName(res?.managementExpenseConfirmedByName || null);
    setManagementConfirmedAt(res?.managementExpenseConfirmedAt || null);
    setFinalized(!!res?.finalized);
    setFinalizedByName(res?.finalizedByName || null);
    setFinalizedAt(res?.finalizedAt || null);
  };

  // Trạng thái khoá bảng "Chi Ngoài" + kết thúc kỳ — mọi vai trò xem trang này
  // đều cần biết (để hiện badge đã khoá và disable form).
  useEffect(() => {
    if (!resolvedSchoolExpenseId) {
      applyLockState(null);
      return;
    }
    let active = true;
    schoolExpenseApi
      .getById(resolvedSchoolExpenseId)
      .then((res: any) => {
        if (active) applyLockState(res);
      })
      .catch(() => {
        if (active) applyLockState(null);
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
      applyLockState(res);
      toast.success("Đã xác nhận đúng BBCS — bảng Chi Ngoài đã được khoá");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xác nhận thất bại"));
    } finally {
      setConfirmingManagement(false);
    }
  };

  // Kế toán trưởng: mở khoá BBCS / Kết thúc / Mở lại kỳ thu chi.
  const runLockAction = async (
    action: (id: number) => Promise<any>,
    successMessage: string,
  ) => {
    if (!resolvedSchoolExpenseId) return;
    setLockActionLoading(true);
    try {
      applyLockState(await action(resolvedSchoolExpenseId));
      toast.success(successMessage);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Thao tác thất bại"));
    } finally {
      setLockActionLoading(false);
    }
  };

  const handleUnconfirmManagementExpense = () =>
    runLockAction(
      schoolExpenseApi.unconfirmManagementExpense,
      "Đã mở khoá BBCS — bảng Chi Ngoài sửa được lại",
    );

  const handleFinalize = () =>
    runLockAction(
      schoolExpenseApi.finalize,
      "Đã kết thúc kỳ thu chi — toàn bộ dữ liệu đã khoá",
    );

  const handleReopen = () =>
    runLockAction(schoolExpenseApi.reopen, "Đã mở lại kỳ thu chi");

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
    invoicePaymentDate: "Ngày chi (HĐ)",
    invoiceCashAccount: "Khoản thu/chi",
    invoiceCashDirection: "Thu/Chi (HĐ)",
    invoiceCashAmount: "Số tiền thu/chi (HĐ)",
    invoiceNote: "Ghi chú (HĐ)",
    paymentMethod: "PT thanh toán",
    paymentDate: "Ngày thanh toán",
    expenseDate: "Ngày chi",
    cashAccount: "Nguồn chi",
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
    const quantityDefaults = revenueQuantityDefaultsFromPolicy(activeSubject);

    setInputRows((prev) => [
      ...prev,
      {
        ...initialInputData,
        ...quantityDefaults,
        unitPrice: fee,
      },
    ]);
    setRevenueRows((prev) => [...prev, { ...initialRevenueRow }]);
    // Dòng Chi Ngoài đi kèm nằm cùng vị trí dòng Doanh Thu mới — trước các
    // dòng thêm riêng cho Chi Ngoài.
    setManagementRows((prev) => {
      const nextRows = padRows(prev, inputRows.length, initialManagementRow);
      nextRows.splice(inputRows.length, 0, { ...initialManagementRow });
      return nextRows;
    });
  };

  /**
   * Thêm 1 dòng chỉ cho bảng Chi Ngoài: nằm sau dòng Doanh Thu cuối nên tự giữ
   * Số tiết / Số HS / Số tháng (xem utils/managementRows).
   */
  const addManagementRow = () => {
    setManagementRows((prev) => [
      ...padRows(prev, inputRows.length, initialManagementRow),
      managementConfirmed
        ? lockedManagementRow(activeSubject)
        : {
            ...initialManagementRow,
            ...revenueQuantityDefaultsFromPolicy(activeSubject),
            monthsCount: 0,
            content: "",
          },
    ]);
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
    setManagementRows((prev) => {
      const nextRows = prev.filter((_, i) => i !== index);
      // Xoá dòng đi kèm Doanh Thu khi phía sau còn dòng thêm riêng: chèn dòng
      // trống vào cuối nhóm đi kèm để dòng thêm riêng không bị ghép vào Doanh Thu.
      if (index < inputRows.length && prev.length > inputRows.length) {
        nextRows.splice(inputRows.length - 1, 0, { ...initialManagementRow });
      }
      return nextRows;
    });
  };

  // LOAD SAVED EXPENSE DATA
  const loadExpenseData = async (subId: number) => {
    if (!resolvedSchoolExpenseId || !subId) return;

    try {
      const [revenues, schoolItems, mgmtItems, history, invoices] =
        await Promise.all([
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
        schoolExpenseApi
          .getEInvoices(resolvedSchoolExpenseId, subId)
          .catch(() => []),
      ]);

      setSavedRevenues(revenues || []);
      setEInvoices(invoices || []);
      setSavedSchoolItems(schoolItems || []);
      setHistoryList(normalizeHistory(history));
      setSavedMgmtItems(mgmtItems || []);

      const loadedPolicyData =
        subjects.find((s: any) => s.id === subId)?.policies?.[0]?.data || {};
      const loadedSubject = subjects.find((s: any) => s.id === subId);
      const policyOtherCosts = getPolicyOtherCosts(loadedSubject);
      const fee = Number(loadedPolicyData?.fee || 0);
      const quantityDefaults = revenueQuantityDefaultsFromPolicy(loadedSubject);

      const nextInputRows =
        revenues?.length > 0
          ? revenues.map((r: any) => {
              const hasSavedQuantity =
                Number(r.totalPeriods || 0) > 0 ||
                Number(r.studentCount || 0) > 0;

              return {
                content: r.content || "",
                totalPeriods: hasSavedQuantity
                  ? r.totalPeriods || 0
                  : quantityDefaults.totalPeriods,
                unitPrice: r.unitPrice || fee,
                studentCount: hasSavedQuantity
                  ? r.studentCount || 0
                  : quantityDefaults.studentCount,
                monthsCount: r.monthsCount ?? 0,
                invoiced: r.invoiced || false,
                invoiceType: r.invoiceType || (r.invoiced ? "company" : ""),
                invoiceOther: r.invoiceOther || "",
                invoiceNumber: r.invoiceNumber || "",
                invoiceDate: r.invoiceDate || "",
                invoiceUnit: r.invoiceUnit || "",
                invoicePaymentDate: r.invoicePaymentDate || "",
                invoiceCashAccount: r.invoiceCashAccount || "",
                invoiceCashDirection: r.invoiceCashDirection || "",
                invoiceCashAmount:
                  r.invoiceCashAmount === null ||
                  r.invoiceCashAmount === undefined
                    ? null
                    : Number(r.invoiceCashAmount),
                invoiceNote: r.invoiceNote || "",
                invoiceLocked: !!r.invoiceLocked,
                paidAmount: r.paidAmount || 0,
                paymentMethod: r.paymentMethod || "",
                paymentDate: r.paymentDate || "",
              };
            })
          : [
              {
                ...initialInputData,
                ...quantityDefaults,
                unitPrice: fee,
              },
            ];

      setInputRows(nextInputRows);

      if (schoolItems?.length > 0) {
        setRevenueRows(
          padRows(
            schoolItems.map((r: any) => ({
              id: r.id,
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
              paymentType: r.paymentType || "",
              cashAccount: r.cashAccount || "",
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
            placeRowsByIndex<any>(mgmtItems).map((r: any) => {
              if (!r) return { ...initialManagementRow };

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
                id: r.id,
                content: r.content ?? undefined,
                // Chỉ dòng thêm riêng (sau dòng Doanh Thu cuối) dùng số lượng này.
                totalPeriods: Number(r.totalPeriods || 0),
                studentCount: Number(r.studentCount || 0),
                monthsCount: Number(r.monthsCount ?? 0),
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
                cashAccount: r.cashAccount || "",
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
  const saveExpense = async (
    schoolExpenseId: number,
    subjectId: number,
    rows: InputExpenseRow[],
  ) => {
    const policy = activeSubject?.policies?.[0];
    const policyData = policy?.data || {};
    const ttcs = policyData.ttcs?.[0] || {};

    await schoolExpenseApi.saveAll(schoolExpenseId, {
      subjectId,
      revenueItems: rows.map((row, index) => ({
        rowIndex: index,
        subjectId,
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
        invoiceUnit: (row.invoiceUnit || "").slice(0, 50) || undefined,
        invoicePaymentDate: row.invoicePaymentDate || undefined,
        invoiceCashAccount: row.invoiceCashAccount || undefined,
        invoiceCashDirection: row.invoiceCashDirection || undefined,
        invoiceCashAmount:
          row.invoiceCashAmount === null ? undefined : row.invoiceCashAmount,
        invoiceNote: (row.invoiceNote || "").slice(0, 500) || undefined,
        invoiceLocked: !!row.invoiceLocked,
        paidAmount: Number(row.paidAmount || 0),
        paymentMethod: row.paymentMethod || undefined,
        paymentDate: row.paymentDate || undefined,
      })),
      schoolExpenseItems: revenueRows.map((row, index) => {
        const inputRow = rows[index] || rows[0] || initialInputData;

        return {
          // Kỳ đã kết thúc: server khớp Ngày chi + Nguồn chi theo id dòng.
          id: row.id,
          rowIndex: index,
          subjectId,
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
          paymentType: row.paymentType || undefined,
          cashAccount: row.cashAccount || undefined,
          payer: row.payer || "",
          note: row.note || "",
        };
      }),
      managementExpenseItems: managementRows.map((row, index) => {
        const inputRow = getManagementRowInput(row, index, rows);

        return {
          // Bảng đã khoá: server khớp cột chi của kế toán theo id dòng.
          id: row.id,
          addedWhileLocked: row.addedWhileLocked,
          content: isStandaloneManagementRow(index, rows)
            ? row.content
            : undefined,
          rowIndex: index,
          subjectId,
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
          cashAccount: row.cashAccount || undefined,
          payer: row.payer || "",
          note: row.note || "",
        };
      }),
    });
  };

  const handleSubmit = async () => {
    if (!resolvedSchoolExpenseId || !activeSubjectId) {
      toast.error("Vui lòng chọn môn học");
      return;
    }

    try {
      setLoading(true);
      await saveExpense(resolvedSchoolExpenseId, activeSubjectId, inputRows);
      toast.success("Lưu dữ liệu thành công");
      await loadExpenseData(activeSubjectId);
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không thể lưu dữ liệu thu chi"));
    } finally {
      setLoading(false);
    }
  };

  /**
   * "Đẩy hóa đơn": lưu dữ liệu đang nhập rồi gộp các dòng "Xuất HĐ Cty" chưa
   * có hóa đơn thành 1 hóa đơn nháp trên Viettel — bên mua là trường. Server
   * khóa các dòng đã lên hóa đơn.
   */
  const handleExportInvoices = async () => {
    if (!resolvedSchoolExpenseId || !activeSubjectId) {
      toast.error("Vui lòng chọn môn học");
      return;
    }

    setExportingInvoices(true);
    try {
      // Viettel nhận số liệu đã lưu trên server, nên phải lưu trước.
      await saveExpense(resolvedSchoolExpenseId, activeSubjectId, inputRows);
    } catch (error: any) {
      // Không tải lại: giữ nguyên dữ liệu người dùng đang nhập.
      toast.error(
        getApiErrorMessage(error, "Không thể lưu dữ liệu trước khi đẩy hóa đơn"),
      );
      setExportingInvoices(false);
      return;
    }

    try {
      const summary = await schoolExpenseApi.exportEInvoiceDrafts(
        resolvedSchoolExpenseId,
        activeSubjectId,
      );
      if (!Array.isArray(summary?.existing)) {
        // BE bản cũ (mỗi dòng 1 hóa đơn) trả kết quả khác — không đoán kết quả.
        toast.error(
          "Máy chủ chưa cập nhật bản đẩy hóa đơn gộp — kiểm tra lại hóa đơn nháp trên portal Viettel",
          { duration: 8000 },
        );
        return;
      }
      const { draft, existing, skipped } = summary;
      const rowList = (rowIndexes: number[]) =>
        rowIndexes.map((i) => i + 1).join(", ");

      if (draft?.status === "error") {
        toast.error(`Chưa đẩy được hóa đơn: ${draft.message ?? ""}`, {
          duration: 8000,
        });
      } else if (draft?.status === "created") {
        toast.success(
          `Viettel S-Invoice: đã tạo 1 hóa đơn nháp gồm ${draft.rowIndexes.length} dòng (dòng ${rowList(draft.rowIndexes)}) — ${money(draft.amount ?? 0)}đ`,
        );
      }

      // Viettel không cho sửa nháp qua API — kế toán sửa trực tiếp trên portal.
      const changedRows = [draft, ...existing]
        .filter((r) => r?.status === "changed")
        .flatMap((r) => r?.rowIndexes ?? []);
      if (changedRows.length) {
        toast(
          `Dòng ${rowList(changedRows)} đã đổi số liệu sau khi tạo nháp — hãy sửa hóa đơn nháp trên portal Viettel`,
          { icon: "⚠️", duration: 8000 },
        );
      }
      if (skipped.length) {
        toast(
          `Bỏ qua dòng ${rowList(skipped.map((s) => s.rowIndex))}: thành tiền bằng 0`,
          { icon: "ℹ️" },
        );
      }
      if (!draft && !changedRows.length && !skipped.length) {
        toast.success(
          'Các dòng "Xuất HĐ Cty" đều đã có hóa đơn nháp, dữ liệu không đổi',
        );
      }
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Đẩy hóa đơn thất bại"));
    } finally {
      setExportingInvoices(false);
      await loadExpenseData(activeSubjectId);
    }
  };

  /**
   * KTT "Bỏ liên kết nháp": API Viettel không xóa được nháp — sau khi xóa trên
   * portal, bỏ liên kết để các dòng đẩy lại được. Server mở khóa các dòng đó
   * (chặn nếu hóa đơn đã phát hành).
   */
  const handleUnlinkEInvoice = async (einvoice: RevenueEInvoice) => {
    if (!resolvedSchoolExpenseId || !activeSubjectId) return;
    const rowList = (rowIndexes: number[]) =>
      rowIndexes.map((i) => i + 1).join(", ");
    const confirmed = window.confirm(
      `Bỏ liên kết hóa đơn nháp gồm dòng ${rowList(
        (einvoice.lines ?? []).map((l) => l.rowIndex),
      )} (${money(Number(einvoice.amount))}đ)?\n\n` +
        "Chỉ làm khi đã XÓA hóa đơn nháp này trên portal Viettel — nếu nháp vẫn còn, đẩy lại sẽ tạo thêm 1 hóa đơn nháp trùng.",
    );
    if (!confirmed) return;

    setUnlinkingEInvoiceId(einvoice.id);
    try {
      const { rowIndexes } = await schoolExpenseApi.unlinkEInvoice(
        resolvedSchoolExpenseId,
        activeSubjectId,
        einvoice.id,
      );
      // Cập nhật tại chỗ thay vì tải lại — giữ dữ liệu đang nhập dở.
      setInputRows((rows) =>
        rows.map((row, idx) =>
          rowIndexes.includes(idx) ? { ...row, invoiceLocked: false } : row,
        ),
      );
      setEInvoices((list) => list.filter((e) => e.id !== einvoice.id));
      toast.success(
        `Đã bỏ liên kết — dòng ${rowList(rowIndexes)} có thể đẩy hóa đơn lại`,
      );
    } catch (error: any) {
      toast.error(
        getApiErrorMessage(error, "Không bỏ liên kết được hóa đơn nháp"),
      );
    } finally {
      setUnlinkingEInvoiceId(null);
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
      // Năm học do trang cha quản lý (onSchoolYearChange) thì để cha tự xử lý
      // danh sách rỗng — đặt về "" ở đây thì cha lại chọn năm mặc định, hai bên
      // giành nhau thành vòng lặp render vô hạn (trường chưa có môn).
      if (!onSchoolYearChange && selectedSchoolYear) setSelectedSchoolYear("");
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
    onSchoolYearChange,
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
              {/* Sales admin xem đủ bảng thông tin chung nhưng không được sửa.
                  Đã "Kết thúc" → fieldset disabled khoá mọi ô nhập/nút. */}
              <fieldset
                disabled={finalized || isSalesAdmin}
                className="m-0 min-w-0 border-0 p-0"
              >
                <InputExpenseTable
                rows={inputRows}
                defaultFee={Number(
                  activeSubject?.policies?.[0]?.data?.fee || 0,
                )}
                onUpdate={updateInputRow}
                onAdd={addInputRow}
                onRemove={removeInputRow}
              />
              </fieldset>
              {!isSalesAdmin && <ExpenseFormTable
                inputRows={inputRows}
                revenueRows={revenueRows}
                managementRows={managementRows}
                subjects={activeSubject}
                editingItem={editingItem}
                loading={loading}
                addRow={addInputRow}
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
                managementPolicyLocked={managementConfirmed || finalized}
                managementSavedRowsOnly={
                  (managementConfirmed && !isChief) || finalized
                }
                // Kỳ đã kết thúc: mọi người chỉ còn Ngày chi + Nguồn chi.
                managementDateSourceOnly={
                  finalized ||
                  (managementConfirmed && !isChief && !isLockedPaymentEditor)
                }
                managementConfirmedByName={managementConfirmedByName}
                managementConfirmedAt={managementConfirmedAt}
                historyCount={historyList.length}
                isChief={isChief}
                finalized={finalized}
                finalizedByName={finalizedByName}
                finalizedAt={finalizedAt}
                lockActionLoading={lockActionLoading || confirmingManagement}
                onConfirmManagement={handleConfirmManagementExpense}
                onUnconfirmManagement={handleUnconfirmManagementExpense}
                onFinalize={handleFinalize}
                onReopen={handleReopen}
                onExportInvoices={handleExportInvoices}
                exportingInvoices={exportingInvoices}
                einvoices={einvoices}
                onUnlinkEInvoice={isChief ? handleUnlinkEInvoice : undefined}
                unlinkingEInvoiceId={unlinkingEInvoiceId}
                schoolName={resolvedSchool?.name}
                schoolYear={selectedSchoolYear}
              />}

              {/*
                Sales admin: xem đầy đủ mọi bảng ở chế độ chỉ đọc và chỉ được
                thao tác nút xác nhận đúng BBCS.
                Kế toán trưởng đi qua form đầy đủ phía trên giống Kế toán/Giám đốc.
              */}
              {isSalesAdmin && <ExpenseFormTable
                inputRows={inputRows}
                revenueRows={revenueRows}
                managementRows={managementRows}
                subjects={activeSubject}
                editingItem={editingItem}
                loading={loading}
                addRow={addInputRow}
                removeRevenueRow={removeRevenueRow}
                removeManagementRow={removeManagementRow}
                updateInputRow={updateInputRow}
                updateRevenueRow={updateRevenueRow}
                updateManagementRow={updateManagementRow}
                handleSubmit={handleSubmit}
                handleCancelEdit={handleCancelEdit}
                readOnly
                managementConfirmed={managementConfirmed}
                managementReadOnly
                managementConfirmedByName={managementConfirmedByName}
                managementConfirmedAt={managementConfirmedAt}
                canConfirmManagement={isSalesAdmin}
                confirmingManagement={confirmingManagement}
                onConfirmManagement={handleConfirmManagementExpense}
                finalized={finalized}
                finalizedByName={finalizedByName}
                finalizedAt={finalizedAt}
                schoolName={resolvedSchool?.name}
                schoolYear={selectedSchoolYear}
                handleViewHistory={handleViewHistory}
                historyLoading={historyLoading}
                historyCount={historyList.length}
              />}

              {/* SAVED DATA */}
              <SavedDataSection
                savedRevenues={savedRevenues}
                savedSchoolItems={savedSchoolItems}
                savedMgmtItems={savedMgmtItems}
                otherCosts={activeOtherCosts}
                ttcs={activeTtcs}
              />
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
