import { hasRole } from "@/utils/auth";
import { DEPARTMENT_HEAD_ROLES } from "@/utils/departmentHeads";
import { isEquipmentOnlyUser } from "@/pages/ExpenseRequest/lib";
import expense from "@/pages/Director/static/expense.png";
import policy from "@/pages/Director/static/policy.png";
import report from "@/pages/Director/static/report.png";
import statistics from "@/pages/Director/static/statistics.png";
import suggest from "@/pages/Director/static/suggest.png";
import team from "@/pages/Director/static/team.png";
import {
  HandCoins,
  Landmark,
  ReceiptText,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";

export type DirectorMenu = {
  title: string;
  icon?: string;
  lucideIcon?: LucideIcon;
  /** Route con dưới /director */
  path: string;
  from: string;
};

const PAYROLL_MENU: DirectorMenu = {
  title: "Phiếu lương",
  lucideIcon: ReceiptText,
  path: "payrolls",
  from: "payroll",
};

const FINANCE_MENU: DirectorMenu = {
  title: "Đề nghị tài chính nội bộ",
  lucideIcon: HandCoins,
  path: "finance",
  from: "finance",
};

const RECRUITMENT_MENU: DirectorMenu = {
  title: "Tuyển dụng",
  lucideIcon: UserRoundSearch,
  path: "recruitment",
  from: "recruitment",
};

const CASHFLOW_REPORT_MENU: DirectorMenu = {
  title: "Tổng hợp thu chi",
  lucideIcon: Landmark,
  path: "cashflow-report",
  from: "cashflow-report",
};

// Phải khớp CashflowReportGuard (routes/Director.tsx) và READ_ROLES của backend.
const CASHFLOW_REPORT_ROLES = [
  "accountant",
  "ketoan_congno",
  "ketoan_truong",
  "thuquy",
  "troly_gd",
  "director",
];

const ALL_MENUS = [
  { title: "Chính sách", icon: policy, path: "nhan-vien", from: "policy" },
  { title: "Báo cáo", icon: report, path: "nhan-vien", from: "report" },
  {
    title: "Thống kê",
    icon: statistics,
    path: "nhan-vien",
    from: "statistics",
  },
  {
    title: "QL thu chi",
    icon: expense,
    path: "expense-management",
    from: "expense",
  },
  {
    title: "Nhân viên",
    icon: team,
    path: "employee-management",
    from: "management",
  },
  {
    title: "Đề xuất chi",
    icon: suggest,
    path: "expense-requests",
    from: "expense-request",
  },
  {
    title: "Quản lý kho",
    icon: suggest,
    path: "warehouse",
    from: "warehouse",
  },
];

const LIMITED_MENUS = [
  {
    title: "QL thu chi",
    icon: expense,
    path: "expense-management",
    from: "expense",
  },
  {
    title: "Đề xuất chi",
    icon: suggest,
    path: "expense-requests",
    from: "expense-request",
  },
];

// Phòng kỹ thuật chỉ có việc trong module Đề xuất chi (nhánh thiết bị) + kho.
const TECHNICAL_MENUS = [
  {
    title: "Đề xuất thiết bị",
    icon: suggest,
    path: "expense-requests",
    from: "expense-request",
  },
  {
    title: "Quản lý kho",
    icon: suggest,
    path: "warehouse",
    from: "warehouse",
  },
];

const CHIEF_ACCOUNTANT_MENUS = [
  {
    title: "Quản lý thu chi",
    icon: expense,
    path: "expense-management",
    from: "expense",
  },
  {
    title: "Thống kê",
    icon: statistics,
    path: "nhan-vien",
    from: "statistics",
  },
  {
    title: "Đề xuất chi",
    icon: suggest,
    path: "expense-requests",
    from: "expense-request",
  },
  { title: "Chính sách", icon: policy, path: "nhan-vien", from: "policy" },
];

// Phải khớp với AccountantGuard trong routes/Director.tsx, nếu không bấm vào
// menu sẽ bị guard đẩy về trang chủ.
const EXPENSE_ROLES = [
  "accountant",
  "director",
  "director_la",
  "ketoan_congno",
  "ketoan_truong",
  "troly_gd",
  "thuquy",
  "saleadmin",
  "salesadmin",
  "salesadmin_la",
];

// Role "rộng" luôn thấy menu đầy đủ — người kiêm thêm role hẹp hơn (kế toán,
// kế toán trưởng, kỹ thuật...) không bị các nhánh dưới thu hẹp lại. Phải khớp
// BROAD_ROLES trong utils/auth.ts.
const BROAD_ROLES = [
  "director",
  "director_la",
  "saleadmin",
  "salesadmin",
  "salesadmin_la",
];

/** Menu chính của trang Giám đốc theo vai trò — dùng chung cho Home và sidebar brand. */
export const directorBaseMenus = (): DirectorMenu[] => {
  const menus: DirectorMenu[] = hasRole(...BROAD_ROLES)
    ? ALL_MENUS
    : hasRole("ketoan_truong")
    ? CHIEF_ACCOUNTANT_MENUS
    : // Chỉ thu gọn menu khi tài khoản **chỉ** là phòng kỹ thuật; người kiêm
    // thêm giám đốc/kế toán/kinh doanh vẫn phải giữ nguyên menu của vai đó.
    isEquipmentOnlyUser()
    ? TECHNICAL_MENUS
    : hasRole("accountant", "ketoan_congno", "troly_gd", "thuquy")
    ? LIMITED_MENUS
    : hasRole("nhansu", "giaovu", "giaovien_congty", "giaovien_ctv")
    ? [] // Nhân sự / Giáo vụ / giáo viên chỉ dùng module Giảng dạy
    : hasRole(...DEPARTMENT_HEAD_ROLES)
    ? [] // Chỉ mang chức danh trưởng/phó phòng: không mở thêm menu nghiệp vụ nào
    : ALL_MENUS;
  const visibleMenus = menus.filter(
    (item) => item.from !== "expense" || hasRole(...EXPENSE_ROLES)
  );
  // Mọi tài khoản đều được xem phiếu của chính mình; backend tự mở rộng phạm
  // vi cho Nhân sự/KTT/BGĐ. Vì các role không-sales cũng dùng trang /director,
  // mục này được nối vào tất cả biến thể menu tại một chỗ.
  const canViewRecruitment = hasRole(
    "nhansu",
    "director",
    "director_la",
    "troly_gd"
  );

  return [
    ...visibleMenus,
    ...(hasRole(...CASHFLOW_REPORT_ROLES) ? [CASHFLOW_REPORT_MENU] : []),
    ...(canViewRecruitment ? [RECRUITMENT_MENU] : []),
    PAYROLL_MENU,
    // Đề nghị tạm ứng/thanh toán: ai cũng lập được; quyền duyệt/chi do backend quyết định.
    FINANCE_MENU,
  ];
};
