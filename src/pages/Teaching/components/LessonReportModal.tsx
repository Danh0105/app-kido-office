import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from "lucide-react";

import type { LessonImage, TeachingSession } from "@/types/teaching";
import { formatDistance } from "@/utils/geo";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { classNameOf, formatCheckedAt, formatDate, formatTime } from "../lib";

const fallback = (value?: string | null) => value?.trim() || "Chưa cập nhật";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-gray-800">{children}</dd>
    </div>
  );
}

function RangeBadge({ value }: { value?: boolean | null }) {
  if (value == null) return <span className="text-gray-400">Chưa xác định</span>;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
      value ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
    }`}>
      {value ? "Ngoài phạm vi" : "Trong phạm vi"}
    </span>
  );
}

function EvidenceImage({ image, onOpen }: { image: LessonImage; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button type="button" onClick={onOpen} className="relative aspect-square overflow-hidden rounded-xl border bg-gray-50 text-xs text-gray-500">
      {!loaded && !failed && <span className="absolute inset-0 grid place-items-center">Đang tải…</span>}
      {failed ? (
        <span className="absolute inset-0 grid place-items-center px-2"><span><ImageIcon className="mx-auto mb-1" size={20} />Không thể tải ảnh</span></span>
      ) : (
        <img
          src={resolveApiFileUrl(image.url)}
          alt="Ảnh minh chứng bài dạy"
          loading="lazy"
          className={`h-full w-full object-cover transition ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </button>
  );
}

/** Nhóm state xem-toàn-màn-hình: danh sách ảnh đang duyệt + vị trí hiện tại. */
type Preview = { images: LessonImage[]; index: number };

export default function LessonReportModal({ session, onClose }: { session: TeachingSession; onClose: () => void }) {
  const checkinImages = session.checkinImages ?? [];
  const lessonImages = session.lessonImages ?? [];
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") preview == null ? onClose() : setPreview(null);
      if (preview && preview.images.length > 1) {
        if (event.key === "ArrowLeft")
          setPreview({
            ...preview,
            index: (preview.index - 1 + preview.images.length) % preview.images.length,
          });
        if (event.key === "ArrowRight")
          setPreview({ ...preview, index: (preview.index + 1) % preview.images.length });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, preview]);

  const distance = (value?: number | null) => value == null ? "Chưa xác định" : formatDistance(value);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label="Chi tiết nội dung bài học" className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white md:max-w-4xl md:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Chi tiết buổi học</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-gray-100"><X size={20} /></button>
        </header>
        <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Thông tin buổi dạy</h3>
            <dl className="grid min-w-0 grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
              <Info label="Giáo viên">{session.teacherName || "Chưa phân công"}</Info>
              <Info label="Trường">{session.schoolName}</Info>
              <Info label="Lớp">{classNameOf(session)}</Info>
              <Info label="Môn học">{session.subjectName}</Info>
              <Info label="Ngày dạy">{formatDate(session.date)}</Info>
              <Info label="Giờ dạy">{formatTime(session.startTime)}–{formatTime(session.endTime)}</Info>
              <Info label="Check-in">{session.checkinAt ? formatCheckedAt(session.checkinAt) : "Chưa Check-in"}</Info>
              <Info label="Check-out">{session.checkoutAt ? formatCheckedAt(session.checkoutAt) : "Chưa Check-out"}</Info>
              <Info label="Khoảng cách Check-in">{distance(session.checkinDistance)}</Info>
              <Info label="Khoảng cách Check-out">{distance(session.checkoutDistance)}</Info>
              <Info label="Phạm vi Check-in"><RangeBadge value={session.checkinOutOfRange} /></Info>
              <Info label="Phạm vi Check-out"><RangeBadge value={session.checkoutOutOfRange} /></Info>
            </dl>
          </section>

          <section className="min-w-0 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Ảnh check-in</h3>
            {checkinImages.length === 0 ? (
              <p className="text-sm text-gray-400">Không có ảnh</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {checkinImages.map((image, index) => (
                  <EvidenceImage
                    key={image.id}
                    image={image}
                    onOpen={() => setPreview({ images: checkinImages, index })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Nội dung giáo viên báo cáo</h3>
            <Info label="Tên bài học">{fallback(session.lessonName)}</Info>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Đánh giá buổi học</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">{fallback(session.lessonEvaluation)}</p>
            </div>
            <div>
              <p className="mb-2 text-xs text-gray-500">Ảnh minh chứng</p>
              {lessonImages.length === 0 ? <p className="text-sm text-gray-400">Không có ảnh</p> : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {lessonImages.map((image, index) => (
                    <EvidenceImage
                      key={image.id}
                      image={image}
                      onOpen={() => setPreview({ images: lessonImages, index })}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </section>

      {preview && preview.images[preview.index] && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/90 p-3" onClick={() => setPreview(null)}>
          <button type="button" aria-label="Đóng ảnh xem trước" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white" onClick={() => setPreview(null)}><X /></button>
          <img src={resolveApiFileUrl(preview.images[preview.index].url)} alt={`Ảnh xem trước ${preview.index + 1}`} className="max-h-[90vh] max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
          {preview.images.length > 1 && <>
            <button type="button" aria-label="Ảnh trước" className="absolute left-2 grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white md:left-5" onClick={(event) => { event.stopPropagation(); setPreview({ ...preview, index: (preview.index - 1 + preview.images.length) % preview.images.length }); }}><ChevronLeft size={30} /></button>
            <button type="button" aria-label="Ảnh sau" className="absolute right-2 grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white md:right-5" onClick={(event) => { event.stopPropagation(); setPreview({ ...preview, index: (preview.index + 1) % preview.images.length }); }}><ChevronRight size={30} /></button>
          </>}
        </div>
      )}
    </div>
  );
}
