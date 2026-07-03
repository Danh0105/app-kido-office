import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import MobileSelect from "@/pages/Employee/Sales/Suggest/MobileSelect";
import { getEmployeeId } from "@/utils/auth";
import { provinceApi } from "@/service/province";
import { wardApi } from "@/service/ward";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { expenseRequestApi } from "@/service/expenseRequest";
import { expenseBasePath, todayISO } from "./lib";
import { formatVnd, parseVnd } from "@/utils/decimal";

const MAX_SIZE = 50 * 1024 * 1024;

type Option = { id: number | string; name: string };

// Tạo đề xuất = gửi duyệt luôn (vào thẳng PENDING_APPROVAL). Không có nháp/sửa.
export default function ExpenseRequestForm() {
  const navigate = useNavigate();
  const base = expenseBasePath();

  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [participants, setParticipants] = useState("");
  const [amount, setAmount] = useState(0);
  const [expectedPaymentDate, setExpectedPaymentDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Chọn khu vực → (phường/xã) → trường (giống luồng đề xuất)
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [wards, setWards] = useState<Option[]>([]);
  const [schools, setSchools] = useState<Option[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<number | null>(null);
  const [schoolYears, setSchoolYears] = useState<Option[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string | null>(
    null,
  );
  const [schoolYearsLoading, setSchoolYearsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Khu vực (province) theo nhân viên
  useEffect(() => {
    provinceApi
      .getProvincesByEmployee(getEmployeeId())
      .then((res: any[]) =>
        setProvinces(res.map((r) => ({ id: r.id, name: r.name }))),
      )
      .catch((e) => console.error(e));
  }, []);

  // Chọn khu vực → load trường + phường/xã
  useEffect(() => {
    if (!selectedRegion) return;
    setSelectedWard(null);
    setSelectedSchool(null);
    setWards([]);
    setSchools([]);

    schoolApi
      .getByEmployeeRegion(selectedRegion)
      .then((res: any[]) => setSchools(res))
      .catch((e) => console.error(e));

    wardApi
      .getByEmployee(getEmployeeId(), selectedRegion)
      .then((res: any[]) => setWards(res.map((w) => ({ id: w.id, name: w.name }))))
      .catch((e) => console.error(e));
  }, [selectedRegion]);

  // Chọn phường/xã → lọc lại trường
  useEffect(() => {
    if (!selectedWard) return;
    setSelectedSchool(null);
    schoolApi
      .getByEmployeeAndWard(getEmployeeId(), selectedWard)
      .then((res: any[]) => setSchools(res))
      .catch((e) => console.error(e));
  }, [selectedWard]);

  useEffect(() => {
    setSchoolYears([]);
    setSelectedSchoolYear(null);

    if (!selectedSchool) return;

    let active = true;
    setSchoolYearsLoading(true);

    subjectApi
      .getFinanceBySchool(selectedSchool)
      .then((response: any) => {
        if (!active) return;

        const subjects = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : [];
        const schoolYearValues: string[] = subjects
          .map((subject: any) => String(subject?.schoolYear || "").trim())
          .filter((schoolYear: string) => Boolean(schoolYear));
        const options: Option[] = [...new Set<string>(schoolYearValues)]
          .sort((first, second) => second.localeCompare(first))
          .map((schoolYear) => ({ id: schoolYear, name: schoolYear }));

        setSchoolYears(options);

        if (options.length > 0) {
          const now = new Date();
          const startYear =
            now.getMonth() + 1 >= 8
              ? now.getFullYear()
              : now.getFullYear() - 1;
          const currentSchoolYear = `${startYear}-${startYear + 1}`;
          const preferred =
            options.find((option) => option.id === currentSchoolYear) ||
            options[0];

          setSelectedSchoolYear(String(preferred.id));
        }
      })
      .catch((e) => {
        console.error(e);
        if (active) setSchoolYears([]);
      })
      .finally(() => {
        if (active) setSchoolYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSchool]);

  const pickFile = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      setError("Tệp tối đa 50MB");
      return;
    }
    setError("");
    setFile(f);
  };

  const validate = () => {
    if (!content.trim()) return "Vui lòng nhập tiêu đề";
    if (content.length > 500) return "Tiêu đề tối đa 500 ký tự";
    if (!amount || amount <= 0) return "Số tiền phải lớn hơn 0";
    if (!expectedPaymentDate) return "Vui lòng chọn ngày dự kiến chi";
    if (expectedPaymentDate < todayISO())
      return "Ngày dự kiến chi phải từ hôm nay trở đi";
    if (!selectedSchool) return "Vui lòng chọn trường";
    if (schoolYearsLoading) return "Đang tải danh sách năm học";
    if (schoolYears.length === 0)
      return "Trường chưa có dữ liệu năm học";
    if (!selectedSchoolYear) return "Vui lòng chọn năm học";
    return "";
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const created = await expenseRequestApi.create({
        content: content.trim(),
        description: description.trim() || undefined,
        participants: participants.trim() || undefined,
        amount,
        expectedPaymentDate,
        schoolId: Number(selectedSchool),
        schoolYear: String(selectedSchoolYear),
        file: file || undefined,
      });
      toast.success("Đã gửi đề xuất, chờ giám đốc duyệt");
      navigate(`${base}/${created.id}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gửi thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title="Tạo đề xuất chi" />

      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div>
            <label className="text-sm text-gray-600">
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={content}
              maxLength={500}
              onChange={(e) => setContent(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: Chi tiếp khách"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Nội dung / lý do</label>
            <textarea
              value={description}
              rows={3}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="Mô tả chi tiết"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Thành phần tham gia</label>
            <textarea
              value={participants}
              rows={2}
              maxLength={500}
              onChange={(e) => setParticipants(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              placeholder="VD: Giám đốc, kế toán, khách hàng dự án X"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Số tiền (đ) <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                inputMode="numeric"
                value={formatVnd(amount)}
                onChange={(event) => setAmount(parseVnd(event.target.value))}
                className="w-full rounded-lg border px-3 py-2 pr-10 text-right text-sm"
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                đ
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Ngày dự kiến chi <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={expectedPaymentDate}
              min={todayISO()}
              onChange={(e) => setExpectedPaymentDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Khu vực → phường/xã → trường */}
          <MobileSelect
            label="Khu vực"
            placeholder="Chọn khu vực"
            value={selectedRegion}
            options={provinces}
            onChange={setSelectedRegion}
          />

          {wards.length > 0 && (
            <MobileSelect
              label="Phường/Xã"
              placeholder="Chọn phường/xã"
              value={selectedWard}
              options={wards}
              onChange={setSelectedWard}
            />
          )}

          {selectedRegion && (
            <MobileSelect
              label="Trường"
              placeholder="Chọn trường"
              value={selectedSchool}
              options={schools}
              onChange={setSelectedSchool}
            />
          )}

          {selectedSchool && (
            <MobileSelect
              label="Năm học"
              placeholder={
                schoolYearsLoading
                  ? "Đang tải năm học..."
                  : "Chọn năm học"
              }
              value={selectedSchoolYear}
              options={schoolYears}
              onChange={setSelectedSchoolYear}
              disabled={schoolYearsLoading || schoolYears.length === 0}
            />
          )}

          <div>
            <label className="text-sm text-gray-600">Tệp đính kèm</label>
            <input
              type="file"
              onChange={(e) => pickFile(e.target.files)}
              className="w-full mt-1 text-sm"
            />
            {file && (
              <div className="mt-2 flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1">
                <span className="truncate">📎 {file.name}</span>
                <button onClick={() => setFile(null)} className="text-red-500 ml-2">
                  ✕
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <p className="text-xs text-gray-400 text-center px-4">
          Sau khi gửi, đề xuất sẽ chuyển đến giám đốc duyệt. Không thể sửa lại.
        </p>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium active:scale-95 disabled:opacity-60"
        >
          {saving ? "Đang gửi…" : "Gửi đề xuất"}
        </button>
      </div>
    </div>
  );
}
