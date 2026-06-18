import { Home, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getEmployeeRole } from "@/utils/auth";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const role = getEmployeeRole();

  const basePath =
    role === "director_la" ||
    role === "director" ||
    role === "saleadmin" ||
    role === "salesadmin_la"
      ? "/director"
      : role === "employee" || role === "probation"
      ? "/employee"
      : "/login";

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-transparent">
      <div
        className="
                    w-full 
                    md:max-w-6xl md:mx-auto

                    bg-white border-t md:border
                    flex justify-around py-2

                    md:rounded-xl md:shadow
                    md:mb-2
                "
      >
        {/* HOME */}
        <button
          onClick={() => navigate(`${basePath}/`)}
          className={`flex flex-col items-center ${
            isActive(basePath) ? "text-orange-500" : "text-gray-400"
          }`}
        >
          <Home size={20} />
          <span className="text-xs">Trang chủ</span>
        </button>

        {/* PROFILE */}
        <button
          onClick={() => navigate(`/employee/profile`)}
          className={`flex flex-col items-center ${
            isActive("/employee/profile") ? "text-orange-500" : "text-gray-400"
          }`}
        >
          <User size={20} />
          <span className="text-xs">Cá nhân</span>
        </button>
      </div>
    </div>
  );
}
