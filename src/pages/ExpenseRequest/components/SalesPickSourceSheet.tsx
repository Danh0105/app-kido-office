import { useEffect, useState } from "react";

import { expenseRequestApi } from "@/service/expenseRequest";
import type {
  CashflowSheetResponse,
  CashflowSource,
} from "@/types/expenseRequest";
import CashflowSheetPreview from "./CashflowSheetPreview";

/**
 * "Đề xuất chi tháng": bảng của một loại đã tích (Chi trường = Chi Trường, Chi
 * Ban quản lí = Chi Ngoài, Chi giáo viên = Giáo viên trường) của trường trong
 * kỳ — kinh doanh tích từng khoản. Tự tải số liệu, báo lên form qua `onLoaded`
 * để form tính tổng Còn chi các khoản đã chọn.
 */
export default function SalesPickSourceSheet({
  source,
  schoolId,
  expensePeriodId,
  excludeSuggestId,
  selected,
  onToggle,
  onLoaded,
}: {
  source: CashflowSource;
  schoolId: number;
  expensePeriodId: number;
  excludeSuggestId?: number;
  selected: Set<string>;
  onToggle: (
    source: CashflowSource,
    group: CashflowSheetResponse["groups"][number],
    checked: boolean
  ) => void;
  onLoaded: (source: CashflowSource, sheet: CashflowSheetResponse | null) => void;
}) {
  const [sheet, setSheet] = useState<CashflowSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setSheet(null);
    setError("");
    setLoading(true);
    onLoaded(source, null);
    expenseRequestApi
      .getCashflowSheet({
        source,
        schoolId,
        expensePeriodId,
        excludeSuggestId,
      })
      .then((data) => {
        if (!active) return;
        setSheet(data);
        onLoaded(source, data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err?.response?.data?.message || "Không tải được số liệu QL thu chi"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // onLoaded đổi mỗi lần form render — chỉ tải lại khi đổi bảng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, schoolId, expensePeriodId, excludeSuggestId]);

  return (
    <CashflowSheetPreview
      sheet={sheet}
      loading={loading}
      error={error}
      selectable
      selected={selected}
      onToggle={(group, checked) => onToggle(source, group, checked)}
    />
  );
}
