import { useRef } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { ImagePlus, Maximize2, Minus, Plus } from "lucide-react";

import { TIMETABLE_IMAGE_MIME_TYPES } from "@/types/teaching";

/**
 * Ảnh gốc để Nhân sự đối chiếu từng ô với lưới bên phải. Phóng to được là bắt
 * buộc: chữ trên tờ thời khoá biểu chụp bằng điện thoại rất nhỏ.
 *
 * Backend không lưu ảnh, nên F5 xong là mất — khi đó cho chọn lại ảnh để xem
 * (chỉ hiển thị tại chỗ, **không** gửi lên và không tạo bản nháp mới).
 */
export default function TimetableImportImage({
  url,
  onPick,
}: {
  url: string | null;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold uppercase text-gray-500">
          Ảnh gốc
        </span>
        {url && (
          <span className="text-[10px] text-gray-400">
            Kéo để di chuyển · cuộn để phóng to
          </span>
        )}
      </div>

      {url ? (
        <TransformWrapper
          minScale={0.5}
          maxScale={8}
          initialScale={1}
          centerOnInit
          doubleClick={{ mode: "zoomIn" }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <div className="relative">
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{ width: "100%" }}
              >
                <img
                  src={url}
                  alt="Ảnh thời khoá biểu đã gửi"
                  className="h-[45vh] w-full object-contain md:h-[60vh]"
                />
              </TransformComponent>

              <div className="absolute bottom-2 right-2 flex gap-1">
                <ZoomButton label="Thu nhỏ" onClick={() => zoomOut()}>
                  <Minus size={15} />
                </ZoomButton>
                <ZoomButton label="Phóng to" onClick={() => zoomIn()}>
                  <Plus size={15} />
                </ZoomButton>
                <ZoomButton label="Về mặc định" onClick={() => resetTransform()}>
                  <Maximize2 size={14} />
                </ZoomButton>
              </div>
            </div>
          )}
        </TransformWrapper>
      ) : (
        <div className="flex h-[30vh] flex-col items-center justify-center px-4 text-center md:h-[60vh]">
          <ImagePlus className="text-gray-300" size={32} />
          <p className="mt-2 text-xs font-medium text-gray-600">
            Không còn ảnh gốc trên trang này
          </p>
          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-gray-400">
            Ảnh chỉ nằm trong phiên làm việc nên tải lại trang là mất. Bản nháp
            vẫn nguyên — chọn lại đúng tấm ảnh đó để đối chiếu với lưới.
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 active:scale-95"
          >
            Chọn ảnh để đối chiếu
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={TIMETABLE_IMAGE_MIME_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white/90 text-gray-600 shadow-sm active:scale-95"
    >
      {children}
    </button>
  );
}
