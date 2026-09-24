import { useState } from "react";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";

import type { TimetableIssue, TimetablePreview } from "@/types/teaching";

import { formatDate } from "../lib";

const MISSING = "chưa có";

/** Số lớp hiện thẳng ra ngoài trước khi bung danh sách đầy đủ. */
const CLASS_PREVIEW_COUNT = 8;

/** Dải thông tin đã chốt — đặt ngay trên lưới để đối chiếu với tiêu đề tờ giấy. */
export function TimetableImportHeader({
  preview,
}: {
  preview: TimetablePreview;
}) {
  const { resolution } = preview;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm font-semibold text-gray-800">
        {resolution.schoolName || MISSING}
        <span className="mx-1.5 text-gray-300">·</span>
        {resolution.subjectName || MISSING}
        <span className="mx-1.5 text-gray-300">·</span>
        {resolution.teacherName || MISSING}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Năm học {resolution.schoolYear || MISSING}
        <span className="mx-1.5 text-gray-300">·</span>
        Áp dụng {formatDate(resolution.effectiveFrom)} →{" "}
        {resolution.effectiveToUnbounded
          ? "vô thời hạn"
          : formatDate(resolution.effectiveTo)}
      </p>
    </div>
  );
}

/**
 * Những gì **sẽ được ghi** khi bấm xác nhận, kèm nút xác nhận.
 *
 * Nút bật/tắt hoàn toàn theo `preview.canCommit` — FE không tính lại điều kiện,
 * hai nơi cùng validate là hai nơi lệch nhau.
 */
export default function TimetableImportSummary({
  preview,
  committing,
  onCommit,
  hideCommit = false,
}: {
  preview: TimetablePreview;
  committing: boolean;
  onCommit: () => void;
  /**
   * true khi nút xác nhận đã được ghim ở đáy panel — chỉ hiện phần tóm tắt,
   * tránh hai nút xác nhận cùng nằm trên một màn.
   */
  hideCommit?: boolean;
}) {
  const [showAllClasses, setShowAllClasses] = useState(false);

  const { newClassNames, existingClassCount, scheduleCount, stats } = preview;
  const visibleClasses = showAllClasses
    ? newClassNames
    : newClassNames.slice(0, CLASS_PREVIEW_COUNT);

  const blockReason =
    preview.blockers[0]?.message ?? preview.needs[0]?.question ?? "";

  return (
    <div className="space-y-3">
      <IssueList issues={preview.blockers} />
      <IssueList issues={preview.warnings} />
      <IssueList issues={preview.notes} />

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Sẽ ghi vào dữ liệu
        </p>

        <dl className="mt-2 space-y-1.5 text-sm">
          <Line label="Lớp dùng lại" value={existingClassCount} />
          <Line
            label="Lớp tạo mới"
            value={newClassNames.length}
            highlight={newClassNames.length > 0}
          />
          <Line label="Lịch tạo mới" value={scheduleCount} />
        </dl>

        {newClassNames.length > 0 && (
          <div className="mt-2 rounded-xl bg-blue-50 px-3 py-2">
            <p className="text-[11px] leading-relaxed text-blue-700">
              {newClassNames.length} lớp chưa có trong hệ thống, sẽ được tạo mới:
            </p>
            <p className="mt-1 text-xs font-medium text-blue-800">
              {visibleClasses.join(", ")}
              {!showAllClasses &&
                newClassNames.length > CLASS_PREVIEW_COUNT &&
                ` … +${newClassNames.length - CLASS_PREVIEW_COUNT}`}
            </p>
            {newClassNames.length > CLASS_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllClasses((value) => !value)}
                className="mt-1 text-[11px] font-medium text-blue-600 underline"
              >
                {showAllClasses ? "Thu gọn" : "Xem tất cả"}
              </button>
            )}
          </div>
        )}

        {/* Tín hiệu phụ, không phải dấu "đã kiểm tra xong": một ô đọc tụt xuống
            nhầm tiết vẫn giữ cờ này bật. */}
        {stats.oneLessonPerClass && (
          <p className="mt-2 text-[11px] text-emerald-600">
            ✓ {stats.totalEntries} tiết cho {stats.distinctClasses} lớp — mỗi lớp
            đúng 1 tiết/tuần. Vẫn nên soi lại lưới với ảnh.
          </p>
        )}

        {!hideCommit && (
          <>
            <button
              onClick={onCommit}
              disabled={!preview.canCommit || committing}
              title={preview.canCommit ? undefined : blockReason}
              className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white active:scale-95 disabled:opacity-40"
            >
              {committing ? "Đang tạo…" : "Xác nhận tạo lớp và lịch"}
            </button>

            {!preview.canCommit && blockReason && (
              <p className="mt-1.5 text-center text-[11px] leading-relaxed text-gray-500">
                Chưa xác nhận được: {blockReason}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={`font-semibold ${
          highlight ? "text-blue-600" : "text-gray-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

const ISSUE_STYLES = {
  ERROR: {
    box: "border-red-100 bg-red-50 text-red-700",
    icon: OctagonAlert,
  },
  WARN: {
    box: "border-amber-100 bg-amber-50 text-amber-700",
    icon: AlertTriangle,
  },
  INFO: {
    box: "border-gray-100 bg-gray-50 text-gray-600",
    icon: Info,
  },
} as const;

/** Hiện nguyên văn `message` của backend — đã viết sẵn cho người dùng cuối. */
export function IssueList({ issues }: { issues: TimetableIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {issues.map((issue, index) => {
        const style = ISSUE_STYLES[issue.level];
        const Icon = style.icon;
        return (
          <p
            key={`${issue.code}-${index}`}
            className={`flex items-start gap-1.5 rounded-xl border px-3 py-2 text-xs leading-relaxed ${style.box}`}
          >
            <Icon size={14} className="mt-px shrink-0" />
            <span>{issue.message}</span>
          </p>
        );
      })}
    </div>
  );
}
