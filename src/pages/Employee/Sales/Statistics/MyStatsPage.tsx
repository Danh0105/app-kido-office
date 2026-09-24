import DirectorPolicyStatsPage from "@/pages/Director/Sales/Statistics/PolicyStatsPage";
import { getEmployeeId } from "@/utils/auth";

/**
 * Thống kê của nhân viên kinh doanh — dùng đúng màn thống kê của giám đốc, chỉ
 * khác phạm vi:
 *
 * - `employeeId` khoá cứng theo tài khoản đăng nhập (giám đốc lấy từ URL, chọn
 *   được nhân viên nào cũng xem). Backend cũng ép `employeeId` theo token với
 *   role `sales`, nên không thể xem số của người khác kể cả gọi API tay.
 * - Tắt phần thu chi thực tế: `/school-expenses` chỉ mở cho kế toán / trợ lý GĐ /
 *   giám đốc.
 */
export default function MyStatsPage() {
  const employeeId = Number(getEmployeeId()) || 0;

  return <DirectorPolicyStatsPage employeeId={employeeId} showExpenses={false} />;
}
