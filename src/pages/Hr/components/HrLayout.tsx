import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TeachingLayout from "@/pages/Teaching/components/TeachingLayout";
import { useHrAccess } from "../hooks/useHrAccess";
import { hrNavItems, type HrPermissionCode } from "../lib/hrAccess";
import { HrDenied, HrLoading } from "./HrUi";

/**
 * Khung chung HRM: dùng lại khung của module Nhân sự (header, sidebar brand
 * trên desktop, BottomNav trên mobile) + thanh tab HRM lọc theo quyền.
 *
 * `require`: quyền tối thiểu để xem trang (chỉ để UX — backend kiểm tra lại).
 */
export default function HrLayout({
  title,
  require,
  children,
}: {
  title: string;
  require?: (has: (code: HrPermissionCode) => boolean, hasUnrestricted: (code: HrPermissionCode) => boolean) => boolean;
  children: ReactNode;
}) {
  const { access, isLoading, hasAny, has, hasUnrestricted } = useHrAccess();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const items = hrNavItems(access);

  let content: ReactNode = children;
  if (isLoading) content = <HrLoading />;
  else if (!hasAny) content = <HrDenied />;
  else if (require && !require(has, hasUnrestricted)) content = <HrDenied />;

  return (
    <TeachingLayout title={title}>
      {items.length > 0 && (
        <nav
          aria-label="HRM"
          className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 overflow-x-auto"
        >
          {items.map((item) => {
            const active =
              item.path === "/hr" ? pathname === "/hr" : pathname.startsWith(item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`flex-1 shrink-0 whitespace-nowrap px-3 py-2 text-xs md:text-sm font-medium rounded-lg transition ${
                  active ? "bg-blue-500 text-white" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {item.title}
              </button>
            );
          })}
        </nav>
      )}
      {content}
    </TeachingLayout>
  );
}
