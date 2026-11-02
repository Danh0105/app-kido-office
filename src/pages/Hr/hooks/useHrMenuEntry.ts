import { useLocation, useNavigate } from "react-router-dom";
import { getEmployeeId } from "@/utils/auth";
import { useHrAccess } from "./useHrAccess";

/**
 * Mục menu "HRM" cho sidebar / thanh điều hướng dưới — CHỈ hiện khi backend
 * trả về ít nhất một quyền HR. Không đoán theo tên role cũ.
 */
export function useHrMenuEntry() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasAny } = useHrAccess(!!getEmployeeId());
  return {
    visible: hasAny,
    active: pathname === "/hr" || pathname.startsWith("/hr/"),
    go: () => navigate("/hr"),
  };
}
