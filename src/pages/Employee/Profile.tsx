import BottomNav from "@/layout/BottomNav";
import { employeeApi } from "@/service/employee";
import { getEmployeeId, logout } from "@/utils/auth";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import RegisterFace from "../FaceId/RegisterFace";

type User = {
    name: string;
    email: string;
    /* avatar: string; */
    phone?: string;
};


const Profile: React.FC = () => {
    const [user, setUser] = useState<User>();
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showFaceId, setShowFaceId] = useState(false);

    const [form, setForm] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    useEffect(() => {

        const fetchData = async () => {
            const userId = getEmployeeId();
            const data = await employeeApi.getById(userId);
            console.log(data);
            setUser(data);
        }
        fetchData();
    }, []);
    const handleChangePassword = async () => {
        if (form.newPassword !== form.confirmPassword) {
            alert("Mật khẩu xác nhận không khớp");
            return;
        }

        try {
            const userId = getEmployeeId();

            await employeeApi.changePassword(userId, {
                oldPassword: form.oldPassword,
                newPassword: form.newPassword,
            });

            alert("Đổi mật khẩu thành công");
            setShowChangePassword(false);
            setForm({
                oldPassword: "",
                newPassword: "",
                confirmPassword: "",
            });
        } catch (err) {
            alert("Mật khẩu cũ không đúng");
        }
    };
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
            logout();
            window.location.href = "/";
        }
    };
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center">
            {/* Wrapper */}
            <div className="w-full max-w-5xl">

                {/* Header */}
                <div className="bg-blue-500 h-40 rounded-b-3xl relative">
                    <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
                        <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md flex items-center justify-center text-xl font-semibold">
                            {user?.name?.charAt(0)}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="mt-16 px-4 md:px-6">
                    {/* Name */}
                    <div className="text-center mb-6">
                        <h2 className="text-xl md:text-2xl font-semibold">
                            {user?.name}
                        </h2>
                        <p className="text-gray-500 text-sm">{user?.email}</p>
                    </div>

                    {/* GRID DESKTOP */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* LEFT - INFO */}
                        <div className="md:col-span-1 bg-white p-4 rounded-2xl shadow space-y-3">
                            <div>
                                <p className="text-gray-400 text-xs">Phone</p>
                                <p className="text-sm font-medium">{user?.phone}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs">Email</p>
                                <p className="text-sm font-medium">{user?.email}</p>
                            </div>
                        </div>

                        {/* RIGHT - MENU */}
                        <div className="md:col-span-2 bg-white rounded-2xl shadow divide-y">
                            {[
                                "Đổi mật khẩu",
                                "Đăng ký FaceID",
                                "Đăng xuất",
                            ].map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        if (item === "Đổi mật khẩu") {
                                            setShowChangePassword(true);
                                        }
                                        if (item === "Đăng ký FaceID") {
                                            setShowFaceId(true);
                                        }
                                        if (item === "Đăng xuất") {
                                            handleLogout();
                                        }
                                    }}
                                    className="w-full text-left px-4 py-4 text-sm md:text-base 
                                hover:bg-gray-50 active:bg-gray-100 transition"
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showChangePassword && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white w-[90%] max-w-md rounded-2xl p-5 space-y-4">
                        <h3 className="text-lg font-semibold">Đổi mật khẩu</h3>

                        <input
                            type="password"
                            placeholder="Mật khẩu cũ"
                            className="w-full border rounded-lg p-2"
                            value={form.oldPassword}
                            onChange={(e) =>
                                setForm({ ...form, oldPassword: e.target.value })
                            }
                        />

                        <input
                            type="password"
                            placeholder="Mật khẩu mới"
                            className="w-full border rounded-lg p-2"
                            value={form.newPassword}
                            onChange={(e) =>
                                setForm({ ...form, newPassword: e.target.value })
                            }
                        />

                        <input
                            type="password"
                            placeholder="Xác nhận mật khẩu"
                            className="w-full border rounded-lg p-2"
                            value={form.confirmPassword}
                            onChange={(e) =>
                                setForm({ ...form, confirmPassword: e.target.value })
                            }
                        />

                        <div className="flex justify-end gap-2">
                            <button
                                className="px-4 py-2 text-sm"
                                onClick={() => setShowChangePassword(false)}
                            >
                                Hủy
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
                                onClick={handleChangePassword}
                            >
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showFaceId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white w-full max-w-2xl rounded-2xl p-4 relative">

                        {/* Nút đóng */}
                        <button
                            className="absolute top-3 right-3 text-gray-500 hover:text-black"
                            onClick={() => setShowFaceId(false)}
                        >
                            ✕
                        </button>

                        {/* Nhúng component FaceID */}
                        <RegisterFace onSuccess={() => setShowFaceId(false)} />
                    </div>
                </div>
            )}
            {/* BottomNav chỉ mobile */}
            <div >
                <BottomNav />
            </div>
        </div>
    );
};

export default Profile;