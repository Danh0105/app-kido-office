import { useLocation, useNavigate } from "react-router-dom";

import { TEACHER_MENUS } from "../lib";

/** Điều hướng giữa các màn của giáo viên — cùng kiểu tab với module Nhân sự. */
export default function TeacherTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-100">
      {TEACHER_MENUS.map((item) => {
        const active = pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
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
