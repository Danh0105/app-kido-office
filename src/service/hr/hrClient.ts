import axios from "axios";

/**
 * Axios riêng cho `/api/hr/v1`. Khác `service/api.ts`:
 * - KHÔNG tự bật toast cho 403/404 — lỗi HR được dịch tập trung ở
 *   `pages/Hr/lib/hrErrors.ts` (403 M1 cần hiện chi tiết; 404 ngoài phạm vi
 *   phải là câu chung chung).
 * - KHÔNG log request/response ra console (body có thể chứa CCCD, số TK,
 *   giá trị reveal hoặc token tải file).
 * Giữ nguyên cách gắn token và xử lý 401 như client chung.
 */
export const hrClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

hrClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

hrClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      if (window.location.hash !== "#/") window.location.hash = "#/";
    }
    return Promise.reject(error);
  },
);
