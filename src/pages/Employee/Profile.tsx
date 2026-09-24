import BottomNav from "@/layout/BottomNav";
import { employeeApi } from "@/service/employee";
import { getEmployeeId, logout } from "@/utils/auth";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { getHomePath } from "@/utils/nav";
import BrandSidebar from "@/pages/Director/components/BrandSidebar";
import { brandMenusForUser, isBrandMenuActive } from "@/utils/brandMenu";
import {
  ChevronLeft,
  Home,
  Lock,
  LogOut,
  Mail,
  Phone,
  Save,
  ScanFace,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import RegisterFace from "../FaceId/RegisterFace";

type User = {
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  avatar?: string | null;
};

const TEACHING_UI_KEYS = [
  "kido.director.teachingDesktopHomeUi",
  "kido.employee.desktopHomeUi",
] as const;

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isDesktop;
};

// Giao diện brand là mặc định cho mọi role; chỉ về classic khi người dùng đã
// chủ động bấm "Giao diện cũ" ở trang chủ.
const hasChosenClassicUi = () =>
  typeof window !== "undefined" &&
  TEACHING_UI_KEYS.some((key) => localStorage.getItem(key) === "classic");

const saveClassicUi = () => {
  TEACHING_UI_KEYS.forEach((key) => localStorage.setItem(key, "classic"));
};

const avatarOf = (user?: User, preview?: string | null) => {
  const raw = preview || user?.avatarUrl || user?.avatar;
  return raw ? resolveApiFileUrl(raw) : null;
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showFaceId, setShowFaceId] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const showBrandProfile = isDesktop && !hasChosenClassicUi();
  const avatarUrl = useMemo(
    () => avatarOf(user, avatarPreview),
    [user, avatarPreview],
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = getEmployeeId();
      const data = await employeeApi.getById(userId);
      setUser(data);
      setProfileForm({
        name: data?.name || "",
        email: data?.email || "",
        phone: data?.phone || "",
      });
    } catch (error) {
      toast.error("Không tải được thông tin cá nhân.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const handleAvatarChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh.");
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    const userId = getEmployeeId();
    if (!profileForm.name.trim()) {
      toast.error("Vui lòng nhập họ tên.");
      return;
    }

    setSavingProfile(true);
    try {
      let payload: any = {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        phone: profileForm.phone.trim(),
      };

      if (avatarFile) {
        const formData = new FormData();
        formData.append("name", payload.name);
        formData.append("email", payload.email);
        formData.append("phone", payload.phone);
        formData.append("avatar", avatarFile);
        payload = formData;
      }

      const updated = await employeeApi.update(userId, payload);
      setUser((current) => ({
        ...current,
        ...profileForm,
        ...(updated || {}),
      }));
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }
      toast.success("Đã cập nhật thông tin cá nhân.");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      toast.error(
        Array.isArray(message)
          ? message.join(", ")
          : message || "Không lưu được thông tin cá nhân.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      const userId = getEmployeeId();
      await employeeApi.changePassword(userId, {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success("Đổi mật khẩu thành công.");
      setShowChangePassword(false);
      setPasswordForm({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast.error("Mật khẩu cũ không đúng.");
    }
  };

  const handleLogout = () => {
    if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
      logout();
      window.location.href = "/";
    }
  };

  const content = (
    <ProfileContent
      user={user}
      loading={loading}
      savingProfile={savingProfile}
      avatarUrl={avatarUrl}
      avatarFile={avatarFile}
      fileInputRef={fileInputRef}
      profileForm={profileForm}
      setProfileForm={setProfileForm}
      onAvatarChange={handleAvatarChange}
      onSaveProfile={handleSaveProfile}
      onChangePassword={() => setShowChangePassword(true)}
      onFaceId={() => setShowFaceId(true)}
      onLogout={handleLogout}
      brand={showBrandProfile}
    />
  );

  return (
    <>
      {showBrandProfile ? (
        <BrandProfileShell onSwitchClassic={() => {
          saveClassicUi();
          navigate(getHomePath());
        }}>
          {content}
        </BrandProfileShell>
      ) : (
        <ClassicProfileShell>{content}</ClassicProfileShell>
      )}

      {showChangePassword && (
        <PasswordModal
          form={passwordForm}
          setForm={setPasswordForm}
          onClose={() => setShowChangePassword(false)}
          onSubmit={handleChangePassword}
        />
      )}

      {showFaceId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-2xl p-4 relative">
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-black"
              onClick={() => setShowFaceId(false)}
            >
              <X size={18} />
            </button>
            <RegisterFace onSuccess={() => setShowFaceId(false)} />
          </div>
        </div>
      )}
    </>
  );
};

function ClassicProfileShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        <div className="bg-blue-500 h-40 rounded-b-3xl relative">
          <button
            onClick={() => navigate(getHomePath())}
            className="hidden lg:flex items-center gap-1 absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition active:scale-95"
          >
            <ChevronLeft size={16} />
            Trang chủ
          </button>
        </div>
        <div className="-mt-12 px-4 md:px-6 pb-24">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}

