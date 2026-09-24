import { Link } from "react-router-dom";

import type { SchoolClass } from "@/types/teaching";

import { inputClass } from "./Modal";
import { CLASS_PAGE_PATH, classLabel } from "../lib";

type Props = {
  /** "" = chưa chọn. Dùng string để thay thẳng cho <select> cũ. */
  value: string;
  onChange: (value: string) => void;
  classes: SchoolClass[];
  loading?: boolean;
  /** Chưa chọn trường thì chưa có lớp nào để chọn. */
  schoolPicked: boolean;
  /** Nhãn dòng trống: "— Chọn lớp —" ở form, "Tất cả lớp" ở thanh lọc. */
  placeholder?: string;
  /**
   * Lớp đang gắn nhưng không nằm trong danh sách vừa tải (lớp đã ngừng dùng).
   * Không có option này thì mở form sửa lịch cũ sẽ thấy ô lớp trống.
   */
  current?: { id: number; name: string } | null;
  className?: string;
  disabled?: boolean;
};

/**
 * Chọn lớp của một trường. Lớp phụ thuộc trường nên phải chọn trường trước —
 * cùng cách hoạt động với ô chọn môn học.
 */
export default function ClassSelect({
  value,
  onChange,
  classes,
  loading = false,
  schoolPicked,
  placeholder = "— Chọn lớp —",
  current = null,
  className = inputClass,
  disabled = false,
}: Props) {
  // Lớp đang gắn đã ngừng dùng → BE không trả về trong danh sách lớp đang dùng.
  const missingCurrent =
    current && !classes.some((item) => item.id === current.id);

  const emptyLabel = !schoolPicked
    ? "Chọn trường trước"
    : loading
    ? "Đang tải lớp…"
    : classes.length === 0 && !missingCurrent
    ? "Trường này chưa có lớp"
    : placeholder;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || !schoolPicked || loading}
      className={`${className} disabled:bg-gray-50 disabled:text-gray-400`}
    >
      <option value="">{emptyLabel}</option>

      {missingCurrent && (
        <option value={String(current!.id)}>{current!.name} (ngừng dùng)</option>
      )}

      {classes.map((item) => (
        <option key={item.id} value={item.id}>
          {classLabel(item)}
        </option>
      ))}
    </select>
  );
}

/** Trường chưa khai báo lớp nào — chỉ đường sang màn Lớp học thay vì để ô rỗng. */
export function NoClassNotice({ schoolName }: { schoolName?: string }) {
  return (
    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
      {schoolName ? <b>{schoolName}</b> : "Trường này"} chưa có lớp học nào. Hãy
      tạo lớp ở màn{" "}
      <Link to={CLASS_PAGE_PATH} className="underline font-medium">
        Lớp học
      </Link>{" "}
      rồi quay lại xếp lịch.
    </div>
  );
}
