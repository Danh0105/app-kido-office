/**
 * Trưởng/phó phòng — chức danh kiêm thêm, gán cùng role nghiệp vụ của người đó.
 * Danh sách chuẩn ở backend (`/employees/positions`); bản này dùng cho menu,
 * điều hướng và danh sách dự phòng khi chưa tải được chức danh.
 */
export const DEPARTMENT_HEAD_POSITIONS = [
  { value: "truongphong_chuyenmon", label: "Trưởng/phó phòng chuyên môn" },
  { value: "truongphong_sanxuat", label: "Trưởng/phó phòng sản xuất" },
  { value: "truongphong_ketoan", label: "Trưởng/phó phòng kế toán" },
  { value: "truongphong_giaovu", label: "Trưởng/phó phòng giáo vụ" },
  { value: "truongphong_nhansu", label: "Trưởng/phó phòng nhân sự" },
  { value: "truongphong_kythuat", label: "Trưởng/phó phòng kỹ thuật" },
  { value: "truongphong_congnghe", label: "Trưởng/phó phòng công nghệ" },
  { value: "truongphong_saleadmin", label: "Trưởng/phó phòng sale admin" },
];

export const DEPARTMENT_HEAD_ROLES = DEPARTMENT_HEAD_POSITIONS.map((p) => p.value);
