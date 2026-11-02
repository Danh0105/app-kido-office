/**
 * Nơi DUY NHẤT dịch lỗi API HR sang câu cho người dùng. Component chỉ gọi
 * `describeHrError(err)` — không rải `if (code === ...)`.
 *
 * Không bao giờ đưa dữ liệu người dùng nhập (CCCD, số TK…) vào thông báo:
 * chỉ dùng mã lỗi và các trường có cấu trúc backend trả.
 */

export interface HrErrorView {
  message: string;
  details: string[];
  code: string | null;
  status: number | null;
}

type ErrorBody = {
  code?: string;
  message?: string | string[];
  messageVi?: string;
  missingPermissions?: string[];
  periodNotCovered?: { permission: string; yourEffectiveTo: string | null }[];
  latestEffectiveTo?: string;
};

export const HR_ERROR_MESSAGES: Record<string, string> = {
  HR_GRANT_EXCEEDS_OWN_ACCESS: "Bạn không thể cấp quyền vượt quá quyền hoặc phạm vi hiện tại của mình.",
  HR_DIRECT_GRANT_NOT_ALLOWED: "Quyền quản trị phân quyền chỉ được cấp qua role HR_ADMIN.",
  HR_SENSITIVE_ACCESS_DURATION: "Quyền truy cập dữ liệu nhạy cảm không được vượt quá 180 ngày.",
  HR_CRYPTO_UNAVAILABLE: "Chức năng bảo mật dữ liệu HR hiện chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống.",
  HR_FILE_STORAGE_UNAVAILABLE: "Kho tài liệu HR hiện chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống.",
  HR_FILE_TOKEN_INVALID: "Liên kết tải tài liệu không hợp lệ hoặc đã hết hạn. Vui lòng bấm tải lại.",
  HR_IDENTIFIER_DUPLICATE: "Thông tin định danh này đã tồn tại trong hệ thống.",
  HR_RECORD_EXISTS: "Hồ sơ đã có dữ liệu này. Hãy dùng chức năng cập nhật.",
  HR_VERSION_CONFLICT: "Dữ liệu đã được người khác cập nhật. Vui lòng tải lại rồi thử lại.",
  HR_EMPLOYEE_DUPLICATE: "Mã nhân viên hoặc tài khoản đã được gắn với hồ sơ khác.",
  HR_FILE_TYPE_NOT_ENABLED: "Loại tài liệu này chưa được hỗ trợ (chưa có quyền truy cập tương ứng).",
  HR_FILE_TYPE_NOT_ALLOWED: "Chỉ nhận PDF, JPEG, PNG — nội dung, định dạng và đuôi file phải khớp.",
  HR_FILE_TOO_LARGE: "File vượt quá 10 MB.",
  HR_FILE_REQUIRED: "Vui lòng chọn file.",
  HR_FILE_SCAN_BLOCKED: "Tài liệu bị chặn do chưa qua kiểm tra an toàn.",
  HR_FILE_INTEGRITY: "Không đọc được tài liệu. Vui lòng liên hệ quản trị hệ thống.",
  HR_FILE_CONFLICT: "Có thay đổi đồng thời. Vui lòng thử lại.",
  HR_FILE_USE_DOCUMENTS: "Loại tài liệu này tải lên ở tab Tài liệu.",
  HR_ORG_OUT_OF_SCOPE: "Đơn vị nằm ngoài phạm vi quản lý cơ cấu của bạn.",
  HR_DECRYPTION_FAILED: "Không đọc được dữ liệu đã mã hoá. Vui lòng liên hệ quản trị hệ thống.",
};

/** Mã lỗi mà câu thông báo của server đã rõ ràng và an toàn để hiển thị nguyên văn. */
/** Mã lỗi mà câu của server (tiếng Việt, không chứa dữ liệu người dùng) hiển thị nguyên văn. */
const SERVER_MESSAGE_CODES = ["HR_ADMIN_MINIMUM", "HR_ACCESS_HISTORY", "HR_IDENTIFIER_INVALID", "HR_APPROVER_NOT_CONFIGURED"];
const SERVER_MESSAGE_PREFIXES = ["HR_ORG_", "HR_POSITION_", "HR_LEGACY_MAPPING_", "HR_DOCUMENT_"];

export const NOT_FOUND_OR_FORBIDDEN = "Không tìm thấy dữ liệu hoặc bạn không có quyền truy cập.";

const isoToVn = (iso: string | null | undefined) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const serverText = (body: ErrorBody | undefined): string | null => {
  if (!body) return null;
  if (body.messageVi) return body.messageVi;
  if (Array.isArray(body.message)) return body.message.join("; ");
  return typeof body.message === "string" ? body.message : null;
};

export function describeHrError(error: unknown): HrErrorView {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  const status = typeof response?.status === "number" ? response.status : null;
  const body =
    response?.data && typeof response.data === "object" ? (response.data as ErrorBody) : undefined;
  const code = typeof body?.code === "string" ? body.code : null;
  const details: string[] = [];

  if (status === null) {
    return { message: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.", details, code, status };
  }

  if (code === "HR_GRANT_EXCEEDS_OWN_ACCESS") {
    if (body?.missingPermissions?.length) {
      details.push(`Không đủ quyền: ${body.missingPermissions.join(", ")}`);
    }
    for (const p of body?.periodNotCovered ?? []) {
      details.push(
        p.yourEffectiveTo
          ? `Quyền ${p.permission} của bạn chỉ có hiệu lực đến ${isoToVn(p.yourEffectiveTo)}.`
          : `Quyền ${p.permission} của bạn không đủ thời hạn.`,
      );
    }
  }
  if (code === "HR_SENSITIVE_ACCESS_DURATION" && body?.latestEffectiveTo) {
    details.push(`Ngày hết hạn tối đa: ${isoToVn(body.latestEffectiveTo)}`);
  }

  if (code && HR_ERROR_MESSAGES[code]) {
    return { message: HR_ERROR_MESSAGES[code], details, code, status };
  }
  if (code && (SERVER_MESSAGE_CODES.includes(code) || SERVER_MESSAGE_PREFIXES.some((p) => code.startsWith(p)))) {
    return { message: serverText(body) ?? "Thao tác bị từ chối.", details, code, status };
  }
  if (status === 404) return { message: NOT_FOUND_OR_FORBIDDEN, details, code, status };
  if (status === 403) return { message: "Bạn không có quyền thực hiện thao tác này.", details, code, status };
  if (status === 413) return { message: HR_ERROR_MESSAGES.HR_FILE_TOO_LARGE, details, code, status };
  if (status === 503) return { message: "Chức năng tạm thời không khả dụng. Vui lòng thử lại sau.", details, code, status };
  if (status >= 500) return { message: "Máy chủ gặp lỗi. Vui lòng thử lại sau.", details, code, status };
  // 400 / 409 khác: lỗi kiểm tra dữ liệu của server chỉ nêu tên trường, không lặp giá trị.
  return { message: serverText(body) ?? "Yêu cầu không hợp lệ.", details, code, status };
}

export function isHrErrorCode(error: unknown, code: string): boolean {
  return describeHrError(error).code === code;
}
