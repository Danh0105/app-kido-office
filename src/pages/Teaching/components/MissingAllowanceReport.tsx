import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Home, Layers, School } from "lucide-react";

import type { GasAllowanceMissingReport } from "@/types/teaching";

import { canManageTeaching, canSetTeachingRates } from "../lib";

type Props = {
  report: GasAllowanceMissingReport;
  /** Buổi đã đủ dữ liệu, chỉ cần tính lại — hiện kèm nút nếu có. */
  needsRecomputeSessions?: number;
  onRecompute?: () => void;
};

export const isReportEmpty = (report?: GasAllowanceMissingReport | null) =>
  !report ||
  (report.teachersWithoutLocation.length === 0 &&
    report.placesWithoutLocation.length === 0 &&
    report.distancesWithoutTier.length === 0);

const placeLabel = (item: {
  schoolId: number;
  schoolName: string | null;
  locationName: string | null;
}) =>
  [item.schoolName || `Trường #${item.schoolId}`, item.locationName]
    .filter(Boolean)
    .join(" · ");

const km = (value: number) =>
  `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} km`;

/**
 * "Cần bổ sung": vì sao các buổi của giáo viên công ty chưa có phụ cấp xăng,
 * gộp theo đúng thứ phải sửa, mỗi dòng kèm link tới đúng form để bổ sung.
 *
 * Sửa xong vị trí giáo viên/trường hoặc bậc phụ cấp, backend tự điền lại phụ
 * cấp cho các buổi đang trống — người dùng không phải làm thêm bước nào.
 */
export default function MissingAllowanceReport({
  report,
  needsRecomputeSessions = 0,
  onRecompute,
}: Props) {
  const canFix = canManageTeaching();
  const canFixTiers = canSetTeachingRates();
  const { teachersWithoutLocation, placesWithoutLocation, distancesWithoutTier } =
    report;

  return (
    <div className="space-y-3">
      {teachersWithoutLocation.length > 0 && (
        <Group
          icon={<Home size={14} />}
          title={`${teachersWithoutLocation.length} giáo viên chưa có vị trí nhà`}
          hint="Không có vị trí nhà thì không tính được khoảng cách tới trường. Nhờ giáo viên bấm lấy vị trí trên app, hoặc dán link Google Maps vào hồ sơ giáo viên."
        >
          {teachersWithoutLocation.map((item) => (
            <Item
              key={item.teacherId}
              label={item.teacherName}
              detail={`${item.sessions} buổi chưa có phụ cấp`}
              to={canFix ? `/nhan-su/giao-vien?edit=${item.teacherId}` : undefined}
              action="Thêm vị trí"
            />
          ))}
        </Group>
      )}

      {placesWithoutLocation.length > 0 && (
        <Group
          icon={<School size={14} />}
          title={`${placesWithoutLocation.length} trường/điểm trường chưa có toạ độ`}
          hint="Đặt vị trí cho trường (hoặc điểm trường nếu lớp dạy ở cơ sở riêng). Điểm trường chưa có toạ độ thì lùi về toạ độ của trường."
        >
          {placesWithoutLocation.map((item) => (
            <Item
              key={`${item.schoolId}-${item.schoolLocationId ?? ""}`}
              label={placeLabel(item)}
              detail={`${item.sessions} buổi chưa có phụ cấp`}
              to={
                !canFix
                  ? undefined
                  : item.schoolLocationId
                    ? `/nhan-su/diem-truong?schoolId=${item.schoolId}&locationId=${item.schoolLocationId}`
                    : `/nhan-su/vi-tri-truong?schoolId=${item.schoolId}`
              }
              action="Đặt vị trí"
            />
          ))}
        </Group>
      )}

      {distancesWithoutTier.length > 0 && (
        <Group
          icon={<Layers size={14} />}
          title={`${distancesWithoutTier.length} chặng không khớp bậc phụ cấp`}
          hint="Đã tính được khoảng cách nhưng không bậc phụ cấp xăng nào phủ số km này (khoảng cách quá gần, hoặc rơi vào khe giữa hai bậc). Khai thêm/nới bậc phụ cấp xăng."
        >
          {distancesWithoutTier.map((item) => (
            <Item
              key={`${item.teacherId}-${item.schoolId}-${item.schoolLocationId ?? ""}`}
              label={`${item.teacherName} → ${placeLabel(item)}`}
              detail={
                item.reason === "INVALID_DISTANCE"
                  ? `Khoảng cách bất thường — kiểm tra lại vị trí nhà và trường · ${item.sessions} buổi`
                  : `${km(item.distanceKm ?? 0)} · ${item.sessions} buổi`
              }
              to={
                item.reason === "INVALID_DISTANCE"
                  ? canFix
                    ? `/nhan-su/giao-vien?edit=${item.teacherId}`
                    : undefined
                  : canFixTiers
                    ? "/nhan-su/phu-cap-xang"
                    : undefined
              }
              action={item.reason === "INVALID_DISTANCE" ? "Kiểm tra vị trí" : "Sửa bậc"}
            />
          ))}
        </Group>
      )}

      {needsRecomputeSessions > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span>
            {needsRecomputeSessions} buổi đã đủ dữ liệu nhưng được tạo trước khi
            bổ sung — chỉ cần tính lại phụ cấp.
          </span>
          {onRecompute && (
            <button
              type="button"
              onClick={onRecompute}
              className="ml-auto rounded-lg bg-emerald-600 px-3 py-1 font-medium text-white"
            >
              Tính lại ngay
            </button>
          )}
        </div>
      )}

      {!canFix && (
        <p className="text-[11px] text-gray-500">
          Nhờ phòng Nhân sự/Giáo vụ bổ sung các mục trên.
        </p>
      )}
    </div>
  );
}

function Group({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60">
      <div className="px-3 pt-2.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          {icon}
          {title}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700/90">{hint}</p>
      </div>
      <ul className="mt-2 divide-y divide-amber-100 border-t border-amber-100">
        {children}
      </ul>
    </div>
  );
}

function Item({
  label,
  detail,
  to,
  action,
}: {
  label: string;
  detail: string;
  to?: string;
  action: string;
}) {
  const body = (
    <>
      <AlertTriangle size={12} className="shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-500">{detail}</p>
      </div>
      {to && (
        <span className="flex shrink-0 items-center text-[11px] font-medium text-blue-600">
          {action}
          <ChevronRight size={13} />
        </span>
      )}
    </>
  );

  return (
    <li>
      {to ? (
        <Link to={to} className="flex items-center gap-2 px-3 py-2 hover:bg-amber-100/60">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">{body}</div>
      )}
    </li>
  );
}
