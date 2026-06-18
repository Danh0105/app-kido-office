// pages/RealExpensePeriods.tsx

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import HeaderWithBack from "@/components/HeaderWithBack";

import { CalendarDays, ChevronRight, Plus, Wallet } from "lucide-react";
import { expensePeriodApi } from "@/service/expensePeriod";

export default function RealExpensePeriods() {
  const navigate = useNavigate();

  const { schoolId } = useParams();

  const [periods, setPeriods] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const fetchPeriods = async () => {
    try {
      setLoading(true);

      const res = await expensePeriodApi.getAll();

      setPeriods(res || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderWithBack title="Kỳ thu chi" />

      <div className="mt-[60px] p-4 space-y-5">
        {/* HERO */}
        <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-100 text-sm">Quản lý kỳ</p>

              <h1 className="text-white text-2xl font-bold mt-2">Kỳ thu chi</h1>

              <p className="text-violet-100 text-sm mt-2">
                Quản lý dữ liệu theo tháng/quý/năm
              </p>
            </div>

            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
              <Wallet className="text-white" size={30} />
            </div>
          </div>
        </div>

        {/* ACTION */}
        <button className="w-full h-14 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg">
          <Plus size={20} />
          Tạo kỳ mới
        </button>

        {/* LIST */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-3xl p-10 text-center">
              Đang tải...
            </div>
          ) : (
            periods.map((period) => (
              <div
                key={period.id}
                onClick={() =>
                  navigate(
                    `/director/real-expense/${schoolId}/period/${period.id}`,
                  )
                }
                className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
                      <CalendarDays size={26} className="text-violet-700" />
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 text-lg">
                        {period.name}
                      </p>

                      <p className="text-sm text-slate-400 mt-1">
                        Kỳ hoạt động
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="text-slate-300" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
