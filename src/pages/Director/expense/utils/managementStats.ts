/** Một dòng Chi Ngoài đã tính xong số tiền. */
export type ManagementStatRow = {
  totalOutside?: number | string | null;
  paidAmount?: number | string | null;
};

export type ManagementRowStats = {
  /** Số dòng có số tiền, không tính dòng trống. */
  rowCount: number;
  /** Đã chi đủ, gồm cả dòng chi vượt. */
  paidRows: number;
  partialRows: number;
  unpaidRows: number;
  overpaidRows: number;
  overpaidAmount: number;
};

/** Lệch dưới 1 đồng là do làm tròn, coi như đã chi đủ. */
const ROUNDING_TOLERANCE = 1;

const amountOf = (value: unknown) => Math.max(0, Number(value || 0));

export function summarizeManagementRows(
  rows: ManagementStatRow[],
): ManagementRowStats {
  const stats: ManagementRowStats = {
    rowCount: 0,
    paidRows: 0,
    partialRows: 0,
    unpaidRows: 0,
    overpaidRows: 0,
    overpaidAmount: 0,
  };

  for (const row of rows) {
    const total = amountOf(row.totalOutside);
    const paid = amountOf(row.paidAmount);
    if (total <= 0 && paid <= 0) continue;

    stats.rowCount += 1;
    if (paid - total > ROUNDING_TOLERANCE) {
      stats.overpaidRows += 1;
      stats.overpaidAmount += paid - total;
    }
    if (total - paid <= ROUNDING_TOLERANCE) stats.paidRows += 1;
    else if (paid > 0) stats.partialRows += 1;
    else stats.unpaidRows += 1;
  }

  return stats;
}

/** Làm tròn xuống để chỉ hiện 100% khi đã chi đủ thật. */
export function paidPercentOf(totalOutside: unknown, paidAmount: unknown): number {
  const total = amountOf(totalOutside);
  const paid = amountOf(paidAmount);
  if (total <= 0) return 0;
  if (total - paid <= ROUNDING_TOLERANCE) return 100;
  return Math.floor((paid / total) * 1000) / 10;
}
