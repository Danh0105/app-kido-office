import type { InputExpenseRow } from "../RealExpenseDetail/type/InputExpenseRow";
import type { ManagementRow } from "../RealExpenseDetail/type/ManagementRow";

/**
 * Dòng Chi Ngoài thứ i dùng chung Nội dung / Số tiết / Số HS / Số tháng với
 * dòng Doanh Thu thứ i. Các dòng nằm sau dòng Doanh Thu cuối cùng là dòng thêm
 * riêng cho Chi Ngoài: tự giữ Nội dung và số lượng (backend cũng chỉ lấy số lượng
 * từ chính dòng Chi Ngoài khi không có dòng Doanh Thu cùng rowIndex).
 */
export const STANDALONE_MANAGEMENT_CONTENT = "Chi ngoài bổ sung";

export type ManagementRowInput = Pick<
  InputExpenseRow,
  "content" | "totalPeriods" | "studentCount" | "monthsCount" | "invoiceLocked"
>;

export const isStandaloneManagementRow = (
  index: number,
  inputRows: readonly unknown[],
) => index >= inputRows.length;

export const getManagementRowInput = (
  row: Partial<ManagementRow> | undefined,
  index: number,
  inputRows: InputExpenseRow[],
): ManagementRowInput =>
  isStandaloneManagementRow(index, inputRows)
    ? {
        content: row?.content ?? STANDALONE_MANAGEMENT_CONTENT,
        totalPeriods: Number(row?.totalPeriods || 0),
        studentCount: Number(row?.studentCount || 0),
        monthsCount: Number(row?.monthsCount ?? 0),
        invoiceLocked: false,
      }
    : inputRows[index];

/**
 * Đặt dòng đã lưu đúng vị trí theo rowIndex. Dòng thêm khi bảng đã khoá nằm sau
 * dòng Doanh Thu cuối dù các dòng trước chưa lưu đủ; xếp theo thứ tự nhận về sẽ
 * làm nó dùng nhầm Nội dung của Doanh Thu. rowIndex trùng hoặc lạ thì giữ nguyên.
 */
export const placeRowsByIndex = <T extends { rowIndex?: number | string }>(
  rows: T[],
): (T | undefined)[] => {
  const indexes = rows.map((row) => Number(row.rowIndex));
  const usable =
    new Set(indexes).size === rows.length &&
    indexes.every((index) => Number.isInteger(index) && index >= 0);
  if (!usable) return rows;

  const placed: (T | undefined)[] = [];
  rows.forEach((row, position) => {
    placed[indexes[position]] = row;
  });
  return Array.from(placed);
};
