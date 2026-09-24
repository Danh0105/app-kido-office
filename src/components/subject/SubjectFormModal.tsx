import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import SearchableSelect from "@/components/SearchableSelect";
import MultiSelect from "@/components/MultiSelect";
import { subjectApi } from "@/service/subject.api";
import { currentSchoolYear } from "@/pages/Teaching/lib";
import {
  subjectCatalogApi,
  type SubjectCatalog,
} from "@/service/subjectCatalog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  canSetTeachingRates,
  isValidRate,
  MAX_RATE_PER_PERIOD,
  parseRate,
  rateToInput,
  TEACHING_MONEY_FEATURES_ENABLED,
} from "@/pages/Teaching/lib";

export type EditableSubject = {
  id: number;
  name: string;
  /** Môn trong danh mục; null với dữ liệu cũ chưa map được. */
  catalogId?: number | null;
  studentCount?: number;
  classCount?: number;
  totalLessons?: number;
  contractDuration?: number;
  appendixDuration?: number;
  startDate?: string;
  contractNumber?: string;
  schoolYear?: string;
  /** Đơn giá mỗi tiết dạy môn này tại trường này — chỉ Nhân sự thấy/sửa được. */
  ratePerPeriod?: number | null;
};

type Props = {
  /** Đã biết trước trường (mở từ trang của trường đó) thì truyền số. */
  schoolId?: number;
  /** Năm học của môn sẽ tạo. Bỏ trống thì người dùng tự chọn ở năm học bên dưới. */
  schoolYear?: string;
  /** Có giá trị = sửa, null = thêm mới. */
  subject: EditableSubject | null;
  onClose: () => void;
  onSaved: () => void;
  /**
   * Chưa biết `schoolId` (bấm "Tạo môn" từ màn quản lý chung, chưa gắn với
   * trường nào) thì truyền danh sách trường để chọn ngay trong form này —
   * không cần màn chọn trường riêng trước đó.
   */
  schools?: { id: number; name: string }[];
};

const emptyForm = {
  /** Id môn trong danh mục, "" = chưa chọn. Tên môn do backend lấy theo danh mục. */
  catalogId: "",
  studentCount: 0,
  classCount: 0,
  totalLessons: 0,
  contractDuration: 0,
  appendixDuration: 0,
  startDate: "",
  contractNumber: "",
  ratePerPeriod: "",
};

type SubjectForm = typeof emptyForm;

/**
 * Form tạo/sửa môn học của trường — dùng chung cho nhân viên kinh doanh và
 * màn quản lý của giám đốc / sales admin.
 *
 * Môn học **chọn từ danh mục** (`/subject-catalogs`), không gõ tay: form gửi
 * `catalogId`, backend tự lấy tên môn theo danh mục.
 */
