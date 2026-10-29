import type { InputExpenseRow } from "../RealExpenseDetail/type/InputExpenseRow";
import type { ManagementRow } from "../RealExpenseDetail/type/ManagementRow";

/**
 * Dòng Chi Ngoài thứ i dùng chung Nội dung / Số tiết / Số HS / Số tháng với
 * dòng Doanh Thu thứ i. Các dòng nằm sau dòng Doanh Thu cuối cùng là dòng thêm
 * riêng cho Chi Ngoài: tự giữ số lượng (backend cũng chỉ lấy số lượng của
 * chính dòng Chi Ngoài khi không có dòng Doanh Thu cùng rowIndex), còn Nội
 * dung thì không có cột lưu — diễn giải ghi ở cột Ghi chú.
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
        content: STANDALONE_MANAGEMENT_CONTENT,
        totalPeriods: Number(row?.totalPeriods || 0),
        studentCount: Number(row?.studentCount || 0),
        monthsCount: Number(row?.monthsCount ?? 0),
        invoiceLocked: false,
      }
    : inputRows[index];
