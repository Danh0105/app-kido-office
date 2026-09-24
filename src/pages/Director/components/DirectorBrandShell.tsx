import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DIRECTOR_DESKTOP_HOME_UI_KEY } from "@/utils/directorUi";
import { brandMenusForUser, isBrandMenuActive } from "@/utils/brandMenu";

import BrandSidebar from "./BrandSidebar";

export default function DirectorBrandShell({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();

  if (!enabled) return <>{children}</>;

  const switchToClassic = () => {
    localStorage.setItem(DIRECTOR_DESKTOP_HOME_UI_KEY, "classic");
    window.location.reload();
  };

  const menus = brandMenusForUser("director");

  return (
    <div className="min-h-screen bg-[#FFF8E6] text-[#0047B8] flex">
      <BrandSidebar
        items={menus.map((item) => ({
          key: item.key,
          title: item.title,
          icon: item.icon,
          lucideIcon: item.lucideIcon,
          active: isBrandMenuActive(item, pathname, state),
          onClick: () =>
            navigate(item.to, { state: { from: item.from } }),
        }))}
        onSwitchClassic={switchToClassic}
      />

      {/* Trang cũ còn nền xám và nút xanh Tailwind mặc định — ép về tông brand
          ngay tại đây để không phải sửa từng trang; trang đã style brand
          không bị ảnh hưởng vì đã dùng đúng màu. */}
      <main className="director-brand-main min-w-0 flex-1">{children}</main>
    </div>
  );
}
