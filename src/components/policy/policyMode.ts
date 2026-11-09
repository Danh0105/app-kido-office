export type PolicyMode = "TIET" | "HS";

/**
 * Tab (HP / HS hay HP / Tiết) mà kinh doanh đã chọn khi lưu chính sách — form
 * sửa của Giám đốc / Sales admin / kinh doanh mở mặc định đúng tab này.
 *
 * Từ 24/09/2026 form lưu rõ `mode`, nên lấy đúng `mode`. Chính sách cũ hơn không
 * có `mode`: suy như app gốc lúc kinh doanh tạo chính sách, và như màn xem chi
 * tiết (dòng "HP / Tiết") / popup Thống kê — có Sĩ số HS/lớp ⇒ HP / Tiết, không
 * có ⇒ HP / HS.
 */
export function resolvePolicyMode(data: unknown): PolicyMode {
  const policy =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  if (policy.mode === "TIET" || policy.mode === "HS") return policy.mode;
  const studentPerClass = Number(policy.studentPerClass);
  return Number.isFinite(studentPerClass) && studentPerClass > 0 ? "TIET" : "HS";
}
