import { formatDistance } from "@/utils/geo";

import { ConfirmModal } from "./Modal";
import { radiusOf, type OutOfRangeMark } from "../hooks/useSessionCheckin";

/**
 * Xác nhận check-in khi giáo viên đứng ngoài bán kính cho phép.
 * Vẫn chấm được — backend ghi nhận kèm cờ "ngoài vùng" để Nhân sự xem lại.
 */
export default function OutOfRangeConfirm({
  mark,
  loading,
  onClose,
  onSubmit,
}: {
  mark: OutOfRangeMark;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const radius = radiusOf(mark.session);

  return (
    <ConfirmModal
      title="Bạn đang ở ngoài vùng cho phép"
      message={
        <>
          Vị trí hiện tại cách <b>{mark.session.schoolName}</b> khoảng{" "}
          <b>{formatDistance(mark.distance)}</b>, trong khi bán kính cho phép là{" "}
          <b>{radius} m</b>.
        </>
      }
      hint={
        <>
          Vẫn check-in được, nhưng buổi này sẽ bị đánh dấu <b>"ngoài vùng"</b>{" "}
          để Nhân sự xem lại.
        </>
      }
      submitLabel="Vẫn check-in"
      submitColor="bg-amber-500"
      loading={loading}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
