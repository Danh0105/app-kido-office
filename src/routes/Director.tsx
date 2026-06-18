import { Routes, Route } from "react-router-dom";

import Home from "../pages/Director/Home";
import Department from "../pages/Director/Department";
import EmployeeList from "../pages/Director/Sales/EmployeeList";
import Profile from "../pages/Director/Sales/Profile";
import PolicyGD from "../pages/Director/Sales/Policy/Sales";
import SubjectList from "../pages/Director/Sales/School/SubjectList";
import SchoolList from "../pages/Director/Sales/School/SchoolList";
import PolicyList from "../pages/Director/Sales/Policy/PolicyList";
import PolicyHistoryList from "../pages/Director/Sales/Policy/PolicyHistoryList";
import Region from "@/pages/Director/Region/ListRegion";
import DailyReportPage from "@/pages/Director/Sales/Report/DailyReportPage";
import SuggestPage from "@/pages/Director/Sales/Suggest/Suggest";
import SuggestReview from "@/pages/Director/Sales/Suggest/SuggestReview";
import PolicyStatsPage from "@/pages/Director/Sales/Statistics/PolicyStatsPage";
import RealExpense from "@/pages/Director/expense/RealExpense";
import RealExpenseDetail from "@/pages/Director/expense/RealExpenseDetail";

export default function DirectorRoutes() {
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="subject-list/:id" element={<SubjectList />} />
      <Route path="school-list/:employeeId" element={<SchoolList />} />
      <Route path="statistics/:employeeId" element={<PolicyStatsPage />} />
      <Route path="phong-ban" element={<Department />} />
      <Route path="region/:employeeId" element={<Region />} />
      <Route path="nhan-vien" element={<EmployeeList />} />
      <Route path="nhan-vien/profile/:userId" element={<Profile />} />
      <Route path="daily-report/:employeeId" element={<DailyReportPage />} />
      <Route path="suggest/:employeeId" element={<SuggestPage />} />
      <Route path="suggest-review/:suggestId" element={<SuggestReview />} />
      <Route path="policy-list/:subject" element={<PolicyList />} />
      <Route
        path="policy-history-list/:policyId"
        element={<PolicyHistoryList />}
      />
      <Route path="policy/:id" element={<PolicyGD />} />
      <Route path="expense-management" element={<RealExpense />} />
      <Route path="real-expense/:schoolId" element={<RealExpenseDetail />} />
      <Route
        path="real-expense-detail/:schoolExpenseId"
        element={<RealExpenseDetail />}
      />
    </Routes>
  );
}
