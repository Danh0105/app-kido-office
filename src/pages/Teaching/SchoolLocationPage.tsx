import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { MapPin, Search } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { schoolApi } from "@/service/school.api";
import { provinceApi } from "@/service/province";
import SearchableSelect from "@/components/SearchableSelect";
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

import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import Modal, { Field, inputClass } from "./components/Modal";
import {
  EmptyState,
  FilterCard,
  Loading,
  Pagination,
} from "./components/Shared";
import { canManageTeaching } from "./lib";
import {
  BINH_DUONG_REGION_ID,
  BINH_DUONG_WARD_IDS,
  VUNG_TAU_REGION_ID,
  VUNG_TAU_WARD_IDS,
  type RefOption,
} from "./hooks/useTeachingRefData";

/** Bán kính hợp lệ (m) — quá nhỏ thì sai số GPS làm hỏng, quá lớn thì mất ý nghĩa. */
const MIN_RADIUS = 20;
const MAX_RADIUS = 2000;

/** Số trường mỗi trang. Lọc/tìm kiếm chạy ở client nên phân trang cũng ở client. */
const PAGE_SIZE = 20;

type School = {
  id: number;
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  checkinRadius?: number | null;
  /** Link chia sẻ Google Maps đã lưu — nguồn gốc của toạ độ. */
  googleMapsUrl?: string | null;
  provinceId?: number;
  isVungTau?: boolean;
  isBinhDuong?: boolean;
  [key: string]: any;
};

/** Mã tỉnh Hồ Chí Minh — dùng để loại các trường Vũng Tàu/Bình Dương cũ ra khỏi
 * danh sách khi lọc theo TP.HCM (đã gộp vào TP.HCM nhưng vẫn thuộc khu vực cũ riêng). */
const HO_CHI_MINH_PROVINCE_ID = 6;

const schoolLatLng = (school?: School | null): LatLng | null =>
  toLatLng(school);

/**
 * Vị trí trường — nơi phòng Nhân sự gắn toạ độ cho từng trường.
 * Toạ độ này là căn cứ để kiểm tra check-in của giáo viên tại buổi dạy.
 */