export default function SubjectFormModal({
  schoolId,
  schoolYear,
  subject,
  onClose,
  onSaved,
  schools,
}: Props) {
  // Đơn giá/tiết của môn đã bỏ khỏi giao diện — xem
  // `TEACHING_MONEY_FEATURES_ENABLED`. Vẫn giữ điều kiện quyền phía sau để bật
  // lại là đúng nguyên trạng: chỉ Nhân sự khai được, kể cả ở các màn Sales
  // dùng chung form này.
  const showRateField = TEACHING_MONEY_FEATURES_ENABLED && canSetTeachingRates();
  const editing = !!subject;

  // Chưa có schoolId cố định (bấm "Tạo môn" chưa gắn trường) thì tự chọn ngay
  // trong form — bỏ luôn màn "chọn trường" riêng trước đó.
  const [pickedSchoolId, setPickedSchoolId] = useState("");
  const effectiveSchoolId = schoolId || Number(pickedSchoolId) || 0;
  const needsSchoolPicker = !editing && !schoolId;

  const [catalogs, setCatalogs] = useState<SubjectCatalog[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<SubjectForm>(() =>
    subject
      ? {
          // Preselect theo catalogId, không so khớp theo tên.
          catalogId: subject.catalogId ? String(subject.catalogId) : "",
          studentCount: subject.studentCount || 0,
          classCount: subject.classCount || 0,
          totalLessons: subject.totalLessons || 0,
          contractDuration: subject.contractDuration || 0,
          appendixDuration: subject.appendixDuration || 0,
          startDate: subject.startDate || "",
          contractNumber: subject.contractNumber || "",
          ratePerPeriod: rateToInput(subject.ratePerPeriod),
        }
      : emptyForm,
  );

  // Tạo mới: cho chọn nhiều môn + nhiều năm học, tạo một môn riêng cho mỗi
  // cặp (môn × năm) — backend chỉ nhận một catalogId/schoolYear mỗi lần gọi.
  // Sửa thì giữ 1 môn + 1 năm như cũ (form.catalogId ở trên).
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>(
    schoolYear ? [schoolYear] : [],
  );
  const yearOptions = useMemo(() => {
    // Luôn có sẵn năm học đến 2028-2029, không phụ thuộc đồng hồ máy chủ.
    const start = Math.max(new Date().getFullYear() + 2, 2028);
    const nearbyYears = Array.from({ length: 12 }, (_, index) => {
      const year = start - index;
      return `${year}-${year + 1}`;
    });
    return Array.from(
      new Set([schoolYear, ...nearbyYears].filter((y): y is string => Boolean(y))),
    );
  }, [schoolYear]);

  // Chưa chọn năm nào (không có schoolYear mặc định) thì tự chọn năm học
  // hiện tại ngay khi có danh sách, đỡ phải bấm thêm một bước.
  useEffect(() => {
    if (!schoolYear && selectedYears.length === 0 && yearOptions.length > 0) {
      const current = currentSchoolYear();
      setSelectedYears([
        yearOptions.includes(current) ? current : yearOptions[0],
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearOptions]);

  const toggleYear = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year)
        ? prev.length > 1
          ? prev.filter((item) => item !== year)
          : prev
        : [...prev, year],
    );
  };

  // Chỉ lấy môn đang dùng — môn sales admin đã tắt thì không chọn mới được nữa.
  useEffect(() => {
    subjectCatalogApi
      .list()
      .then(setCatalogs)
      .catch(() => setCatalogs([]))
      .finally(() => setLoadingCatalogs(false));
  }, []);

  const catalogOptions = useMemo(
    () => catalogs.map((item) => ({ id: item.id, name: item.name })),
    [catalogs],
  );

  /**
   * Môn học cũ chưa map danh mục (hoặc môn danh mục đã bị tắt) — không preselect
   * được, phải để người dùng chọn lại nếu muốn đổi.
   */
  const isLegacySubject =
    editing &&
    !loadingCatalogs &&
    !catalogs.some((item) => String(item.id) === form.catalogId);

  const change = (key: keyof SubjectForm, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (editing) {
      // Sửa môn cũ mà không đổi môn thì được phép bỏ trống — backend giữ nguyên môn.
      if (!form.catalogId && !isLegacySubject) {
        setError("Vui lòng chọn môn học từ danh mục");
        return;
      }
    } else {
      if (!effectiveSchoolId) {
        setError("Vui lòng chọn trường");
        return;
      }
      if (selectedCatalogIds.length === 0) {
        setError("Vui lòng chọn ít nhất 1 môn học");
        return;
      }
      if (selectedYears.length === 0) {
        setError("Vui lòng chọn ít nhất 1 năm học");
        return;
      }
    }

    if (showRateField && !isValidRate(form.ratePerPeriod)) {
      setError(
        `Đơn giá phải từ 0 đến ${MAX_RATE_PER_PERIOD.toLocaleString(
          "vi-VN",
        )}, tối đa 2 chữ số thập phân`,
      );
      return;
    }

    setError("");
    setSaving(true);
    try {
      const basePayload: Record<string, any> = {
        schoolId: effectiveSchoolId,
        classCount: Number(form.classCount),
        studentCount: Number(form.studentCount),
        totalLessons: Number(form.totalLessons),
        contractDuration: Number(form.contractDuration),
        appendixDuration: Number(form.appendixDuration),
        startDate: form.startDate,
        contractNumber: form.contractNumber,
        ...(showRateField
          ? { ratePerPeriod: parseRate(form.ratePerPeriod) }
          : {}),
      };

      if (editing) {
        // Không gửi `name` — tên môn backend lấy theo danh mục.
        // Bỏ trống catalogId khi sửa môn cũ = giữ nguyên môn đang có.
        if (form.catalogId) basePayload.catalogId = Number(form.catalogId);

        await subjectApi.update(subject!.id, {
          ...basePayload,
          schoolYear: subject!.schoolYear || schoolYear,
        });
        toast.success("Đã cập nhật môn học");
      } else {
        const catalogById = new Map(catalogOptions.map((item) => [item.id, item.name]));
        const combos = selectedCatalogIds.flatMap((catalogId) =>
          selectedYears.map((year) => ({ catalogId, year })),
        );
        const results = await Promise.allSettled(
          combos.map(({ catalogId, year }) =>
            subjectApi.create({ ...basePayload, catalogId, schoolYear: year }),
          ),
        );
        const failed = results
          .map((result, index) => ({ result, combo: combos[index] }))
          .filter(({ result }) => result.status === "rejected");

        if (failed.length === 0) {
          toast.success(
            combos.length > 1
              ? `Đã thêm ${combos.length} môn học`
              : "Đã thêm môn học",
          );
        } else if (failed.length < combos.length) {
          toast.success(`Đã thêm ${combos.length - failed.length}/${combos.length} môn học`);
          const reason =
            failed[0].result.status === "rejected" ? failed[0].result.reason : null;
          const failedLabels = failed
            .map(({ combo }) => `${catalogById.get(combo.catalogId) || combo.catalogId} (${combo.year})`)
            .join(", ");
          toast.error(`Lỗi: ${failedLabels} — ${getApiErrorMessage(reason, "Thất bại")}`);
        } else {
          const reason =
            failed[0].result.status === "rejected" ? failed[0].result.reason : null;
          const message = getApiErrorMessage(reason, "Lưu môn học thất bại");
          setError(message);
          toast.error(message);
          return;
        }
      }

      onSaved();
    } catch (err: any) {
      // 400 của backend nêu rõ lý do (môn không tồn tại / đã ngừng dùng…) —
      // hiện nguyên văn thay vì nuốt lỗi.
      const message = getApiErrorMessage(err, "Lưu môn học thất bại");
      setError(message);
      if (err?.response?.status !== 403) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const emptyCatalog = !loadingCatalogs && catalogs.length === 0;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute bottom-0 left-0 right-0 md:inset-0 md:m-auto md:h-fit md:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl md:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Handle (mobile) */}
        <div className="flex justify-center py-3 md:hidden">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-5 pb-4 pt-2 md:pt-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editing ? "Sửa môn học" : "Tạo môn học"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {editing
                  ? `Năm học ${subject!.schoolYear || schoolYear}`
                  : needsSchoolPicker && !effectiveSchoolId
                  ? "Chọn trường để bắt đầu"
                  : selectedYears.length > 1
                  ? `${selectedYears.length} năm học`
                  : selectedYears[0]
                  ? `Năm học ${selectedYears[0]}`
                  : "Chọn năm học"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {needsSchoolPicker && (
            <Row label="Trường">
              <SearchableSelect
                value={pickedSchoolId}
                onChange={(value) => {
                  setPickedSchoolId(value);
                  setError("");
                }}
                options={schools || []}
                placeholder="— Chọn trường —"
                searchPlaceholder="Tìm trường…"
                portal
              />
            </Row>
          )}

          {(!needsSchoolPicker || effectiveSchoolId > 0) && (
            <>
          {/* Môn học chọn từ danh mục do sales admin quản lý — không gõ tay */}
          <Row label="Môn học">
            {emptyCatalog ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Chưa có môn học nào trong danh mục. Liên hệ sales admin để thêm.
              </p>
            ) : editing ? (
              <SearchableSelect
                value={form.catalogId}
                onChange={(v) => {
                  change("catalogId", v);
                  setError("");
                }}
                options={catalogOptions}
                placeholder={isLegacySubject ? "— Chọn môn mới —" : "— Chọn môn học —"}
                searchPlaceholder="Tìm môn học…"
                disabled={loadingCatalogs}
                portal
              />
            ) : (
              <MultiSelect
                values={selectedCatalogIds}
                onChange={(next) => {
                  setSelectedCatalogIds(next);
                  setError("");
                }}
                options={catalogOptions}
                placeholder="— Chọn môn học —"
                searchPlaceholder="Tìm môn học…"
                loading={loadingCatalogs}
                portal
              />
            )}
          </Row>

          {!editing && (
            <Row label="Năm học">
              <div className="flex flex-wrap gap-2">
                {yearOptions.map((year) => {
                  const active = selectedYears.includes(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => toggleYear(year)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        active
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </Row>
          )}

          {isLegacySubject && (
            <p className="text-xs text-amber-700 md:ml-36 leading-relaxed">
              Môn hiện tại: <b>{subject!.name}</b> — môn này không còn trong danh
              mục. Để nguyên thì môn giữ như cũ, muốn đổi thì chọn môn mới ở trên.
            </p>
          )}

          <NumberRow
            label="Số học sinh"
            value={form.studentCount}
            onChange={(v) => change("studentCount", v)}
          />
          <NumberRow
            label="Số lớp"
            value={form.classCount}
            onChange={(v) => change("classCount", v)}
          />
          <NumberRow
            label="Tổng số tiết"
            value={form.totalLessons}
            onChange={(v) => change("totalLessons", v)}
          />
          <NumberRow
            label="Thời hạn HĐ (tháng)"
            value={form.contractDuration}
            onChange={(v) => change("contractDuration", v)}
          />
          <NumberRow
            label="Thời hạn PL (tháng)"
            value={form.appendixDuration}
            onChange={(v) => change("appendixDuration", v)}
          />

          {showRateField && (
            <Row label="Đơn giá/tiết">
              <input
                type="text"
                inputMode="decimal"
                value={formatRateInput(form.ratePerPeriod)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  if (/^\d*(?:\.\d{0,2})?$/.test(raw)) {
                    change("ratePerPeriod", raw);
                  }
                }}
                placeholder="Chưa khai giá"
                className={fieldClass}
              />
            </Row>
          )}

          <Row label="Ngày khai giảng">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => change("startDate", e.target.value)}
              className={fieldClass}
            />
          </Row>

          <Row label="Số hợp đồng">
            <input
              value={form.contractNumber}
              onChange={(e) => change("contractNumber", e.target.value)}
              placeholder="Không bắt buộc"
              className={fieldClass}
            />
          </Row>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                saving ||
                (!editing &&
                  (emptyCatalog ||
                    !effectiveSchoolId ||
                    selectedCatalogIds.length === 0 ||
                    selectedYears.length === 0))
              }
              className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {saving
                ? "Đang lưu…"
                : editing
                ? "Cập nhật"
                : needsSchoolPicker && !effectiveSchoolId
                ? "Chọn trường trước"
                : selectedCatalogIds.length > 1 || selectedYears.length > 1
                ? `Lưu ${selectedCatalogIds.length * selectedYears.length} môn học`
                : "Lưu môn học"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldClass =
  "flex-1 min-w-0 px-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-600 outline-none text-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-400 bg-white dark:bg-gray-800 text-black dark:text-white";

/** Hiển thị 100000 thành 100,000 nhưng vẫn giữ phần thập phân đang nhập. */
function formatRateInput(value: string) {
  if (!value) return "";

  const [integerPart, decimalPart] = value.split(".");
  const formattedInteger = (integerPart || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

  return value.includes(".")
    ? `${formattedInteger}.${decimalPart ?? ""}`
    : formattedInteger;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
      <label className="md:w-36 md:shrink-0 text-sm font-medium text-gray-600 dark:text-gray-300">
        {label}
      </label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Row label={label}>
      <input
        type="number"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className={fieldClass}
      />
    </Row>
  );
}
