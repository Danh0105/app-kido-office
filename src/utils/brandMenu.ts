import type { ComponentType } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  MapPin,
  MapPinned,
  ReceiptText,
  Users,
} from "lucide-react";

import { directorBaseMenus } from "@/pages/Director/directorMenus";
import policyIcon from "@/pages/Director/static/policy.png";
import reportIcon from "@/pages/Director/static/report.png";
import statisticsIcon from "@/pages/Director/static/statistics.png";
import suggestIcon from "@/pages/Director/static/suggest.png";
import {
  TEACHER_MENUS,
  canViewTeaching,
  isTeacher,
  teachingMenusForUser,
} from "@/pages/Teaching/lib";
import { hasRole } from "./auth";
import { getHomePath } from "./nav";

export type BrandMenuWorkspace = "director" | "employee" | "auto";

export type BrandMenuDefinition = {
  key: string;
  title: string;
  to: string;
  from?: string;
  icon?: string;
  lucideIcon?: ComponentType<{ className?: string }>;
  activePaths?: string[];
};

export const iconForTeachingMenu = (title: string) => {
  if (title.includes("Giáo viên")) return GraduationCap;
  if (title.includes("Điểm trường")) return MapPinned;
  if (title.includes("Lớp")) return Users;
  if (title.includes("Môn") || title.includes("Tiết")) return BookOpen;
  if (title.includes("Thời") || title.includes("Lịch")) return CalendarDays;
  if (title.includes("Chấm")) return ClipboardCheck;
  if (title.includes("Hình")) return CheckSquare;
  if (title.includes("Vị trí") || title.includes("Phụ cấp")) return MapPin;
  return LayoutDashboard;
};

const DIRECTOR_ACTIVE_PATHS: Record<string, string[]> = {
  policy: [
    "/director/subject-list",
    "/director/school-list",
    "/director/policy-list",
    "/director/policy-history-list",
    "/director/policy/",
    "/director/suggest",
  ],
  report: ["/director/daily-report"],
  statistics: ["/director/statistics"],
  expense: [
    "/director/expense-management",
    "/director/real-expense",
    "/director/expense-tasks",
    "/director/expense-notifications",
    "/director/expense-reminder-settings",
  ],
  management: ["/director/employee-management", "/director/nhan-vien/profile"],
  "expense-request": ["/director/expense-requests"],
  warehouse: ["/director/warehouse"],
  payroll: ["/director/payrolls"],
};

const directorMenus = (): BrandMenuDefinition[] =>
  directorBaseMenus()
    .filter((item) => item.from !== "payroll" || !hasRole("giaovien_ctv"))
    .map((item) => ({
      key: `director-${item.from}`,
      title: item.title,
      to: `/director/${item.path}`,
      from: item.from,
      icon: item.icon,
      lucideIcon: item.lucideIcon,
      activePaths: DIRECTOR_ACTIVE_PATHS[item.from] ?? [
        `/director/${item.path}`,
      ],
    }));

const employeeMenus = (): BrandMenuDefinition[] => {
  const payroll: BrandMenuDefinition = {
    key: "employee-payroll",
    title: "Phiếu lương",
    to: "/employee/payrolls",
    from: "payroll",
    lucideIcon: ReceiptText,
  };

  const canViewPayroll = !hasRole("giaovien_ctv");

  if (hasRole("probation")) {
    return [
      {
        key: "employee-training",
        title: "Training",
        to: "/employee/training",
        from: "training",
        lucideIcon: GraduationCap,
      },
      ...(canViewPayroll ? [payroll] : []),
    ];
  }

  return [
    ...(canViewPayroll ? [payroll] : []),
    {
      key: "employee-policy",
      title: "Chính sách",
      to: "/employee/policy-select",
      from: "policy",
      icon: policyIcon,
      activePaths: ["/employee/policy", "/employee/region", "/employee/school-list"],
    },
    {
      key: "employee-report",
      title: "Báo cáo tuần",
      to: "/employee/daily-report",
      from: "report",
      icon: reportIcon,
    },
    {
      key: "employee-statistics",
      title: "Thống kê",
      to: "/employee/statistics",
      from: "statistics",
      icon: statisticsIcon,
    },
    ...(hasRole("sales")
      ? [
          {
            key: "employee-expense-request",
            title: "Đề xuất chi",
            to: "/employee/expense-requests",
            from: "expense-request",
            icon: suggestIcon,
          },
          {
            key: "employee-school-timetable",
            title: "Thời khoá biểu",
            to: "/employee/school-timetable",
            from: "school-timetable",
            lucideIcon: CalendarDays,
          },
        ]
      : []),
  ];
};

const teachingMenus = (): BrandMenuDefinition[] => {
  const source = canViewTeaching()
    ? teachingMenusForUser()
    : isTeacher()
      ? TEACHER_MENUS
      : [];

  return source.map((item) => ({
    key: `teaching-${item.path}`,
    title: item.title,
    to: item.path,
    lucideIcon: iconForTeachingMenu(item.title),
  }));
};

/**
 * Nguồn menu brand duy nhất. Trang chủ và mọi shell trang con phải gọi hàm
 * này để chuyển route không làm sidebar đổi hoặc mất mục.
 */
export const brandMenusForUser = (
  workspace: BrandMenuWorkspace = "auto",
): BrandMenuDefinition[] => {
  const resolvedWorkspace =
    workspace === "auto"
      ? getHomePath().startsWith("/employee")
        ? "employee"
        : "director"
      : workspace;

  return [
    ...(resolvedWorkspace === "employee" ? employeeMenus() : directorMenus()),
    ...teachingMenus(),
  ];
};

export const isBrandMenuActive = (
  item: BrandMenuDefinition,
  pathname: string,
  locationState?: { from?: string } | null,
) => {
  // Ba mục dùng chung /director/nhan-vien, nên phải dựa thêm state.from.
  if (pathname === "/director/nhan-vien" && item.from) {
    return item.from === (locationState?.from ?? "policy");
  }

  return (item.activePaths ?? [item.to]).some((path) =>
    pathname.startsWith(path),
  );
};
