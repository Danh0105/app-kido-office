import { useEffect, useState, type ComponentType } from "react";
import { ChevronsLeft, ChevronsRight, LayoutDashboard } from "lucide-react";

import logo from "@/static/Logo.png";
import {
  BRAND_SIDEBAR_COLLAPSED_WIDTH,
  BRAND_SIDEBAR_WIDTH,
  readBrandSidebarCollapsed,
  writeBrandSidebarCollapsed,
} from "@/utils/directorUi";

export type BrandSidebarItem = {
  key: string;
  title: string;
  icon?: string;
  lucideIcon?: ComponentType<{ className?: string }>;
  active?: boolean;
  onClick: () => void;
};

/**
 * Sidebar xanh của giao diện brand — dùng chung cho Home và mọi trang con để
 * hai nơi không lệch nhau. Thu hẹp còn cột icon; trạng thái nhớ qua
 * localStorage và phát ra CSS var `--brand-sidebar-w` để header cố định bám theo.
 */
export default function BrandSidebar({
  items,
  onSwitchClassic,
}: {
  items: BrandSidebarItem[];
  onSwitchClassic: () => void;
}) {
  const [collapsed, setCollapsed] = useState(readBrandSidebarCollapsed);

  useEffect(() => {
    writeBrandSidebarCollapsed(collapsed);
    document.documentElement.style.setProperty(
      "--brand-sidebar-w",
      `${collapsed ? BRAND_SIDEBAR_COLLAPSED_WIDTH : BRAND_SIDEBAR_WIDTH}px`,
    );
  }, [collapsed]);

  // Rời giao diện brand thì trả header về mép trái.
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--brand-sidebar-w");
    },
    [],
  );

  return (
    <aside
      style={{
        width: collapsed ? BRAND_SIDEBAR_COLLAPSED_WIDTH : BRAND_SIDEBAR_WIDTH,
      }}
      className="sticky top-0 h-screen shrink-0 overflow-y-auto overflow-x-hidden bg-[#005BEA] text-white shadow-2xl shadow-blue-950/20 transition-[width] duration-200"
    >
      <div className="flex h-full flex-col">
        <div
          className={`flex items-center gap-3 border-b border-white/10 py-5 ${
            collapsed ? "justify-center px-2" : "px-4"
          }`}
        >
          <img
            src={logo}
            className={`shrink-0 rounded-full border-2 border-[#FFC928] bg-white object-cover ${
              collapsed ? "h-11 w-11" : "h-14 w-14"
            }`}
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight text-[#FFC928]">
                KIDO SKILL
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-blue-100">
                KNS - CDS - STEM
              </p>
            </div>
          )}
        </div>

        <div className={`flex-1 py-5 ${collapsed ? "px-2" : "px-3"}`}>
          <div
            className={`flex items-center ${
              collapsed ? "justify-center" : "justify-between px-3"
            }`}
          >
            {!collapsed && (
              <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-[#FFC928]">
                Menu
              </p>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              title={collapsed ? "Mở rộng menu" : "Thu hẹp menu"}
              aria-label={collapsed ? "Mở rộng menu" : "Thu hẹp menu"}
              aria-expanded={!collapsed}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-100 transition hover:bg-white/15 hover:text-white"
            >
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                title={collapsed ? item.title : undefined}
                aria-label={item.title}
                className={`group flex w-full items-center gap-3 rounded-2xl text-left text-sm font-semibold transition ${
                  collapsed ? "justify-center px-0 py-2" : "px-3 py-3"
                } ${
                  item.active
                    ? "bg-white text-[#005BEA] shadow-sm"
                    : "text-blue-50 hover:bg-white/10"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                    item.active
                      ? "bg-blue-50 ring-blue-900/10"
                      : "bg-white/10 text-[#FFF0A8] ring-white/10 group-hover:bg-white group-hover:text-[#005BEA]"
                  }`}
                >
                  {item.icon ? (
                    <img src={item.icon} className="h-6 w-6 object-contain" />
                  ) : item.lucideIcon ? (
                    <item.lucideIcon className="h-5 w-5" />
                  ) : null}
                </span>
                {!collapsed && (
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={collapsed ? "p-2" : "p-3"}>
          <button
            type="button"
            onClick={onSwitchClassic}
            title="Giao diện cũ"
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-white/35 text-sm font-semibold text-white hover:bg-white/10 ${
              collapsed ? "h-11 px-0" : "px-4 py-3"
            }`}
          >
            <LayoutDashboard size={16} />
            {!collapsed && "Giao diện cũ"}
          </button>
        </div>
      </div>
    </aside>
  );
}
