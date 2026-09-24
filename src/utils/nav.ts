import { hasRole, hasBroadRole } from "./auth";

/**
 * Trang chủ tương ứng với role đang đăng nhập.
 * Dùng chung cho thanh điều hướng dưới và nút quay về ở các màn không có header.
 */
export const getHomePath = () => {
  // Role rộng (director/saleadmin...) luôn vào /director trước — khu vực
  // Employee không có các mục quản lý (QL thu chi, Nhân viên...) của Director,
  // nên ai kiêm thêm "sales" vẫn phải thấy được các mục đó thay vì bị đưa
  // thẳng vào không gian làm việc nhân viên.
  if (hasBroadRole()) return "/director";

  // Người có thêm role Giảng dạy/Nhân sự vẫn giữ workspace Nhân viên nếu tài
  // khoản vốn là employee/sales. Nếu xét role quản lý trước, bấm từ sidebar
  // Giảng dạy về Trang chủ sẽ đổi workspace và làm mất nhóm menu Nhân viên.
  // Role rộng đã được ưu tiên ở trên nên Giám đốc/Sales admin không bị thu hẹp.
  if (hasRole("sales", "employee", "probation", "employee_la")) {
    return "/employee/home";
  }

  const isDirectorType = hasRole(
    "accountant",
    "director",
    "director_la",
    "saleadmin",
    "salesadmin_la",
    "ketoan_congno",
    "thuquy",
    "ky_thuat",
    "ketoan_truong",
    "troly_gd",
    "nhansu",
    "giaovu",
    "giaovien_congty",
    "giaovien_ctv",
  );
  if (isDirectorType) return "/director";

  return "/";
};

export const PROFILE_PATH = "/profile";
