import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { MapPin, Plus, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import {
  schoolApi,
  schoolLocationApi,
  type SchoolLocation,
} from "@/service/school.api";
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
  type RawLatLng,
} from "@/utils/geo";

import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import Modal, { Field, inputClass } from "./components/Modal";
import { EmptyState, FilterCard, Loading } from "./components/Shared";
import { useTeachingRefData } from "./hooks/useTeachingRefData";
import { canManageTeaching } from "./lib";

/** Bán kính hợp lệ (m) — cùng ngưỡng với màn "Vị trí trường". */
const MIN_RADIUS = 20;
const MAX_RADIUS = 2000;

const locationLatLng = (item?: RawLatLng | null): LatLng | null =>
  toLatLng(item);

/**
 * Điểm trường — các cơ sở của một trường có nhiều địa điểm.
 *
 * Lớp học và lịch dạy gắn xuống điểm trường thì check-in đo theo toạ độ của
 * chính điểm đó. Điểm trường chưa khai toạ độ vẫn dùng được: hệ thống lùi về
 * toạ độ của trường mẹ, không chặn giáo viên check-in.
 */
export default function SchoolBranchPage() {
  const canManage = canManageTeaching();
  const { schools, loading: loadingSchools } = useTeachingRefData();

  // `?schoolId=&locationId=` (từ báo cáo "Cần bổ sung" ở tab Quãng đường) →
  // chọn sẵn trường và mở form sửa đúng điểm trường đang thiếu toạ độ.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusLocationId = Number(searchParams.get("locationId")) || null;

  const [schoolId, setSchoolId] = useState(searchParams.get("schoolId") || "");
  const [locations, setLocations] = useState<SchoolLocation[]>([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<SchoolLocation | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!focusLocationId || !canManage || locations.length === 0) return;
    const location = locations.find((item) => item.id === focusLocationId);
    if (location) setEditing(location);
    setSearchParams({}, { replace: true });
  }, [focusLocationId, canManage, locations, setSearchParams]);

  const load = async (id = schoolId) => {
    if (!id) {
      setLocations([]);
      return;
    }
    setLoading(true);
    try {
      setLocations(await schoolLocationApi.getBySchool(Number(id)));
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, "Không tải được danh sách điểm trường"));
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(schoolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const school = schools.find((s) => String(s.id) === schoolId);

  const remove = async (item: SchoolLocation) => {
    if (
      !window.confirm(
        `Xoá điểm trường "${item.name}"?\n\nLớp và lịch dạy đang gắn điểm này sẽ quay về mức trường, không bị xoá theo.`,
      )
    ) {
      return;
    }
    try {
      await schoolLocationApi.delete(item.id);
      toast.success("Đã xoá điểm trường");
      load();
    } catch (error: any) {
      if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Xoá điểm trường thất bại"));
      }
    }
  };

  return (
    <TeachingLayout title="Điểm trường">
      <TeachingTabs />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          Trường có nhiều cơ sở thì khai từng điểm trường ở đây, rồi gắn lớp học
          vào đúng điểm. Check-in của giáo viên sẽ đo theo toạ độ điểm trường;
          điểm chưa khai toạ độ thì lùi về toạ độ của trường.
        </p>
      </div>

      <FilterCard>
        <div className="md:col-span-3">
          <SearchableSelect
            value={schoolId}
            onChange={setSchoolId}
            options={schools}
            placeholder={
              loadingSchools ? "Đang tải trường…" : "— Chọn trường —"
            }
            searchPlaceholder="Tìm trường…"
          />
        </div>

        {canManage && schoolId && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium active:scale-95"
          >
            <Plus size={15} />
            Thêm điểm trường
          </button>
        )}
      </FilterCard>

      {!schoolId && (
        <EmptyState
          icon="🏫"
          title="Chọn một trường"
          description="Chọn trường ở trên để xem và khai các điểm trường của trường đó."
        />
      )}

      {schoolId && loading && <Loading />}

      {schoolId && !loading && locations.length === 0 && (
        <EmptyState
          icon="📍"
          title="Trường này chưa có điểm trường nào"
          description={
            canManage
              ? "Trường chỉ có một cơ sở thì không cần khai điểm trường — mọi thứ vẫn chạy như cũ."
              : undefined
          }
        />
      )}

      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3">
        {schoolId &&
          !loading &&
          locations.map((item) => {
            const point = locationLatLng(item);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2 flex flex-col"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.name}
                  </p>
                  {item.address && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.address}
                    </p>
                  )}
                </div>

                {point ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="px-2 py-[2px] rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      Đã đặt vị trí
                    </span>
                    <span className="text-gray-500">
                      Bán kính {item.checkinRadius || DEFAULT_CHECKIN_RADIUS} m
                    </span>
                    <a
                      href={mapsLinkOf(item.googleMapsUrl, point)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-500 underline"
                    >
                      Xem trên Google Maps
                    </a>
                  </div>
                ) : (
                  <span className="inline-block text-xs px-2 py-[2px] rounded-full bg-amber-100 text-amber-700 font-medium">
                    Chưa đặt vị trí — dùng toạ độ của trường
                  </span>
                )}

                {canManage && (
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={() => setEditing(item)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium active:scale-95"
                    >
                      <MapPin size={15} />
                      Sửa
                    </button>
                    <button
                      onClick={() => remove(item)}
                      className="px-3 py-2 rounded-xl border border-red-100 text-red-400 active:scale-95"
                      aria-label={`Xoá ${item.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {(creating || editing) && (
        <SchoolBranchFormModal
          schoolId={Number(schoolId)}
          schoolName={school?.name || ""}
          location={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}
    </TeachingLayout>
  );
}

/** Form khai tên + địa chỉ + toạ độ của một điểm trường. */
function SchoolBranchFormModal({
  schoolId,
  schoolName,
  location,
  onClose,
  onSaved,
}: {
  schoolId: number;
  schoolName: string;
  location?: SchoolLocation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!location;
  const point = locationLatLng(location);

  const [name, setName] = useState(location?.name || "");
  const [address, setAddress] = useState(location?.address || "");
  const [latitude, setLatitude] = useState(
    point ? formatCoord(point.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    point ? formatCoord(point.longitude) : "",
  );
  const [radius, setRadius] = useState(
    String(location?.checkinRadius || DEFAULT_CHECKIN_RADIUS),
  );
  const [mapsLink, setMapsLink] = useState(location?.googleMapsUrl || "");

  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = locationLatLng({ latitude, longitude });

  const applyPoint = (value: LatLng) => {
    setLatitude(formatCoord(value.latitude));
    setLongitude(formatCoord(value.longitude));
    setAccuracy(null);
    setErrors((prev) => ({ ...prev, mapsLink: "", point: "" }));
  };

  /**
   * Giải toạ độ từ link Google Maps. Dùng chung endpoint của trường
   * (`/schools/resolve-google-maps`) — việc đọc link không phụ thuộc trường hay
   * điểm trường nên không cần endpoint riêng.
   */
  const resolveMapsLink = async (rawLink?: string) => {
    const link = (rawLink ?? mapsLink).trim();
    if (!link) return;

    if (/^https?:\/\//i.test(link) && !isGoogleMapsUrl(link)) {
      setErrors((prev) => ({
        ...prev,
        mapsLink: "Chỉ hỗ trợ link chia sẻ Google Maps",
      }));
      return;
    }

    const local = parseLatLng(link);
    if (local) {
      applyPoint(local);
      setMapsLink(link);
      return;
    }

    if (!isGoogleMapsUrl(link)) {
      setErrors((prev) => ({ ...prev, mapsLink: "Link Google Maps không hợp lệ" }));
      return;
    }

    setResolving(true);
    try {
      const resolved = await schoolApi.resolveGoogleMaps(link);
      const value = parseLatLng(`${resolved.latitude}, ${resolved.longitude}`);
      if (!value) throw new Error("Toạ độ trả về không hợp lệ");
      applyPoint(value);
      setMapsLink(link);
    } catch (error: any) {
      setErrors((prev) => ({
        ...prev,
        mapsLink: getApiErrorMessage(
          error,
          "Không đọc được vị trí từ link Google Maps",
        ),
      }));
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

    if (!name.trim()) next.name = "Vui lòng nhập tên điểm trường";

    // Toạ độ không bắt buộc: điểm chưa khai vị trí thì lùi về toạ độ trường.
    // Nhưng đã có toạ độ thì bán kính phải hợp lệ.
    if (current) {
      const radiusValue = Number(radius);
      if (
        !Number.isInteger(radiusValue) ||
        radiusValue < MIN_RADIUS ||
        radiusValue > MAX_RADIUS
      ) {
        next.radius = `Bán kính phải từ ${MIN_RADIUS} đến ${MAX_RADIUS} m`;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        address: address.trim() || null,
        latitude: current ? current.latitude : null,
        longitude: current ? current.longitude : null,
        checkinRadius: current ? Number(radius) : null,
        googleMapsUrl: mapsLink.trim() || null,
      };

      if (editing) {
        await schoolLocationApi.update(location!.id, body);
        toast.success("Đã cập nhật điểm trường");
      } else {
        await schoolLocationApi.create({ ...body, schoolId });
        toast.success("Đã thêm điểm trường");
      }

      onSaved();
      onClose();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status === 400) {
        // Hay gặp nhất: trùng tên điểm trường trong cùng một trường.
        setErrors({ name: getApiErrorMessage(error, "Tên điểm trường đã tồn tại") });
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Lưu điểm trường thất bại"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? `Sửa ${location!.name}` : "Thêm điểm trường"}
      submitLabel={editing ? "Lưu" : "Thêm"}
      loading={saving}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Trường">
        <div className="px-3 py-2 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-600">
          {schoolName || `#${schoolId}`}
        </div>
      </Field>

      <Field
        label="Tên điểm trường"
        required
        error={errors.name}
        hint="Tên gọi để phân biệt các cơ sở, ví dụ “Cơ sở 1”, “Điểm lẻ Thôn Đông”."
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
          placeholder="Cơ sở 1"
          className={inputClass}
        />
      </Field>

      <Field label="Địa chỉ">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={500}
          placeholder="Không bắt buộc"
          className={inputClass}
        />
      </Field>

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
        Đứng tại cổng cơ sở rồi bấm nút trên. Không tới tận nơi được thì mở
        Google Maps, tìm cơ sở, bấm <b>Chia sẻ → Sao chép liên kết</b> rồi dán
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
            onPaste={(e) => resolveMapsLink(e.clipboardData.getData("text"))}
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

      <div
        className={`rounded-xl border px-3 py-2 ${
          current
            ? "border-emerald-100 bg-emerald-50/60"
            : "border-gray-100 bg-gray-50"
        }`}
      >
        <p className="text-[11px] text-gray-500">Vị trí điểm trường</p>

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
            Chưa đặt — check-in sẽ đo theo toạ độ của trường.
          </p>
        )}
      </div>

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
        <button
          type="button"
          onClick={() => {
            setLatitude("");
            setLongitude("");
            setMapsLink("");
            setAccuracy(null);
          }}
          className="w-full py-2 rounded-xl border border-red-100 text-red-400 text-sm font-medium active:scale-95"
        >
          Bỏ vị trí riêng — dùng toạ độ của trường
        </button>
      )}
    </Modal>
  );
}
