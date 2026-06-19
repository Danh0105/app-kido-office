import { Routes, Route } from "react-router-dom";
import EmployeeRoutes from "./Employee";
import DirectorRoutes from "./Director";
import Login from "../pages/Auth/Login";
import UploadApk from "@/pages/UploadApk";
import ProtectedRoute from "./ProtectedRoute";
import RegisterFace from "@/pages/FaceId/RegisterFace";
/* import TabletPage from "@/pages/Display/TabletPage";
 */ /* import Display from "@/pages/Display/Display";
 */ /* import INTRO from "@/pages/Display"; */

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/upload-apk" element={<UploadApk />} />
      {/*    <Route path="/intro" element={<INTRO />} /> */}
      {/*       <Route path="/display" element={<Display />} />
       */}{" "}
      {/*       <Route path="/tablet/:tabletCode" element={<TabletPage />} />
       */}{" "}
      <Route
        path="/employee/*"
        element={
          <ProtectedRoute>
            <EmployeeRoutes />
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
