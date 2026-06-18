import { Routes, Route } from "react-router-dom";

import Home from "../pages/Employee/Home";
import SchoolList from "../pages/Employee/Sales/School/SchoolList";
import SubjectList from "../pages/Employee/Sales/School/SubjectList";
import PolicyList from "../pages/Employee/Sales/Policy/PolicyList";
import PolicyView from "../pages/Employee/Sales/PolicyView/Sales";
import PolicyHistoryList from "../pages/Employee/Sales/Policy/PolicyHistoryList";
import SchoolYearPage from "../pages/Employee/Sales/School/SchoolYear";
import Profile from "../pages/Employee/Profile";
import DailyReportPage from "@/pages/Employee/Sales/report/DailyReportPage";
import ProtectedRoute from "./ProtectedRoute";
import Region from "../pages/Employee/Sales/Region/ListRegion";
import RegisterFace from "@/pages/FaceId/RegisterFace";
import FaceVerify from "@/pages/FaceId/FaceVerify";
import Suggest from "@/pages/Employee/Sales/Suggest/Suggest";
import PolicyStatsPage from "@/pages/Employee/Sales/Statistics/PolicyStatsPage";
import Training from "@/pages/Employee/Sales/Training/Training";

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
        element={<PolicyHistoryList />}
      />
      <Route path="policy/view" element={<PolicyView />} />
      <Route path="region/:employeeId" element={<Region />} />
      <Route index element={<Home />} />
      <Route path="/suggest" element={<Suggest />} />
      <Route path="/statistics" element={<PolicyStatsPage />} />
      <Route path="register-face-id" element={<RegisterFace />} />
      <Route path="face-verify" element={<FaceVerify />} />
      <Route path="/training" element={<Training />} />
    </Routes>
  );
}