function BrandProfileShell({
  children,
  onSwitchClassic,
}: {
  children: React.ReactNode;
  onSwitchClassic: () => void;
}) {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const items = brandMenusForUser().map((item) => ({
    key: item.key,
    title: item.title,
    icon: item.icon,
    lucideIcon: item.lucideIcon,
    active: isBrandMenuActive(item, pathname, state),
    onClick: () => navigate(item.to, { state: { from: item.from } }),
  }));

  return (
    <div className="min-h-screen bg-[#FFF8E6] text-[#0047B8] flex">
      <BrandSidebar items={items} onSwitchClassic={onSwitchClassic} />

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-50 flex h-[94px] items-center justify-between border-b border-blue-900/10 bg-white/95 px-8 text-[#0047B8] shadow-sm">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#B87500]">
              Tài khoản
            </div>
            <h1 className="mt-1 text-2xl font-extrabold">Trang cá nhân</h1>
          </div>
          <button
            onClick={() => navigate(getHomePath())}
            className="flex items-center gap-2 rounded-full border border-blue-900/15 bg-[#FFFDF2] px-4 py-2 text-sm font-semibold text-[#0047B8] transition hover:bg-blue-50"
          >
            <Home size={16} />
            Trang chủ
          </button>
        </header>
        <div className="px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

function ProfileContent({
  user,
  loading,
  savingProfile,
  avatarUrl,
  avatarFile,
  fileInputRef,
  profileForm,
  setProfileForm,
  onAvatarChange,
  onSaveProfile,
  onChangePassword,
  onFaceId,
  onLogout,
  brand,
}: {
  user?: User;
  loading: boolean;
  savingProfile: boolean;
  avatarUrl: string | null;
  avatarFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  profileForm: { name: string; email: string; phone: string };
  setProfileForm: React.Dispatch<
    React.SetStateAction<{ name: string; email: string; phone: string }>
  >;
  onAvatarChange: (file?: File) => void;
  onSaveProfile: () => void;
  onChangePassword: () => void;
  onFaceId: () => void;
  onLogout: () => void;
  brand: boolean;
}) {
  const initial = profileForm.name.trim().charAt(0) || user?.name?.charAt(0) || "U";

  return (
    <div className={brand ? "mx-auto max-w-6xl" : ""}>
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        <section className="rounded-3xl bg-white border border-blue-900/10 shadow-sm p-5">
          <div className="flex flex-col items-center text-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-blue-50 shadow-lg ring-2 ring-[#FFC928]"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  className="h-full w-full object-cover"
                  alt="Avatar"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#005BEA] text-4xl font-extrabold text-white">
                  {initial.toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
                <Upload size={22} />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onAvatarChange(event.target.files?.[0])}
            />
            <h2 className="mt-4 text-2xl font-extrabold text-[#0047B8]">
              {loading ? "Đang tải..." : user?.name || "Cá nhân"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {user?.email || "Chưa có email"}
            </p>
            {avatarFile && (
              <p className="mt-3 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Avatar mới chờ lưu
              </p>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <InfoRow icon={Phone} label="Số điện thoại" value={user?.phone} />
            <InfoRow icon={Mail} label="Email" value={user?.email} />
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-3xl bg-white border border-blue-900/10 shadow-sm p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-[#0047B8]">
                  Thông tin cá nhân
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Cập nhật họ tên, email, số điện thoại và avatar.
                </p>
              </div>
              <button
                onClick={onSaveProfile}
                disabled={savingProfile || loading}
                className="flex items-center gap-2 rounded-xl bg-[#005BEA] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0047B8] disabled:opacity-50"
              >
                <Save size={16} />
                {savingProfile ? "Đang lưu..." : "Lưu"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Họ tên">
                <input
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Nhập họ tên"
                />
              </Field>
              <Field label="Số điện thoại">
                <input
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Nhập số điện thoại"
                />
              </Field>
              <Field label="Email">
                <input
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Nhập email"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-blue-900/10 shadow-sm overflow-hidden">
            <ActionButton icon={Lock} label="Đổi mật khẩu" onClick={onChangePassword} />
            <ActionButton icon={ScanFace} label="Đăng ký FaceID" onClick={onFaceId} />
            <ActionButton icon={LogOut} label="Đăng xuất" danger onClick={onLogout} />
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#FFFDF2] border border-blue-900/10 p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#005BEA] shadow-sm">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400">{label}</p>
        <p className="truncate text-sm font-bold text-slate-700">
          {value || "Chưa cập nhật"}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ActionButton({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-blue-900/10 px-5 py-4 text-left text-sm font-bold transition last:border-b-0 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-[#0047B8] hover:bg-blue-50"
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

function PasswordModal({
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  form: { oldPassword: string; newPassword: string; confirmPassword: string };
  setForm: React.Dispatch<
    React.SetStateAction<{
      oldPassword: string;
      newPassword: string;
      confirmPassword: string;
    }>
  >;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#0047B8]">Đổi mật khẩu</h3>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <input
          type="password"
          placeholder="Mật khẩu cũ"
          className={inputClass}
          value={form.oldPassword}
          onChange={(event) =>
            setForm({ ...form, oldPassword: event.target.value })
          }
        />
        <input
          type="password"
          placeholder="Mật khẩu mới"
          className={inputClass}
          value={form.newPassword}
          onChange={(event) =>
            setForm({ ...form, newPassword: event.target.value })
          }
        />
        <input
          type="password"
          placeholder="Xác nhận mật khẩu"
          className={inputClass}
          value={form.confirmPassword}
          onChange={(event) =>
            setForm({ ...form, confirmPassword: event.target.value })
          }
        />

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 text-sm font-semibold text-gray-600"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className="px-4 py-2 bg-[#005BEA] hover:bg-[#0047B8] text-white rounded-xl text-sm font-bold"
            onClick={onSubmit}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-blue-900/10 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#005BEA] focus:ring-2 focus:ring-blue-100";

export default Profile;
