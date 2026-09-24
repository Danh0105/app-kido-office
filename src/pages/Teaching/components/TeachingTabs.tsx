import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { teachingMenusForUser } from "../lib";
import { canUseDirectorBrandUi } from "@/utils/directorUi";

const TEACHING_UI_KEYS = [
  "kido.director.teachingDesktopHomeUi",
  "kido.employee.desktopHomeUi",
] as const;

const useHideTabsForBrandDesktop = () => {
  const [hideTabs, setHideTabs] = useState(false);

  useEffect(() => {
    const update = () => {
      const brandUi = TEACHING_UI_KEYS.some(
        (key) => localStorage.getItem(key) === "brand",
      );
      setHideTabs(window.innerWidth >= 1024 && canUseDirectorBrandUi() && brandUi);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return hideTabs;
};

/** Điều hướng giữa các màn của module Giảng dạy — cùng kiểu tab của module Đề xuất chi. */
export default function TeachingTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const hideTabs = useHideTabsForBrandDesktop();

  if (hideTabs) return null;

  return (
    // Nhiều mục hơn một hàng trên điện thoại → cho cuộn ngang thay vì bóp chữ.
    <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100 overflow-x-auto">
      {teachingMenusForUser().map((item) => {
        const active = pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 shrink-0 whitespace-nowrap px-2 py-1.5 text-xs font-medium rounded-lg transition ${
              active ? "bg-blue-500 text-white" : "text-gray-500"
            }`}
          >
            {item.title}
          </button>
        );
      })}
    </div>
  );
}
