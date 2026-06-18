import { useLocation, useNavigate, useParams } from "react-router-dom";
import { schoolApi } from "../../../../service/school.api";
import { getEmployeeId } from "../../../../utils/auth";
import React, { useEffect, useState } from "react";
import { subjectApi } from "@/service/subject.api";
import HeaderWithBack from "@/components/HeaderWithBack";


const FormField = ({
    label,
    value,
    error,
    onChange,
}: {
    label: string;
    value: string;
    error?: string;
    onChange: (val: string) => void;
}) => (
    <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
            <label className="
                w-36 text-sm font-medium
                text-gray-600 dark:text-gray-300
            ">
                {label}
            </label>

            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`
                    flex-1 px-4 py-2 rounded-xl border outline-none transition-all duration-200

                    ${error
                        ? "border-red-500 focus:ring-2 focus:ring-red-400"
                        : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
                    }

                    bg-white dark:bg-gray-800
                    text-black dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                `}
            />
        </div>

        {error && (
            <p className="text-xs text-red-500 ml-36">
                {error}
            </p>
        )}
    </div>
);

export default function SchoolList() {
    const navigate = useNavigate();
    const { employeeId } = useParams();
    const location = useLocation();
    const ward = location.state?.ward;

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [schools, setSchools] = useState<any[]>([]);

    const [form, setForm] = useState({
        name: "",
        address: "",
        representative: "",
        scale: "",
        classCount: "",
        contractYears: "",
        contractCode: "",
        appendixYears: "",
        appendix: "",
        startDate: "",
        contractNumber: "",
        taxCode: "",
        phone: "",
    });

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!form.name.trim()) newErrors.name = "Vui lòng nhập tên trường";

        const phoneRegex = /^(0|\+84)(\d{9}|2\d{8,9})$/;
        if (!form.phone) {
            newErrors.phone = "Vui lòng nhập số điện thoại";
        } else if (!phoneRegex.test(form.phone)) {
            newErrors.phone = "SĐT không hợp lệ";
        }
        if (!form.taxCode) {
            newErrors.taxCode = "Vui lòng nhập MST";
        }
        if (form.taxCode && !/^[0-9]{10,13}$/.test(form.taxCode)) {
            newErrors.taxCode = "MST phải từ 10-13 số";
        }

        if (form.scale && isNaN(Number(form.scale))) {
            newErrors.scale = "Quy mô phải là số";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const formatDate = (date: string) => {
        if (!date) return undefined;
        if (date.includes("-")) return date;
        const [d, m, y] = date.split("/");
        return `${y}-${m}-${d}`;
    };

    const formatDisplayDate = (date: string) => {
        if (!date) return "";
        if (date.includes("/")) return date;
        const [y, m, d] = date.split("-");
        return `${d}/${m}/${y}`;
    };

    const handleChange = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleEdit = (item: any) => {
        const { id, ...rest } = item;

        setForm({
            ...rest,
            startDate: formatDisplayDate(rest.startDate),
        });

        setEditingId(id);
        setShowModal(true);
    };

    /*     const handleDelete = async (id: number) => {
            if (confirm("Xóa trường này?")) {
                await schoolApi.remove(id);
                const data = await schoolApi.getAll();
                setSchools(data);
            }
        }; */
    const handleToggleStatus = async (item: any) => {
        const newStatus = item.status === 0 ? 1 : 0;

        const confirmMsg =
            newStatus === 1
                ? "Bạn muốn ngưng trường này?"
                : "Bạn muốn kích hoạt lại trường này?";

        if (!confirm(confirmMsg)) return;

        await schoolApi.updateStatus(item.id, newStatus);

        const user = getEmployeeId();
        const data = await schoolApi.getByEmployee(user);
        setSchools(data);
    };
    const resetForm = () => {
        setForm({
            name: "",
            address: "",
            representative: "",
            scale: "",
            classCount: "",
            contractYears: "",
            contractCode: "",
            appendixYears: "",
            appendix: "",
            startDate: "",
            contractNumber: "",
            taxCode: "",
            phone: "",
        });
        setEditingId(null);
    };
    const fetchData = async () => {
        const data = await schoolApi.getByEmployeeAndWard(
            Number(employeeId),
            Number(ward.id)
        );
        setSchools(data);
    };
    const handleSubmit = async () => {
        if (!validate()) return;

        const payload = {
            ...form,
            scale: Number(form.scale),
            classCount: Number(form.classCount),
            startDate: formatDate(form.startDate),
            employeeId: getEmployeeId(),
            wardId: ward.id,
        };

        try {
            if (editingId) {
                await schoolApi.update(editingId, payload);
            } else {
                await schoolApi.create(payload);
            }
            fetchData();

            alert("Lưu thành công!");
            setShowModal(false);
            resetForm();
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {

        fetchData();
    }, []);

    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen">

            <HeaderWithBack title="Danh sách trường" />
            {/* Button thêm */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => {
                        setEditingId(null);
                        resetForm();
                        setShowModal(true);
                    }}
                    className="w-14 h-14 rounded-full bg-blue-500 text-white text-2xl shadow-lg active:scale-90"
                >
                    +
                </button>
            </div>

            {/* LIST */}
            <div className="p-4 space-y-3" style={{ marginTop: "60px" }}>
                {schools.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => {
                            if (item.status === 0) {
                                navigate(`/employee/school-year/${item.id}`);
                            }
                        }}
                        className={`
                            bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm transition space-y-3

                      
                        `}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-base">
                                    {item.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    📍 {item.address}
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                    {item.scale}
                                </p>
                                <p className="text-xs text-gray-400">Học sinh</p>

                                <p className="text-sm font-medium text-green-600 mt-1">
                                    {item.classCount}
                                </p>
                                <p className="text-xs text-gray-400">Lớp</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-700" />

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Đại diện</span>
                                <span className="text-gray-800 dark:text-gray-200 font-medium">
                                    {item.representative}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">SĐT</span>
                                <span className="text-gray-800 dark:text-gray-200">{item.phone}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">MST</span>
                                <span className="text-gray-800 dark:text-gray-200">{item.taxCode}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()} >
                            <button
                                onClick={() => handleEdit(item)}
                                className={`
                                          ${item.status === 1 ? "opacity-50 pointer-events-none" : "active:scale-95"}
                                    flex-1 py-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-sm font-medium active:scale-95
                                    `}
                            >
                                ✏️ Sửa
                            </button>
                            <button
                                onClick={() => handleToggleStatus(item)}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium
                                        ${item.status === 0
                                        ? "bg-red-50 text-red-600"
                                        : "bg-green-50 text-green-600"

                                    }
                                    
                                    `}
                            >
                                {item.status === 0 ? "⛔ Disable" : "✅ Enable"}
                            </button>
                            {/*          <button
                                onClick={() => handleDelete(item.id)}
                                className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium active:scale-95"
                            >
                                🗑️ Xóa
                            </button> */}
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-end">
                    <div className="bg-white dark:bg-gray-900 w-full rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4 text-black dark:text-white">
                            {editingId ? "Chỉnh sửa trường" : "Tạo trường"}
                        </h2>

                        <div className="space-y-3">
                            <FormField label="Tên trường" value={form.name} onChange={(v) => handleChange("name", v)} error={errors.name} />
                            <FormField label="Địa chỉ" value={form.address} onChange={(v) => handleChange("address", v)} />
                            <FormField label="Người đại diện" value={form.representative} onChange={(v) => handleChange("representative", v)} />
                            <FormField label="Quy mô" value={form.scale} onChange={(v) => handleChange("scale", v)} />
                            <FormField
                                label="Số lớp"
                                value={form.classCount}
                                onChange={(v) => handleChange("classCount", v)}
                                error={errors.classCount}
                            />
                            <FormField label="MST" value={form.taxCode} onChange={(v) => handleChange("taxCode", v)} error={errors.taxCode} />
                            <FormField label="SĐT trường" value={form.phone} onChange={(v) => handleChange("phone", v)} error={errors.phone} />
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => {
                                    setShowModal(false);
                                    resetForm();
                                }}
                                className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 dark:text-white"
                            >
                                Huỷ
                            </button>

                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-3 rounded-xl bg-blue-500 text-white"
                            >
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}