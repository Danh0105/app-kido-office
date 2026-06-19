import { useEffect } from "react";

type ProposalFormData = {
  subject: string;
  date: string;
  consultant: string;
  phone: string;
  schoolYear: string;
  totalLessons: string;
  totalStudents: string;
  school: string;
  address: string;
  representative: string;
  scale: string;
  termHD: number;
  termPL: number;
  contractHD?: string;
  contract3: string;
  startDate: string;
  contractNo: string;
  mst: string;
  schoolPhone: string;
};

type ProposalFormProps = {
  form: ProposalFormData;
  setForm: React.Dispatch<React.SetStateAction<ProposalFormData>>;
};

const Input = ({
  value,
  onChange,
  className = "",
  placeholder = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) => (
  <input
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`min-w-0 border-b border-gray-400 bg-transparent px-1 py-0.5 outline-none focus:border-blue-600 ${className}`}
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
    className="mx-1 w-12 border-b border-gray-400 bg-transparent text-center outline-none focus:border-blue-600"
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
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder="2025 - 2026"
    className="w-32 border-b border-black bg-transparent text-center outline-none focus:border-blue-600"
  />
);

export default function ProposalForm({ form, setForm }: ProposalFormProps) {
  const handleChange = (field: keyof ProposalFormData, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleChangeY = (field: keyof ProposalFormData, value: number) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getStartYear = (schoolYear: string) => {
    const match = schoolYear?.match(/\d{4}/);
    return match ? Number(match[0]) : new Date().getFullYear();
  };

  const calculateEndYear = (schoolYear: string, term: number) => {
    const startYear = getStartYear(schoolYear);
    return startYear + Number(term || 0);
  };

  const startYear = getStartYear(form.schoolYear);
  const endHD = calculateEndYear(form.schoolYear, Number(form.termHD || 0));
  const endPL = calculateEndYear(form.schoolYear, Number(form.termPL || 0));

  useEffect(() => {
    if (!form.schoolYear) return;

    setForm((prev) => ({
      ...prev,
      contractHD: `${startYear} - ${endHD}`,
      contract3: `${startYear} - ${endPL}`,
    }));
  }, [
    form.schoolYear,
    form.termHD,
    form.termPL,
    startYear,
    endHD,
    endPL,
    setForm,
  ]);

  return (
    <div
      className="w-full overflow-x-auto rounded-md border-2 border-black bg-white p-4 text-[14px]"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <div className="mx-auto min-w-[760px] max-w-[1100px]">
        {/* HEADER */}
        <div className="mb-5 text-center">
          <h1 className="text-lg font-bold tracking-wide text-blue-600">
            BẢN ĐỀ NGHỊ CHÍNH SÁCH MÔN{" "}
            <Input
              value={form.subject}
              onChange={(v) => handleChange("subject", v)}
              className="w-48 text-center font-bold uppercase"
            />
          </h1>

          <p className="mt-2">
            Hôm nay, ngày{" "}
            <Input
              value={form.date}
              onChange={(v) => handleChange("date", v)}
              className="w-40 text-center"
              placeholder="dd/mm/yyyy"
            />
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <div className="space-y-3">
            <p className="font-bold">I. Thông tin người đề nghị:</p>

            <div className="grid grid-cols-[150px_1fr] items-end gap-2">
              <span>Họ và tên tư vấn:</span>
              <Input
                value={form.consultant}
                onChange={(v) => handleChange("consultant", v)}
                className="w-full"
              />

              <span>SĐT liên hệ:</span>
              <Input
                value={form.phone}
                onChange={(v) => handleChange("phone", v)}
                className="w-full"
              />
            </div>

            <p className="italic">Xác nhận những thông tin sau:</p>

            <p className="font-bold">
              II. Thời lượng triển khai chương trình trong năm học:
            </p>

            <div className="space-y-3 pl-2">
              <div className="flex flex-wrap items-end gap-2">
                <span>Tổng số tiết năm học</span>

                <InputYearRange
                  value={form.schoolYear}
                  onChange={(v) => handleChange("schoolYear", v)}
                />

                <span>:</span>

                <Input
                  value={form.totalLessons}
                  onChange={(v) => handleChange("totalLessons", v)}
                  className="w-24 text-center"
                />
              </div>

              <div className="grid grid-cols-[150px_1fr] items-end gap-2">
                <span>Tổng số học sinh:</span>
                <Input
                  value={form.totalStudents}
                  onChange={(v) => handleChange("totalStudents", v)}
                  className="w-full text-center"
                />
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="space-y-3">
            <p className="font-bold">III. Thông tin Trường / Hợp đồng</p>

            <div className="grid grid-cols-[145px_1fr] items-end gap-x-3 gap-y-3">
              <span>Trường:</span>
              <Input
                value={form.school}
                onChange={(v) => handleChange("school", v)}
                className="w-full"
              />

              <span>Địa chỉ:</span>
              <Input
                value={form.address}
                onChange={(v) => handleChange("address", v)}
                className="w-full"
              />

              <span>Người đại diện:</span>
              <Input
                value={form.representative}
                onChange={(v) => handleChange("representative", v)}
                className="w-full"
              />

              <span>Quy mô:</span>
              <Input
                value={form.scale}
                onChange={(v) => handleChange("scale", v)}
                className="w-full"
              />

              <span>
                Thời hạn HĐ (
                <InputY
                  value={form.termHD}
                  onChange={(v) => handleChangeY("termHD", v)}
                />
                năm):
              </span>
              <Input
                value={`${startYear} - ${endHD}`}
                onChange={(v) => handleChange("contractHD", v)}
                className="w-full text-center"
              />

              <span>
                Thời hạn PL (
                <InputY
                  value={form.termPL}
                  onChange={(v) => handleChangeY("termPL", v)}
                />
                năm):
              </span>
              <Input
                value={form.contract3 || `${startYear} - ${endPL}`}
                onChange={(v) => handleChange("contract3", v)}
                className="w-full text-center"
              />

              <span>Ngày khai giảng:</span>
              <Input
                value={form.startDate}
                onChange={(v) => handleChange("startDate", v)}
                className="w-full"
                placeholder="dd/mm/yyyy"
              />

              <span>Hợp đồng số:</span>
              <Input
                value={form.contractNo}
                onChange={(v) => handleChange("contractNo", v)}
                className="w-full"
              />

              <span>MST:</span>
              <Input
                value={form.mst}
                onChange={(v) => handleChange("mst", v)}
                className="w-full"
              />

              <span>SĐT:</span>
              <Input
                value={form.schoolPhone}
                onChange={(v) => handleChange("schoolPhone", v)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
