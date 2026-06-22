import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import HeaderWithBack from "@/components/HeaderWithBack";

import {
  Search,
  School2,
  ChevronRight,
  Wallet,
  TrendingUp,
  Landmark,
  BadgeDollarSign,
  Receipt,
} from "lucide-react";

import { schoolApi } from "@/service/school.api";
import { expensePeriodApi } from "@/service/expensePeriod";
import { schoolExpenseApi } from "@/service/schoolExpense";
import { StatCard } from "./component/StatCard";
import RealExpenseDetail from "./RealExpenseDetail/index";
type InfoCardProps = {
  label: string;
  value?: string | number | null;
  fullWidth?: boolean;
};

function InfoCard({ label, value }: InfoCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-sm transition-all">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
        {label}
      </p>

      <p className="text-sm font-semibold text-slate-800 break-words">
        {value || "--"}
      </p>
    </div>
  );
}
export default function RealExpense() {
  // SEARCH
  const [keyword, setKeyword] = useState("");

  // DATA
  const [schools, setSchools] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [hasRemainingExpense, setHasRemainingExpense] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  // LOADING
  const [loading, setLoading] = useState(false);
  const [activeExpenseId, setActiveExpenseId] = useState<number | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);

  const [activeSchool, setActiveSchool] = useState<any>(null);

  const [loadingDetail, setLoadingDetail] = useState(false);
  // FETCH ALL SCHOOL
  const fetchSchools = async (customPage = pagination.page) => {
    try {
      setLoading(true);

      const res = await schoolApi.getAll({
        page: customPage,
        limit: pagination.limit,
        hasRemainingExpense,
        keyword,
      });
      setSchools(res.data || []);

      setPagination(res.pagination);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };
  const fetchPeriods = async () => {
    try {
      const res = await expensePeriodApi.getAll();

      const periodData = Array.isArray(res) ? res : res?.data || [];
      console.log("periods", periodData);
      setPeriods(periodData);

      if (periodData.length > 0) {
        setSelectedPeriod(periodData[0]);
      }
    } catch (error) {
      console.log(error);
    }
  };
  // SEARCH SCHOOL
  const handleSearch = async (value: string) => {
    try {
      setKeyword(value);

      if (!value.trim()) {
        fetchSchools();
        return;
      }

      setLoading(true);

      const res = await schoolApi.search(value);

      setSchools(res || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
    fetchPeriods();
  }, [hasRemainingExpense]);

  const handleChangePeriod = async (month: number, year: number) => {
    console.log("change period", month, year);
    try {
      // TÌM TRONG LIST
      const existed = periods.find(
        (x: any) =>
          Number(x.month) === Number(month) && Number(x.year) === Number(year),
      );

      // ĐÃ CÓ
      if (existed) {
        console.log("created period", existed);
        setSelectedPeriod(existed);

        return;
      }

      // CHƯA CÓ -> CREATE
      const created = await expensePeriodApi.create({
        month,
        year,
        name: `${String(month).padStart(2, "0")}/${year}`,
      });

      // UPDATE LIST
      setPeriods((prev: any) => [created, ...prev]);
      console.log("created period", created);
      setSelectedPeriod(created);
    } catch (error) {
      console.log(error);
    }
  };
  const handleOpenSchoolExpense = async (school: any) => {
    try {
      if (!selectedPeriod) {
        alert("Vui lòng chọn kỳ tháng");

        return;
      }

      setLoadingDetail(true);

      let expenseId: number | null = null;

      // CHECK EXISTED
      const existedRes = await schoolExpenseApi.checkExisted(
        school.id,
        selectedPeriod.id,
      );

      const existed = existedRes?.data || existedRes;

      // ĐÃ TỒN TẠI
      if (existed?.id) {
        expenseId = existed.id;
      } else {
        // CREATE
        const createdRes = await schoolExpenseApi.create({
          schoolId: school.id,
          periodId: selectedPeriod.id,
        });

        const created = createdRes?.data || createdRes;

        if (!created?.id) {
          alert("Không tạo được phiếu thu chi");

          return;
        }

        expenseId = created.id;
      }

      setSelectedSchoolId(school.id);
      setActiveSchool(school);
      setActiveExpenseId(expenseId);

      // scroll xuống detail
      setTimeout(() => {
        document.getElementById("school-expense-detail")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingDetail(false);
    }
  };
  useEffect(() => {
    if (activeSchool && selectedPeriod) {
      handleOpenSchoolExpense(activeSchool);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    if (!selectedSchoolId || !schools.length) return;

    const school = schools.find((item) => item.id === selectedSchoolId);

    if (school) {
      setActiveSchool(school);
    }
  }, [schools, selectedSchoolId]);
  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Quản lý thu chi" />

      <div className="mt-[60px] p-4">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_150px] gap-5 items-start">
          {/* HERO */}

          <div className="space-y-5">
            {/* SEARCH */}
            <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 bg-slate-100 rounded-2xl px-4 h-14">
                <Search size={20} className="text-slate-400" />

                <input
                  value={keyword}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Tìm trường học hoặc MST..."
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700"
                />
              </div>
            </div>

            <>
              {/* BACK BUTTON */}
              {activeExpenseId && (
                <button
                  onClick={() => {
                    setActiveExpenseId(null);
                    setActiveSchool(null);
                  }}
                  className="
        fixed bottom-[1vh] right-6 z-50
        h-10 px-4 rounded-2xl
        bg-slate-900 hover:bg-slate-800
        text-white font-semibold text-sm
        shadow-2xl shadow-slate-300/40
        transition-all duration-200
        hover:scale-105
        flex items-center gap-1
      "
                >
                  ← Quay lại
                </button>
              )}

              {/* LIST */}
              <div className="space-y-4">
                {!activeExpenseId && (
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-semibold text-slate-800">
                          Chỉ hiện trường còn chi
                        </p>

                        <p className="text-sm text-slate-400 mt-1">
                          Lọc các trường còn phải chi ngoài hợp đồng
                        </p>
                      </div>

                      <button
                        onClick={() => setHasRemainingExpense((prev) => !prev)}
                        className={`
              relative w-14 h-8 rounded-full transition-all
              ${hasRemainingExpense ? "bg-emerald-500" : "bg-slate-300"}
            `}
                      >
                        <div
                          className={`
                absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all
                ${hasRemainingExpense ? "left-7" : "left-1"}
              `}
                        />
                      </button>
                    </label>
                  </div>
                )}

                {loading ? (
                  <div className="bg-white rounded-3xl p-10 text-center shadow-sm">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />

                    <p className="text-slate-400 text-sm mt-4">
                      Đang tải dữ liệu...
                    </p>
                  </div>
                ) : schools.length > 0 ? (
                  schools
                    .filter((school) =>
                      activeSchool ? school.id === activeSchool.id : true,
                    )
                    .map((school) => {
                      const isSelected = activeSchool?.id === school.id;

                      return (
                        <div key={school.id} className="space-y-4">
                          {/* CARD */}
                          <div
                            onClick={() =>
                              !activeExpenseId &&
                              handleOpenSchoolExpense(school)
                            }
                            className="
                  group
                  bg-white
                  rounded-3xl
                  border border-slate-200
                  overflow-hidden
                  hover:shadow-xl
                  hover:border-blue-200
                  transition-all
                  cursor-pointer
                "
                          >
                            {/* HEADER */}
                            <div className="p-5">
                              <div className="flex justify-between items-start">
                                <div className="flex gap-4 flex-1">
                                  <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0">
                                    <School2 size={26} className="text-white" />
                                  </div>

                                  <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Header */}
                                    <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-blue-50">
                                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                        <div>
                                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                            Thông tin đơn vị
                                          </p>

                                          <h3 className="text-xl font-bold text-slate-800 mt-1">
                                            {school.name}
                                          </h3>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-semibold">
                                            Mã trường: {school.id}
                                          </span>

                                          {school.taxCode && (
                                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
                                              MST: {school.taxCode}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6">
                                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                        <InfoCard
                                          label="Người đại diện"
                                          value={school.representative}
                                        />

                                        <InfoCard
                                          label="Số điện thoại"
                                          value={school.phone}
                                        />

                                        <InfoCard
                                          label="Mã số thuế"
                                          value={school.taxCode}
                                        />
                                      </div>

                                      <div className="mt-5">
                                        <InfoCard
                                          label="Địa chỉ"
                                          value={school.address}
                                          fullWidth
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    school.status === 0
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {school.status === 0
                                    ? "Hoạt động"
                                    : "Ngừng hoạt động"}
                                </span>
                              </div>

                              {/* KPI */}
                              <div className="grid grid-cols-3 gap-3 mt-5">
                                <div className="bg-slate-50 rounded-2xl p-3">
                                  <p className="text-xs text-slate-400">
                                    Học sinh
                                  </p>

                                  <p className="font-bold text-slate-900 text-lg">
                                    {school.scale}
                                  </p>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-3">
                                  <p className="text-xs text-slate-400">
                                    Lớp học
                                  </p>

                                  <p className="font-bold text-slate-900 text-lg">
                                    {school.classCount}
                                  </p>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-3">
                                  <p className="text-xs text-slate-400">
                                    Kỳ KT
                                  </p>

                                  <p className="font-bold text-slate-900 text-lg">
                                    {school.schoolExpenses?.length || 0}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* STAFF */}
                            <div className="border-t bg-slate-50 px-5 py-3">
                              <p className="text-xs text-slate-400">
                                Nhân viên phụ trách
                              </p>

                              <div className="flex justify-between items-center mt-1">
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {school.employee?.name}
                                  </p>

                                  <p className="text-sm text-slate-500">
                                    {school.employee?.phone}
                                  </p>
                                </div>

                                <ChevronRight
                                  size={20}
                                  className="
                                text-slate-400
                                group-hover:text-blue-600
                                group-hover:translate-x-1
                                transition-all
                              "
                                />
                              </div>
                            </div>
                          </div>

                          {/* DETAIL */}
                          {isSelected && activeExpenseId && (
                            <div className="animate-in fade-in duration-300">
                              <RealExpenseDetail
                                schoolExpenseId={activeExpenseId}
                                school={activeSchool}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                      <School2 size={36} className="text-slate-400" />
                    </div>

                    <p className="text-slate-500 font-semibold mt-5">
                      Không tìm thấy trường học
                    </p>

                    <p className="text-sm text-slate-400 mt-2">
                      Thử tìm kiếm bằng tên trường hoặc mã số thuế
                    </p>
                  </div>
                )}
              </div>

              {/* PAGINATION */}
              {!activeExpenseId && (
                <div className="flex items-center justify-between pt-5">
                  <div className="text-sm text-slate-500">
                    Tổng {pagination.total} trường
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={!pagination.hasPrevPage}
                      onClick={() => fetchSchools(pagination.page - 1)}
                      className="
            h-11 px-5 rounded-2xl
            border border-slate-200
            bg-white
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
                    >
                      Trước
                    </button>

                    <div
                      className="
            h-11 min-w-[110px]
            px-4
            rounded-2xl
            bg-blue-50
            text-blue-700
            font-bold
            flex items-center justify-center
          "
                    >
                      {pagination.page} / {pagination.totalPages}
                    </div>

                    <button
                      disabled={!pagination.hasNextPage}
                      onClick={() => fetchSchools(pagination.page + 1)}
                      className="
            h-11 px-5 rounded-2xl
            bg-blue-600
            text-white
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
                    >
                      Tiếp
                    </button>
                  </div>
                </div>
              )}
            </>
          </div>
          <div className="sticky top-[80px] z-20">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* HEADER */}

              {/* BODY */}
              <div className="p-3 space-y-3">
                {/* YEAR */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      Năm
                    </p>
                  </div>

                  <select
                    value={selectedPeriod?.year}
                    onChange={(e) =>
                      handleChangePeriod(
                        selectedPeriod?.month || 1,
                        Number(e.target.value),
                      )
                    }
                    className="
        w-full h-9 rounded-xl border border-slate-200
        bg-white px-3 text-sm font-medium text-slate-700
        outline-none focus:border-emerald-500
      "
                  >
                    {Array.from(
                      { length: 7 },
                      (_, i) => new Date().getFullYear() - 3 + i,
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* MONTH */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase">
                      Tháng
                    </p>

                    <p className="text-[11px] text-slate-400">
                      {String(selectedPeriod?.month || 1).padStart(2, "0")}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-[420px] overflow-auto pr-1">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const month = i + 1;

                      const active = selectedPeriod?.month === month;

                      return (
                        <button
                          key={month}
                          onClick={() =>
                            handleChangePeriod(
                              month,
                              selectedPeriod?.year || new Date().getFullYear(),
                            )
                          }
                          className={`
              h-9 rounded-xl border text-sm font-semibold transition-all
              flex items-center justify-between px-3
              ${
                active
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
              }
            `}
                        >
                          <span>Tháng {month}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
