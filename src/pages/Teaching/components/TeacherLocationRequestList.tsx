import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "react-hot-toast";

import TeacherLocationChangeModal from "@/components/TeacherLocationChangeModal";
import { teacherLocationChangeApi } from "@/service/teaching";
import type { TeacherLocationChangeRequest } from "@/types/teaching";
import { getApiErrorMessage } from "@/utils/apiError";

import type { ReviewStatus } from "./ReviewQueues";
import { QueueEmpty, QueueLoading, QueueRow } from "./QueueRow";

/**
 * Yêu cầu giáo viên xin đổi vị trí nhà. Chỉ phần danh sách — tiêu đề, ô tìm và
 * bộ chọn trạng thái nằm ở khối `ReviewQueues` dùng chung với hàng chờ mở tài
 * khoản, để hai hàng chờ không nhân đôi thanh điều khiển.
 */
export function LocationRequestRows({
  status,
  search,
  onReviewed,
}: {
  status: ReviewStatus;
  search: string;
  onReviewed: () => void;
}) {
  const [items, setItems] = useState<TeacherLocationChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await teacherLocationChangeApi.list(status));
    } catch (cause: unknown) {
      toast.error(getApiErrorMessage(cause, "Không tải được yêu cầu đổi vị trí"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return items;
    return items.filter((item) =>
      (item.teacherName || "").toLocaleLowerCase("vi").includes(keyword),
    );
  }, [items, search]);

  if (loading) return <QueueLoading />;
  if (visible.length === 0) return <QueueEmpty />;

  return (
    <div className="divide-y divide-gray-100">
      {visible.map((item) => (
        <QueueRow
          key={item.id}
          icon={<MapPin size={15} />}
          iconClass="bg-teal-50 text-teal-600"
          title={item.teacherName || `Giáo viên #${item.teacherId}`}
          subtitle={`#${item.id}`}
          createdAt={item.createdAt}
          status={item.status as ReviewStatus}
          onClick={() => setSelectedId(item.id)}
        />
      ))}

      {selectedId && (
        <TeacherLocationChangeModal
          requestId={selectedId}
          onClose={() => setSelectedId(null)}
          onReviewed={async () => {
            await load();
            onReviewed();
          }}
        />
      )}
    </div>
  );
}
