import { Home, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { hasRole } from "@/utils/auth";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isAccountant = hasRole("accountant");
  const isEmployeeType = hasRole(
    "employee",
    "probation",
    "employee_la",
    "sales",
  );
  const isDirectorType = hasRole(
    "director",
    "director_la",
    "saleadmin",
    "salesadmin_la",
    "ketoan_congno",
    "thuquy",
    "ketoan_truong",
    "troly_gd",
  );

  const homePath = isAccountant
    ? "/director/expense-management"
    : isDirectorType
    ? "/director"
    : isEmployeeType
    ? "/employee/home"
    : "/";

  const profilePath = "/employee/profile";

  const pathname = location.pathname;
  const homeActive =
    pathname === homePath ||
    pathname === "/director" ||
    pathname === "/employee/home" ||
    pathname === "/director/expense-management";

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-transparent">
      <div
        className="
          w-full
          md:max-w-6xl md:mx-auto
          bg-white border-t md:border
          flex justify-around py-2
          md:rounded-xl md:shadow md:mb-2
        "
      >
        {/* HOME */}
        <button
          onClick={() => navigate(homePath)}
          className={`flex flex-col items-center ${
            homeActive ? "text-orange-500" : "text-gray-400"
          }`}
        >
          <Home size={20} />
          <span className="text-xs">
            {isAccountant ? "Thu chi" : "Trang chủ"}
          </span>
        </button>

        {/* PROFILE */}
        {!isAccountant && (
          <button
            onClick={() => navigate(profilePath)}
            className={`flex flex-col items-center ${
              pathname === profilePath ? "text-orange-500" : "text-gray-400"
            }`}
          >
            <User size={20} />
            <span className="text-xs">Cá nhân</span>
          </button>
        )}
      </div>
    </div>
  );
}
