import { useEffect, useState } from "react";
import { suggestApi } from "@/service/suggest";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { policiesApi } from "@/service/policy";
import { getEmployeeId } from "@/utils/auth";
import MobileSelect from "./MobileSelect";
import "./css/suggest.css";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";

type Suggest = {
    id?: number;
    content: string;
    component?: string;
    description?: string;
    issueDate?: string;
    file?: File | null;
};

type Option = {
    id: number | string;
    name: string;
};

export default function SuggestPopup({
    open,
    onClose,
    onSuccess,
    initialData,
}: any) {
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState<Suggest>({
        content: "",
        component: "",
        description: "",
        issueDate: "",
        file: null,
    });

    const [wards, setWards] = useState<Option[]>([]);
    const [years, setYears] = useState<Option[]>([]);
    const [provinces, setpPovinces] = useState<Option[]>([]);
    const [schools, setSchools] = useState<Option[]>([]);
    const [subjects, setSubjects] = useState<Option[]>([]);
    const [policies, setPolicies] = useState<Option[]>([]);

    const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
    const [selectedWard, setSelectedWard] = useState<number | null>(null);
    const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
    const [selectedPolicy, setSelectedPolicy] = useState<number | null>(null);

    // ===== fetch provinces =====
    useEffect(() => {
        provinceApi.getProvincesByEmployee(getEmployeeId()).then((res) => {
            const mapped = res.map((item: any) => ({
                id: item.id,
                name: item?.name,
            }));

            setpPovinces(mapped);
        });
    }, []);

    // ===== fetch wards =====
    const fetchWards = async (provinceId: number) => {
        try {
            const data = await wardApi.getByEmployee(
                getEmployeeId(),
                provinceId,
            );

            const mapped = data.map((item: any) => ({
                id: item.id,
                name: item.name,
            }));

            setWards(mapped);
        } catch (err) {
            console.error(err);
        }
    };

    // ===== fetch schools + wards =====
    useEffect(() => {
        if (!selectedRegion) return;

        setSelectedWard(null);
        setSelectedSchool(null);
        setSelectedYear(null);
        setSelectedSubject(null);
        setSelectedPolicy(null);
        setSchools([]);
        setSubjects([]);
        setPolicies([]);

        schoolApi
            .getByEmployeeRegion(selectedRegion)
            .then((res) => {
                setSchools(res);
            });

        fetchWards(selectedRegion);
    }, [selectedRegion]);

    // ===== fetch schools by ward =====
    useEffect(() => {
        if (!selectedWard) return;

        setSelectedSchool(null);
        setSelectedYear(null);
        setSelectedSubject(null);
        setSelectedPolicy(null);
        setSubjects([]);
        setPolicies([]);

        schoolApi.getByEmployeeAndWard(getEmployeeId(), selectedWard).then((res) => {
            setSchools(res);
        });
    }, [selectedWard]);

    // ===== fetch subjects =====
    useEffect(() => {
        if (!selectedSchool || !selectedYear) return;

        subjectApi
            .getBySchoolYear(selectedYear, selectedSchool)
            .then((res) => {
                setSubjects(res);
                setSelectedSubject(null);
                setPolicies([]);
            });
    }, [selectedSchool, selectedYear]);

    // ===== fetch policies =====
    useEffect(() => {
        if (!selectedSubject) return;

        const fetchData = async () => {
            try {
                const data =
                    await policiesApi.getBySubject(selectedSubject);

                const list = Array.isArray(data)
                    ? data
                    : [data];

                const approved = list.filter(
                    (item: any) =>
                        item.status === "DIRECTOR_APPROVED",
                );

                if (approved.length === 0) {
                    alert(
                        "Chưa có chính sách được duyệt cho môn này",
                    );

                    setPolicies([]);
                    setSelectedPolicy(null);

                    return;
                }

                const mapped = approved.map((item: any) => ({
                    id: item.id,
                    name: formatPolicyName(item),
                }));

                setPolicies(mapped);
                setSelectedPolicy(mapped[0]?.id ?? null);

            } catch (err) {
                console.error("Load policy failed", err);
            }
        };

        fetchData();
    }, [selectedSubject]);

    // ===== years =====
    useEffect(() => {
        const arr: Option[] = [];
        const currentYear = new Date().getFullYear();

        for (let y = 2021; y <= currentYear; y++) {
            arr.push({
                id: `${y}-${y + 1}`,
                name: `${y}-${y + 1}`,
            });

            arr.push({
                id: `Hè ${y}-${y + 1}`,
                name: `Hè ${y}-${y + 1}`,
            });
        }

        setYears(arr.reverse());
    }, []);

    // ===== edit mode =====
    useEffect(() => {
        if (initialData) {
            setForm({
                content: initialData.content || "",
                component: initialData.component || "",
                description: initialData.description || "",
                issueDate: initialData.issueDate || "",
                file: null,
            });

            if (initialData.policyId) {
                setSelectedPolicy(initialData.policyId);
            }
        } else {
            setForm({
                content: "",
                component: "",
                description: "",
                issueDate: "",
                file: null,
            });

            setSelectedPolicy(null);
        }
    }, [initialData]);

    // ===== validate =====
    const validateForm = () => {
        if (!form.content?.trim()) {
            alert("Vui lòng nhập nội dung");
            return false;
        }

        if (!form.component?.trim()) {
            alert("Vui lòng nhập thành phần");
            return false;
        }

        if (!form.description?.trim()) {
            alert("Vui lòng nhập diễn giải");
            return false;
        }

        if (!form.issueDate) {
            alert("Vui lòng chọn ngày");
            return false;
        }

        return true;
    };

    // ===== submit =====
    const handleSubmit = async () => {
        if (!validateForm()) return;

        try {
            setLoading(true);

            await suggestApi.create({
                ...form,
                policyId: selectedPolicy || undefined,
                file: form.file || undefined,
            });

            onSuccess();
            onClose();

        } catch (e) {
            alert("Lỗi");
        } finally {
            setLoading(false);
        }
    };

    const inputClass =
        "w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm";

    // ===== reset =====
    useEffect(() => {
        setSelectedSubject(null);
        setSelectedPolicy(null);

        setSubjects([]);
        setPolicies([]);
    }, [selectedSchool]);

    useEffect(() => {
        setSelectedSubject(null);
        setSelectedPolicy(null);

        setPolicies([]);
    }, [selectedYear]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div
                className="absolute inset-0"
                onClick={onClose}
            />

            <div className="relative bg-white w-full max-w-md rounded-t-3xl flex flex-col max-h-[90vh]">
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />

                <h2 className="text-lg font-semibold text-center">
                    Tạo đề xuất
                </h2>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* content */}
                    <textarea
                        placeholder="Nội dung"
                        value={form.content}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                content: e.target.value,
                            })
                        }
                        className={inputClass}
                    />

                    {/* component */}
                    <input
                        placeholder="Thành phần"
                        value={form.component}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                component: e.target.value,
                            })
                        }
                        className={inputClass}
                    />

                    {/* description */}
                    <textarea
                        placeholder="Diễn giải"
                        value={form.description}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                description: e.target.value,
                            })
                        }
                        className={inputClass}
                    />

                    {/* issue date */}
                    <input
                        type="date"
                        value={form.issueDate}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                issueDate: e.target.value,
                            })
                        }
                        className={inputClass}
                    />

                    {/* file */}
                    <div>
                        <label className="text-sm text-gray-600 mb-1 block">
                            File đính kèm
                        </label>

                        <input
                            type="file"
                            onChange={(e) => {
                                const file =
                                    e.target.files?.[0] || null;

                                setForm({
                                    ...form,
                                    file,
                                });
                            }}
                            className="w-full text-sm"
                        />

                        {form.file && (
                            <div className="mt-2 text-sm text-gray-700 flex items-center justify-between bg-gray-100 px-3 py-2 rounded-xl">
                                <span className="truncate">
                                    {form.file.name}
                                </span>

                                <button
                                    onClick={() =>
                                        setForm({
                                            ...form,
                                            file: null,
                                        })
                                    }
                                    className="text-red-500 text-xs"
                                >
                                    Xoá
                                </button>
                            </div>
                        )}
                    </div>

                    {/* region */}
                    <MobileSelect
                        label="Khu vực"
                        placeholder="Chọn khu vực"
                        value={selectedRegion}
                        options={provinces}
                        onChange={setSelectedRegion}
                    />

                    {/* ward */}
                    {wards.length > 0 && (
                        <MobileSelect
                            label="Phường/Xã"
                            placeholder="Chọn phường/xã"
                            value={selectedWard}
                            options={wards}
                            onChange={setSelectedWard}
                        />
                    )}

                    {/* school */}
                    {selectedRegion && (
                        <MobileSelect
                            label="Trường"
                            placeholder="Chọn trường"
                            value={selectedSchool}
                            options={schools}
                            onChange={setSelectedSchool}
                        />
                    )}

                    {/* year */}
                    {selectedSchool && (
                        <MobileSelect
                            label="Năm học"
                            placeholder="Chọn năm học"
                            value={selectedYear}
                            options={years}
                            onChange={setSelectedYear}
                        />
                    )}

                    {/* subject */}
                    {selectedYear && (
                        <MobileSelect
                            label="Môn học"
                            placeholder="Chọn môn"
                            value={selectedSubject}
                            options={subjects}
                            onChange={setSelectedSubject}
                        />
                    )}

                    {/* policy */}
                    {selectedSubject && (
                        <MobileSelect
                            label="Chính sách"
                            placeholder="Chọn chính sách"
                            value={selectedPolicy}
                            options={policies}
                            onChange={setSelectedPolicy}
                        />
                    )}

                    {/* buttons */}
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-200 py-3 rounded-xl"
                        >
                            Huỷ
                        </button>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex-1 bg-blue-600 text-white py-3 rounded-xl"
                        >
                            {loading
                                ? "Đang xử lý..."
                                : "Gửi"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const formatPolicyName = (item: any) => {
    const date = new Date(item.createdAt);

    return `Chính sách #${item.id} - ${date.toLocaleDateString(
        "vi-VN",
    )}`;
};