import { Routes, Route, Navigate } from "react-router-dom";

import Home from "../pages/Director/Home";
import Department from "../pages/Director/Department";
import EmployeeList from "../pages/Director/Sales/EmployeeList";
import Profile from "../pages/Director/Sales/Profile";
import PolicyGD from "../pages/Director/Sales/Policy/Sales";
import SubjectList from "../pages/Director/Sales/School/SubjectList";
import SchoolList from "../pages/Director/Sales/School/SchoolList";
import PolicyList from "../pages/Director/Sales/Policy/PolicyList";
import PolicyHistoryPage from "@/pages/Policy/PolicyHistoryPage";
import Region from "@/pages/Director/Region/ListRegion";
import DailyReportPage from "@/pages/Director/Sales/Report/DailyReportPage";
import SuggestPage from "@/pages/Director/Sales/Suggest/Suggest";
import SuggestReview from "@/pages/Director/Sales/Suggest/SuggestReview";
import PolicyStatsPage from "@/pages/Director/Sales/Statistics/PolicyStatsPage";
import RealExpense from "@/pages/Director/expense/RealExpense";
import RealExpenseDetail from "@/pages/Director/expense/RealExpenseDetail";
import EmployeeManagement from "@/pages/Director/EmployeeManagement";
import { hasRole } from "@/utils/auth";

const EXPENSE_HOME = "/director/expense-management";
const DIRECTOR_HOME = "/director";

// Expense routes: accountant, director, ketoan_congno, ketoan_truong, troly_gd, thuquy
function AccountantGuard({ children }: { children: React.ReactNode }) {
  if (
    !hasRole(
      "accountant",
      "director",
      "director_la",
      "ketoan_congno",
      "ketoan_truong",
      "troly_gd",
      "thuquy",
    )
  ) {
    return <Navigate to={DIRECTOR_HOME} replace />;
  }
  return <>{children}</>;
}

// General director pages: block accountant only
function DirectorOnlyGuard({ children }: { children: React.ReactNode }) {
  if (hasRole("accountant")) {
    return <Navigate to={EXPENSE_HOME} replace />;
  }
  return <>{children}</>;
}

// Suggest + employee list: only block accountant (ketoan_congno allowed)
function SuggestAccessGuard({ children }: { children: React.ReactNode }) {
  if (hasRole("accountant")) {
    return <Navigate to={EXPENSE_HOME} replace />;
  }
  return <>{children}</>;
}

const directorOnly = (children: React.ReactNode) => (
  <DirectorOnlyGuard>{children}</DirectorOnlyGuard>
);

const suggestAccess = (children: React.ReactNode) => (
  <SuggestAccessGuard>{children}</SuggestAccessGuard>
);

function DirectorFallback() {
  return (
    <Navigate
      to={hasRole("accountant") ? EXPENSE_HOME : DIRECTOR_HOME}
      replace
    />
  );
}

export default function DirectorRoutes() {
  return (
    <Routes>
      <Route index element={directorOnly(<Home />)} />
      <Route path="subject-list/:id" element={directorOnly(<SubjectList />)} />
      <Route
        path="school-list/:employeeId"
        element={directorOnly(<SchoolList />)}
      />
      <Route
        path="statistics/:employeeId"
        element={directorOnly(<PolicyStatsPage />)}
      />
      <Route path="phong-ban" element={directorOnly(<Department />)} />
      <Route path="region/:employeeId" element={directorOnly(<Region />)} />
      <Route path="nhan-vien" element={suggestAccess(<EmployeeList />)} />
      <Route
        path="employee-management"
        element={directorOnly(<EmployeeManagement />)}
      />
      <Route
        path="nhan-vien/profile/:userId"
        element={directorOnly(<Profile />)}
      />
      <Route
        path="daily-report/:employeeId"
        element={directorOnly(<DailyReportPage />)}
      />
      <Route
        path="suggest/:employeeId"
        element={suggestAccess(<SuggestPage />)}
      />
      <Route
        path="suggest-review/:suggestId"
        element={suggestAccess(<SuggestReview />)}
      />
      <Route
        path="policy-list/:subject"
        element={directorOnly(<PolicyList />)}
      />
      <Route
        path="policy-history-list/:policyId"
        element={directorOnly(<PolicyHistoryPage audience="director" />)}
      />
      <Route path="policy/:id" element={directorOnly(<PolicyGD />)} />
      <Route
        path="expense-management"
        element={
          <AccountantGuard>
            <RealExpense />
          </AccountantGuard>
        }
      />
      <Route
        path="real-expense/:schoolId"
        element={
          <AccountantGuard>
            <RealExpenseDetail />
          </AccountantGuard>
        }
      />
      <Route
        path="real-expense-detail/:schoolExpenseId"
        element={
          <AccountantGuard>
            <RealExpenseDetail />
          </AccountantGuard>
        }
      />
      <Route path="*" element={<DirectorFallback />} />
    </Routes>
  );
}
