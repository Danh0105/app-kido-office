import React, { useEffect, useState } from "react";
import logo from "../../static/Logo.png";
import { useNavigate } from "react-router-dom";
import FaceVerify from "../FaceId/FaceVerify";

// 13/11/2026: tạm ẩn đăng nhập bằng FaceID — chỉ còn đăng nhập mật khẩu.
// Đổi thành true để hiện lại tab FaceID.
const FACE_LOGIN_ENABLED = false;
import { initWebPush } from "@/utils/webPush";
import { loginErrorMessage, loginWithRetry, networkMessage } from "./lib";
import LoginNoticeModal, { type LoginNotice } from "./LoginNoticeModal";

const PENDING_LOGIN_NOTICE_KEY = "pending_login_notice";

const savedLoginNotice = (): LoginNotice | null => {
  try {
    const raw = localStorage.getItem(PENDING_LOGIN_NOTICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(PENDING_LOGIN_NOTICE_KEY);
    return null;
  }
};

type Props = {
  onSuccess?: () => void;
};

type LoginForm = {
  phone: string;
  password: string;
  remember: boolean;
};

export default function Login({ onSuccess }: Props) {
  const [form, setForm] = useState<LoginForm>({
    phone: "",
    password: "",
    remember: false,
  });

  const [loading, setLoading] = useState(false);
  /** Lần gọi thứ 2 trở đi → nói cho người dùng biết đang thử lại, không phải treo. */
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [loginNotice, setLoginNotice] = useState<LoginNotice | null>(
    savedLoginNotice,
  );
  const [pendingUser, setPendingUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const navigate = useNavigate();
  const [tab, setTab] = useState<"password" | "face">("password");
  const isValid = form.phone && form.password;

  /** Vào màn chính theo role — dùng chung cho đăng nhập mật khẩu và FaceID. */
  const goHome = (user: any) => {
    const roles: string[] = user?.roles ?? [];
    const EMPLOYEE_ROLES = ["employee", "probation", "employee_la", "sales"];
    navigate(
      EMPLOYEE_ROLES.some((r) => roles.includes(r))
        ? "/employee/home"
        : "/director",
    );
  };

  const finishLogin = (user: any, notice?: LoginNotice | null) => {
    if (!notice) {
      goHome(user);
      onSuccess?.();
      return;
    }

    localStorage.setItem(PENDING_LOGIN_NOTICE_KEY, JSON.stringify(notice));
    setPendingUser(user);
    setLoginNotice(notice);
  };

  const closeLoginNotice = () => {
    localStorage.removeItem(PENDING_LOGIN_NOTICE_KEY);
    setLoginNotice(null);
    if (pendingUser) goHome(pendingUser);
    onSuccess?.();
  };

  const handleSubmit = async () => {
    if (!isValid || loading) return;

    setError("");

    // navigator.onLine chỉ đáng tin khi nó báo `false` — đủ để khỏi bắt chờ 20 giây.
    if (!navigator.onLine) {
      setError("Máy đang không có mạng. Bật lại Wi-Fi hoặc 4G rồi thử lại.");
      return;
    }

    setLoading(true);

    try {
      const result = await loginWithRetry(
        { phone: form.phone, password: form.password },
        () => setRetrying(true),
      );

      const message = loginErrorMessage(result);
      if (message) {
        setError(message);
        return;
      }

      const { data } = result;

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      if (form.remember) {
        localStorage.setItem(
          "remember_login",
          JSON.stringify({
            phone: form.phone,
            password: form.password,
          }),
        );
      } else {
        localStorage.removeItem("remember_login");
      }

      // Đăng ký nhận thông báo chạy nền: nó gọi Firebase rồi gọi tiếp API lưu
      // token, cả hai đều không có hạn chờ. Trước đây `await` ở đây nên mạng yếu
      // là kẹt luôn ở màn đăng nhập dù token đã lưu xong — đăng nhập được rồi
      // mà người dùng tưởng hỏng.
      ensureRealtimeConnection();
      void initWebPush().catch((pushError) => {
        console.warn("Web push initialization failed after login:", pushError);
      });
      if (Capacitor.isNativePlatform()) {
        void initNativePush().catch((pushError) => {
          console.warn(
            "Native push initialization failed after login:",
            pushError,
          );
        });
      }

      finishLogin(data.user, data.loginNotice);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(networkMessage(err));
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };
  useEffect(() => {
    const saved = localStorage.getItem("remember_login");

    if (saved) {
      const parsed = JSON.parse(saved);

      setForm({
        phone: parsed.phone || "",
        password: parsed.password || "",
        remember: true,
      });
    }
  }, []);
  return (
    <div className="bg-gradient-to-b from-blue-500 to-blue-300 min-h-screen flex flex-col justify-center items-center px-5">
      {/* Container */}
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img src={logo} className="w-24 h-24 mb-2" />
          <h1 className="text-white text-xl font-bold">KIDO EDU</h1>
          <p className="text-white opacity-80 text-sm">Đăng nhập hệ thống</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {/* TAB SWITCH */}
          {FACE_LOGIN_ENABLED && (
            <div className="flex mb-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTab("password")}
                className={`flex-1 py-2 rounded-md text-sm ${
                  tab === "password"
                    ? "bg-white shadow text-blue-500"
                    : "text-gray-500"
                }`}
              >
                🔑 Mật khẩu
              </button>

              <button
                onClick={() => setTab("face")}
                className={`flex-1 py-2 rounded-md text-sm ${
                  tab === "face"
                    ? "bg-white shadow text-blue-500"
                    : "text-gray-500"
                }`}
              >
                📸 FaceID
              </button>
            </div>
          )}

          {/* ================= PASSWORD ================= */}
          {tab === "password" && (
            <>
              <div>
                <label className="text-sm text-gray-600">Số điện thoại</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Mật khẩu</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) =>
                      setForm({ ...form, remember: e.target.checked })
                    }
                  />
                  Ghi nhớ
                </label>
              </div>

              {error && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-600">
                  {error}
                </p>
              )}

              <button
                disabled={!isValid || loading}
                onClick={handleSubmit}
                className={`w-full py-2 rounded-lg text-white ${
                  !isValid || loading ? "bg-gray-400" : "bg-blue-500"
                }`}
              >
                {loading
                  ? retrying
                    ? "Mạng chậm, đang thử lại…"
                    : "Đang đăng nhập..."
                  : "Đăng nhập"}
              </button>
            </>
          )}

          {/* ================= FACE ================= */}
          {FACE_LOGIN_ENABLED && tab === "face" && (
            <FaceVerify
              onSuccess={(user: any, notice?: LoginNotice) => {
                // Cùng lý do với đăng nhập mật khẩu: không chờ đăng ký thông báo.
                ensureRealtimeConnection();
                void initWebPush().catch((pushError) => {
                  console.warn(
                    "Web push initialization failed after face login:",
                    pushError,
                  );
                });
                localStorage.setItem("user", JSON.stringify(user));
                finishLogin(user, notice);
              }}
            />
          )}
        </div>
      </div>
      {loginNotice && (
        <LoginNoticeModal notice={loginNotice} onClose={closeLoginNotice} />
      )}
    </div>
  );
}
