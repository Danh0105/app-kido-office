// Phần "gọi API đăng nhập" tách khỏi component: toàn hàm thuần, không đụng React
// nên thử tay được, và màn Login chỉ còn phần giao diện.

export const LOGIN_URL = "https://sales.kidoedu.vn/auth/login";

/**
 * Quá mức này coi như mạng không tải nổi. `fetch` không tự bỏ cuộc — không đặt
 * hạn thì sóng yếu là kẹt ở "Đang đăng nhập…" hàng phút, người dùng tưởng treo.
 */
export const LOGIN_TIMEOUT_MS = 20000;

/** Mạng yếu hay rớt gói giữa chừng; gọi lại một lần thường là xong. */
export const LOGIN_ATTEMPTS = 2;

/** Nghỉ giữa hai lần gọi — gọi dồn ngay lúc sóng chập chờn thì cũng trượt tiếp. */
export const LOGIN_RETRY_DELAY_MS = 800;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type LoginPayload = { phone: string; password: string };

export type LoginResponse = {
  ok: boolean;
  status: number;
  /** `null` khi body rỗng hoặc không phải JSON. */
  data: any;
};

/** Lỗi mạng không có `status` để tra — dịch sang câu người dùng làm được gì. */
export const networkMessage = (error: any) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Máy đang không có mạng. Bật lại Wi-Fi hoặc 4G rồi thử lại.";
  }
  if (error?.name === "AbortError") {
    return "Mạng yếu nên đăng nhập quá lâu. Kiểm tra sóng rồi bấm Đăng nhập lại.";
  }
  return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
};

/** Câu báo lỗi cho một phản hồi đã tới nơi nhưng không đăng nhập được. */
export const loginErrorMessage = (result: LoginResponse) => {
  if (!result.ok) {
    return (
      result.data?.message ||
      (result.status >= 500
        ? "Máy chủ đang bận. Thử lại sau ít phút."
        : "Sai số điện thoại hoặc mật khẩu.")
    );
  }

  // Mạng yếu có thể cắt ngang gói tin: status vẫn 200 mà body thiếu/hỏng.
  if (!result.data?.access_token) {
    return "Kết nối bị gián đoạn giữa chừng. Bấm Đăng nhập lại.";
  }

  return "";
};

/**
 * Một lần gọi API đăng nhập, có hạn thời gian.
 *
 * Đọc body dạng text rồi mới `JSON.parse`: mạng yếu hay bị proxy/wifi công cộng
 * chèn trang HTML thì `res.json()` ném "Unexpected token <" — một câu vô nghĩa
 * với người dùng, lại còn giấu mất nguyên nhân thật là lỗi mạng.
 */
export const requestLogin = async (
  payload: LoginPayload
): Promise<LoginResponse> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Gọi đăng nhập, tự gọi lại khi **lỗi mạng**.
 *
 * `fetch` chỉ ném khi mất kết nối hoặc hết hạn chờ; sai mật khẩu về ở
 * `ok === false` nên vòng lặp này không bao giờ gửi lại một lời sai.
 */
export const loginWithRetry = async (
  payload: LoginPayload,
  onRetry?: (attempt: number) => void
): Promise<LoginResponse> => {
  let lastError: any = null;

  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) onRetry?.(attempt);
      return await requestLogin(payload);
    } catch (error) {
      lastError = error;
      if (attempt < LOGIN_ATTEMPTS) await delay(LOGIN_RETRY_DELAY_MS);
    }
  }

  throw lastError;
};
