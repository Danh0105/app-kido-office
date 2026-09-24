import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { getApiErrorMessage } from "@/utils/apiError";
import { subjectApi } from "@/service/subject.api";
import { subjectCatalogApi, type SubjectCatalog } from "@/service/subjectCatalog.api";
import SearchableSelect from "@/components/SearchableSelect";

import Modal from "./Modal";
import { selectClass } from "./Shared";
import {
  fallbackSchoolYears,
  formatMoney,
  isValidRate,
  MAX_RATE_PER_PERIOD,
  parseRate,
} from "../lib";

type SchoolSubjectRow = {
  subjectId: number;
  schoolId: number;
  schoolName: string;
  ratePerPeriod: number | null;
};

type Props = {
  onClose: () => void;
  onApplied: () => void;
};

/**
 * Nhân sự thoả cùng một đơn giá cho nhiều trường dạy cùng một môn — chọn môn,
 * xem danh sách trường đang dạy môn đó, tick những trường muốn áp rồi lưu một
 * lần thay vì sửa từng trường qua `SubjectFormModal`.
 */
export default function BulkSubjectRateModal({ onClose, onApplied }: Props) {
  const [catalogs, setCatalogs] = useState<SubjectCatalog[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [schoolYear, setSchoolYear] = useState("");

  const [rows, setRows] = useState<SchoolSubjectRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [rate, setRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    subjectCatalogApi.list().then(setCatalogs).catch(() => setCatalogs([]));
  }, []);

  useEffect(() => {
    if (!catalogId) {
      setRows([]);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    setLoadingRows(true);
    subjectApi
      .getBySubject({ catalogId: Number(catalogId), schoolYear: schoolYear || undefined })
      .then((schools: any[]) => {
        if (cancelled) return;
        const next: SchoolSubjectRow[] = (schools || []).flatMap((school) =>
          (school.subjects || []).map((s: any) => ({
            subjectId: s.id,
            schoolId: school.id,
            schoolName: school.name,
            ratePerPeriod: s.ratePerPeriod ?? null,
          })),
        );
        setRows(next);
        setSelected(new Set(next.map((r) => r.subjectId)));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogId, schoolYear]);

  const toggle = (subjectId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.subjectId)),
    );
  };

  const canSubmit =
    selected.size > 0 && rate.trim() !== "" && isValidRate(rate) && parseRate(rate) !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await subjectApi.bulkUpdateRate({
        subjectIds: Array.from(selected),
        ratePerPeriod: parseRate(rate) as number,
      });
      toast.success(`Đã áp giá cho ${selected.size} trường`);
      onApplied();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Áp giá thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Áp đơn giá cho nhiều trường"
      wide
      submitLabel="Áp dụng"
      loading={submitting}
      disabled={!canSubmit}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="space-y-1">
        <label className="text-xs text-gray-500">Môn học</label>
        <SearchableSelect
          value={catalogId}
          onChange={setCatalogId}
          options={catalogs}
          placeholder="— Chọn môn —"
          searchPlaceholder="Tìm môn…"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Năm học</label>
        <select
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          className={`${selectClass} w-full`}
        >
          <option value="">— Mọi năm học —</option>
          {fallbackSchoolYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {catalogId && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500">
              Trường đang dạy môn này ({rows.length})
            </label>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-blue-600 font-medium"
              >
                {selected.size === rows.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-gray-100">
            {loadingRows ? (
              <div className="p-3 text-sm text-gray-400 text-center">Đang tải…</div>
            ) : rows.length === 0 ? (
              <div className="p-3 text-sm text-gray-400 text-center">
                Chưa trường nào dạy môn này
              </div>
            ) : (
              rows.map((row) => (
                <label
                  key={row.subjectId}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selected.has(row.subjectId)}
                      onChange={() => toggle(row.subjectId)}
                    />
                    <span className="truncate">{row.schoolName}</span>
                  </span>
                  <span className="text-gray-400 whitespace-nowrap">
                    {formatMoney(row.ratePerPeriod)}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-gray-500">Đơn giá mới áp cho các trường đã chọn</label>
        <input
          type="number"
          min={0}
          max={MAX_RATE_PER_PERIOD}
          step={1000}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="VD: 150000"
          className={`${selectClass} w-full`}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
