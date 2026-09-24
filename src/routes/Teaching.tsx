import { Navigate, Route, Routes } from "react-router-dom";

import TeacherList from "@/pages/Teaching/TeacherList";
import SchoolClassPage from "@/pages/Teaching/SchoolClassPage";
import SubjectManagePage from "@/pages/Teaching/SubjectManagePage";
import TeachingSchedulePage from "@/pages/Teaching/TeachingSchedulePage";
import AttendancePage from "@/pages/Teaching/AttendancePage";
import MySchedulePage from "@/pages/Teaching/MySchedulePage";
import TeacherAttendancePage from "@/pages/Teaching/TeacherAttendancePage";
import OpenSessionsPage from "@/pages/Teaching/OpenSessionsPage";
import SchoolLocationPage from "@/pages/Teaching/SchoolLocationPage";
import SchoolBranchPage from "@/pages/Teaching/SchoolBranchPage";
import FuelAllowanceTierPage from "@/pages/Teaching/FuelAllowanceTierPage";
import ActivityLogPage from "@/pages/Teaching/ActivityLogPage";
import ImageLibraryPage from "@/pages/Teaching/ImageLibraryPage";
import {
  canSetTeachingRates,
  canViewActivityLog,
  canViewTeaching,
  canManageTeaching,
  isTeacher,
  teachingHomePath,
  TEACHING_MONEY_FEATURES_ENABLED,
} from "@/pages/Teaching/lib";

/**
 * Màn quản lý (Giáo viên / Lịch dạy / Chấm công): nhansu và giaovu được
 * thao tác; director / director_la / troly_gd / ketoan_truong chỉ xem.
 * Role khác gõ URL tay → đẩy về màn đầu tiên được phép.
 */
function ManageGuard({ children }: { children: React.ReactNode }) {
  if (!canViewTeaching()) {
    return <Navigate to={teachingHomePath()} replace />;
  }
  return <>{children}</>;
}

/**
 * Tính năng liên quan giá tiền — tạm ẩn kể cả gõ thẳng URL, không chỉ ẩn
 * menu. Xem `TEACHING_MONEY_FEATURES_ENABLED`. Nhân sự vẫn vào được các màn
 * này (VD "Phụ cấp xăng") dù tắt cờ này — đây là nơi họ khai đơn giá, chặn
 * nốt thì không ai khai được giá.
 */
function MoneyFeatureGuard({ children }: { children: React.ReactNode }) {
  if (!TEACHING_MONEY_FEATURES_ENABLED && !canSetTeachingRates()) {
    return <Navigate to={teachingHomePath()} replace />;
  }
  return <>{children}</>;
}

function RateManageGuard({ children }: { children: React.ReactNode }) {
  if (!canSetTeachingRates()) {
    return <Navigate to={teachingHomePath()} replace />;
  }
  return <>{children}</>;
}

/** Màn "Lịch dạy của tôi": chỉ role giaovien. */
/** Nhật ký thao tác — Nhân sự + Ban giám đốc, cố ý loại Giáo vụ. */
function ActivityLogGuard({ children }: { children: React.ReactNode }) {
  if (!canViewActivityLog()) {
    return <Navigate to={teachingHomePath()} replace />;
  }
  return <>{children}</>;
}

/** Thư viện ảnh báo giảng là công cụ nghiệp vụ của Nhân sự/Giáo vụ. */
function TeachingManagerGuard({ children }: { children: React.ReactNode }) {
  if (!canManageTeaching()) return <Navigate to={teachingHomePath()} replace />;
  return <>{children}</>;
}

function TeacherGuard({ children }: { children: React.ReactNode }) {
  // Vừa giaovien vừa nhansu/giaovu → dùng giao diện quản lý (quyền rộng nhất).
  if (canViewTeaching()) {
    return <Navigate to={teachingHomePath()} replace />;
  }
  if (!isTeacher()) {
    return <Navigate to={teachingHomePath()} replace />;
  }
  return <>{children}</>;
}

export function NhanSuRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="giao-vien" replace />} />
      <Route
        path="giao-vien"
        element={
          <ManageGuard>
            <TeacherList />
          </ManageGuard>
        }
      />
      {/* Lớp học của từng trường — phải có lớp rồi mới xếp được lịch dạy. */}
      <Route
        path="lop-hoc"
        element={
          <ManageGuard>
            <SchoolClassPage />
          </ManageGuard>
        }
      />
      {/* Môn học của trường — Nhân sự và Giáo vụ khai như bên Kinh doanh. */}
      <Route
        path="mon-hoc"
        element={
          <ManageGuard>
            <SubjectManagePage />
          </ManageGuard>
        }
      />
      <Route
        path="phu-cap-xang"
        element={
          <ManageGuard>
            <MoneyFeatureGuard>
              <RateManageGuard>
                <FuelAllowanceTierPage />
              </RateManageGuard>
            </MoneyFeatureGuard>
          </ManageGuard>
        }
      />
      <Route
        path="lich-day"
        element={
          <ManageGuard>
            <TeachingSchedulePage />
          </ManageGuard>
        }
      />
      <Route
        path="cham-cong"
        element={
          <ManageGuard>
            <AttendancePage />
          </ManageGuard>
        }
      />
      <Route
        path="hinh-anh"
        element={<TeachingManagerGuard><ImageLibraryPage /></TeachingManagerGuard>}
      />
      {/* Gắn toạ độ trường — căn cứ kiểm tra check-in của giáo viên. */}
      <Route
        path="vi-tri-truong"
        element={
          <ManageGuard>
            <SchoolLocationPage />
          </ManageGuard>
        }
      />
      {/* Các cơ sở của trường nhiều địa điểm — lớp gắn xuống điểm trường thì
          check-in đo theo toạ độ của chính điểm đó. */}
      <Route
        path="diem-truong"
        element={
          <ManageGuard>
            <SchoolBranchPage />
          </ManageGuard>
        }
      />
      {/* Nhật ký thao tác của Giáo vụ / Nhân sự. */}
      <Route
        path="nhat-ky"
        element={
          <ActivityLogGuard>
            <ActivityLogPage />
          </ActivityLogGuard>
        }
      />
      <Route path="*" element={<Navigate to={teachingHomePath()} replace />} />
    </Routes>
  );
}

export function GiaoVienRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="lich-day" replace />} />
      <Route
        path="lich-day"
        element={
          <TeacherGuard>
            <MySchedulePage />
          </TeacherGuard>
        }
      />
      {/* Giáo viên tự check-in / check-out tại trường + xem lịch sử đã chấm. */}
      <Route
        path="cham-cong"
        element={
          <TeacherGuard>
            <TeacherAttendancePage />
          </TeacherGuard>
        }
      />
      {/* Tiết Nhân sự mở, giáo viên tự đăng ký nhận. */}
      <Route
        path="dang-ky-tiet-day"
        element={
          <TeacherGuard>
            <OpenSessionsPage />
          </TeacherGuard>
        }
      />
      <Route path="*" element={<Navigate to={teachingHomePath()} replace />} />
    </Routes>
  );
}
