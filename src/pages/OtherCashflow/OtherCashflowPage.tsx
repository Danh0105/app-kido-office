import HeaderWithBack from "@/components/HeaderWithBack";
import OtherCashflowPanel from "./OtherCashflowPanel";

/**
 * Trang riêng của Thu Chi ngoài — cho thủ quỹ (không có menu Chính sách) và
 * đường dẫn mở thẳng một hợp đồng từ thông báo / báo cáo thu chi.
 */
export default function OtherCashflowPage() {
  return (
    <div className="min-h-screen bg-slate-100 pb-24 pt-[72px] text-slate-900">
      <HeaderWithBack title="Thu Chi ngoài" />
      <main className="mx-auto w-full max-w-7xl px-3 md:px-6">
        <OtherCashflowPanel />
      </main>
    </div>
  );
}
