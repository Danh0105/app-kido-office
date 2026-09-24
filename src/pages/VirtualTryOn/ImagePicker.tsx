import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

/** Khớp trần của backend (`TRYON_MAX_FILE_BYTES`) để báo lỗi ngay tại máy. */
const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
};

export default function ImagePicker({
  label,
  hint,
  file,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Dùng data URL (FileReader) chứ KHÔNG dùng `URL.createObjectURL`.
   *
   * App bật `React.StrictMode`: ở dev, effect chạy 2 lần (mount → cleanup →
   * mount), nên cleanup `URL.revokeObjectURL()` huỷ luôn URL vừa cấp và ảnh
   * xem trước vỡ. Data URL không cần thu hồi nên không dính lỗi này; ảnh ở đây
   * tối đa 15MB và chỉ có 2 tấm nên chi phí bộ nhớ chấp nhận được.
   */
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    let alive = true;
    const reader = new FileReader();

    reader.onload = () => {
      if (alive) setPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => {
      if (alive) {
        setPreview(null);
        setError("Không đọc được ảnh này, thử ảnh khác giúp");
      }
    };
    reader.readAsDataURL(file);

    return () => {
      alive = false;
      reader.abort();
    };
  }, [file]);

  const pick = (selected?: File | null) => {
    setError(null);
    if (!selected) return;

    if (!ACCEPT.split(",").includes(selected.type)) {
      setError("Chỉ nhận ảnh JPEG, PNG hoặc WEBP");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("Ảnh vượt quá 15MB, chọn ảnh nhẹ hơn");
      return;
    }
    onChange(selected);
  };

  const clear = () => {
    onChange(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className="text-xs text-gray-400 mb-2 line-clamp-2">{hint}</p>

      {/*
        Khung giữ nguyên tỉ lệ dù có ảnh hay chưa — không thì lúc ảnh vừa tải
        xong khung co lại, cả trang bị giật.
      */}
      <div
        className={`relative aspect-[3/4] w-full rounded-2xl border-2 border-dashed overflow-hidden ${
          preview ? "border-transparent" : "border-gray-300 bg-gray-50"
        } ${disabled ? "opacity-60" : ""}`}
      >
        {file && !preview && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <span className="text-xs text-gray-400">Đang mở ảnh…</span>
          </div>
        )}

        {preview && (
          <>
            <img
              src={preview}
              alt={label}
              className="w-full h-full object-cover"
              onError={() => {
                setPreview(null);
                setError("Ảnh hiển thị lỗi, thử chọn lại");
              }}
            />
            {!disabled && (
              <button
                type="button"
                onClick={clear}
                aria-label={`Xoá ${label}`}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"
              >
                <X size={14} />
              </button>
            )}
          </>
        )}

        {!file && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400"
          >
            <ImagePlus size={28} />
            <span className="text-xs">Chọn ảnh</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
