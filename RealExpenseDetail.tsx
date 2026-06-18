// pages/RealExpenseDetail.tsx

import { useEffect, useMemo, useState } from "react";

import { useLocation, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import HeaderWithBack from "@/components/HeaderWithBack";

import {
  Landmark,
  Receipt,
  Wallet,
  BadgeDollarSign,
  Plus,
  School2,
  Trash2,
  Pencil,
  Save,
} from "lucide-react";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { subjectApi } from "@/service/subject.api";
import { expenseItemApi } from "@/service/expenseItem";
import { cashPolicyItemApi } from "@/service/cashPolicyItem";
import { expensePeriodApi } from "@/service/expensePeriod";
import { StatCard } from "./component/StatCard";
type ExpenseRow = {
  subjectId: string;

  totalPeriods: string;

  // thêm
  studentCount: string;

  invoiceAmount: string;

  collectedDate: string;

  totalOutsideExpense: string;

  paidAmount: string;

  remainingOutsideExpense: string;

  paymentDate: string;

  payer: string;

  note: string;
};
export default function RealExpenseDetail() {
  const { schoolExpenseId } = useParams();
  const [editingCashPolicyId, setEditingCashPolicyId] = useState<number | null>(
    null,
  );
  const location = useLocation();
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const school = location.state?.school;
  const [data, setData] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [periods, setPeriods] = useState<any[]>([]);

  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  const [subjects, setSubjects] = useState<any[]>([]);
  type CashPolicyRow = {
    payer: string;

    cashPolicyAmount: string;

    otherAmount: string;

    paymentDate: string;

    note: string;
  };
  const fetchPeriods = async () => {
    try {
      const res = await expensePeriodApi.getAll({
        page: 1,
        limit: 100,
      });
      console.log(res);
      setPeriods(res || []);
    } catch (error) {
      console.log(error);
    }
  };
  const [cashPolicyRows, setCashPolicyRows] = useState<CashPolicyRow[]>([
    {
      payer: "",

      cashPolicyAmount: "",

      otherAmount: "",

      paymentDate: "",

      note: "",
    },
  ]);
  const [tab, setTab] = useState<"expense" | "cash-policy" | "summary">(
    "expense",
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([
    {
      subjectId: "",

      totalPeriods: "",

      studentCount: "",

      invoiceAmount: "",

      collectedDate: "",

      totalOutsideExpense: "",

      paidAmount: "",

      remainingOutsideExpense: "",

      paymentDate: "",

      payer: "",

      note: "",
    },
  ]);

  const fetchSubjects = async (schoolId: number) => {
    try {
      const res = await subjectApi.getBySchool(schoolId);
      setSubjects(res || []);
    } catch (error) {
      console.log(error);
    }
  };
  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await schoolExpenseApi.getAll({
        schoolId: school?.id,
        periodId: selectedPeriod?.id,
      });
      console.log("school expense", res);
      setData(res);

      if (school?.id) {
        await fetchSubjects(Number(school.id));
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
  }, [selectedPeriod]);

  const addRow = () => {
    setExpenseRows((prev) => [
      ...prev,
      {
        subjectId: "",

        totalPeriods: "",

        invoiceAmount: "",

        collectedDate: "",

        studentCount: "",

        totalOutsideExpense: "",

        paidAmount: "",

        remainingOutsideExpense: "",

        paymentDate: "",

        payer: "",

        note: "",
      },
    ]);
  };

  const updateRow = (index: number, field: keyof ExpenseRow, value: string) => {
    setExpenseRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const updated = {
          ...row,
          [field]: value,
        };

        const total = Number(updated.totalOutsideExpense || 0);

        const paid = Number(updated.paidAmount || 0);

        return {
          ...updated,
          remainingOutsideExpense: String(total - paid),
        };
      }),
    );
  };
  const removeRow = (index: number) => {
    setExpenseRows((prev) => prev.filter((_, i) => i !== index));
  };
  // TOTALS

  const totalRevenue = useMemo(() => {
    return (data || []).reduce(
      (sum: number, schoolExpense: any) =>
        sum + Number(schoolExpense.totalRevenue || 0),
      0,
    );
  }, [data]);

  const totalExpense = useMemo(() => {
    return (data || []).reduce(
      (sum: number, schoolExpense: any) =>
        sum + Number(schoolExpense.totalExpense || 0),
      0,
    );
  }, [data]);

  const totalCashPolicy = useMemo(() => {
    return (data || []).reduce(
      (sum: number, schoolExpense: any) =>
        sum + Number(schoolExpense.totalCashPolicy || 0),
      0,
    );
  }, [data]);

  const profit = useMemo(() => {
    return totalRevenue - totalExpense - totalCashPolicy;
  }, [totalRevenue, totalExpense, totalCashPolicy]);

  const money = (value: number) => {
    return Number(value || 0).toLocaleString("vi-VN");
  };
  const handleSubmit = async () => {
    try {
      const validRows = expenseRows.filter(
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

          subjectId: Number(row.subjectId),

          totalPeriods: Number(row.totalPeriods || 0),

          revenueAmount: Number(row.invoiceAmount || 0),

          invoiceAmount: Number(row.invoiceAmount || 0),

          collectedDate: row.collectedDate || undefined,

          totalOutsideExpense: Number(row.totalOutsideExpense || 0),

          paidAmount: Number(row.paidAmount || 0),

          studentCount: Number(row.studentCount || 0),

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

              subjectId: Number(row.subjectId),

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

      // RESET
      setExpenseRows([
        {
          subjectId: "",

          totalPeriods: "",

          invoiceAmount: "",

          collectedDate: "",

          totalOutsideExpense: "",

          paidAmount: "",

          studentCount: "",

          remainingOutsideExpense: "",

          paymentDate: "",

          payer: "",

          note: "",
        },
      ]);

      await fetchData();
    } catch (error) {
      console.log(error);

      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };
  const handleEdit = (item: any) => {
    setExpenseRows([
      {
        subjectId: String(item.subject?.id || item.subjectId || ""),

        totalPeriods: String(item.totalPeriods || ""),

        invoiceAmount: String(item.invoiceAmount || ""),

        collectedDate: item.collectedDate || "",

        totalOutsideExpense: String(item.totalOutsideExpense || ""),

        studentCount: String(item.studentCount || ""),

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

  const handleDelete = async (id: number) => {
    const confirmDelete = window.confirm(
      "Bạn có chắc muốn xoá khoản thu chi này?",
    );

    if (!confirmDelete) return;

    try {
      setLoadingDeleteId(id);

      await expenseItemApi.delete(id);

      toast.success("Xoá thành công");

      await fetchData();
    } catch (error) {
      console.log(error);

      toast.error("Xoá thất bại");
    } finally {
      setLoadingDeleteId(null);
    }
  };
  const addCashPolicyRow = () => {
    setCashPolicyRows((prev) => [
      ...prev,
      {
        payer: "",
        cashPolicyAmount: "",
        otherAmount: "",
        paymentDate: "",
        note: "",
      },
    ]);
  };
  const removeCashPolicyRow = (index: number) => {
    setCashPolicyRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCashPolicyRow = (
    index: number,
    field: keyof CashPolicyRow,
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
  };

  const handleSubmitCashPolicy = async () => {
    try {
      const validRows = cashPolicyRows.filter(
        (row) => row.payer || row.cashPolicyAmount || row.otherAmount,
      );

      if (validRows.length === 0) {
        toast.error("Vui lòng nhập dữ liệu");

        return;
      }

      setLoading(true);

      // UPDATE
      if (editingCashPolicyId) {
        const row = validRows[0];

        await cashPolicyItemApi.update(editingCashPolicyId, {
          payer: row.payer,

          cashPolicyAmount: Number(row.cashPolicyAmount || 0),

          otherAmount: Number(row.otherAmount || 0),

          paymentDate: row.paymentDate || undefined,

          note: row.note,
        });

        toast.success("Cập nhật thành công");

        setEditingCashPolicyId(null);
      }

      // CREATE
      else {
        await Promise.all(
          validRows.map(async (row) => {
            return cashPolicyItemApi.create({
              schoolExpenseId: Number(schoolExpenseId),

              payer: row.payer,

              cashPolicyAmount: Number(row.cashPolicyAmount || 0),

              otherAmount: Number(row.otherAmount || 0),

              paymentDate: row.paymentDate || undefined,

              note: row.note,
            });
          }),
        );

        toast.success("Lưu thành công");
      }

      // RESET
      setCashPolicyRows([
        {
          payer: "",

          cashPolicyAmount: "",

          otherAmount: "",

          paymentDate: "",

          note: "",
        },
      ]);

      await fetchData();
    } catch (error) {
      console.log(error);

      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteCashPolicy = async (id: number) => {
    try {
      await cashPolicyItemApi.delete(id);

      toast.success("Đã xoá dữ liệu");

      await fetchData();
    } catch (error) {
      console.error(error);

      toast.error("Xóa thất bại");
    }
  };
  const handleEditCashPolicy = (item: any) => {
    setEditingCashPolicyId(item.id);

    setCashPolicyRows([
      {
        payer: item.payer || "",

        cashPolicyAmount: String(item.cashPolicyAmount || ""),

        otherAmount: String(item.otherAmount || ""),

        paymentDate: item.paymentDate?.slice(0, 10) || "",

        note: item.note || "",
      },
    ]);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };
  const filteredExpenseItems = useMemo(() => {
    const items = data?.expenseItems || [];

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

  const paginatedExpenseItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredExpenseItems.slice(start, start + pageSize);
  }, [filteredExpenseItems, currentPage]);
  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Chi tiết thu chi" />

      <div className="mt-[60px] p-4 space-y-5 pb-32">
        {/* HERO */}
        <div
          key={school?.id}
          className="
      relative overflow-hidden
      rounded-3xl
      bg-gradient-to-r
      from-blue-600
      to-indigo-700
      p-5
      shadow-xl
    "
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-blue-100 text-sm">Quản lý thực chi</p>

                <h1 className="text-white text-2xl font-bold mt-2 leading-tight">
                  {school?.name}
                </h1>

                <p className="text-blue-100 text-sm mt-2">
                  {school?.period?.name}
                </p>
              </div>

              <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur">
                <School2 className="text-white" size={30} />
              </div>
            </div>
          </div>
        </div>
        {/* STATS */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Doanh thu"
            value={money(totalRevenue)}
            icon={<Receipt className="text-blue-600" />}
            color="blue"
          />

          <StatCard
            title="Chi phí"
            value={money(totalExpense)}
            icon={<Wallet className="text-red-500" />}
            color="red"
          />

          <StatCard
            title="CS tiền mặt"
            value={money(totalCashPolicy)}
            icon={<Landmark className="text-orange-500" />}
            color="orange"
          />

          <StatCard
            title="Lợi nhuận"
            value={money(profit)}
            icon={<BadgeDollarSign className="text-emerald-600" />}
            color="emerald"
          />
        </div>

        {/* TAB */}
        <div className="bg-white rounded-3xl p-2 flex gap-2 shadow-sm">
          <button
            onClick={() => setTab("expense")}
            className={`flex-1 h-12 rounded-2xl font-semibold transition-all ${
              tab === "expense"
                ? "bg-blue-600 text-white shadow-lg"
                : "text-slate-500"
            }`}
          >
            Thu chi
          </button>

          <button
            onClick={() => setTab("cash-policy")}
            className={`flex-1 h-12 rounded-2xl font-semibold transition-all ${
              tab === "cash-policy"
                ? "bg-orange-500 text-white shadow-lg"
                : "text-slate-500"
            }`}
          >
            Chính sách
          </button>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {/* EXPENSE */}
            {tab === "expense" && (
              <div className="space-y-5">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200">
                  {/* HEADER */}
                  <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">
                        Quản lý thu chi
                      </h2>
                    </div>
                  </div>
                  {/* TABLE */}
                  <div className="overflow-x-auto bg-white">
                    <div className="min-w-[1810px]">
                      {/* HEADER */}
                      <div
                        className="
    sticky top-0 z-30
    grid
    grid-cols-[260px_110px_120px_180px_160px_180px_160px_180px_160px_180px_260px_120px]
    bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900
    text-white
    text-[12px]
    font-semibold
    uppercase
    tracking-wide
    border-b border-white/10
    shadow-xl
    backdrop-blur
  "
                      >
                        {[
                          {
                            label: "Môn học",
                            icon: "📚",
                          },
                          {
                            label: "Số tiết",
                            icon: "🕒",
                          },
                          {
                            label: "Số HS",
                            icon: "👨‍🎓",
                          },
                          {
                            label: "Tiền HĐ",
                            icon: "💰",
                          },
                          {
                            label: "Ngày thu",
                            icon: "📅",
                          },
                          {
                            label: "Chi ngoài",
                            icon: "💸",
                          },
                          {
                            label: "Đã chi",
                            icon: "🏦",
                          },
                          {
                            label: "Còn chi",
                            icon: "📊",
                          },
                          {
                            label: "Ngày chi",
                            icon: "📆",
                          },
                          {
                            label: "Người chi",
                            icon: "👤",
                          },
                          {
                            label: "Ghi chú",
                            icon: "📝",
                          },
                          {
                            label: "TT",
                            icon: "⚙️",
                          },
                        ].map((item, index) => (
                          <div
                            key={index}
                            className={`
        flex items-center gap-2
        px-4 py-3
        border-r border-white/10
        last:border-r-0
        whitespace-nowrap
        ${index === 10 ? "justify-center" : ""}
      `}
                          >
                            <span className="text-sm opacity-90">
                              {item.icon}
                            </span>

                            <span className="truncate">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      {/* BODY */}
                      <div className="divide-y divide-slate-100">
                        {expenseRows.map((row, index) => (
                          <div
                            key={index}
                            className={`
                              grid
                              items-stretch
                              grid-cols-[260px_110px_120px_180px_160px_180px_160px_180px_160px_180px_260px_120px]
                              transition-all duration-200
                              hover:bg-blue-50/40
                              ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
                            `}
                          >
                            {/* SUBJECT */}
                            <div className="p-2 border-r border-slate-100">
                              <select
                                value={row.subjectId}
                                onChange={(e) =>
                                  updateRow(index, "subjectId", e.target.value)
                                }
                                className="
                w-full h-11 rounded-xl
                border border-slate-200
                bg-white
                px-3 text-sm
                focus:ring-2 focus:ring-blue-200
                focus:border-blue-400
                outline-none
                transition
              "
                              >
                                <option value="">Chọn môn học</option>

                                {subjects.map((subject: any) => (
                                  <option key={subject.id} value={subject.id}>
                                    {subject.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* TOTAL */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                type="number"
                                value={row.totalPeriods || ""}
                                onChange={(e) =>
                                  updateRow(
                                    index,
                                    "totalPeriods",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="
                w-full h-11 rounded-xl
                border border-slate-200
                px-3 text-sm
                focus:ring-2 focus:ring-blue-200
                outline-none
              "
                              />
                            </div>
                            {/* STUDENT COUNT */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                type="number"
                                value={row.studentCount || ""}
                                onChange={(e) =>
                                  updateRow(
                                    index,
                                    "studentCount",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="
      w-full h-11 rounded-xl
      border border-slate-200
      px-3 text-sm
      focus:ring-2 focus:ring-blue-200
      outline-none
    "
                              />
                            </div>
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={Number(
                                  row.invoiceAmount || 0,
                                ).toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");

                                  updateRow(index, "invoiceAmount", raw);
                                }}
                                placeholder="0"
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm font-semibold
                      text-blue-600
                    "
                              />
                            </div>

                            {/* COLLECT DATE */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                type="date"
                                value={row.collectedDate || ""}
                                onChange={(e) =>
                                  updateRow(
                                    index,
                                    "collectedDate",
                                    e.target.value,
                                  )
                                }
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm
                    "
                              />
                            </div>

                            {/* TOTAL OUTSIDE */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={Number(
                                  row.totalOutsideExpense || 0,
                                ).toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");

                                  updateRow(index, "totalOutsideExpense", raw);
                                }}
                                placeholder="0"
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm font-semibold
                      text-red-500
                    "
                              />
                            </div>

                            {/* PAID */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={Number(
                                  row.paidAmount || 0,
                                ).toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");

                                  updateRow(index, "paidAmount", raw);
                                }}
                                placeholder="0"
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm font-semibold
                      text-orange-500
                    "
                              />
                            </div>

                            {/* REMAIN */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={Number(
                                  row.remainingOutsideExpense || 0,
                                ).toLocaleString("vi-VN")}
                                readOnly
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      bg-slate-50
                      px-3 text-sm font-bold
                      text-purple-600
                    "
                              />
                            </div>

                            {/* PAYMENT DATE */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                type="date"
                                value={row.paymentDate || ""}
                                onChange={(e) =>
                                  updateRow(
                                    index,
                                    "paymentDate",
                                    e.target.value,
                                  )
                                }
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm
                    "
                              />
                            </div>

                            {/* PAYER */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={row.payer || ""}
                                onChange={(e) =>
                                  updateRow(index, "payer", e.target.value)
                                }
                                placeholder="Người chi"
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm
                    "
                              />
                            </div>

                            {/* NOTE */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={row.note || ""}
                                onChange={(e) =>
                                  updateRow(index, "note", e.target.value)
                                }
                                placeholder="Ghi chú..."
                                className="
                      w-full h-11 rounded-lg
                      border border-slate-200
                      px-3 text-sm
                    "
                              />
                            </div>

                            {/* DELETE */}
                            <div
                              className="
    h-full
    px-2
    border-l border-slate-100
    flex items-center justify-center
  "
                            >
                              <button
                                onClick={() => removeRow(index)}
                                className="
      group relative
      w-10 h-10
      rounded-xl
      bg-red-50
      border border-red-100
      text-red-500
      hover:bg-red-500
      hover:text-white
      transition-all duration-200
      flex items-center justify-center
    "
                              >
                                <Trash2
                                  size={17}
                                  className="transition-transform group-hover:scale-110"
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* FOOTER */}
                  <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5">
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                      {/* LEFT */}
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {editingItem
                            ? "Đang chỉnh sửa khoản thu chi"
                            : "Thêm dữ liệu thu chi"}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          {editingItem
                            ? "Sau khi chỉnh sửa hãy nhấn cập nhật để lưu thay đổi"
                            : "Có thể nhập nhiều dòng cùng lúc như Excel"}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* ADD ROW */}
                        <button
                          onClick={addRow}
                          className="
          h-12 px-5 rounded-2xl
          bg-white
          border border-slate-200
          text-slate-700 font-semibold
          hover:border-blue-300
          hover:bg-blue-50
          hover:text-blue-600
          transition-all
          flex items-center gap-2
          shadow-sm
        "
                        >
                          <Plus size={18} />

                          <span>Thêm dòng</span>
                        </button>

                        {/* CANCEL */}
                        {editingItem && (
                          <button
                            onClick={() => {
                              setEditingItem(null);

                              setExpenseRows([
                                {
                                  subjectId: "",

                                  totalPeriods: "",

                                  invoiceAmount: "",

                                  collectedDate: "",

                                  totalOutsideExpense: "",

                                  paidAmount: "",

                                  studentCount: "",

                                  remainingOutsideExpense: "",

                                  paymentDate: "",

                                  payer: "",

                                  note: "",
                                },
                              ]);
                            }}
                            className="
            h-12 px-5 rounded-2xl
            bg-white
            border border-red-200
            text-red-500 font-semibold
            hover:bg-red-50
            transition-all
            shadow-sm
          "
                          >
                            Huỷ
                          </button>
                        )}

                        {/* SUBMIT */}
                        <button
                          onClick={handleSubmit}
                          disabled={loading}
                          className={`
          h-12 px-7 rounded-2xl
          text-white font-bold
          shadow-lg shadow-blue-200
          transition-all
          flex items-center gap-2
          ${
            loading
              ? "bg-slate-400 cursor-not-allowed"
              : editingItem
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-blue-600 hover:bg-blue-700"
          }
        `}
                        >
                          {editingItem ? (
                            <>
                              <Pencil size={18} />

                              <span>Cập nhật</span>
                            </>
                          ) : (
                            <>
                              <Save size={18} />

                              <span>Lưu tất cả</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-4 shadow-sm">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* SEARCH */}
                    <input
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Tìm môn học, người chi..."
                      className="
        flex-1 h-12 rounded-xl
        border border-slate-200
        px-4
        outline-none
        focus:ring-2 focus:ring-blue-200
      "
                    />

                    {/* PERIOD */}
                    <select
                      value={selectedPeriod?.id || ""}
                      onChange={(e) => {
                        const period = periods.find(
                          (item: any) => item.id === Number(e.target.value),
                        );

                        setSelectedPeriod(period || null);
                      }}
                      className="
        h-12 w-full md:w-64
        rounded-xl
        border border-slate-200
        px-4
        outline-none
        focus:ring-2 focus:ring-blue-200
      "
                    >
                      <option value="">Tất cả kỳ</option>

                      {periods.map((period: any) => (
                        <option key={period.id} value={period.id}>
                          {period.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* LIST */}
                <div className="space-y-6">
                  {(data || []).length > 0 ? (
                    (data || []).map((schoolExpense: any) => (
                      <div
                        key={schoolExpense.id}
                        className="
            bg-white
            rounded-3xl
            p-5
            shadow-sm
            border border-slate-100
          "
                      >
                        <div className="mb-5">
                          <p
                            className="
      inline-flex items-center
      px-3 py-1
      rounded-full
      bg-blue-100
      text-blue-700
      text-sm
      font-semibold
      shadow-sm
    "
                          >
                            {schoolExpense.period?.name}
                          </p>
                        </div>

                        {/* ITEMS */}
                        <div className="space-y-4">
                          {schoolExpense.expenseItems?.length > 0 ? (
                            schoolExpense.expenseItems.map((item: any) => (
                              <ExpenseItemCard
                                key={item.id}
                                item={item}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                              />
                            ))
                          ) : (
                            <EmptyState text="Chưa có dữ liệu thu chi" />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="Không có dữ liệu" />
                  )}
                </div>
              </div>
            )}

            {/* CASH POLICY */}
            {tab === "cash-policy" && (
              <div className="space-y-5">
                {/* FORM */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* HEADER */}
                  <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">
                        Chính sách tiền mặt
                      </h2>
                    </div>

                    <button
                      onClick={addCashPolicyRow}
                      className="
            h-11 px-5 rounded-xl
            bg-orange-500 hover:bg-orange-600
            text-white font-semibold
            flex items-center gap-2
            transition-all shadow-sm
          "
                    >
                      <Plus size={18} />
                      <span>Thêm dòng</span>
                    </button>
                  </div>

                  {/* TABLE */}
                  <div className="overflow-auto max-h-[70vh]">
                    <div className="min-w-[1450px]">
                      {/* TABLE HEADER */}
                      <div
                        className="
              sticky top-0 z-30
              grid
              grid-cols-[260px_180px_180px_180px_1fr_90px]

              bg-gradient-to-r
              from-slate-800
              via-slate-700
              to-slate-800

              text-white
              text-[13px]
              font-bold
              uppercase
              tracking-wide
            "
                      >
                        {[
                          "Người chi",
                          "CS tiền mặt",
                          "Chi khác",
                          "Ngày chi",
                          "Ghi chú",
                          "",
                        ].map((label, index) => (
                          <div
                            key={index}
                            className="
                  h-14 px-4
                  flex items-center
                  border-r border-slate-600/50
                  last:border-r-0
                "
                          >
                            {label}
                          </div>
                        ))}
                      </div>

                      {/* BODY */}
                      <div className="divide-y divide-slate-100 bg-white">
                        {cashPolicyRows.map((row, index) => (
                          <div
                            key={index}
                            className={`
                  grid
                  grid-cols-[260px_180px_180px_180px_1fr_90px]
                  min-h-[72px]
                  transition-all

                  ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}

                  hover:bg-orange-50/40
                `}
                          >
                            {/* PAYER */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={row.payer || ""}
                                onChange={(e) =>
                                  updateCashPolicyRow(
                                    index,
                                    "payer",
                                    e.target.value,
                                  )
                                }
                                placeholder="Nhập người chi..."
                                className="
                      w-full h-11
                      rounded-xl
                      border border-slate-200
                      bg-white  
                      px-4
                      text-sm

                      focus:border-orange-500
                      focus:ring-4 focus:ring-orange-100
                      outline-none
                    "
                              />
                            </div>

                            {/* CASH POLICY */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={Number(
                                  row.cashPolicyAmount || 0,
                                ).toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");

                                  updateCashPolicyRow(
                                    index,
                                    "cashPolicyAmount",
                                    raw,
                                  );
                                }}
                                placeholder="0"
                                className="
                      w-full h-11
                      rounded-xl
                      border border-slate-200
                      bg-orange-50
                      px-4

                      text-right
                      text-sm
                      font-bold
                      text-orange-600

                      focus:border-orange-500
                      focus:ring-4 focus:ring-orange-100
                      outline-none
                    "
                              />
                            </div>

                            {/* OTHER */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={Number(
                                  row.otherAmount || 0,
                                ).toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");

                                  updateCashPolicyRow(
                                    index,
                                    "otherAmount",
                                    raw,
                                  );
                                }}
                                placeholder="0"
                                className="
                      w-full h-11
                      rounded-xl
                      border border-slate-200
                      bg-red-50
                      px-4

                      text-right
                      text-sm
                      font-bold
                      text-red-500

                      focus:border-red-400
                      focus:ring-4 focus:ring-red-100
                      outline-none
                    "
                              />
                            </div>

                            {/* DATE */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                type="date"
                                value={row.paymentDate || ""}
                                onChange={(e) =>
                                  updateCashPolicyRow(
                                    index,
                                    "paymentDate",
                                    e.target.value,
                                  )
                                }
                                className="
                      w-full h-11
                      rounded-xl
                      border border-slate-200
                      bg-white
                      px-4
                      text-sm

                      focus:border-orange-500
                      focus:ring-4 focus:ring-orange-100
                      outline-none
                    "
                              />
                            </div>

                            {/* NOTE */}
                            <div className="p-2 border-r border-slate-100">
                              <input
                                value={row.note || ""}
                                onChange={(e) =>
                                  updateCashPolicyRow(
                                    index,
                                    "note",
                                    e.target.value,
                                  )
                                }
                                placeholder="Nhập ghi chú..."
                                className="
                      w-full h-11
                      rounded-xl
                      border border-slate-200
                      bg-white
                      px-4
                      text-sm

                      focus:border-orange-500
                      focus:ring-4 focus:ring-orange-100
                      outline-none
                    "
                              />
                            </div>

                            {/* DELETE */}
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => removeCashPolicyRow(index)}
                                className="
                      w-10 h-10 rounded-xl

                      border border-slate-200
                      bg-white

                      text-slate-400

                      hover:bg-red-50
                      hover:border-red-200
                      hover:text-red-500

                      transition-all

                      flex items-center justify-center
                    "
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 flex justify-between items-center">
                    <div className="text-sm text-slate-500">
                      Tổng dòng:{" "}
                      <span className="font-bold text-slate-700">
                        {cashPolicyRows.length}
                      </span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={addCashPolicyRow}
                        className="
              h-11 px-5 rounded-xl
              border border-slate-200
              bg-white

              text-slate-700
              font-semibold

              hover:border-orange-300
              hover:bg-orange-50
              hover:text-orange-600

              transition-all

              flex items-center gap-2
            "
                      >
                        <Plus size={18} />
                        <span>Thêm dòng</span>
                      </button>

                      <button
                        onClick={handleSubmitCashPolicy}
                        className="
              h-11 px-6 rounded-xl
              bg-orange-500 hover:bg-orange-600

              text-white
              font-bold

              flex items-center gap-2

              shadow-sm
              transition-all
            "
                      >
                        <Save size={18} />
                        <span>
                          {editingCashPolicyId ? "Cập nhật" : "Lưu dữ liệu"}
                        </span>
                        {editingCashPolicyId && (
                          <button
                            onClick={() => {
                              setEditingCashPolicyId(null);

                              setCashPolicyRows([
                                {
                                  payer: "",
                                  cashPolicyAmount: "",
                                  otherAmount: "",
                                  paymentDate: "",
                                  note: "",
                                },
                              ]);
                            }}
                            className="
      h-11 px-5 rounded-xl
      border border-red-200
      text-red-500
      hover:bg-red-50
      transition-all
    "
                          >
                            Huỷ
                          </button>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* LIST */}
                <div className="space-y-6">
                  {data.length > 0 ? (
                    data.map((schoolExpense: any) => (
                      <div
                        key={schoolExpense.id}
                        className="
            bg-white
            rounded-3xl
            p-5
            shadow-sm
            border border-slate-100
          "
                      >
                        {/* SCHOOL */}
                        <div className="mb-5">
                          <h2 className="text-xl font-bold text-slate-900">
                            {schoolExpense.school?.name}
                          </h2>

                          <p className="text-sm text-slate-500 mt-1">
                            {schoolExpense.period?.name}
                          </p>
                        </div>

                        {/* CASH POLICY ITEMS */}
                        <div className="space-y-4">
                          {schoolExpense.cashPolicyItems?.length > 0 ? (
                            schoolExpense.cashPolicyItems.map((item: any) => (
                              <div
                                key={item.id}
                                className="
                      bg-slate-50
                      rounded-2xl
                      border border-slate-200
                      p-5
                    "
                              >
                                <div className="flex items-start justify-between">
                                  <div className="space-y-2">
                                    <div className="text-lg font-bold text-slate-800">
                                      {item.payer}
                                    </div>

                                    <div className="text-sm text-slate-500">
                                      CS tiền mặt:
                                      <span className="ml-2 font-bold text-orange-600">
                                        {Number(
                                          item.cashPolicyAmount || 0,
                                        ).toLocaleString("vi-VN")}
                                        đ
                                      </span>
                                    </div>

                                    <div className="text-sm text-slate-500">
                                      Chi khác:
                                      <span className="ml-2 font-bold text-red-500">
                                        {Number(
                                          item.otherAmount || 0,
                                        ).toLocaleString("vi-VN")}
                                        đ
                                      </span>
                                    </div>

                                    <div className="text-sm text-slate-400">
                                      {item.paymentDate?.slice(0, 10)}
                                    </div>

                                    {item.note && (
                                      <div className="text-sm text-slate-600">
                                        {item.note}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditCashPolicy(item)}
                                      className="
                            h-10 px-4 rounded-xl
                            border border-slate-200
                            hover:bg-orange-50
                          "
                                    >
                                      <Pencil size={18} />
                                    </button>

                                    <button
                                      onClick={() =>
                                        handleDeleteCashPolicy(item.id)
                                      }
                                      className="
                            h-10 px-4 rounded-xl
                            border border-red-200
                            text-red-500
                            hover:bg-red-50
                          "
                                    >
                                      <Trash2 size={17} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <EmptyState text="Chưa có dữ liệu chính sách tiền mặt" />
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="Không có dữ liệu" />
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="
      h-10 px-4 rounded-xl
      border border-slate-200
      disabled:opacity-50
    "
          >
            Trước
          </button>

          <div className="px-4 font-semibold">
            {currentPage} / {totalPages || 1}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="
      h-10 px-4 rounded-xl
      border border-slate-200
      disabled:opacity-50
    "
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}

// STAT CARD

// EXPENSE ITEM
function ExpenseItemCard({ item, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-xl text-slate-900">
            {item.subject?.name || "--"}
          </p>

          <div className="flex flex-wrap gap-3 mt-3">
            <div className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium">
              {item.totalPeriods || 0} tiết
            </div>
            <div className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
              {item.studentCount || 0} học sinh
            </div>
            <div className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 text-sm font-medium">
              Người chi: {item.payer || "--"}
            </div>
          </div>
        </div>

        {/* ACTION */}
        <div className="flex items-center gap-2">
          {/* EDIT */}
          <button
            onClick={() => onEdit(item)}
            className="
              w-11 h-11 rounded-xl
              bg-blue-50
              text-blue-600
              hover:bg-blue-100
              flex items-center justify-center
              transition
            "
          >
            <Pencil size={18} />
          </button>

          {/* DELETE */}
          <button
            onClick={() => onDelete(item.id)}
            className="
              w-11 h-11 rounded-xl
              bg-red-50
              text-red-500
              hover:bg-red-100
              flex items-center justify-center
              transition
            "
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* MONEY */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        <Item label="Doanh thu" value={item.revenueAmount} color="blue" />

        <Item label="Tiền hóa đơn" value={item.invoiceAmount} color="blue" />

        <Item label="Chi phí" value={item.expenseAmount} color="red" />

        <Item
          label="Chi ngoài HĐ"
          value={item.totalOutsideExpense}
          color="orange"
        />

        <Item label="Đã chi" value={item.paidAmount} color="red" />

        <Item
          label="Còn phải chi"
          value={item.remainingOutsideExpense}
          color="emerald"
        />
      </div>

      {/* DATE */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Ngày thu tiền</p>

          <p className="font-semibold text-slate-700 mt-2">
            {item.collectedDate || "--"}
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Ngày chi</p>

          <p className="font-semibold text-slate-700 mt-2">
            {item.paymentDate || "--"}
          </p>
        </div>
      </div>

      {/* NOTE */}
      {item.note && (
        <div className="mt-5 pt-5 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">Ghi chú</p>

          <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed">
            {item.note}
          </div>
        </div>
      )}
    </div>
  );
}

// ITEM
function Item({ label, value, color }: any) {
  const amount = Number(value || 0);

  return (
    <div className="bg-slate-100 rounded-2xl p-3">
      <p className="text-xs text-slate-400">{label}</p>

      <p
        className={`font-bold mt-2 ${
          color === "blue"
            ? "text-blue-600"
            : color === "red"
            ? "text-red-500"
            : color === "orange"
            ? "text-orange-500"
            : color === "emerald"
            ? "text-emerald-600"
            : "text-slate-900"
        }`}
      >
        {amount.toLocaleString("vi-VN")} đ
      </p>
    </div>
  );
}

// SUMMARY CARD
function SummaryCard({ label, value, color }: any) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-400">{label}</p>

        <p
          className={`text-2xl font-bold mt-2 ${
            color === "blue"
              ? "text-blue-600"
              : color === "red"
              ? "text-red-500"
              : color === "orange"
              ? "text-orange-500"
              : "text-emerald-600"
          }`}
        >
          {value} đ
        </p>
      </div>

      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          color === "blue"
            ? "bg-blue-100"
            : color === "red"
            ? "bg-red-100"
            : color === "orange"
            ? "bg-orange-100"
            : "bg-emerald-100"
        }`}
      >
        <Wallet />
      </div>
    </div>
  );
}

// EMPTY
function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
      <p className="text-slate-400">{text}</p>
    </div>
  );
}
