import React from "react";
const FormRow = ({ label, children }: any) => (
    <div className="flex items-center gap-4">
        <label className="w-40 text-sm font-medium">{label}</label>
        <div className="flex-1">{children}</div>
    </div>
);
export default function ProposalForm({ form, setForm }) {

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleChangeY = (field: string, value: number) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow space-y-6">

            {/* HEADER */}
            <h2 className="text-lg font-semibold text-center bg-yellow-200 py-2 rounded">
                BẢN ĐỀ NGHỊ CHÍNH SÁCH
            </h2>

            {/* SUBJECT */}
            <FormRow label="Môn học">
                <input
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Ngày">
                <input
                    value={form.date}
                    onChange={(e) => handleChange("date", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            {/* SECTION I */}
            <div className="font-semibold">I. Thông tin người đề nghị</div>

            <FormRow label="Họ tên tư vấn">
                <input
                    value={form.consultant}
                    onChange={(e) => handleChange("consultant", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="SĐT">
                <input
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            {/* SECTION II */}
            <div className="font-semibold">
                II. Thời lượng triển khai
            </div>

            <FormRow label="Năm học">
                <input
                    value={form.schoolYear}
                    onChange={(e) => handleChange("schoolYear", e.target.value)}
                    placeholder="2025 - 2026"
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Tổng số tiết">
                <input
                    value={form.totalLessons}
                    onChange={(e) => handleChange("totalLessons", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Số học sinh">
                <input
                    value={form.totalStudents}
                    onChange={(e) => handleChange("totalStudents", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            {/* SECTION III */}
            <div className="font-semibold">
                III. Thông tin Trường / Hợp đồng
            </div>

            <FormRow label="Trường">
                <input
                    value={form.school}
                    onChange={(e) => handleChange("school", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Địa chỉ">
                <input
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Người đại diện">
                <input
                    value={form.representative}
                    onChange={(e) => handleChange("representative", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Quy mô">
                <input
                    value={form.scale}
                    onChange={(e) => handleChange("scale", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Thời hạn HĐ (năm)">
                <input
                    type="number"
                    value={form.termHD}
                    onChange={(e) =>
                        handleChangeY("termHD", Number(e.target.value))
                    }
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Hợp đồng">
                <input
                    value={form.contract1}
                    onChange={(e) => handleChange("contract1", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Thời hạn PL (năm)">
                <input
                    type="number"
                    value={form.termPL}
                    onChange={(e) =>
                        handleChangeY("termPL", Number(e.target.value))
                    }
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Phụ lục">
                <input
                    value={form.contract3}
                    onChange={(e) => handleChange("contract3", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Ngày khai giảng">
                <input
                    value={form.startDate}
                    onChange={(e) => handleChange("startDate", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="Số HĐ">
                <input
                    value={form.contractNo}
                    onChange={(e) => handleChange("contractNo", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="MST">
                <input
                    value={form.mst}
                    onChange={(e) => handleChange("mst", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>

            <FormRow label="SĐT trường">
                <input
                    value={form.schoolPhone}
                    onChange={(e) => handleChange("schoolPhone", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                />
            </FormRow>
        </div>
    );
}