export default function SchoolLocationPage() {
  const canManage = canManageTeaching();

  const [schools, setSchools] = useState<School[]>([]);
  const [provinces, setProvinces] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [regionId, setRegionId] = useState("");
  const [page, setPage] = useState(1);

  const [target, setTarget] = useState<School | null>(null);

  // `?schoolId=` (vd. từ báo cáo "Cần bổ sung" ở tab Quãng đường) → mở sẵn
  // form đặt vị trí của đúng trường đó, chỉ một lần sau khi tải xong.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusSchoolId = Number(searchParams.get("schoolId")) || null;
  useEffect(() => {
    if (!focusSchoolId || !canManage || schools.length === 0) return;
    const school = schools.find((item) => item.id === focusSchoolId);
    if (school) setTarget(school);
    setSearchParams({}, { replace: true });
  }, [focusSchoolId, canManage, schools, setSearchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await schoolApi.getAll({ page: 1, limit: 1000 });
      const list = Array.isArray(res) ? res : res?.data || [];
      setSchools(
        list.map((school: any) => {
          const wardId = Number(school.ward?.id ?? school.wardId ?? 0);
          return {
            ...school,
            provinceId:
              Number(
                school.ward?.province_id ??
                  school.ward?.provinceId ??
                  school.provinceId ??
                  0,
              ) || undefined,
            isVungTau: VUNG_TAU_WARD_IDS.has(wardId),
            isBinhDuong: BINH_DUONG_WARD_IDS.has(wardId),
          };
        }),
      );
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không tải được danh sách trường"));
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    provinceApi
      .getAll()
      .then((res: any) => setProvinces(Array.isArray(res) ? res : res?.data || []))
      .catch(() => setProvinces([]));
  }, []);

  /** Khu vực trước sát nhập: Vũng Tàu/Bình Dương là khu vực riêng dù đã gộp
   * hành chính vào tỉnh khác — chọn tỉnh gộp (TP.HCM) thì loại các trường này ra. */
  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return schools.filter((school) => {
      if (onlyMissing && schoolLatLng(school)) return false;
      if (regionId === VUNG_TAU_REGION_ID && !school.isVungTau) return false;
      if (regionId === BINH_DUONG_REGION_ID && !school.isBinhDuong) return false;
      if (
        regionId &&
        regionId !== VUNG_TAU_REGION_ID &&
        regionId !== BINH_DUONG_REGION_ID
      ) {
        if (String(school.provinceId) !== regionId) return false;
        if (
          Number(regionId) === HO_CHI_MINH_PROVINCE_ID &&
          (school.isVungTau || school.isBinhDuong)
        )
          return false;
      }
      if (!keyword) return true;
      return `${school.name} ${school.address || ""}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [schools, search, onlyMissing, regionId]);

  const missingCount = schools.filter((s) => !schoolLatLng(s)).length;

  // Đổi bộ lọc → về trang 1, tránh đứng ở trang không còn tồn tại.
  useEffect(() => {
    setPage(1);
  }, [search, onlyMissing, regionId]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(from, from + PAGE_SIZE);

  const goToPage = (next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <TeachingLayout title="Vị trí trường">
      <TeachingTabs />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          Toạ độ ở đây là căn cứ kiểm tra check-in của giáo viên. Trường chưa
          gắn toạ độ thì buổi dạy vẫn check-in được nhưng hệ thống không kiểm
          tra khoảng cách.
        </p>
      </div>

      <FilterCard>
        <div className="flex items-center gap-2 border rounded-lg px-2 md:col-span-3">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên trường hoặc địa chỉ"
            className="flex-1 min-w-0 py-2 text-sm outline-none"
          />
        </div>

        {/* Khu vực trước sát nhập: Vũng Tàu/Bình Dương tách riêng khỏi tỉnh
            hành chính hiện tại vì đã gộp vào tỉnh khác. */}
        <SearchableSelect
          value={regionId}
          onChange={setRegionId}
          options={[
            { id: VUNG_TAU_REGION_ID, name: "Vũng Tàu (trước sát nhập)" },
            { id: BINH_DUONG_REGION_ID, name: "Bình Dương (trước sát nhập)" },
            ...provinces,
          ]}
          placeholder="Tất cả khu vực"
          searchPlaceholder="Tìm khu vực…"
          className="md:col-span-2"
        />

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Chỉ trường chưa gắn vị trí
          {missingCount > 0 && (
            <span className="text-xs text-amber-600">({missingCount})</span>
          )}
        </label>
      </FilterCard>

      {loading && <Loading />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon="🏫"
          title={
            onlyMissing
              ? "Tất cả trường đều đã gắn vị trí"
              : "Không tìm thấy trường nào"
          }
          description={
            onlyMissing ? undefined : "Thử đổi từ khoá tìm kiếm."
          }
        />
      )}

      {!loading && rows.length > 0 && (
        <p className="text-xs text-gray-400 px-1">
          Hiển thị {from + 1}–{from + pageRows.length} / {rows.length} trường
        </p>
      )}

      {/* Desktop: thẻ trường xếp 2–3 cột cho đỡ phải cuộn dài. */}
      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
        {!loading &&
          pageRows.map((school) => {
            const point = schoolLatLng(school);

            return (
              <div
                key={school.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2 flex flex-col"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {school.name}
                  </p>
                  {school.address && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {school.address}
                    </p>
                  )}
                </div>

                {point ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {/* "Đã đặt vị trí" chỉ dành cho trường gắn bằng link Google Maps. */}
                    {school.googleMapsUrl ? (
                      <span className="px-2 py-[2px] rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        Đã đặt vị trí
                      </span>
                    ) : (
                      <span className="px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium">
                        Chưa có link Maps
                      </span>
                    )}
                    <span className="text-gray-500">
                      Bán kính {school.checkinRadius || DEFAULT_CHECKIN_RADIUS} m
                    </span>
                    <a
                      href={mapsLinkOf(school.googleMapsUrl, point)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 underline"
                    >
                      Xem trên Google Maps
                    </a>
                  </div>
                ) : (
                  <span className="inline-block text-xs px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium">
                    Chưa đặt vị trí
                  </span>
                )}

                {canManage && (
                  <button
                    onClick={() => setTarget(school)}
                    className="mt-auto w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium active:scale-95"
                  >
                    <MapPin size={15} />
                    {point ? "Sửa vị trí" : "Đặt vị trí"}
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {!loading && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onChange={goToPage}
        />
      )}

      {target && (
        <SchoolLocationModal
          school={target}
          onClose={() => setTarget(null)}
          onSaved={load}
        />
      )}
    </TeachingLayout>
  );
}

/** Form gắn toạ độ + bán kính cho 1 trường. */
function SchoolLocationModal({
  school,
  onClose,
  onSaved,
}: {
  school: School;
  onClose: () => void;
  onSaved: () => void;
}) {
  const point = schoolLatLng(school);

  const [latitude, setLatitude] = useState(
    point ? formatCoord(point.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    point ? formatCoord(point.longitude) : "",
  );
  const [radius, setRadius] = useState(
    String(school.checkinRadius || DEFAULT_CHECKIN_RADIUS),
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mapsLink, setMapsLink] = useState(school.googleMapsUrl || "");
  const [resolving, setResolving] = useState(false);

  const current = schoolLatLng({ ...school, latitude, longitude });

  const applyPoint = (point: LatLng) => {
    setLatitude(formatCoord(point.latitude));
    setLongitude(formatCoord(point.longitude));
    setAccuracy(null);
    setErrors({});
  };

  /**
   * Lấy toạ độ từ link "Chia sẻ" của Google Maps.
   * Link đầy đủ đã chứa toạ độ → đọc tại chỗ; link rút gọn phải nhờ backend
   * đi theo redirect (trình duyệt bị CORS chặn).
   */
  const resolveMapsLink = async (rawLink?: string) => {
    const link = (rawLink ?? mapsLink).trim();
    if (!link) return;

    // Là URL nhưng không thuộc host Google Maps → chặn ngay, khỏi gọi backend.
    if (/^https?:\/\//i.test(link) && !isGoogleMapsUrl(link)) {
      setErrors({ mapsLink: "Chỉ hỗ trợ link chia sẻ Google Maps" });
      return;
    }

    // Link đầy đủ / cặp toạ độ đọc được ngay tại máy.
    const local = parseLatLng(link);
    if (local) {
      applyPoint(local);
      setMapsLink(link);
      return;
    }

    if (!isGoogleMapsUrl(link)) {
      setErrors({ mapsLink: "Link Google Maps không hợp lệ" });
      return;
    }

    setResolving(true);
    try {
      const resolved = await schoolApi.resolveGoogleMaps(link);
      const point = parseLatLng(`${resolved.latitude}, ${resolved.longitude}`);
      if (!point) throw new Error("Toạ độ trả về không hợp lệ");
      applyPoint(point);
      setMapsLink(link);
    } catch (error: any) {
      setErrors({
        mapsLink: getApiErrorMessage(
          error,
          "Không đọc được vị trí từ link Google Maps",
        ),
      });
    } finally {
      setResolving(false);
    }
  };

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      setLatitude(formatCoord(position.latitude));
      setLongitude(formatCoord(position.longitude));
      setAccuracy(position.accuracy);
      // Toạ độ mới không còn khớp link cũ nữa.
      setMapsLink("");
      setErrors({});
    } catch (error: any) {
      toast.error(error?.message || "Không lấy được vị trí hiện tại");
    } finally {
      setLocating(false);
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};

    if (!current) {
      next.point = "Chưa đặt vị trí — dán link Google Maps hoặc lấy vị trí hiện tại";
    }

    const radiusValue = Number(radius);
    if (
      !Number.isInteger(radiusValue) ||
      radiusValue < MIN_RADIUS ||
      radiusValue > MAX_RADIUS
    ) {
      next.radius = `Bán kính phải từ ${MIN_RADIUS} đến ${MAX_RADIUS} m`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // PUT /schools/:id ghi đè cả bản ghi → gửi kèm dữ liệu cũ, chỉ thay phần vị trí.
  const save = async (payload: Record<string, any>) => {
    setSaving(true);
    try {
      const { id, ...rest } = school;
      await schoolApi.update(id, { ...rest, ...payload });
      toast.success("Đã lưu vị trí trường");
      onSaved();
      onClose();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Lưu vị trí thất bại"));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (!validate() || !current) return;
    save({
      latitude: current.latitude,
      longitude: current.longitude,
      checkinRadius: Number(radius),
      googleMapsUrl: mapsLink.trim() || null,
    });
  };

  return (
    <Modal
      title={school.name}
      submitLabel="Lưu vị trí"
      loading={saving}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium active:scale-95 disabled:opacity-50"
      >
        <MapPin size={15} />
        {locating ? "Đang lấy vị trí…" : "Lấy vị trí hiện tại"}
      </button>

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Đứng tại cổng trường rồi bấm nút trên. Không tới tận nơi được thì mở
        Google Maps, tìm trường, bấm <b>Chia sẻ → Sao chép liên kết</b> rồi dán
        vào ô dưới đây.
      </p>

      <Field
        label="Link Google Maps"
        error={errors.mapsLink}
        hint="Nhận link rút gọn maps.app.goo.gl, link đầy đủ, hoặc cặp toạ độ “10.762622, 106.660172”."
      >
        <div className="flex gap-2">
          <input
            value={mapsLink}
            onChange={(e) => setMapsLink(e.target.value)}
            onPaste={(e) =>
              // Dán xong lấy toạ độ luôn, khỏi bấm thêm nút.
              resolveMapsLink(e.clipboardData.getData("text"))
            }
            placeholder="https://maps.app.goo.gl/..."
            className={`${inputClass} flex-1 min-w-0`}
          />
          <button
            type="button"
            onClick={() => resolveMapsLink()}
            disabled={resolving || !mapsLink.trim()}
            className="px-3 rounded-lg bg-blue-50 text-blue-600 text-sm font-medium whitespace-nowrap active:scale-95 disabled:opacity-50"
          >
            {resolving ? "Đang đọc…" : "Lấy toạ độ"}
          </button>
        </div>
      </Field>

      {/* Toạ độ chỉ đến từ GPS hoặc link Maps — không cho gõ tay cho khỏi sai. */}
      <div
        className={`rounded-xl border px-3 py-2 ${
          current
            ? "border-emerald-100 bg-emerald-50/60"
            : errors.point
            ? "border-red-200 bg-red-50/60"
            : "border-gray-100 bg-gray-50"
        }`}
      >
        <p className="text-[11px] text-gray-500">Vị trí</p>

        {current ? (
          <>
            <p className="text-sm font-semibold text-emerald-700">
              Đã đặt vị trí
            </p>
            <a
              href={mapsLinkOf(mapsLink, current)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-500 underline"
            >
              Mở điểm đã chọn trên Google Maps để kiểm tra
            </a>
          </>
        ) : (
          <p className="text-sm text-gray-400">
            Chưa đặt — dán link Google Maps hoặc lấy vị trí hiện tại ở trên.
          </p>
        )}

        {errors.point && (
          <p className="text-xs text-red-500 mt-1">{errors.point}</p>
        )}
      </div>

      {/* Bán kính chỉ có nghĩa khi đã có toạ độ. */}
      {current && (
        <Field
          label="Bán kính cho phép (m)"
          required
          error={errors.radius}
          hint={`Giáo viên đứng ngoài bán kính vẫn check-in được nhưng bị đánh dấu để xem lại (${MIN_RADIUS}–${MAX_RADIUS} m, mặc định ${DEFAULT_CHECKIN_RADIUS}).`}
        >
          <input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            inputMode="numeric"
            placeholder={String(DEFAULT_CHECKIN_RADIUS)}
            className={inputClass}
          />
        </Field>
      )}

      {accuracy !== null && (
        <p className="text-xs text-gray-500">
          Sai số GPS lúc lấy: ~{accuracy} m
          {accuracy > 50 ? " — nên ra chỗ thoáng lấy lại cho chuẩn." : ""}
        </p>
      )}

      {current && (
        <a
          href={mapsLinkOf(mapsLink, current)}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-blue-500 underline"
        >
          Xem điểm đã chọn trên bản đồ
        </a>
      )}

      {point && (
        <button
          type="button"
          onClick={() =>
            save({
              latitude: null,
              longitude: null,
              checkinRadius: null,
              googleMapsUrl: null,
            })
          }
          disabled={saving}
          className="w-full py-2 rounded-xl border border-red-100 text-red-400 text-sm font-medium active:scale-95 disabled:opacity-50"
        >
          Xoá vị trí của trường này
        </button>
      )}
    </Modal>
  );
}
