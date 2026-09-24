import { useNavigate, useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import { provinceApi } from "@/service/province";
import { employeeApi } from "@/service/employee";
import { wardApi } from "@/service/ward";
import { toast } from "react-hot-toast";

/**
 * GET /provinces/provinces-by-employee/:id trả về **danh sách tỉnh phẳng**
 * (backend đã bóc `row.province` ra), không phải bản ghi employee_region.
 */
type ProvinceType = {
    id: number;
    name: string;
};

export default function Province() {
    const { employeeId } = useParams();
    const navigate = useNavigate();

    // Tên biến cũ là "employees" nhưng nội dung là danh sách tỉnh chưa giao.
    const [availableProvinces, setAvailableProvinces] = useState<ProvinceType[]>([]);
    const [showSelectForm, setShowSelectForm] = useState(false);

    const [provinces, setProvinces] = useState<ProvinceType[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);
    const [wards, setWards] = useState<any[]>([]);
    const [showWardModal, setShowWardModal] = useState(false);
    const fetchData = async () => {
        if (!employeeId) return;
        const data = await provinceApi.getProvincesByEmployee(Number(employeeId));
        setProvinces(data);
    };

    useEffect(() => {
        fetchData();
    }, [employeeId]);

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleCreate = async () => {
        try {
            await provinceApi.create({
                name: newName,
            });

            setShowModal(false);
            setNewName("");
            fetchData();
        } catch (err) {
            console.error("Create province failed", err);
        }
    };

    const handleOpenAdd = async () => {
        try {
            const data = await provinceApi.getAvailableProvinces(Number(employeeId));
            setAvailableProvinces(Array.isArray(data) ? data : []);
            setShowSelectForm(true);
        } catch (err) {
            // Trước đây chỉ log: API hỏng là bấm "+" không ra gì, không ai biết vì sao.
            console.error("Load available provinces failed", err);
            toast.error("Không tải được danh sách tỉnh còn trống.");
        }
    };

    const handleAddMany = async () => {
        if (!selectedIds.length) return;

        // Trước đây không bắt lỗi: gọi hỏng thì modal đứng im, người dùng tưởng
        // đã lưu xong. Giờ hỏng là báo thẳng ra màn hình.
        try {
            await employeeApi.addManyToProvince(Number(employeeId), selectedIds);

            setSelectedIds([]);
            setShowSelectForm(false);
            await fetchData();
            toast.success("Đã phân khu vực");
        } catch (err) {
            console.error("Add provinces failed", err);
            toast.error("Không phân được khu vực. Thử lại giúp mình.");
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen">
            <HeaderWithBack title="Danh sách tỉnh" />

            {/* BUTTON ADD */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={handleOpenAdd}
                    className="w-14 h-14 rounded-full bg-blue-500 text-white text-2xl shadow-lg active:scale-90"
                >
                    +
                </button>
            </div>

            {/* LIST */}
            <div className="p-4 space-y-3 pt-20">
                {provinces.map((item) => (
                    <div
                        key={item.id}
                        className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm"
                    >
                        <div
                            onClick={async () => {
                                setSelectedProvinceId(item.id);

                                const data = await wardApi.getByEmployee(Number(employeeId));
                                /*     console.log("All wards:", data);
                                    const filtered = data.filter(
                                        (w: any) => w.province_id === item.id
                                    ); */

                                setWards(data);

                                setShowWardModal(true);
                            }}
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                                📍
                            </div>

                            <p className="font-semibold text-gray-800">
                                {item.name}
                            </p>
                        </div>

                        {/* DELETE */}
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();

                                try {
                                    await employeeApi.removeProvince(
                                        Number(employeeId),
                                        item.id
                                    );
                                    await fetchData();
                                    toast.success("Đã thu hồi khu vực");
                                } catch (err) {
                                    console.error("Remove province failed", err);
                                    toast.error("Không thu hồi được khu vực.");
                                }
                            }}
                            className="text-red-500 px-3 py-1 rounded-lg hover:bg-red-50"
                        >
                            Xoá
                        </button>
                    </div>
                ))}
            </div>

            {/* MODAL CREATE */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white w-[90%] rounded-2xl p-5">
                        <h2 className="text-lg font-semibold mb-4">
                            Tạo tỉnh
                        </h2>

                        <input
                            type="text"
                            placeholder="Tên tỉnh"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full border rounded-lg p-3 mb-4"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-3 rounded-lg bg-gray-200"
                            >
                                Huỷ
                            </button>

                            <button
                                onClick={handleCreate}
                                className="flex-1 py-3 rounded-lg bg-blue-500 text-white"
                            >
                                Tạo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SELECT FORM */}
            {showSelectForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white w-[90%] max-w-md rounded-2xl p-5 space-y-4 shadow-lg">

                        <h2 className="font-bold text-lg text-center">
                            Chọn tỉnh
                        </h2>

                        <div className="max-h-[300px] overflow-auto space-y-2">
                            {availableProvinces.length === 0 && (
                                <p className="text-center text-gray-500">
                                    Không còn dữ liệu
                                </p>
                            )}

                            {availableProvinces.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => toggleSelect(emp.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition
                        ${selectedIds.includes(emp.id)
                                            ? "bg-blue-100 border-blue-500"
                                            : "bg-white hover:bg-gray-50"
                                        }`}
                                >
                                    <p className="font-semibold">{emp.name}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                disabled={!selectedIds.length}
                                onClick={handleAddMany}
                                className="flex-1 bg-blue-500 text-white py-3 rounded-xl disabled:opacity-50"
                            >
                                Thêm ({selectedIds.length})
                            </button>

                            <button
                                onClick={() => {
                                    setShowSelectForm(false);
                                    setSelectedIds([]);
                                }}
                                className="flex-1 bg-gray-300 py-3 rounded-xl"
                            >
                                Huỷ
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showWardModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white w-[90%] max-w-md rounded-2xl p-5">

                        <h2 className="text-lg font-semibold mb-4 text-center">
                            Danh sách phường/xã
                        </h2>

                        <div className="max-h-[300px] overflow-auto space-y-2">
                            {wards.length === 0 && (
                                <p className="text-center text-gray-500">
                                    Không có dữ liệu
                                </p>
                            )}

                            {wards.map((w) => (
                                <div
                                    key={w.id}
                                    className="p-3 border rounded-xl hover:bg-gray-50 cursor-pointer flex justify-between"
                                    onClick={() => {
                                        navigate(`/director/school-list/${employeeId}`, {
                                            state: { ward: w },
                                        });
                                    }}
                                >
                                    <span>{w.name}</span>
                                    <span className="text-sm text-red-500">
                                        {w.schoolcount} trường
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowWardModal(false)}
                            className="mt-4 w-full bg-gray-300 py-3 rounded-xl"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}