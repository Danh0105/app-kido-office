import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import EmployeeRoutes from "./Employee";
import DirectorRoutes from "./Director";
import Login from "../pages/Auth/Login";
import UploadApk from "@/pages/UploadApk";
import ProtectedRoute from "./ProtectedRoute";
import RegisterFace from "@/pages/FaceId/RegisterFace";
import Profile from "@/pages/Employee/Profile";
import { GiaoVienRoutes, NhanSuRoutes } from "./Teaching";
import VirtualTryOnPage from "@/pages/VirtualTryOn/VirtualTryOnPage";
import { isAccountantOnly, isChiefAccountant } from "@/utils/auth";
import { getHomePath } from "@/utils/nav";
/* import TabletPage from "@/pages/Display/TabletPage";
 */ /* import Display from "@/pages/Display/Display";
 */ /* import INTRO from "@/pages/Display"; */

function BlockAccountingRolesOutsideDirector({ children }: any) {
  if (isAccountantOnly() || isChiefAccountant()) {
    return <Navigate to="/director" replace />;
  }

  return children;
}

/** Link trung lập `/finance/...` (thông báo, mã QR trên PDF) → đúng workspace của người mở. */
function FinanceRedirect() {
  const { pathname, search } = useLocation();
  const workspace = getHomePath().startsWith("/employee") ? "/employee" : "/director";
  return <Navigate to={`${workspace}${pathname}${search}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/upload-apk" element={<UploadApk />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      {/*
        Thử đồ ảo — mở công khai, KHÔNG bọc ProtectedRoute: khách chưa đăng
        nhập vẫn dùng được. Backend chặn lạm dụng bằng giới hạn theo IP.
      */}
      <Route path="/virtual-tryon" element={<VirtualTryOnPage />} />
      {/*    <Route path="/intro" element={<INTRO />} /> */}
      {/*       <Route path="/display" element={<Display />} />
       */}{" "}
      {/*       <Route path="/tablet/:tabletCode" element={<TabletPage />} />
       */}{" "}
      <Route
        path="/employee/*"
        element={
          <ProtectedRoute>
            <BlockAccountingRolesOutsideDirector>
              <EmployeeRoutes />
            </BlockAccountingRolesOutsideDirector>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance/*"
        element={
          <ProtectedRoute>
            <FinanceRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/director/*"
        element={
          <ProtectedRoute>
            <DirectorRoutes />
          </ProtectedRoute>
        }
      />
      {/* Giảng dạy — phòng Nhân sự quản lý lịch dạy & chấm công */}
      <Route
        path="/nhan-su/*"
        element={
          <ProtectedRoute>
            <NhanSuRoutes />
          </ProtectedRoute>
        }
      />
      {/* Giảng dạy — lịch dạy của chính giáo viên */}
      <Route
        path="/giao-vien/*"
        element={
          <ProtectedRoute>
            <GiaoVienRoutes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
