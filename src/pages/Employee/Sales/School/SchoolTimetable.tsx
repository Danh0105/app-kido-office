import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { schoolApi } from "@/service/school.api";
import { getEmployeeId } from "@/utils/auth";
import TeachingLayout from "@/pages/Teaching/components/TeachingLayout";
import TimetableTab from "@/pages/Teaching/tabs/TimetableTab";
import type { RefOption } from "@/pages/Teaching/hooks/useTeachingRefData";

/**
 * Thời khoá biểu các trường mình phụ trách — dành cho nhân viên kinh doanh.
 *
 * Dùng đúng lưới TKB của phòng Nhân sự (`TimetableTab`) ở chế độ **chỉ xem**
 * (`canManage={false}`): cùng một bản in TKB, không nhân bản thêm một giao diện
 * thứ hai phải bảo trì song song.
 *
 * Khác Nhân sự hai điểm, và cả hai đều do phân quyền:
 * - Danh sách trường lấy theo `schools.employee_id` (trường mình phụ trách),
 *   không phải toàn bộ trường; backend cũng tự giới hạn phạm vi như vậy.
 * - Không truyền danh sách giáo viên: `/teachers` chỉ mở cho Nhân sự / Giáo vụ /
 *   ban giám đốc (kèm đơn giá), nên bộ lọc theo giáo viên tự ẩn.
 */
export default function SchoolTimetable() {
  const employeeId = Number(getEmployeeId());
  const [schools, setSchools] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }

    let alive = true;
    schoolApi
      .getByEmployee(employeeId)
      .then((rows: any) => {
        if (!alive) return;
        const list = (Array.isArray(rows) ? rows : rows?.data || []).map(
          (row: any) => ({ id: row.id, name: row.name }),
        );
        setSchools(list);
      })
      .catch((reason) => {
        console.error("Load employee schools failed", reason);
        if (alive) {
          setSchools([]);
          toast.error("Không tải được danh sách trường của bạn");
        }
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [employeeId]);

  return (
    <TeachingLayout title="Thời khoá biểu">
      {!loading && schools.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center">
          <p className="text-sm text-gray-500">Bạn chưa phụ trách trường nào.</p>
        </div>
      )}

      {schools.length > 0 && (
        <TimetableTab
          teachers={[]}
          schools={schools}
          canManage={false}
          onCreated={() => undefined}
          // Một trường thì mở sẵn TKB của trường đó, đỡ một bước chọn.
          initialSchoolId={schools.length === 1 ? String(schools[0].id) : ""}
        />
      )}
    </TeachingLayout>
  );
}
