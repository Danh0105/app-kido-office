// Tiện ích định vị dùng chung: lấy GPS, tính khoảng cách, đọc/ghi toạ độ.
// Dùng cho việc gắn vị trí trường học và kiểm tra check-in theo vị trí.

export type LatLng = { latitude: number; longitude: number };

export type FixedPosition = LatLng & {
  /** Sai số GPS do thiết bị báo (mét) — càng nhỏ càng đáng tin. */
  accuracy: number;
};

/** Bán kính cho phép check-in mặc định khi trường chưa cấu hình riêng (mét). */
export const DEFAULT_CHECKIN_RADIUS = 200;

/** Sai số GPS lớn hơn mức này thì toạ độ lấy được không đáng tin để chấm công. */
export const MAX_TRUSTED_ACCURACY = 100;

export const isValidLatitude = (value: number) =>
  Number.isFinite(value) && value >= -90 && value <= 90;

export const isValidLongitude = (value: number) =>
  Number.isFinite(value) && value >= -180 && value <= 180;

/** Toạ độ thô từ API / form: số, chuỗi, hoặc rỗng khi chưa gắn. */
export type RawLatLng = {
  latitude?: number | string | null;
  longitude?: number | string | null;
};

/**
 * Đổi một ô toạ độ thô sang số.
 * null / undefined / chuỗi rỗng nghĩa là "chưa gắn" nên phải ra NaN:
 * Number(null) === 0 sẽ biến trường chưa có toạ độ thành điểm (0, 0) hợp lệ.
 */
export const toCoord = (value?: number | string | null) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "string" && !value.trim()) return NaN;
  return Number(value);
};

/** Toạ độ đã gắn, hoặc null khi thiếu/không hợp lệ. */
export const toLatLng = (value?: RawLatLng | null): LatLng | null => {
  const latitude = toCoord(value?.latitude);
  const longitude = toCoord(value?.longitude);
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return { latitude, longitude };
};

export const isValidLatLng = (value?: RawLatLng | null) => !!toLatLng(value);

/** 10.762622 -> "10.762622" (6 số lẻ ≈ sai số 0.1m, thừa hơn là vô nghĩa). */
export const formatCoord = (value?: number | string | null) => {
  const num = toCoord(value);
  return Number.isFinite(num) ? num.toFixed(6) : "";
};

// Danh sách host khớp với backend (POST /schools/resolve-google-maps).
const MAPS_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
];

/** Link chia sẻ Google Maps — backend chỉ nhận HTTPS thuộc các host trên. */
export const isGoogleMapsUrl = (text: string) => {
  const source = (text || "").trim();
  if (!/^https?:\/\//i.test(source)) return false;
  try {
    return MAPS_HOSTS.includes(new URL(source).hostname.toLowerCase());
  } catch {
    return false;
  }
};

/** Link rút gọn — phải nhờ backend đi theo redirect mới ra toạ độ. */
export const isShortGoogleMapsUrl = (text: string) =>
  /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl)\//i.test((text || "").trim());

// Thứ tự quan trọng: !3d!4d là ghim chính xác, @lat,lng chỉ là tâm khung nhìn.
const URL_COORD_PATTERNS = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|query|ll|center|daddr|sll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
  /\/place\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
];

/**
 * Đọc toạ độ từ chuỗi dán vào: "10.762622, 106.660172" hoặc link Google Maps
 * đầy đủ (có @lat,lng / !3d!4d / ?q=lat,lng).
 * Link rút gọn (maps.app.goo.gl) không chứa toạ độ → trả null, phải nhờ backend resolve.
 */
export const parseLatLng = (text: string): LatLng | null => {
  const source = (text || "").trim();
  if (!source) return null;

  for (const pattern of URL_COORD_PATTERNS) {
    const match = source.match(pattern);
    if (match) {
      const point = toLatLng({ latitude: match[1], longitude: match[2] });
      if (point) return point;
    }
  }

  // Không phải link → coi như cặp số "lat, lng".
  if (/^https?:\/\//i.test(source)) return null;

  const pair = source.split(/[,;\s]+/).filter(Boolean);
  if (pair.length < 2) return null;

  return toLatLng({ latitude: pair[0], longitude: pair[1] });
};

/** Khoảng cách giữa 2 điểm theo công thức haversine, đơn vị mét. */
export const distanceInMeters = (from: LatLng, to: LatLng) => {
  const R = 6371000; // bán kính Trái Đất (m)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
};

/** 85 -> "85 m", 1250 -> "1.25 km" */
export const formatDistance = (meters: number) =>
  meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`;

/** Toạ độ nằm trong bán kính cho phép không (kèm khoảng cách để hiện cho user). */
export const isWithinRadius = (
  current: LatLng,
  target: LatLng,
  radius = DEFAULT_CHECKIN_RADIUS,
) => {
  const distance = distanceInMeters(current, target);
  return { ok: distance <= radius, distance };
};

const GEO_ERROR_MESSAGE: Record<number, string> = {
  1: "Bạn đã từ chối quyền truy cập vị trí. Hãy bật lại trong cài đặt.",
  2: "Không xác định được vị trí. Kiểm tra GPS rồi thử lại.",
  3: "Lấy vị trí quá lâu. Ra chỗ thoáng rồi thử lại.",
};

/** Lấy vị trí hiện tại, ưu tiên độ chính xác cao. Lỗi trả về message tiếng Việt. */
export const getCurrentPosition = (timeout = 15000) =>
  new Promise<FixedPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Thiết bị không hỗ trợ định vị"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy || 0),
        }),
      (error) =>
        reject(
          new Error(
            GEO_ERROR_MESSAGE[error.code] || "Không lấy được vị trí hiện tại",
          ),
        ),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });

/** Link mở Google Maps tại toạ độ — để kiểm tra lại điểm vừa lưu. */
export const googleMapsUrl = ({ latitude, longitude }: LatLng) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;

/**
 * Link bản đồ để hiển thị: ưu tiên link chia sẻ người dùng đã lưu (mở đúng địa
 * điểm gốc), không có thì dựng lại từ toạ độ.
 */
export const mapsLinkOf = (saved?: string | null, point?: LatLng | null) =>
  (saved || "").trim() || (point ? googleMapsUrl(point) : "");
