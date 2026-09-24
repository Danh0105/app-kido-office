import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import BrandSidebar from "@/pages/Director/components/BrandSidebar";
import { brandMenusForUser, isBrandMenuActive } from "@/utils/brandMenu";
import { EMPLOYEE_DESKTOP_HOME_UI_KEY } from "@/utils/directorUi";

export default function EmployeeBrandShell({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();

  if (!enabled) return <>{children}</>;

  const menus = brandMenusForUser("employee");
  const switchToClassic = () => {
    localStorage.setItem(EMPLOYEE_DESKTOP_HOME_UI_KEY, "classic");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#FFF8E6] text-[#0047B8] flex">
      <BrandSidebar
        items={menus.map((item) => ({
          key: item.key,
          title: item.title,
          icon: item.icon,
          lucideIcon: item.lucideIcon,
          active: isBrandMenuActive(item, pathname, state),
          onClick: () => navigate(item.to, { state: { from: item.from } }),
        }))}
        onSwitchClassic={switchToClassic}
      />
      <main className="director-brand-main min-w-0 flex-1">{children}</main>
    </div>
  );
}
