import { Navigate, Routes, Route } from "react-router-dom";

import Home from "../pages/Employee/Home";
import SchoolList from "../pages/Employee/Sales/School/SchoolList";
import SubjectList from "../pages/Employee/Sales/School/SubjectList";
import PolicyList from "../pages/Employee/Sales/Policy/PolicyList";
import PolicyView from "../pages/Employee/Sales/PolicyView/Sales";
import PolicyHistoryPage from "@/pages/Policy/PolicyHistoryPage";
import SchoolYearPage from "../pages/Employee/Sales/School/SchoolYear";
import Profile from "../pages/Employee/Profile";
import DailyReportPage from "@/pages/Employee/Sales/report/DailyReportPage";
import ProtectedRoute from "./ProtectedRoute";
import Region from "../pages/Employee/Sales/Region/ListRegion";
import RegisterFace from "@/pages/FaceId/RegisterFace";
import FaceVerify from "@/pages/FaceId/FaceVerify";
import PolicyStatsPage from "@/pages/Employee/Sales/Statistics/PolicyStatsPage";
import Training from "@/pages/Employee/Sales/Training/Training";
import ExpenseRequestList from "@/pages/ExpenseRequest/ExpenseRequestList";
import ExpenseRequestDetail from "@/pages/ExpenseRequest/ExpenseRequestDetail";
import ExpenseRequestForm from "@/pages/ExpenseRequest/ExpenseRequestForm";
import ExpenseTasks from "@/pages/ExpenseRequest/ExpenseTasks";
import ExpenseNotifications from "@/pages/ExpenseRequest/ExpenseNotifications";

export default function EmployeeRoutes() {
  return (
    <Routes>
      <Route path="home" element={<Home />} />
      <Route path="profile" element={<Profile />} />
      <Route path="daily-report" element={<DailyReportPage />} />
      <Route path="school-list/:employeeId" element={<SchoolList />} />
      <Route path="school-year/:id" element={<SchoolYearPage />} />
      <Route path="subject-list/:id" element={<SubjectList />} />
      <Route path="policy-list/:subject" element={<PolicyList />} />
      <Route
        path="policy-history-list/:policyId"
        element={<PolicyHistoryPage audience="employee" />}
      />
      <Route path="policy/view" element={<PolicyView />} />
      <Route path="policy/:policyId" element={<PolicyView />} />
      <Route path="region/:employeeId" element={<Region />} />
      <Route index element={<Home />} />
      <Route
        path="suggest"
        element={<Navigate to="/employee/expense-requests" replace />}
      />
      <Route path="/statistics" element={<PolicyStatsPage />} />

      {/* Đề xuất chi (sales) — tạo là gửi duyệt luôn, không có nháp/sửa */}
      <Route path="expense-requests" element={<ExpenseRequestList />} />
      <Route path="expense-requests/new" element={<ExpenseRequestForm />} />
      <Route path="expense-requests/:id" element={<ExpenseRequestDetail />} />
      <Route path="expense-tasks" element={<ExpenseTasks />} />
      <Route path="expense-notifications" element={<ExpenseNotifications />} />
      <Route path="register-face-id" element={<RegisterFace />} />
      <Route path="face-verify" element={<FaceVerify />} />
      <Route path="/training" element={<Training />} />
    </Routes>
  );
}
