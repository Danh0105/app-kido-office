// pages/RealExpenseDetail/index.tsx

import { useEffect, useMemo, useState } from "react";
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
import { InputExpenseRow } from "./type/InputExpenseRow";
import { RevenueRow } from "./type/RevenueRow";
import { ManagementRow } from "./type/ManagementRow";

type CashPolicyRowType = {
  payer: string;
  cashPolicyAmount: string;
  otherAmount: string;
  paymentDate: string;
  note: string;
};

type RealExpenseDetailProps = {
  schoolExpenseId: number | null;
  school: any;
};
const initialInputData: InputExpenseRow = {
  totalPeriods: 0,
  unitPrice: 0,
  studentCount: 0,
  monthsCount: 1,
  invoiced: false,
  invoiceType: "",
  invoiceOther: "",
  invoiceDate: "",
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
  totalOutsideExpense: 0,
  paidAmount: 0,
  remainingOutsideExpense: 0,
  paymentDate: "",
  payer: "",
  note: "",
};

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
}: RealExpenseDetailProps) {
  const [tab, setTab] = useState<string>("expense");
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [periods, setPeriods] = useState<any[]>([]);

  const [subjects, setSubjects] = useState<any[]>([]);

  const [data, setData] = useState<any[]>([]);

  const [editingItem, setEditingItem] = useState<any>(null);

  const [subjectId, setSubjectId] = useState<number>(0);

  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [subTab, setSubTab] = useState<"expense" | "cash-policy">("expense");
  const [suggestStats, setSuggestStats] = useState<Record<number, any>>({});

  const [inputRows, setInputRows] = useState<InputExpenseRow[]>([
    initialInputData,
  ]);
  const [savedRevenues, setSavedRevenues] = useState<any[]>([]);
  const [savedSchoolItems, setSavedSchoolItems] = useState<any[]>([]);
  const [savedMgmtItems, setSavedMgmtItems] = useState<any[]>([]);

  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([
    initialRevenueRow,
  ]);

  const [managementRows, setManagementRows] = useState<ManagementRow[]>([
    initialManagementRow,
  ]);

  const pageSize = 5;

  // FETCH PERIODS
  const fetchPeriods = async () => {
    try {
      const res = await expensePeriodApi.getAll({
        page: 1,
        limit: 100,
      });

      setPeriods(res || []);
    } catch (error) {
      console.log(error);
    }
  };

  // FETCH SUBJECTS
  const fetchSubjects = async (schoolId: number, schoolYear?: string) => {
    try {
      const res = await subjectApi.getFinanceBySchool(schoolId, schoolYear);
      console.log("Fetched subjects:", res);
      const filtered = (res || [])
        .filter(
          (subject: any) => !schoolYear || subject.schoolYear === schoolYear,
        )
        .map((subject: any) => ({
          ...subject,

          expenseItems:
            subject.expenseItems?.filter(
              (item: any) => item.subject?.schoolYear === schoolYear,
            ) || [],
        }));

      setData(filtered);
      setSubjects(filtered);
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    if (school?.id) {
      fetchSubjects(Number(school.id));
    }
    fetchPeriods();
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) {
      fetchSubjects(Number(school.id), selectedSchoolYear || undefined);
    }
  }, [selectedSchoolYear]);

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
    value: string,
  ) => {
    setRevenueRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const updateManagementRow = (
    index: number,
    field: keyof ManagementRow,
    value: string,
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
    if (!schoolExpenseId || !subId) return;

    try {
      const [revenues, schoolItems, mgmtItems] = await Promise.all([
        revenueItemApi.getAll({ schoolExpenseId, subjectId: subId }),
        schoolExpenseItemApi.getAll({ schoolExpenseId, subjectId: subId }),
        managementExpenseItemApi.getAll({ schoolExpenseId, subjectId: subId }),
      ]);

      setSavedRevenues(revenues || []);
      setSavedSchoolItems(schoolItems || []);
      setSavedMgmtItems(mgmtItems || []);

      const loadedPolicyData =
        subjects.find((s: any) => s.id === subId)?.policies?.[0]?.data || {};
      const fee = Number(loadedPolicyData?.fee || 0);

      const nextInputRows =
        revenues?.length > 0
          ? revenues.map((r: any) => ({
            totalPeriods: r.totalPeriods || 0,
            unitPrice: r.unitPrice || fee,
            studentCount: r.studentCount || 0,
            monthsCount: r.monthsCount || 1,
            invoiced: r.invoiced || false,
            invoiceType: r.invoiceType || (r.invoiced ? "company" : ""),
            invoiceOther: r.invoiceOther || "",
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
            mgmtItems.map((r: any) => ({
              totalOutsideExpense: r.totalOutside || 0,
              paidAmount: r.paidAmount || 0,
              remainingOutsideExpense: r.remaining || 0,
              paymentDate: r.expenseDate || "",
              payer: r.payer || "",
              note: r.note || "",
            })),
            nextInputRows.length,
            initialManagementRow,
          ),
        );
      } else {
        setManagementRows(
          padRows([], nextInputRows.length, initialManagementRow),
        );
      }
    } catch {
      console.error("Failed to load expense data");
    }
  };

  // SUBMIT EXPENSE
  const handleSubmit = async () => {
    if (!schoolExpenseId || !activeSubjectId) {
      toast.error("Vui lòng chọn môn học");
      return;
    }

    try {
      setLoading(true);

      const policy = activeSubject?.policies?.[0];
      const policyData = policy?.data || {};
      const ttcs = policyData.ttcs?.[0] || {};

      await schoolExpenseApi.saveAll(schoolExpenseId, {
        subjectId: activeSubjectId,
        revenueItems: inputRows.map((row, index) => ({
          rowIndex: index,
          subjectId: activeSubjectId,
          totalPeriods: Number(row.totalPeriods || 0),
          studentCount: Number(row.studentCount || 0),
          monthsCount: Number(row.monthsCount || 1),
          unitPrice: Number(row.unitPrice || 0),
          invoiced: row.invoiced || false,
          invoiceType: row.invoiceType || undefined,
          invoiceOther:
            row.invoiceType === "other" ? row.invoiceOther : undefined,
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
            monthsCount: Number(inputRow.monthsCount || 1),
            teacherUnitPrice: Number(
              row.teacherUnitPrice ?? policyData.giaovien ?? 0,
            ),
            taxUnitPrice: Number(
              row.taxUnitPrice ?? policyData.thue ?? policyData.tax ?? 0,
            ),
            csvcUnitPrice: Number(
              row.csvcUnitPrice ?? policyData.csvc ?? 0,
            ),
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
            monthsCount: Number(inputRow.monthsCount || 1),
            ql1UnitPrice: Number((ttcs.ql1Percent || 0) - (ttcs.ql1Tax || 0)),
            ql2UnitPrice: Number((ttcs.ql2Percent || 0) - (ttcs.ql2Tax || 0)),
            invoiceAmount: Number(row.invoiceAmount || 0),
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
      const message =
        error?.response?.data?.message || error?.message || "Có lỗi xảy ra";
      toast.error(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
    }
  };

  // CANCEL EDIT
  const handleCancelEdit = () => {
    setEditingItem(null);

    setRevenueRows([initialExpenseRow]);
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
  console.log("activeSubject", activeSubject);
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
    if (activeSubjectId && schoolExpenseId) {
      loadExpenseData(activeSubjectId);
    }
  }, [schoolExpenseId]);

  const schoolYears = useMemo(() => {
    if (!subjects.length) return [];
    return [...new Set(subjects.map((s: any) => s.schoolYear).filter(Boolean))];
  }, [subjects]);

  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Chi tiết thu chi" />

      <div className="space-y-5 pb-32">
        {/* STEP 1: NĂM HỌC + THÁNG */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
          <h3 className="font-semibold text-slate-700 text-sm">
            📅 Chọn kỳ thu chi
          </h3>

          <div className="flex gap-3 flex-wrap">
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="h-11 flex-1 min-w-[160px] rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">🎓 Tất cả năm học</option>
              {schoolYears.map((y: string) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* STEP 2: CHỌN MÔN */}
        <Tabs
          tab={tab}
          setTab={setTab}
          subjects={subjects}
          setSubjectId={setSubjectId}
        />

        {/* SUBJECT */}
        {tab.startsWith("subject-") && activeSubject && (
          <div className="space-y-5">
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
            <div className="bg-white rounded-3xl p-2 flex gap-2 shadow-sm">
              <button
                onClick={() => setSubTab("expense")}
                className={`
          flex-1 h-12 rounded-2xl font-semibold transition-all
          ${
            subTab === "expense"
              ? "bg-blue-600 text-white shadow-lg"
              : "text-slate-500 hover:bg-slate-100"
          }
        `}
              >
                Thu chi
              </button>

              <button
                onClick={() => setSubTab("cash-policy")}
                className={`
          flex-1 h-12 rounded-2xl font-semibold transition-all
          ${
            subTab === "cash-policy"
              ? "bg-orange-500 text-white shadow-lg"
              : "text-slate-500 hover:bg-slate-100"
          }
        `}
              >
                Chính sách tiền mặt
              </button>
            </div>

            {/* EXPENSE */}
            {subTab === "expense" && (
              <div className="space-y-5">
                <InputExpenseTable
                  rows={inputRows}
                  defaultFee={Number(
                    activeSubject?.policies?.[0]?.data?.fee || 0,
                  )}
                  onUpdate={updateInputRow}
                  onAdd={addInputRow}
                  onRemove={removeInputRow}
                  classCount={activeSubject.classCount}
                />
                <ExpenseFormTable
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
                />

                {/* SAVED DATA */}
                {(savedRevenues.length > 0 ||
                  savedSchoolItems.length > 0 ||
                  savedMgmtItems.length > 0) && (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-5 bg-slate-800 text-white font-bold text-xl">
                      📋 Dữ liệu đã lưu
                    </div>

                    {/* REVENUE */}
                    {savedRevenues.length > 0 && (
                      <div>
                        <div className="px-6 py-4 bg-indigo-50 text-indigo-700 text-lg font-bold border-b">
                          💰 Doanh Thu ({savedRevenues.length})
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-lg whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-900 text-white font-bold">
                                <th className="px-5 py-4 text-left">Số tiết</th>
                                <th className="px-5 py-4 text-left">HS</th>
                                <th className="px-5 py-4 text-left">Tháng</th>
                                <th className="px-5 py-4 text-right">Đơn giá</th>
                                <th className="px-5 py-4 text-right">Thành tiền</th>
                                <th className="px-5 py-4 text-center">HĐ</th>
                                <th className="px-5 py-4 text-left">Ngày xuất HĐ</th>
                                <th className="px-5 py-4 text-right">Đã thu</th>
                                <th className="px-5 py-4 text-left">Hình thức</th>
                                <th className="px-5 py-4 text-left">Ngày thu</th>
                                <th className="px-5 py-4 text-right">Còn lại</th>
                              </tr>
                            </thead>
                            <tbody>
                              {savedRevenues.map((r: any) => {
                                const invoiceAmount =
                                  Number(r.invoiceAmount || 0) ||
                                  Number(r.studentCount || 0) *
                                    Number(r.monthsCount || 0) *
                                    Number(r.unitPrice || 0);
                                const remaining =
                                  invoiceAmount - Number(r.paidAmount || 0);

                                const invoiceLabel =
                                  r.invoiceType === "company"
                                    ? "Xuất HĐ Cty"
                                    : r.invoiceType === "student"
                                      ? "Xuất HĐ HS"
                                      : r.invoiceType === "none"
                                        ? "Không xuất"
                                        : r.invoiceType === "other"
                                          ? r.invoiceOther || "Khác"
                                          : "-";

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
                                      {Number(
                                        r.unitPrice || 0,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-blue-700">
                                      {invoiceAmount.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-center font-semibold">
                                      {invoiceLabel}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
                                      {r.invoiceDate || "-"}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-green-700">
                                      {Number(
                                        r.paidAmount || 0,
                                      ).toLocaleString()}
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
                        <div className="px-6 py-4 bg-blue-50 text-blue-700 text-lg font-bold border-y">
                          🏫 Chi Trường ({savedSchoolItems.length})
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-lg whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-900 text-white font-bold">
                                <th className="px-5 py-4 text-left">Số tiết</th>
                                <th className="px-5 py-4 text-left">HS</th>
                                <th className="px-5 py-4 text-left">Tháng</th>
                                <th className="px-5 py-4 text-right">ĐG GV</th>
                                <th className="px-5 py-4 text-right">Giáo viên</th>
                                <th className="px-5 py-4 text-right">ĐG Thuế</th>
                                <th className="px-5 py-4 text-right">Thuế</th>
                                <th className="px-5 py-4 text-right">ĐG CSVC</th>
                                <th className="px-5 py-4 text-right">CSVC</th>
                                <th className="px-5 py-4 text-right">Chi trường</th>
                                <th className="px-5 py-4 text-right">Đã chi</th>
                                <th className="px-5 py-4 text-right">Còn lại</th>
                                <th className="px-5 py-4 text-left">Ngày chi</th>
                                <th className="px-5 py-4 text-left">Người chi</th>
                                <th className="px-5 py-4 text-left">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
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
                                const csvcAmt = students * csvcUP;
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
                                      {Number(
                                        r.paidAmount || 0,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-orange-700">
                                      {remaining.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
                                      {r.expenseDate || "-"}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
                                      {r.payer || "-"}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
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

                    {/* MANAGEMENT */}
                    {savedMgmtItems.length > 0 && (
                      <div>
                        <div className="px-6 py-4 bg-emerald-50 text-emerald-700 text-lg font-bold border-y">
                          💸 Chi Ngoài ({savedMgmtItems.length})
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-lg whitespace-nowrap">
                            <thead>
                              <tr className="bg-slate-900 text-white font-bold">
                                <th className="px-5 py-4 text-left">Số tiết</th>
                                <th className="px-5 py-4 text-left">HS</th>
                                <th className="px-5 py-4 text-left">Tháng</th>
                                <th className="px-5 py-4 text-right">ĐG QL1</th>
                                <th className="px-5 py-4 text-right">Chi QL1</th>
                                <th className="px-5 py-4 text-right">ĐG QL2</th>
                                <th className="px-5 py-4 text-right">Chi QL2</th>
                                <th className="px-5 py-4 text-right">Tổng chi ngoài</th>
                                <th className="px-5 py-4 text-right">Tiền HĐ</th>
                                <th className="px-5 py-4 text-right">Đã chi</th>
                                <th className="px-5 py-4 text-right">Còn chi</th>
                                <th className="px-5 py-4 text-left">Ngày chi</th>
                                <th className="px-5 py-4 text-left">Người chi</th>
                                <th className="px-5 py-4 text-left">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {savedMgmtItems.map((r: any) => {
                                const students = Number(r.studentCount || 0);
                                const months = Number(r.monthsCount || 0);
                                const ql1UP = Number(r.ql1UnitPrice || 0);
                                const ql2UP = Number(r.ql2UnitPrice || 0);
                                const ql1Amt =
                                  Number(r.ql1Amount || 0) ||
                                  ql1UP * students * months;
                                const ql2Amt =
                                  Number(r.ql2Amount || 0) ||
                                  ql2UP * students * months;
                                const totalOutside =
                                  Number(r.totalOutside || 0) ||
                                  ql1Amt + ql2Amt;
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
                                    <td className="px-5 py-4 text-right font-bold text-emerald-700">
                                      {ql1Amt.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-semibold">
                                      {ql2UP.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-cyan-700">
                                      {ql2Amt.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-red-600">
                                      {totalOutside.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-blue-600">
                                      {Number(
                                        r.invoiceAmount || 0,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-green-700">
                                      {Number(
                                        r.paidAmount || 0,
                                      ).toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-orange-700">
                                      {remaining.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
                                      {r.expenseDate || "-"}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
                                      {r.payer || "-"}
                                    </td>
                                    <td className="px-5 py-4 font-semibold">
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
                  </div>
                )}
              </div>
            )}

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
    </div>
  );
}
