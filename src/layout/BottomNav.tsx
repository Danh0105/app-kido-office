import { Home, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { getHomePath, PROFILE_PATH } from "@/utils/nav";

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const homePath = getHomePath();
  const profilePath = PROFILE_PATH;

  const pathname = location.pathname;
  const homeActive =
    pathname === homePath ||
    pathname === "/director" ||
    pathname === "/employee/home" ||
    pathname === "/director/expense-management";

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-transparent lg:hidden">
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
          <span className="text-xs">Trang chủ</span>
        </button>

        {/* PROFILE */}
        <button
          onClick={() => navigate(profilePath)}
          className={`flex flex-col items-center ${
            pathname === profilePath ? "text-orange-500" : "text-gray-400"
          }`}
        >
          <User size={20} />
          <span className="text-xs">Cá nhân</span>
        </button>
      </div>
    </div>
  );
}
