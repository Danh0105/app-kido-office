import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { MapPin } from "lucide-react";

import { getApiErrorMessage } from "@/utils/apiError";
import { teacherApi } from "@/service/teaching";
import {
  subjectCatalogApi,
  type SubjectCatalog,
} from "@/service/subjectCatalog.api";
import { isPendingTeacherAccount, type Teacher } from "@/types/teaching";

import Modal, { Field, inputClass } from "./Modal";
import MultiSelect from "@/components/MultiSelect";
import SearchableSelect from "@/components/SearchableSelect";
import type { RefOption } from "../hooks/useTeachingRefData";
import {
  catalogLabel,
  DEFAULT_TEACHER_PASSWORD,
  canSetTeachingRates,
  isValidEmail,
  isValidGoogleMapsUrl,
  isValidPhone,
  isValidRate,
  isValidWeeklyQuota,
  MAX_PERIODS_PER_WEEK,
  parseRate,
  rateToInput,
  TEACHER_COLLABORATOR_ROLE,
  TEACHER_STAFF_ROLE,
} from "../lib";

type Props = {
  teacher?: Teacher | null;
  /** Danh sách khu vực để lọc xã/phường theo quan hệ cha → con. */
  provinces: RefOption[];
  /** Danh sách xã/phường đã tải sẵn ở màn cha — không gọi lại API trong modal. */
  wards: RefOption[];
  onClose: () => void;
  onSaved: () => void;
};

const MIN_PASSWORD = 6;

/** Giá trị chuẩn `150000.5` -> chuỗi nhập tiền kiểu Việt Nam `150.000,5`. */
const formatVndInput = (value: string) => {
  if (!value) return "";
  const [integer, decimal] = value.split(".");
  const formattedInteger = Number(integer || 0).toLocaleString("vi-VN");
  return decimal === undefined ? formattedInteger : `${formattedInteger},${decimal}`;
};

/** Chuỗi nhập kiểu Việt Nam -> giá trị số chuẩn để validate/gửi API. */
const parseVndInput = (value: string) => {
  const cleaned = value.replace(/\s|₫/g, "");
  const commaIndex = cleaned.indexOf(",");

  if (commaIndex < 0) return cleaned.replace(/\D/g, "");

  const integer = cleaned.slice(0, commaIndex).replace(/\D/g, "");
  const decimal = cleaned.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2);
  return `${integer || "0"}.${decimal}`;
};

