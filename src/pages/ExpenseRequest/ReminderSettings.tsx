import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import BottomNav from "@/layout/BottomNav";
import { hasRole } from "@/utils/auth";
import { expenseRequestApi } from "@/service/expenseRequest";

export default function ReminderSettings() {
  const isDirector = hasRole("director", "director_la");

  const [remindBeforeDays, setRemindBeforeDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await expenseRequestApi.getReminderSettings();
        setRemindBeforeDays(res.remindBeforeDays ?? 1);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await expenseRequestApi.updateReminderSettings(remindBeforeDays);
      toast.success("Đã lưu cấu hình");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title="Cấu hình báo động" />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3 pt-2">
        {loading ? (
          <div className="text-center text-gray-400 text-sm py-10">Đang tải…</div>
        ) : !isDirector ? (
          <div className="text-center text-gray-400 text-sm py-16">
            Chỉ giám đốc mới cấu hình được báo động.
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <label className="text-sm text-gray-600">
              Số ngày nhắc trước ngày dự kiến chi
            </label>
            <input
              type="number"
              min={0}
              value={remindBeforeDays}
              onChange={(e) => setRemindBeforeDays(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400">
              Hệ thống chạy lúc 08:00 hằng ngày để gửi báo động cho người phụ trách bước
              đang giữ + người đề xuất khi quá hạn.
            </p>
            <button
              onClick={save}
              disabled={saving}
              className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-medium active:scale-95 disabled:opacity-60"
            >
              {saving ? "Đang lưu…" : "Lưu cấu hình"}
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
