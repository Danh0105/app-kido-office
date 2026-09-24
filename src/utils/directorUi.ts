import { hasRole } from "@/utils/auth";

export const DIRECTOR_DESKTOP_HOME_UI_KEY =
  "kido.director.teachingDesktopHomeUi";
export const EMPLOYEE_DESKTOP_HOME_UI_KEY = "kido.employee.desktopHomeUi";

export type DirectorDesktopUi = "classic" | "brand";

/** Giao diện mới là mặc định cho mọi tài khoản; chỉ về classic khi người
 * dùng chủ động bấm "Giao diện cũ". */
export const readDirectorDesktopUi = (): DirectorDesktopUi => {
  if (typeof window === "undefined") return "brand";
  return localStorage.getItem(DIRECTOR_DESKTOP_HOME_UI_KEY) === "classic"
    ? "classic"
    : "brand";
};

/** Các vai trò khối kế toán / thủ quỹ / trợ lý GĐ. */
const ACCOUNTING_ROLES = [
  "accountant",
  "ketoan_congno",
  "ketoan_truong",
  "troly_gd",
  "thuquy",
] as const;

/** Giao diện brand: khối giảng dạy (nhân sự/giáo vụ) và khối kinh doanh
 * (giám đốc, sales admin, kế toán, phòng kỹ thuật) — cùng bộ menu, khác
 * biến thể nội dung. */
export const canUseDirectorBrandUi = () =>
  hasRole(
    "nhansu",
    "giaovu",
    "director",
    "director_la",
    "saleadmin",
    "salesadmin",
    "salesadmin_la",
    "giaovien_congty",
    "giaovien_ctv",
    ...ACCOUNTING_ROLES,
    "ky_thuat",
  );

/** Khối kinh doanh (giám đốc, sales admin, kế toán, kỹ thuật) dùng biến thể
 * "sales" của giao diện brand — thẻ chức năng lấy từ menu theo vai trò. */
export const isBusinessBrandUser = () =>
  hasRole(
    "director",
    "director_la",
    "saleadmin",
    "salesadmin",
    "salesadmin_la",
    ...ACCOUNTING_ROLES,
    "ky_thuat",
  );

/** Nhãn khối + câu chào trên trang chủ brand theo vai trò. */
export const brandHomeCopy = () => {
  if (hasRole("director", "director_la")) {
    return {
      label: "Ban giám đốc",
      title: "Không gian quản lý kinh doanh hôm nay",
      description:
        "Theo dõi chính sách, trường học, thống kê và đề xuất chi trong giao diện đồng bộ với nhận diện Kido.",
    };
  }
  if (hasRole("saleadmin", "salesadmin", "salesadmin_la")) {
    return {
      label: "Sales admin",
      title: "Không gian quản lý kinh doanh hôm nay",
      description:
        "Theo dõi chính sách, trường học, thống kê và đề xuất chi trong giao diện đồng bộ với nhận diện Kido.",
    };
  }
  if (hasRole(...ACCOUNTING_ROLES)) {
    return {
      label: "Kế toán - tài chính",
      title: "Không gian quản lý thu chi hôm nay",
      description:
        "Theo dõi đề xuất chi, lệnh chi, xuất quỹ và quản lý thu chi trong giao diện đồng bộ với nhận diện Kido.",
    };
  }
  if (hasRole("ky_thuat")) {
    return {
      label: "Phòng kỹ thuật",
      title: "Không gian xử lý đề xuất thiết bị hôm nay",
      description:
        "Theo dõi đề xuất thiết bị, lệnh xuất kho và nhận lại hàng trong giao diện đồng bộ với nhận diện Kido.",
    };
  }
  return {
    label: "Nhân sự - giáo vụ",
    title: "Không gian quản lý giảng dạy hôm nay",
    description:
      "Theo dõi giáo viên, lớp học, thời khóa biểu và chấm công trong giao diện đồng bộ với nhận diện Kido.",
  };
};

export const isDirectorBrandUiEnabled = () =>
  typeof window !== "undefined" &&
  window.innerWidth >= 1024 &&
  canUseDirectorBrandUi() &&
  readDirectorDesktopUi() === "brand";

export const isEmployeeBrandUiEnabled = () =>
  typeof window !== "undefined" &&
  window.innerWidth >= 1024 &&
  localStorage.getItem(EMPLOYEE_DESKTOP_HOME_UI_KEY) !== "classic";

// ===== Sidebar brand: thu hẹp / mở rộng =====
export const BRAND_SIDEBAR_WIDTH = 286;
export const BRAND_SIDEBAR_COLLAPSED_WIDTH = 76;
const BRAND_SIDEBAR_COLLAPSED_KEY = "kido.director.brandSidebarCollapsed";

export const readBrandSidebarCollapsed = () =>
  typeof window !== "undefined" &&
  localStorage.getItem(BRAND_SIDEBAR_COLLAPSED_KEY) === "1";

export const writeBrandSidebarCollapsed = (collapsed: boolean) => {
  if (typeof window === "undefined") return;
  if (collapsed) localStorage.setItem(BRAND_SIDEBAR_COLLAPSED_KEY, "1");
  else localStorage.removeItem(BRAND_SIDEBAR_COLLAPSED_KEY);
};
