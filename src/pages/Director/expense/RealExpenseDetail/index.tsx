// pages/RealExpenseDetail/index.tsx

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import HeaderWithBack from "@/components/HeaderWithBack";
import Tabs from "./components/Tabs";
import Pagination from "./components/Pagination";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { subjectApi } from "@/service/subject.api";
import { expenseItemApi } from "@/service/expenseItem";
import { expensePeriodApi } from "@/service/expensePeriod";
import ExpenseFormTable from "../component/expense/ExpenseFormTable";
import ExpenseList from "../component/expense/ExpenseList";
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
  invoiceDate: "",
  paid: false,
  paymentMethod: "",
  paymentDate: "",
  remainingAmount: 0,
};

const initialRevenueRow: RevenueRow = {
  subjectId: 0,
  invoiceAmount: 0,
  collectedDate: "",
};

const initialManagementRow: ManagementRow = {
  totalOutsideExpense: 0,
  paidAmount: 0,
  remainingOutsideExpense: 0,
  paymentDate: "",
  payer: "",
  note: "",
};
export default function RealExpenseDetail({
  schoolExpenseId,
  school,
}: RealExpenseDetailProps) {
  const [tab, setTab] = useState<string>("expense");
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);

  const [periods, setPeriods] = useState<any[]>([]);

  const [subjects, setSubjects] = useState<any[]>([]);

  const [data, setData] = useState<any[]>([]);

  const [editingItem, setEditingItem] = useState<any>(null);

  const [subjectId, setSubjectId] = useState<number>(0);

  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [subTab, setSubTab] = useState<"expense" | "cash-policy">("expense");

  const [inputData, setInputData] = useState<InputExpenseRow>(initialInputData);

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
  // FETCH DATA
  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await schoolExpenseApi.getAll({
        schoolId: school?.id,
        periodId: selectedPeriod?.id,
      });

      if (school?.id) {
        await fetchSubjects(Number(school.id), selectedSchoolYear);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    fetchPeriods();
  }, [selectedPeriod, selectedSchoolYear]);

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
    setRevenueRows((prev) => [...prev, initialRevenueRow]);
  };

  const addManagementRow = () => {
    setManagementRows((prev) => [...prev, initialManagementRow]);
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

  // SUBMIT EXPENSE
  const handleSubmit = async () => {
    /* try {
      const validRows = revenueRows.filter(
        (row) =>
          row.subjectId ||
          row.invoiceAmount ||
          row.totalOutsideExpense ||
          row.paidAmount,
      );

      if (validRows.length === 0) {
        toast.error("Vui lòng nhập dữ liệu");

        return;
      }

      setLoading(true);

      if (editingItem) {
        const row = validRows[0];

        await expenseItemApi.update(editingItem.id, {
          schoolExpenseId: Number(schoolExpenseId),

          subjectId: Number(subjectId),

          totalPeriods: Number(row.totalPeriods || 0),

          studentCount: Number(row.studentCount || 0),

          revenueAmount: Number(row.invoiceAmount || 0),

          invoiceAmount: Number(row.invoiceAmount || 0),

          collectedDate: row.collectedDate || undefined,

          totalOutsideExpense: Number(row.totalOutsideExpense || 0),

          paidAmount: Number(row.paidAmount || 0),

          remainingOutsideExpense: Number(row.remainingOutsideExpense || 0),

          expenseAmount: Number(row.paidAmount || 0),

          paymentDate: row.paymentDate || undefined,

          payer: row.payer || "",

          note: row.note || "",
        });

        toast.success("Cập nhật thành công");

        setEditingItem(null);
      } else {
        await Promise.all(
          validRows.map(async (row) => {
            return expenseItemApi.create({
              schoolExpenseId: Number(schoolExpenseId),

              subjectId: Number(subjectId),

              totalPeriods: Number(row.totalPeriods || 0),

              studentCount: Number(row.studentCount || 0),

              revenueAmount: Number(row.invoiceAmount || 0),

              invoiceAmount: Number(row.invoiceAmount || 0),

              collectedDate: row.collectedDate || undefined,

              totalOutsideExpense: Number(row.totalOutsideExpense || 0),

              paidAmount: Number(row.paidAmount || 0),

              remainingOutsideExpense: Number(row.remainingOutsideExpense || 0),

              expenseAmount: Number(row.paidAmount || 0),

              paymentDate: row.paymentDate || undefined,

              payer: row.payer || "",

              note: row.note || "",
            });
          }),
        );

        toast.success("Lưu dữ liệu thành công");
      }

      setRevenueRows([initialExpenseRow]);

      await fetchData();
    } catch (error: any) {
      console.log(error);

      const message =
        error?.response?.data?.message || error?.message || "Có lỗi xảy ra";

      toast.error(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
    } */
  };

  // EDIT EXPENSE
  const handleEdit = (item: any) => {
    setRevenueRows([
      {
        subjectId: subjectId || 0,

        totalPeriods: String(item.totalPeriods || ""),

        studentCount: String(item.studentCount || ""),

        invoiceAmount: String(item.invoiceAmount || ""),

        collectedDate: item.collectedDate || "",

        totalOutsideExpense: String(item.totalOutsideExpense || ""),

        paidAmount: String(item.paidAmount || ""),

        remainingOutsideExpense: String(item.remainingOutsideExpense || ""),

        paymentDate: item.paymentDate || "",

        payer: item.payer || "",

        note: item.note || "",
      },
    ]);

    setEditingItem(item);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // DELETE EXPENSE
  const handleDelete = async (id: number) => {
    const confirmDelete = window.confirm(
      "Bạn có chắc muốn xoá khoản thu chi này?",
    );

    if (!confirmDelete) return;

    try {
      await expenseItemApi.delete(id);

      toast.success("Xoá thành công");

      await fetchData();
    } catch (error) {
      console.log(error);

      toast.error("Xoá thất bại");
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
  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Chi tiết thu chi" />

      <div className="space-y-5 pb-32">
        {/* TABS */}
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
                <PolicyFinanceTable policy={activeSubject.policies?.[0]} />

                <TtcsTable policy={activeSubject.policies?.[0]} />

                <CashPolicyTable policy={activeSubject.policies?.[0]} />

                <DevicePolicyTable policy={activeSubject.policies?.[0]} />
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
                  data={inputData}
                  onChange={(field, value) =>
                    setInputData((prev) => ({
                      ...prev,
                      [field]: value,
                    }))
                  }
                  subjects={activeSubject}
                />
                <ExpenseFormTable
                  inputData={inputData}
                  revenueRows={revenueRows}
                  managementRows={managementRows}
                  subjects={activeSubject}
                  editingItem={editingItem}
                  loading={loading}
                  addRevenueRow={addRevenueRow}
                  addManagementRow={addManagementRow}
                  removeRevenueRow={removeRevenueRow}
                  removeManagementRow={removeManagementRow}
                  updateRevenueRow={updateRevenueRow}
                  updateManagementRow={updateManagementRow}
                  handleSubmit={handleSubmit}
                  handleCancelEdit={handleCancelEdit}
                />

                <ExpenseList
                  data={data}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
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
