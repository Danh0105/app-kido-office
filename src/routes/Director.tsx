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
import PolicyStatsPage from "@/pages/Director/Sales/Statistics/PolicyStatsPage";
import RealExpense from "@/pages/Director/expense/RealExpense";
import RealExpenseDetail from "@/pages/Director/expense/RealExpenseDetail";
import EmployeeManagement from "@/pages/Director/EmployeeManagement";
import ExpenseRequestList from "@/pages/ExpenseRequest/ExpenseRequestList";
import ExpenseRequestDetail from "@/pages/ExpenseRequest/ExpenseRequestDetail";
import ExpenseTasks from "@/pages/ExpenseRequest/ExpenseTasks";
import ExpenseNotifications from "@/pages/ExpenseRequest/ExpenseNotifications";
import ReminderSettings from "@/pages/ExpenseRequest/ReminderSettings";
import { hasRole, isChiefAccountant } from "@/utils/auth";

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
  if (hasRole("accountant") || isChiefAccountant()) {
    return <Navigate to={EXPENSE_HOME} replace />;
  }
  return <>{children}</>;
}

// Expense-request module: director, saleadmin, ketoan_congno, thuquy (+ variants)
function ExpenseRequestGuard({ children }: { children: React.ReactNode }) {
  if (
    !hasRole(
      "accountant",
      "director",
      "director_la",
      "saleadmin",
      "salesadmin_la",
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

const expenseAccess = (children: React.ReactNode) => (
  <ExpenseRequestGuard>{children}</ExpenseRequestGuard>
);

const directorOnly = (children: React.ReactNode) => (
  <DirectorOnlyGuard>{children}</DirectorOnlyGuard>
);

function DirectorFallback() {
  return (
    <Navigate
      to={hasRole("accountant") || isChiefAccountant() ? EXPENSE_HOME : DIRECTOR_HOME}
      replace
    />
  );
}

export default function DirectorRoutes() {
  return (
    <Routes>
      <Route index element={isChiefAccountant() ? <Home /> : directorOnly(<Home />)} />
      <Route path="subject-list/:id" element={isChiefAccountant() ? <SubjectList /> : directorOnly(<SubjectList />)} />
      <Route
        path="school-list/:employeeId"
        element={isChiefAccountant() ? <SchoolList /> : directorOnly(<SchoolList />)}
      />
      <Route
        path="statistics/:employeeId"
        element={isChiefAccountant() ? <PolicyStatsPage /> : directorOnly(<PolicyStatsPage />)}
      />
      <Route path="phong-ban" element={directorOnly(<Department />)} />
      <Route path="region/:employeeId" element={directorOnly(<Region />)} />
      <Route path="nhan-vien" element={isChiefAccountant() ? <EmployeeList /> : directorOnly(<EmployeeList />)} />
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
        element={<Navigate to="/director/expense-requests" replace />}
      />
      <Route
        path="suggest-review/:suggestId"
        element={<Navigate to="/director/expense-requests" replace />}
      />
      <Route
        path="policy-list/:subject"
        element={isChiefAccountant() ? <PolicyList /> : directorOnly(<PolicyList />)}
      />
      <Route
        path="policy-history-list/:policyId"
        element={isChiefAccountant() ? <PolicyHistoryPage audience="director" /> : directorOnly(<PolicyHistoryPage audience="director" />)}
      />
      <Route path="policy/:id" element={isChiefAccountant() ? <PolicyGD /> : directorOnly(<PolicyGD />)} />
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
      {/* Đề xuất chi (director / kế toán công nợ / thủ quỹ / sales admin) */}
      <Route
        path="expense-requests"
        element={expenseAccess(<ExpenseRequestList />)}
      />
      <Route
        path="expense-requests/:id"
        element={expenseAccess(<ExpenseRequestDetail />)}
      />
      <Route path="expense-tasks" element={expenseAccess(<ExpenseTasks />)} />
      <Route
        path="expense-notifications"
        element={expenseAccess(<ExpenseNotifications />)}
      />
      <Route
        path="expense-reminder-settings"
        element={isChiefAccountant() ? <Navigate to={EXPENSE_HOME} replace /> : expenseAccess(<ReminderSettings />)}
      />

      <Route path="*" element={<DirectorFallback />} />
    </Routes>
  );
}
