import { useEffect, useState } from "react";
import { suggestApi } from "@/service/suggest";
import { regionApi } from "@/service/region";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { policiesApi } from "@/service/policy";
import { getEmployeeId } from "@/utils/auth";
import MobileSelect from "./MobileSelect";
import "./css/suggest.css";

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

export default function SuggestPopup({ open, onClose, onSuccess, initialData }: any) {
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState<Suggest>({
        content: "",
        component: "",
        description: "",
        issueDate: "",
        file: null,
    });

    const [years, setYears] = useState<Option[]>([]);
    const [regions, setRegions] = useState<Option[]>([]);
    const [schools, setSchools] = useState<Option[]>([]);
    const [subjects, setSubjects] = useState<Option[]>([]);
    const [policies, setPolicies] = useState<Option[]>([]);

    const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
    const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
    const [selectedPolicy, setSelectedPolicy] = useState<number | null>(null);

    // ===== fetch =====
    useEffect(() => {
        regionApi.getRegionsByEmployee(getEmployeeId()).then((res) => {
            const mapped = res.map((item: any) => ({
                id: item.id,
                name: item.region.name,
            }));

            setRegions(mapped);
        });
    }, []);

    useEffect(() => {
        if (!selectedRegion) return;
        schoolApi.getByEmployeeRegion(Number(selectedRegion)).then((res) => {
            setSchools(res);
            setSelectedSchool(null);
            setSubjects([]);
            setPolicies([]);
        });
    }, [selectedRegion]);

    useEffect(() => {
        if (!selectedSchool || !selectedYear) return;

        subjectApi.getBySchoolYear(selectedYear, selectedSchool).then((res) => {
            setSubjects(res);
            setSelectedSubject(null);
            setPolicies([]);
        });
    }, [selectedSchool, selectedYear]);

    useEffect(() => {
        if (!selectedSubject) return;

        const fetchData = async () => {
            try {
                const data = await policiesApi.getBySubject(selectedSubject);

                const list = Array.isArray(data) ? data : [data];

                const approved = list.filter(
                    (item: any) => item.status === "DIRECTOR_APPROVED"
                );

                if (approved.length === 0) {
                    // ❗ THÔNG BÁO
                    alert("Chưa có chính sách được duyệt cho môn này");

                    setPolicies([]);
                    setSelectedPolicy(null);
                    return;
                }

                const mapped = approved.map((item: any) => ({
                    id: item.id,
                    name: formatPolicyName(item),
                }));

                setPolicies(mapped);
                setSelectedPolicy(null);

            } catch (err) {
                console.error("Load policy failed", err);
            }
        };

        fetchData();
    }, [selectedSubject]);

    useEffect(() => {
        const arr: Option[] = [];
        const currentYear = new Date().getFullYear();

        for (let y = 2021; y <= currentYear; y++) {
            arr.push({ id: `${y}-${y + 1}`, name: `${y}-${y + 1}` });
            arr.push({ id: `Hè ${y}-${y + 1}`, name: `Hè ${y}-${y + 1}` });
        }

        setYears(arr.reverse());
    }, []);

    // ===== submit =====
    const handleSubmit = async () => {
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

    if (!open) return null;

    const inputClass =
        "w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 text-sm";

    return (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative bg-white w-full max-w-md rounded-t-3xl flex flex-col max-h-[90vh]">
                <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />

                <h2 className="text-lg font-semibold text-center">
                    Tạo đề xuất
                </h2>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* form */}
                    <textarea
                        placeholder="Nội dung"
                        value={form.content}
                        onChange={(e) =>
                            setForm({ ...form, content: e.target.value })
                        }
                        className={inputClass}
                    />

                    <input
                        placeholder="Thành phần"
                        value={form.component}
                        onChange={(e) =>
                            setForm({ ...form, component: e.target.value })
                        }
                        className={inputClass}
                    />

                    <textarea
                        placeholder="Diễn giải"
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                        className={inputClass}
                    />

                    <input
                        type="date"
                        value={form.issueDate}
                        onChange={(e) =>
                            setForm({ ...form, issueDate: e.target.value })
                        }
                        className={inputClass}
                    />

                    {/* ===== SELECT CASCADE ===== */}

                    <MobileSelect
                        label="Khu vực"
                        placeholder="Chọn khu vực"
                        value={selectedRegion}
                        options={regions}
                        onChange={setSelectedRegion}
                    />

                    <MobileSelect
                        label="Trường"
                        placeholder="Chọn trường"
                        value={selectedSchool}
                        options={schools}
                        onChange={setSelectedSchool}
                        disabled={!selectedRegion}
                    />

                    <MobileSelect
                        label="Năm học"
                        placeholder="Chọn năm học"
                        value={selectedYear}
                        options={years}
                        onChange={setSelectedYear}
                        disabled={!selectedSchool}
                    />

                    <MobileSelect
                        label="Môn học"
                        placeholder="Chọn môn"
                        value={selectedSubject}
                        options={subjects}
                        onChange={setSelectedSubject}
                        disabled={!selectedYear}
                    />

                    <MobileSelect
                        label="Chính sách"
                        placeholder="Chọn chính sách"
                        value={selectedPolicy}
                        options={policies}
                        onChange={setSelectedPolicy}
                        disabled={!selectedSubject}
                    />

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
                            {loading ? "Đang xử lý..." : "Gửi"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
const formatPolicyName = (item: any) => {
    const date = new Date(item.createdAt);

    return `Chính sách #${item.id} - ${date.toLocaleDateString("vi-VN")}`;
};