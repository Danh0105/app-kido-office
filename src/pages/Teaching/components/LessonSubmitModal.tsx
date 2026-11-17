import { useEffect, useMemo, useState } from "react";

import type { TeachingSession } from "@/types/teaching";
import Modal, { Field, inputClass } from "./Modal";
import { classNameOf, formatTime } from "../lib";

const MAX_IMAGES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type LessonSubmitContent = {
  lessonName: string;
  lessonEvaluation: string;
  actualStudentCount: number;
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
  const [actualStudentCount, setActualStudentCount] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");

  const previews = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );

  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [previews],
  );

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const oversized = selected.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setFileError(`Tệp ${oversized.name} vượt quá 50 MB.`);
      return;
    }
    setFileError("");
    setImages((prev) => [...prev, ...selected].slice(0, MAX_IMAGES));
  };

  const removeImage = (index: number) =>
    setImages((prev) => prev.filter((_, i) => i !== index));

  const trimmedName = lessonName.trim();
  const trimmedEvaluation = lessonEvaluation.trim();
  const parsedStudentCount = Number(actualStudentCount);
  const validStudentCount =
    actualStudentCount.trim() !== "" &&
    Number.isInteger(parsedStudentCount) &&
    parsedStudentCount >= 0;
  const disabled =
    !trimmedName ||
    !trimmedEvaluation ||
    !validStudentCount ||
    images.length === 0 ||
    !!fileError;

  return (
    <Modal
      title={mode === "checkout" ? "Check-out & báo giảng" : "Báo giảng"}
      submitLabel={mode === "checkout" ? "Check-out & báo giảng" : "Gửi báo giảng"}
      loading={loading}
      disabled={disabled}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          lessonName: trimmedName,
          lessonEvaluation: trimmedEvaluation,
          actualStudentCount: parsedStudentCount,
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

      <Field
        label="Sĩ số thực tế"
        required
        error={
          actualStudentCount && !validStudentCount
            ? "Sĩ số phải là số nguyên từ 0 trở lên."
            : undefined
        }
      >
        <input
          className={inputClass}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={actualStudentCount}
          onChange={(e) => setActualStudentCount(e.target.value)}
          placeholder={
            session.classStudentCount != null
              ? `Sĩ số lớp: ${session.classStudentCount}`
              : "Nhập số học sinh có mặt"
          }
        />
      </Field>

      <Field
        label="Ảnh minh chứng"
        required
        error={fileError || undefined}
        hint={`Bắt buộc ít nhất 1 ảnh, tối đa ${MAX_IMAGES} ảnh; mỗi ảnh không quá 50 MB`}
      >
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

      {mode === "lesson-only" && session.checkoutAt && (
        <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          Check-out đã được lưu. Báo giảng chỉ hoàn tất khi màn hình
          hiển thị “Đã báo giảng thành công”.
        </p>
      )}
    </Modal>
  );
}
