import { useLocation, useNavigate, useParams } from "react-router-dom";
import { schoolApi } from "../../../../service/school.api";
import { getEmployeeId } from "../../../../utils/auth";
import React, { useEffect, useState } from "react";
import { subjectApi } from "@/service/subject.api";
import HeaderWithBack from "@/components/HeaderWithBack";
import {
    DEFAULT_CHECKIN_RADIUS,
    formatCoord,
    getCurrentPosition,
    isGoogleMapsUrl,
    mapsLinkOf,
    parseLatLng,
    toLatLng,
    type LatLng,
} from "@/utils/geo";

/** Bán kính check-in hợp lệ (m) — quá nhỏ thì sai số GPS làm hỏng, quá lớn thì mất ý nghĩa. */
const MIN_RADIUS = 20;
const MAX_RADIUS = 2000;

/** Toạ độ đã gắn cho trường (dùng cho cả thẻ danh sách và form). */
const schoolLatLng = (item: any): LatLng | null => toLatLng(item);

const FormField = ({
    label,
    value,
    error,
    onChange,
    placeholder,
    inputMode,
}: {
    label: string;
    value: string;
    error?: string;
    onChange: (val: string) => void;
    placeholder?: string;
    inputMode?: "text" | "decimal" | "numeric";
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
                placeholder={placeholder}
                inputMode={inputMode}
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

    // Vị trí trường dùng để kiểm tra check-in: toạ độ + bán kính cho phép.
    const [locating, setLocating] = useState(false);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [mapsLink, setMapsLink] = useState("");
    const [resolving, setResolving] = useState(false);

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
        latitude: "",
        longitude: "",
        checkinRadius: "",
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

        if (form.checkinRadius.trim()) {
            const radius = Number(form.checkinRadius);
            if (!Number.isInteger(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS) {
                newErrors.checkinRadius = `Bán kính phải từ ${MIN_RADIUS} đến ${MAX_RADIUS} m`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    /** Đứng tại trường bấm nút này để lấy toạ độ thay vì gõ tay. */
    const handleGetLocation = async () => {
        setLocating(true);
        try {
            const position = await getCurrentPosition();
            setForm((prev) => ({
                ...prev,
                latitude: formatCoord(position.latitude),
                longitude: formatCoord(position.longitude),
                checkinRadius: prev.checkinRadius || String(DEFAULT_CHECKIN_RADIUS),
            }));
            setAccuracy(position.accuracy);
            // Toạ độ mới không còn khớp link cũ nữa.
            setMapsLink("");
            setErrors((prev) => ({ ...prev, latitude: "", longitude: "" }));
        } catch (error: any) {
            alert(error?.message || "Không lấy được vị trí hiện tại");
        } finally {
            setLocating(false);
        }
    };

    const applyPoint = (point: LatLng) => {
        setForm((prev) => ({
            ...prev,
            latitude: formatCoord(point.latitude),
            longitude: formatCoord(point.longitude),
            checkinRadius: prev.checkinRadius || String(DEFAULT_CHECKIN_RADIUS),
        }));
        setAccuracy(null);
        setErrors((prev) => ({ ...prev, latitude: "", longitude: "", mapsLink: "" }));
    };

    /**
     * Lấy toạ độ từ link "Chia sẻ" của Google Maps.
     * Link đầy đủ đã chứa toạ độ → đọc tại chỗ; link rút gọn phải nhờ backend
     * đi theo redirect (trình duyệt bị CORS chặn).
     */
    const resolveMapsLink = async (rawLink?: string) => {
        const link = (rawLink ?? mapsLink).trim();
        if (!link) return;

        setMapsLink(link);

        // Là URL nhưng không thuộc host Google Maps → chặn ngay, khỏi gọi backend.
        if (/^https?:\/\//i.test(link) && !isGoogleMapsUrl(link)) {
            setErrors((prev) => ({
                ...prev,
                mapsLink: "Chỉ hỗ trợ link chia sẻ Google Maps",
            }));
            return;
        }

        // Link đầy đủ / cặp toạ độ đọc được ngay tại máy.
        const local = parseLatLng(link);
        if (local) {
            applyPoint(local);
            return;
        }

        if (!isGoogleMapsUrl(link)) {
            setErrors((prev) => ({
                ...prev,
                mapsLink: "Link Google Maps không hợp lệ",
            }));
            return;
        }

        setResolving(true);
        try {
            const resolved = await schoolApi.resolveGoogleMaps(link);
            applyPoint({
                latitude: Number(resolved.latitude),
                longitude: Number(resolved.longitude),
            });
        } catch (error: any) {
            setErrors((prev) => ({
                ...prev,
                mapsLink:
                    error?.response?.data?.message ||
                    "Không đọc được vị trí từ link Google Maps",
            }));
        } finally {
            setResolving(false);
        }
    };

    /** Xoá vị trí: bỏ trống toạ độ + bán kính, submit sẽ gửi null cho backend. */
    const clearLocation = () => {
        setForm((prev) => ({
            ...prev,
            latitude: "",
            longitude: "",
            checkinRadius: "",
        }));
        setMapsLink("");
        setAccuracy(null);
        setErrors((prev) => ({ ...prev, latitude: "", longitude: "", checkinRadius: "" }));
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
        const coords = schoolLatLng(rest);

        setForm({
            ...rest,
            startDate: formatDisplayDate(rest.startDate),
            // BE trả số / null → form luôn giữ chuỗi.
            latitude: coords ? formatCoord(coords.latitude) : "",
            longitude: coords ? formatCoord(coords.longitude) : "",
            checkinRadius:
                rest.checkinRadius == null ? "" : String(rest.checkinRadius),
        });

        setAccuracy(null);
        setMapsLink(rest.googleMapsUrl || "");
        setErrors({});
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

        await fetchData();
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
            latitude: "",
            longitude: "",
            checkinRadius: "",
        });
        setAccuracy(null);
        setMapsLink("");
        setErrors({});
        setEditingId(null);
    };
    const fetchData = async () => {
        if (!employeeId) return;

        // Có ward (đi từ danh sách phường/xã) thì lọc theo ward; không có ward
        // thì hiện mọi trường của nhân viên.
        const data = ward
            ? await schoolApi.getByEmployeeAndWard(Number(employeeId), Number(ward.id))
            : await schoolApi.getByEmployee(Number(employeeId));
        setSchools(data);
    };
    const handleSubmit = async () => {
        if (!validate()) return;

        const hasCoords = !!form.latitude.trim() && !!form.longitude.trim();

        const payload = {
            ...form,
            scale: Number(form.scale),
            classCount: Number(form.classCount),
            startDate: formatDate(form.startDate),
            employeeId: getEmployeeId(),
            wardId: ward.id,
            // Vị trí check-in: gửi số, xoá vị trí thì gửi null.
            latitude: hasCoords ? Number(form.latitude) : null,
            longitude: hasCoords ? Number(form.longitude) : null,
            checkinRadius: hasCoords
                ? Number(form.checkinRadius) || DEFAULT_CHECKIN_RADIUS
                : null,
            googleMapsUrl: hasCoords ? mapsLink.trim() || null : null,
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

                                {/* Trạng thái vị trí check-in */}
                                {schoolLatLng(item) ? (
                                    <p className="text-[11px] mt-1">
                                        {item.googleMapsUrl ? (
                                            <span className="px-2 py-[2px] rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                                Đã đặt vị trí
                                            </span>
                                        ) : (
                                            <span className="px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium">
                                                Chưa có link Maps
                                            </span>
                                        )}
                                        <span className="text-gray-500 dark:text-gray-400">
                                            {" "}· bán kính{" "}
                                            {item.checkinRadius || DEFAULT_CHECKIN_RADIUS}m ·{" "}
                                        </span>
                                        <a
                                            href={mapsLinkOf(item.googleMapsUrl, schoolLatLng(item))}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-blue-500 underline"
                                        >
                                            Xem trên Google Maps
                                        </a>
                                    </p>
                                ) : (
                                    <span className="inline-block text-[11px] px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium mt-1">
                                        Chưa đặt vị trí
                                    </span>
                                )}
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

                            {/* VỊ TRÍ CHECK-IN */}
                            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                        Vị trí check-in
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={locating}
                                        className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-medium active:scale-95 disabled:opacity-50"
                                    >
                                        {locating ? "Đang lấy…" : "📍 Lấy vị trí hiện tại"}
                                    </button>
                                </div>

                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Đứng tại cổng trường rồi bấm “Lấy vị trí hiện tại”, hoặc mở
                                    Google Maps → <b>Chia sẻ → Sao chép liên kết</b> rồi dán vào ô
                                    dưới. Bỏ trống nếu chưa cần kiểm tra vị trí khi check-in.
                                </p>

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3">
                                        <label className="w-36 text-sm font-medium text-gray-600 dark:text-gray-300">
                                            Link Google Maps
                                        </label>

                                        <input
                                            value={mapsLink}
                                            onChange={(e) => setMapsLink(e.target.value)}
                                            onPaste={(e) =>
                                                // Dán xong lấy toạ độ luôn, khỏi bấm thêm nút.
                                                resolveMapsLink(e.clipboardData.getData("text"))
                                            }
                                            placeholder="https://maps.app.goo.gl/..."
                                            className={`
                                                flex-1 min-w-0 px-4 py-2 rounded-xl border outline-none transition-all duration-200
                                                ${errors.mapsLink
                                                    ? "border-red-500 focus:ring-2 focus:ring-red-400"
                                                    : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-400"
                                                }
                                                bg-white dark:bg-gray-800 text-black dark:text-white
                                                placeholder-gray-400 dark:placeholder-gray-500
                                            `}
                                        />

                                        <button
                                            type="button"
                                            onClick={() => resolveMapsLink()}
                                            disabled={resolving || !mapsLink.trim()}
                                            className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-medium whitespace-nowrap active:scale-95 disabled:opacity-50"
                                        >
                                            {resolving ? "Đang đọc…" : "Lấy toạ độ"}
                                        </button>
                                    </div>

                                    {errors.mapsLink && (
                                        <p className="text-xs text-red-500 ml-36">{errors.mapsLink}</p>
                                    )}
                                </div>

                                {/* Bán kính chỉ có nghĩa khi đã có vị trí. */}
                                {schoolLatLng(form) && (
                                    <>
                                        <FormField
                                            label="Bán kính (m)"
                                            value={form.checkinRadius}
                                            onChange={(v) => handleChange("checkinRadius", v)}
                                            error={errors.checkinRadius}
                                            placeholder={String(DEFAULT_CHECKIN_RADIUS)}
                                            inputMode="numeric"
                                        />
                                        <p className="text-xs text-gray-400 ml-36">
                                            Bán kính cho phép check-in (mét), {MIN_RADIUS}–
                                            {MAX_RADIUS}. Bỏ trống thì hệ thống dùng{" "}
                                            {DEFAULT_CHECKIN_RADIUS} m.
                                        </p>
                                    </>
                                )}

                                {accuracy !== null && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Sai số GPS lúc lấy: ~{accuracy} m
                                        {accuracy > 50
                                            ? " — nên ra chỗ thoáng lấy lại cho chuẩn."
                                            : ""}
                                    </p>
                                )}

                                {schoolLatLng(form) && (
                                    <div className="flex items-center justify-between gap-2">
                                        <a
                                            href={mapsLinkOf(mapsLink, schoolLatLng(form))}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-blue-500 underline"
                                        >
                                            ✅ Đã đặt vị trí — xem trên Google Maps
                                        </a>

                                        {/* Xoá toạ độ: submit sẽ gửi latitude/longitude = null. */}
                                        <button
                                            type="button"
                                            onClick={clearLocation}
                                            className="px-3 py-1.5 rounded-lg border border-red-100 text-red-400 text-xs font-medium active:scale-95"
                                        >
                                            Xoá vị trí
                                        </button>
                                    </div>
                                )}
                            </div>
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
