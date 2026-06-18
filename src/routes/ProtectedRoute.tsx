import { Navigate, useLocation } from "react-router-dom";
import { getEmployeeId } from "@/utils/auth";

export default function ProtectedRoute({ children }: any) {
    const location = useLocation();
    const employeeId = getEmployeeId();

    if (!employeeId) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    return children;
}