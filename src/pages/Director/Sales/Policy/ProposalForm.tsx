import { useEffect } from "react";

const Input = ({
    value,
    onChange,
    className = "",
}: {
    value: string;
    onChange: (v: string) => void;
    className?: string;
}) => (
    <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`border-b border-gray-400 outline-none bg-transparent px-1 ${className}`}
    />
);

const InputY = ({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) => (
    <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-12 text-center border-b border-gray-400 outline-none bg-transparent"
    />
);

const InputYearRange = ({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) => (
    <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="2025 - 2026"
        className="w-32 text-center border-b border-black outline-none bg-transparent"
    />
);

export default function ProposalForm({ form, setForm }) {
    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleChangeY = (field: string, value: number) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };
    const getStartYear = (schoolYear: string) => {
        const match = schoolYear.match(/\d{4}/);
        return match ? Number(match[0]) : new Date().getFullYear();
    };
    const calculateEndYear = (schoolYear: string, termHD: number) => {
        const startYear = getStartYear(schoolYear);
        return startYear + termHD;
    };
    const endYear = calculateEndYear(form.schoolYear, Number(form.termHD || 0));
    useEffect(() => {
        if (!form.schoolYear) return;

        const startHD = getStartYear(form.schoolYear);

        const startPL = startHD;
        const endPL = startPL + Number(form.termPL || 0);

        handleChange("contract3", `${startPL} - ${endPL}`);
    }, [form.schoolYear, form.termHD, form.termPL]);
    return (
        <div className="border-2 border-black p-4 text-[14px] bg-white font-serif">
            {/* HEADER */}
            <div className="text-center mb-4">
                <h1 className="text-blue-600 font-bold text-lg tracking-wide">
                    BẢN ĐỀ NGHỊ CHÍNH SÁCH MÔN{" "}
                    <Input value={form.subject} onChange={(v) => handleChange("subject", v)} />
                </h1>

                <p className="mt-2">
                    Hôm nay, ngày{" "}
                    <Input value={form.date} onChange={(v) => handleChange("date", v)} className="w-32 text-center" />
                </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* LEFT */}
                <div>
                    <p className="font-bold mb-1">I. Thông tin người đề nghị :</p>

                    <p>
                        Họ và tên tư vấn :
                        <Input value={form.consultant} onChange={(v) => handleChange("consultant", v)} className="ml-2" />
                    </p>

                    <p>
                        SĐT liên hệ :
                        <Input value={form.phone} onChange={(v) => handleChange("phone", v)} className="ml-2" />
                    </p>

                    <p className="italic mt-1">Xác nhận những thông tin sau:</p>

                    <p className="font-bold mt-2">
                        II. Thời lượng triển khai chương trình trong năm học:
                    </p>

                    <div className="ml-2 mt-1 space-y-1">
                        <p>
                            Tổng số tiết năm học{" "}
                            <InputYearRange
                                value={form.schoolYear}
                                onChange={(v) => handleChange("schoolYear", v)}
                            />
                            :
                            <Input
                                value={form.totalLessons}
                                onChange={(v) => handleChange("totalLessons", v)}
                                className="ml-2 w-20 text-center"
                            />
                        </p>

                        <p>
                            Tổng số học sinh:
                            <Input value={form.totalStudents} onChange={(v) => handleChange("totalStudents", v)} className="ml-2 w-28 text-center" />
                        </p>
                    </div>
                </div>

                {/* RIGHT */}
                <div>
                    <p className="font-bold mb-1">III. Thông tin Trường / Hợp đồng</p>

                    <div className="grid grid-cols-2 gap-y-2">
                        <p>Trường:</p>
                        <Input value={form.school} onChange={(v) => handleChange("school", v)} />

                        <p>Địa chỉ:</p>
                        <Input value={form.address} onChange={(v) => handleChange("address", v)} />

                        <p>Người đại diện:</p>
                        <Input value={form.representative} onChange={(v) => handleChange("representative", v)} />

                        <p>Quy mô:</p>
                        <Input value={form.scale} onChange={(v) => handleChange("scale", v)} />

                        <p>Thời hạn HĐ (<InputY value={form.termHD} onChange={(v) => handleChangeY("termHD", v)} /> năm):</p>
                        <Input
                            value={`${getStartYear(form.schoolYear)} - ${endYear}`}
                            onChange={(v) => handleChange("schoolYear", v)}
                        />
                        <p>Thời hạn PL (<InputY value={form.termPL} onChange={(v) => handleChangeY("termPL", v)} /> năm):</p>
                        <Input value={form.contract3} onChange={(v) => handleChange("schoolYear", v)} />

                        <p>Ngày khai giảng:</p>
                        <Input value={form.startDate} onChange={(v) => handleChange("startDate", v)} />

                        <p>Hợp đồng số:</p>
                        <Input value={form.contractNo} onChange={(v) => handleChange("contractNo", v)} />

                        <p>MST:</p>
                        <Input value={form.mst} onChange={(v) => handleChange("mst", v)} />

                        <p>SĐT:</p>
                        <Input value={form.schoolPhone} onChange={(v) => handleChange("schoolPhone", v)} />
                    </div>
                </div>
            </div>
        </div>
    );
}