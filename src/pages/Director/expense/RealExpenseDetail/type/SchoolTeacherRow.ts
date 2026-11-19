/** Một dòng bảng Giáo viên trường ở màn QL thu chi. */
export type SchoolTeacherRow = {
  /** id dòng đã lưu — dòng mới chưa có. */
  id?: number;
  /** Chỉ dòng thêm riêng (sau dòng Doanh Thu cuối); dòng đi kèm dùng Nội dung Doanh Thu. */
  content?: string;
  /** Số lượng riêng — chỉ dòng thêm riêng. */
  totalPeriods?: number;
  studentCount?: number;
  monthsCount?: number;
  /** Chưa nhập → Đơn giá "Giáo viên trường" của chính sách. */
  unitPrice?: number | string;
  /** Thuế TNCN nhập tay; trống ("" / undefined) = tự tính theo ngưỡng 5 triệu. */
  pitAmount?: number | string;
  /** Giáo viên nhận (danh sách giáo viên của trường); chưa chọn = null. */
  schoolTeacherId?: number | null;
  expenseDate: string;
  cashAccount: string;
  note: string;
  /** Đã trả theo Đề xuất Chi GV trường — Ngày chi / Nguồn chi khoá, không xoá dòng. */
  suggestCodes?: string;
  /** Đề xuất chi trả từ nhiều nguồn chi: số tiền từng nguồn. */
  suggestSources?: { cashAccount: string | null; amount: number }[];
};
