import { useMemo } from "react";

import type { PreviewRow, TimetablePreview } from "@/types/teaching";

import { SESSION_LABELS } from "../lib";

/** Một dòng của lưới: một tiết của một buổi. Giờ lấy từ chính các ô trong dòng. */
type Slot = {
  key: string;
  session: PreviewRow["session"];
  period: number;
  startTime: string | null;
  endTime: string | null;
};

const slotKeyOf = (row: PreviewRow) => `${row.session}|${row.period}`;

/**
 * Gom `rows` (danh sách phẳng) về đúng hình dạng tờ giấy: dòng là tiết của từng
 * buổi, cột là thứ.
 *
 * Đây là **gom nhóm để hiển thị**, không phải kiểm tra lại dữ liệu: một ô chứa
 * nhiều lớp thì backend đã báo `SLOT_COLLISION` rồi, ở đây chỉ tô đỏ đúng chỗ đó.
 */
export const buildGrid = (rows: PreviewRow[]) => {
  const days: { value: number; label: string }[] = [];
  const slots: Slot[] = [];
  const cells = new Map<string, PreviewRow[]>();

  rows.forEach((row) => {
    if (!days.some((day) => day.value === row.dayOfWeek)) {
      // Dùng nhãn của backend, không tự map số sang tên thứ.
      days.push({ value: row.dayOfWeek, label: row.dayOfWeekLabel });
    }

    const key = slotKeyOf(row);
    if (!slots.some((slot) => slot.key === key)) {
      slots.push({
        key,
        session: row.session,
        period: row.period,
        startTime: row.startTime,
        endTime: row.endTime,
      });
    }

    const cellKey = `${key}|${row.dayOfWeek}`;
    cells.set(cellKey, [...(cells.get(cellKey) ?? []), row]);
  });

  days.sort((a, b) => a.value - b.value);
  slots.sort((a, b) =>
    a.session === b.session
      ? a.period - b.period
      : a.session === "SANG"
        ? -1
        : 1,
  );

  return { days, slots, cells };
};

export default function TimetableImportGrid({
  preview,
}: {
  preview: TimetablePreview;
}) {
  const { days, slots, cells } = useMemo(
    () => buildGrid(preview.rows),
    [preview.rows],
  );

  if (preview.rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
        <div className="mb-2 text-3xl">🖼️</div>
        <p className="text-sm font-medium text-gray-700">
          Không đọc được tiết nào từ ảnh
        </p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-gray-400">
          Ảnh có thể bị mờ, chụp nghiêng, hoặc không phải tờ thời khoá biểu. Huỷ
          bản nháp rồi chụp lại rõ hơn.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-amber-100 text-gray-800">
                <th className="sticky left-0 z-10 border border-amber-200 bg-amber-100 px-2 py-2 text-xs font-bold uppercase">
                  Buổi
                </th>
                <th className="border border-amber-200 px-2 py-2 text-xs font-bold uppercase">
                  Tiết
                </th>
                <th className="border border-amber-200 px-2 py-2 text-xs font-bold uppercase">
                  Thời gian
                </th>
                {days.map((day) => (
                  <th
                    key={day.value}
                    className="border border-amber-200 px-3 py-2 text-sm font-bold"
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {(["SANG", "CHIEU"] as const).map((session) => {
                const sessionSlots = slots.filter(
                  (slot) => slot.session === session,
                );

                return sessionSlots.map((slot, index) => (
                  <tr key={slot.key}>
                    {index === 0 && (
                      <td
                        rowSpan={sessionSlots.length}
                        className="sticky left-0 z-10 border border-gray-200 bg-white px-2 py-2 text-center text-sm font-bold text-gray-800"
                      >
                        {SESSION_LABELS[session]}
                      </td>
                    )}

                    <td className="border border-gray-200 px-2 py-2 text-center text-sm font-bold text-gray-800">
                      {slot.period}
                    </td>

                    {/* Giờ trống là bình thường khi đang chat bổ sung — hiện "—". */}
                    <td className="whitespace-nowrap border border-gray-200 px-2 py-2 text-center text-xs text-gray-500">
                      {slot.startTime ? (
                        `${slot.startTime} – ${slot.endTime ?? "—"}`
                      ) : (
                        <span className="text-red-500">chưa có giờ</span>
                      )}
                    </td>

                    {days.map((day) => (
                      <GridCell
                        key={day.value}
                        rows={cells.get(`${slot.key}|${day.value}`) ?? []}
                      />
                    ))}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Legend />
    </div>
  );
}

function GridCell({ rows }: { rows: PreviewRow[] }) {
  // Nhiều lớp trong một ô = SLOT_COLLISION của backend, gần như luôn do đọc lệch hàng.
  const collision = rows.length > 1;
  const uncertain = !collision && rows.some((row) => row.confidence === "low");

  return (
    <td
      className={`border px-2 py-1.5 text-center align-middle ${
        collision
          ? "border-red-300 bg-red-100"
          : uncertain
            ? "border-amber-300 bg-amber-50"
            : "border-gray-200"
      }`}
    >
      {rows.length === 0 ? (
        <span className="text-gray-200">·</span>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {rows.map((row, index) => (
            <span
              key={`${row.className}-${index}`}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-semibold ${
                collision ? "text-red-700" : "text-gray-800"
              } ${
                row.classId === null
                  ? "ring-1 ring-inset ring-blue-400"
                  : ""
              }`}
            >
              {row.className}
              {row.classId === null && (
                <span className="text-[9px] font-medium uppercase text-blue-500">
                  mới
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </td>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
      <span className="flex items-center gap-1 text-[10px] text-gray-500">
        <span className="h-2.5 w-2.5 rounded-sm border border-red-300 bg-red-100" />
        Hai lớp cùng một khung giờ — soi lại ảnh
      </span>
      <span className="flex items-center gap-1 text-[10px] text-gray-500">
        <span className="h-2.5 w-2.5 rounded-sm border border-amber-300 bg-amber-50" />
        Đọc chưa chắc
      </span>
      <span className="flex items-center gap-1 text-[10px] text-gray-500">
        <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-blue-400" />
        Lớp sẽ được tạo mới
      </span>
    </div>
  );
}
