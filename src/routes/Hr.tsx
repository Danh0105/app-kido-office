import { Navigate, Route, Routes } from "react-router-dom";
import HrOverviewPage from "@/pages/Hr/HrOverviewPage";
import HrEmployeesPage from "@/pages/Hr/HrEmployeesPage";
import HrEmployeeDetailPage from "@/pages/Hr/HrEmployeeDetailPage";
import HrAccessPage from "@/pages/Hr/HrAccessPage";
import HrAuditPage from "@/pages/Hr/HrAuditPage";
import HrSettingsPage from "@/pages/Hr/HrSettingsPage";
import HrOrgPage from "@/pages/Hr/HrOrgPage";

/**
 * HRM Phase 0. Mỗi trang tự kiểm tra quyền HR (từ backend) trong `HrLayout`
 * và hiện trạng thái "không có quyền" — backend vẫn là nơi chặn thật.
 */
export default function HrRoutes() {
  return (
    <Routes>
      <Route index element={<HrOverviewPage />} />
      <Route path="employees" element={<HrEmployeesPage />} />
      <Route path="employees/:id" element={<HrEmployeeDetailPage />} />
      <Route path="org" element={<HrOrgPage />} />
      <Route path="access" element={<HrAccessPage />} />
      <Route path="audit" element={<HrAuditPage />} />
      <Route path="settings" element={<HrSettingsPage />} />
      <Route path="*" element={<Navigate to="/hr" replace />} />
    </Routes>
  );
}
