export const getApiErrorMessage = (
  error: any,
  fallback = "Có lỗi xảy ra",
) => {
  const status = error?.response?.status;

  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  if (status === 403) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (status === 404) {
    return "Không tìm thấy dữ liệu yêu cầu.";
  }

  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join(", ") : message || fallback;
};
