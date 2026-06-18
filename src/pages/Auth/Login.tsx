import React, { useEffect, useState } from "react";
import logo from "../../static/Logo.png";
import { useNavigate } from "react-router-dom";
import FaceVerify from "../FaceId/FaceVerify";
import { initWebPush } from "@/utils/webPush";
import { Capacitor } from "@capacitor/core";
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<"password" | "face">("password");
  const isValid = form.phone && form.password;

  const handleSubmit = async () => {
    if (!isValid) return;

    try {
      setLoading(true);

      const res = await fetch("https://sales.kidoedu.vn/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: form.phone,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

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

      await initWebPush();

      if (data.user.role === "employee" || data.user.role === "probation") {
        navigate("/employee/home");
      } else {
        navigate("/director");
      }

      onSuccess?.();
    } catch (err: any) {
      console.error(err.message);
      alert(err.message);
    } finally {
      setLoading(false);
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

              <button
                disabled={!isValid || loading}
                onClick={handleSubmit}
                className={`w-full py-2 rounded-lg text-white ${
                  !isValid || loading ? "bg-gray-400" : "bg-blue-500"
                }`}
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </>
          )}

          {/* ================= FACE ================= */}
          {tab === "face" && (
            <FaceVerify
              onSuccess={async (user: any) => {
                await initWebPush();

                if (user.role === "employee" || user.role === "probation") {
                  navigate("/employee/home");
                } else {
                  navigate("/director");
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
