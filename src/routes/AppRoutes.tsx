import { Navigate, Routes, Route } from "react-router-dom";
import EmployeeRoutes from "./Employee";
import DirectorRoutes from "./Director";
import Login from "../pages/Auth/Login";
import UploadApk from "@/pages/UploadApk";
import ProtectedRoute from "./ProtectedRoute";
import RegisterFace from "@/pages/FaceId/RegisterFace";
import Profile from "@/pages/Employee/Profile";
import { hasRole, isChiefAccountant } from "@/utils/auth";
/* import TabletPage from "@/pages/Display/TabletPage";
 */ /* import Display from "@/pages/Display/Display";
 */ /* import INTRO from "@/pages/Display"; */

function BlockAccountingRolesOutsideDirector({ children }: any) {
  if (hasRole("accountant") || isChiefAccountant()) {
    return <Navigate to="/director" replace />;
  }

  return children;
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
        path="/director/*"
        element={
          <ProtectedRoute>
            <DirectorRoutes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
