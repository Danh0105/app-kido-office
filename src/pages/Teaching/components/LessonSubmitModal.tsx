import { useMemo, useState } from "react";

import type { TeachingSession } from "@/types/teaching";
import Modal, { Field, inputClass } from "./Modal";
import { classNameOf, formatTime } from "../lib";

const MAX_IMAGES = 10;

export type LessonSubmitContent = {
  lessonName: string;
  lessonEvaluation: string;
  images: File[];
};

type Props = {
  session: TeachingSession;
  /** "checkout" = tiết cuối block, đã có GPS kèm theo; "lesson-only" = tiết giữa/đầu, không cần GPS. */
  mode: "checkout" | "lesson-only";
  loading?: boolean;
  onClose: () => void;
  onSubmit: (content: LessonSubmitContent) => void;
};

/**
 * Form nhập nội dung bài dạy (tên bài, đánh giá, ảnh) — dùng chung cho check-out
 * (kèm GPS, do component cha lo phần vị trí trước khi mở modal này) và cho
 * tiết không cần check-out riêng (chỉ nộp nội dung, `mode="lesson-only"`).
 */
export default function LessonSubmitModal({
  session,
  mode,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const [lessonName, setLessonName] = useState("");
  const [lessonEvaluation, setLessonEvaluation] = useState("");
  const [images, setImages] = useState<File[]>([]);

  const previews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, MAX_IMAGES));
  };

  const removeImage = (index: number) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  const trimmedName = lessonName.trim();
  const trimmedEvaluation = lessonEvaluation.trim();
  const disabled = !trimmedName || !trimmedEvaluation;

  return (
    <Modal
      title={mode === "checkout" ? "Check-out & nội dung bài dạy" : "Nộp nội dung bài dạy"}
      submitLabel={mode === "checkout" ? "Check-out" : "Gửi"}
      loading={loading}
      disabled={disabled}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          lessonName: trimmedName,
          lessonEvaluation: trimmedEvaluation,
          images,
        })
      }
    >
      <p className="text-xs text-gray-500">
        {formatTime(session.startTime)}–{formatTime(session.endTime)} ·{" "}
        {session.schoolName}
        {classNameOf(session) ? ` · ${classNameOf(session)}` : ""}
      </p>

      <Field label="Tên bài học" required>
        <input
          className={inputClass}
          value={lessonName}
          onChange={(e) => setLessonName(e.target.value)}
          maxLength={255}
          placeholder="VD: Phép cộng trong phạm vi 10"
        />
      </Field>

      <Field label="Đánh giá buổi học" required>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={2000}
          value={lessonEvaluation}
          onChange={(e) => setLessonEvaluation(e.target.value)}
          placeholder="Học sinh tiếp thu ra sao, có gì cần lưu ý…"
        />
      </Field>

      <Field label="Ảnh minh chứng" hint={`Tối đa ${MAX_IMAGES} ảnh`}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="text-sm"
        />
        {previews.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {previews.map((preview, index) => (
              <div
                key={`${preview.file.name}-${index}`}
                className="relative aspect-square overflow-hidden rounded-lg border bg-gray-50"
              >
                <img
                  src={preview.url}
                  alt={preview.file.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label="Xoá ảnh"
                  onClick={() => removeImage(index)}
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>
    </Modal>
  );
}
