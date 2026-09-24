// api.ts
import axios from "axios";
import { toast } from "react-hot-toast";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      // App dùng HashRouter và màn đăng nhập nằm ở route `/`. Chuyển
      // pathname sang `/login` vừa không khớp route, vừa buộc tải lại
      // toàn bộ app; một API khởi tạo trả 401 ngay sau login vì thế có
      // thể khiến người dùng tưởng màn đăng nhập bị treo.
      if (window.location.hash !== "#/") {
        window.location.hash = "#/";
      }
    }

    // Nest trả "Cannot GET /duong-dan" khi **route không tồn tại**, khác hẳn
    // 404 nghiệp vụ ("không tìm thấy bản ghi") mà nhiều màn đang bắt để xử lý
    // riêng. Chỉ kêu ở trường hợp đầu — sai đường dẫn API mà im lặng thì người
    // dùng bấm Lưu, không thấy gì, tưởng đã lưu xong.
    if (status === 404) {
      const raw = error?.response?.data?.message;
      const text = Array.isArray(raw) ? raw.join(", ") : raw;

      if (
        typeof text === "string" &&
        /^Cannot (GET|POST|PUT|PATCH|DELETE) /i.test(text)
      ) {
        console.error("API route không tồn tại:", text);
        toast.error(
          "Chức năng này đang lỗi kết nối máy chủ. Báo bộ phận kỹ thuật giúp mình."
        );
      }
    }

    if (status === 403) {
      const backendMessage = error?.response?.data?.message;
      const message = Array.isArray(backendMessage)
        ? backendMessage.join(", ")
        : backendMessage;
      toast.error(
        message || "Bạn không có quyền truy cập chức năng này"
      );
    }

    return Promise.reject(error);
  }
);

export default api;