export default function TeacherFormModal({
  teacher,
  provinces,
  wards,
  onClose,
  onSaved,
}: Props) {
  const editing = !!teacher;
  // Giáo viên cũ chưa gắn tài khoản → lần sửa này sẽ cấp luôn.
  const hasAccount = !!teacher?.employeeId;

  const [name, setName] = useState(teacher?.name || "");
  const [phone, setPhone] = useState(teacher?.phone || "");
  const [email, setEmail] = useState(teacher?.email || "");
  const [maxPeriods, setMaxPeriods] = useState(
    teacher?.maxPeriodsPerWeek == null ? "" : String(teacher.maxPeriodsPerWeek),
  );
  const [defaultRate, setDefaultRate] = useState(
    rateToInput(teacher?.defaultRatePerPeriod),
  );
  const [note, setNote] = useState(teacher?.note || "");
  const [isActive, setIsActive] = useState(teacher?.isActive ?? true);
  const [zaloUid, setZaloUid] = useState(teacher?.zaloUid || "");
  const [zaloUserId, setZaloUserId] = useState(teacher?.zaloUserId || "");

  // ---- Dữ liệu phục vụ gợi ý lịch dạy ----
  const [mapsUrl, setMapsUrl] = useState(teacher?.googleMapsUrl || "");
  const [wardIds, setWardIds] = useState<number[]>(teacher?.wardIds || []);
  const [provinceId, setProvinceId] = useState("");
  const [catalogIds, setCatalogIds] = useState<number[]>(
    teacher?.subjectCatalogIds || [],
  );

  const [catalogs, setCatalogs] = useState<SubjectCatalog[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  const [password, setPassword] = useState(DEFAULT_TEACHER_PASSWORD);
  const [teacherRole, setTeacherRole] = useState<
    "" | typeof TEACHER_STAFF_ROLE | typeof TEACHER_COLLABORATOR_ROLE
  >(teacher?.teacherRole || (teacher ? "" : TEACHER_STAFF_ROLE));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  /** Để focus đúng ô vị trí khi backend trả 400 vì link sai. */
  const mapsRef = useRef<HTMLInputElement>(null);

  // Danh mục môn dùng chung — KHÔNG phải môn của từng trường (`/subjects`).
  // Chỉ lấy môn đang dùng: không truyền `includeInactive`.
  useEffect(() => {
    let alive = true;

    subjectCatalogApi
      .list()
      .then((data) => {
        if (alive) setCatalogs(data);
      })
      .catch(() => {
        if (!alive) return;
        setCatalogs([]);
        toast.error("Không tải được danh mục môn học");
      })
      .finally(() => {
        if (alive) setLoadingCatalogs(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  /**
   * Môn/xã-phường đã chọn nhưng không còn trong danh sách option (môn đã
   * ngừng dùng, xã/phường ngoài trang đầu) vẫn phải hiện đúng tên — ghép thêm
   * dữ liệu `teachableSubjects` / `allowedWards` backend trả kèm hồ sơ.
   */
  const mergeOptions = (
    options: { id: number; name: string }[],
    extra: { id: number; name: string }[],
  ) => {
    const known = new Set(options.map((option) => option.id));
    return [...options, ...extra.filter((item) => !known.has(item.id))];
  };

  // Khi sửa, tự chọn khu vực nếu các xã/phường hiện tại cùng thuộc một khu vực.
  useEffect(() => {
    if (!editing || provinceId || wardIds.length === 0 || wards.length === 0) return;
    const selectedProvinceIds = Array.from(
      new Set(
        wardIds
          .map((id) => wards.find((ward) => ward.id === id)?.provinceId)
          .filter((id): id is number => !!id),
      ),
    );
    if (selectedProvinceIds.length === 1) setProvinceId(String(selectedProvinceIds[0]));
  }, [editing, provinceId, wardIds, wards]);

  const wardOptions = useMemo(() => {
    const inProvince = provinceId
      ? wards.filter((ward) => String(ward.provinceId) === provinceId)
      : [];
    return mergeOptions(inProvince, teacher?.allowedWards || []);
  }, [wards, teacher, provinceId]);

  const catalogOptions = useMemo(
    () =>
      mergeOptions(
        catalogs.map((item) => ({ id: item.id, name: catalogLabel(item) })),
        (teacher?.teachableSubjects || []).map((item) => ({
          id: item.id,
          name: catalogLabel(item),
        })),
      ),
    [catalogs, teacher],
  );

  const validate = () => {
    const next: Record<string, string> = {};
    const trimmed = name.trim();

    if (trimmed.length < 2 || trimmed.length > 150) {
      next.name = "Tên giáo viên phải từ 2 đến 150 ký tự";
    }

    // SĐT là tên đăng nhập, email dùng để liên hệ / khôi phục → bắt buộc cả hai.
    if (!phone.trim()) {
      next.phone = "Vui lòng nhập số điện thoại";
    } else if (!isValidPhone(phone)) {
      next.phone = "Số điện thoại không hợp lệ";
    }

    if (!email.trim()) {
      next.email = "Vui lòng nhập email";
    } else if (!isValidEmail(email)) {
      next.email = "Email không hợp lệ";
    }

    // Để trống = không giới hạn, nên chỉ validate khi có nhập.
    if (maxPeriods.trim() && !isValidWeeklyQuota(maxPeriods)) {
      next.maxPeriods = `Số tiết tối đa phải là số nguyên 1–${MAX_PERIODS_PER_WEEK}`;
    }

    if (canSetTeachingRates() && !isValidRate(defaultRate)) {
      next.defaultRate = "Đơn giá phải từ 0 đến 100.000.000, tối đa 2 số lẻ";
    }

    if (!isValidGoogleMapsUrl(mapsUrl)) {
      next.mapsUrl =
        "Vị trí phải là link Google Maps (google.com/maps, maps.app.goo.gl…)";
    }

    if (!teacherRole) {
      next.teacherRole = "Vui lòng chọn loại giáo viên";
    }

    if (!hasAccount && password.trim().length < MIN_PASSWORD) {
      next.password = `Mật khẩu tối thiểu ${MIN_PASSWORD} ký tự`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    // validate() đã chặn, thêm ở đây để TS biết `teacherRole` không còn rỗng.
    if (!teacherRole) return;

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        // Chưa có tài khoản thì gửi kèm mật khẩu: backend tạo tài khoản trong
        // cùng một lần gọi, và tự chuyển sang hàng chờ khi người gửi là Giáo vụ.
        // Trước đây màn này tự gọi `POST /employees` để tạo tài khoản trước —
        // đường đó đã khoá vì nó vòng qua bước Nhân sự duyệt.
        ...(hasAccount
          ? { employeeId: teacher!.employeeId }
          : { password: password.trim() }),
        teacherRole,
        isActive,
        maxPeriodsPerWeek: maxPeriods.trim() ? Number(maxPeriods) : null,
        ...(canSetTeachingRates()
          ? { defaultRatePerPeriod: parseRate(defaultRate) }
          : {}),
        // Luôn gửi cả 3 field: mảng rỗng / null là cách xoá lựa chọn đã khai.
        googleMapsUrl: mapsUrl.trim() || null,
        wardIds,
        subjectCatalogIds: catalogIds,
        note: note.trim() || null,
        // Hai ID Zalo là tùy chọn; để trống thì không yêu cầu backend cập nhật.
        ...(zaloUid.trim() ? { zaloUid: zaloUid.trim() } : {}),
        ...(zaloUserId.trim() ? { zaloUserId: zaloUserId.trim() } : {}),
      };

      const result = editing
        ? await teacherApi.update(teacher!.id, payload)
        : await teacherApi.create(payload);

      if (isPendingTeacherAccount(result)) {
        // Giáo vụ: chưa có tài khoản nào cả, đừng đọc mật khẩu cho giáo viên.
        toast.success(
          result.message ??
            "Đã gửi Nhân sự duyệt. Tài khoản chỉ được tạo sau khi Nhân sự xác nhận.",
        );
      } else if (editing) {
        toast.success("Đã cập nhật giáo viên");
      } else {
        toast.success(
          `Đã thêm giáo viên. Đăng nhập bằng SĐT ${phone.trim()} / mật khẩu ${password.trim()}`,
        );
      }

      onSaved();
      onClose();
    } catch (error: any) {
      const raw = error?.response?.data?.message;
      const lines: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

      // Lỗi về vị trí thì gắn thẳng xuống ô nhập rồi focus — bắt người dùng đọc
      // toast rồi tự dò xem field nào sai thì rất khó chịu.
      const mapsError = lines.find((line) => /vị trí|maps/i.test(line));
      if (mapsError) {
        setErrors((prev) => ({ ...prev, mapsUrl: mapsError }));
        mapsRef.current?.focus();
      }

      // "Xã/phường không tồn tại: 999" / "Môn học trong danh mục không tồn tại: 99"
      const wardError = lines.find((line) => /^Xã\/phường không tồn tại/i.test(line));
      if (wardError) setErrors((prev) => ({ ...prev, wardIds: wardError }));

      const catalogError = lines.find((line) =>
        /^Môn học trong danh mục không tồn tại/i.test(line),
      );
      if (catalogError) {
        setErrors((prev) => ({ ...prev, catalogIds: catalogError }));
      }

      const zaloUidError = lines.find((line) => /^Zalo UID/i.test(line));
      if (zaloUidError) setErrors((prev) => ({ ...prev, zaloUid: zaloUidError }));

      const zaloUserIdError = lines.find((line) => /^Zalo User ID/i.test(line));
      if (zaloUserIdError) {
        setErrors((prev) => ({ ...prev, zaloUserId: zaloUserIdError }));
      }

      if (Array.isArray(raw)) {
        raw.forEach((line: string) => toast.error(line));
      } else if (error?.response?.status !== 403) {
        toast.error(getApiErrorMessage(error, "Lưu giáo viên thất bại"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editing ? "Sửa giáo viên" : "Thêm giáo viên"}
      submitLabel={editing ? "Lưu" : "Thêm"}
      loading={loading}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <Field label="Tên giáo viên" required error={errors.name}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
          placeholder="Nguyễn Văn A"
          className={inputClass}
        />
      </Field>

      <Field
        label="Số điện thoại"
        required
        error={errors.phone}
        hint="Đây cũng là tên đăng nhập của giáo viên."
      >
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="0912345678"
          className={inputClass}
        />
      </Field>

      <Field label="Email" required error={errors.email}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          placeholder="giaovien@kidoedu.vn"
          className={inputClass}
        />
      </Field>

      {hasAccount ? (
        <Field label="Tài khoản đăng nhập">
          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            {teacher?.employeeName || `#${teacher?.employeeId}`} — đăng nhập bằng
            SĐT
          </p>
        </Field>
      ) : (
        <>
          <Field
            label="Mật khẩu"
            required
            error={errors.password}
            hint={`Mặc định ${DEFAULT_TEACHER_PASSWORD} — đăng nhập bằng SĐT ở trên.`}
          >
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
        </>
      )}

      <Field
        label="Loại giáo viên"
        required
        error={errors.teacherRole}
        hint={
          teacherRole === TEACHER_STAFF_ROLE
            ? "Giáo viên công ty nhận phụ cấp xăng theo khoảng cách."
            : teacherRole === TEACHER_COLLABORATOR_ROLE
              ? "Giáo viên cộng tác viên nhận tiền theo đơn giá mỗi tiết."
              : "Hồ sơ cũ chưa phân loại — chọn loại trước khi lưu."
        }
      >
        <select
          value={teacherRole}
          onChange={(event) => {
            setTeacherRole(
              event.target.value as
                | ""
                | typeof TEACHER_STAFF_ROLE
                | typeof TEACHER_COLLABORATOR_ROLE,
            );
            if (errors.teacherRole) {
              setErrors((prev) => ({ ...prev, teacherRole: "" }));
            }
          }}
          className={inputClass}
        >
          <option value="">— Chọn loại giáo viên —</option>
          <option value={TEACHER_STAFF_ROLE}>Giáo viên công ty</option>
          <option value={TEACHER_COLLABORATOR_ROLE}>
            Giáo viên cộng tác viên
          </option>
        </select>
      </Field>

      <Field
        label="Số tiết tối đa mỗi tuần"
        error={errors.maxPeriods}
        hint="Để trống = không giới hạn. Vượt định mức thì giáo viên không đăng ký thêm được."
      >
        <input
          type="number"
          min={1}
          max={MAX_PERIODS_PER_WEEK}
          value={maxPeriods}
          onChange={(e) => setMaxPeriods(e.target.value)}
          placeholder="Không giới hạn"
          className={inputClass}
        />
      </Field>

      {canSetTeachingRates() && (
        <Field
          label="Đơn giá mặc định mỗi tiết"
          error={errors.defaultRate}
          hint="Đơn giá mới chỉ áp dụng cho buổi dạy tạo về sau; các buổi đã tạo vẫn giữ giá cũ. Để trống = chưa khai giá, nhập 0 = dạy không công."
        >
          <input
            type="text"
            inputMode="decimal"
            value={formatVndInput(defaultRate)}
            onChange={(event) => {
              const raw = parseVndInput(event.target.value);
              if (/^\d*(?:\.\d{0,2})?$/.test(raw)) setDefaultRate(raw);
              if (errors.defaultRate) {
                setErrors((prev) => ({ ...prev, defaultRate: "" }));
              }
            }}
            placeholder="Chưa khai giá"
            className={inputClass}
          />
        </Field>
      )}

      <Field
        label="Vị trí Google Maps"
        error={errors.mapsUrl}
        hint="Dán link vị trí nhà giáo viên — dùng để gợi ý trường gần khi xếp lịch."
      >
        <input
          ref={mapsRef}
          value={mapsUrl}
          onChange={(e) => {
            setMapsUrl(e.target.value);
            if (errors.mapsUrl) setErrors((prev) => ({ ...prev, mapsUrl: "" }));
          }}
          inputMode="url"
          maxLength={500}
          placeholder="https://maps.app.goo.gl/…"
          className={inputClass}
        />
      </Field>

      {/* Link dài nên không hiện nguyên văn — cho bấm mở kiểm tra là đủ. */}
      {isValidGoogleMapsUrl(mapsUrl) && !!mapsUrl.trim() && (
        <a
          href={mapsUrl.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="-mt-1 flex w-fit items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          <MapPin size={12} /> Mở bản đồ kiểm tra
        </a>
      )}

      <Field label="Khu vực" hint="Chọn khu vực trước để tải đúng danh sách xã/phường.">
        <SearchableSelect
          value={provinceId}
          onChange={(value) => {
            setProvinceId(value);
            setWardIds([]);
            if (errors.wardIds) setErrors((prev) => ({ ...prev, wardIds: "" }));
          }}
          options={provinces}
          placeholder="— Chọn khu vực —"
          searchPlaceholder="Tìm khu vực…"
        />
      </Field>

      <Field
        label="Xã/phường có thể dạy"
        error={errors.wardIds}
        hint="Được toàn bộ trường thuộc xã/phường đã chọn. Để trống = không giới hạn."
      >
        <MultiSelect
          values={wardIds}
          onChange={setWardIds}
          options={wardOptions}
          disabled={!provinceId}
          placeholder={provinceId ? "— Chọn xã/phường —" : "— Chọn khu vực trước —"}
          searchPlaceholder="Tìm xã/phường…"
          noOptionLabel="Chưa có xã/phường nào"
        />
      </Field>

      <Field
        label="Môn có thể dạy"
        error={errors.catalogIds}
        hint="Môn trong danh mục dùng chung (STEM, Kỹ năng sống…), không phải môn riêng của từng trường."
      >
        <MultiSelect
          values={catalogIds}
          onChange={setCatalogIds}
          options={catalogOptions}
          loading={loadingCatalogs}
          placeholder="— Chọn môn —"
          searchPlaceholder="Tìm môn…"
          noOptionLabel="Chưa có môn nào trong danh mục"
        />
      </Field>

      <Field
        label="Zalo UID (không bắt buộc)"
        error={errors.zaloUid}
        hint="Có thể bổ sung sau; dùng để nhận diện đăng nhập qua Zalo Mini App."
      >
        <input
          value={zaloUid}
          onChange={(e) => {
            setZaloUid(e.target.value);
            if (errors.zaloUid) setErrors((prev) => ({ ...prev, zaloUid: "" }));
          }}
          maxLength={100}
          placeholder="Không bắt buộc"
          className={inputClass}
        />
      </Field>

      <Field
        label="Zalo User ID (không bắt buộc)"
        error={errors.zaloUserId}
        hint="Có thể bổ sung sau; dùng để gửi thông báo qua Zalo OA."
      >
        <input
          value={zaloUserId}
          onChange={(e) => {
            setZaloUserId(e.target.value);
            if (errors.zaloUserId) {
              setErrors((prev) => ({ ...prev, zaloUserId: "" }));
            }
          }}
          maxLength={100}
          placeholder="Không bắt buộc"
          className={inputClass}
        />
      </Field>

      <Field label="Ghi chú">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Không bắt buộc"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Đang hoạt động
      </label>
    </Modal>
  );
}
