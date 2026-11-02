import { useRef } from "react";
import { HR_FILE_ALLOWED_LABEL, HR_FILE_MAX_BYTES, formatBytes, validateHrUpload } from "../lib/hrFiles";
import { HrAlert } from "./HrUi";

/**
 * Ô chọn file HR (kéo thả / bấm chọn) — cùng luật với backend 0.4C: PDF,
 * JPEG, PNG; tối đa 10 MB. Dùng chung cho tab File và tab Tài liệu.
 */
export default function HrFilePicker({ file, onPick }: { file: File | null; onPick: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileError = file ? validateHrUpload(file) : null;
  const pick = (f: File | undefined | null) => {
    onPick(f ?? null);
    if (!f && inputRef.current) inputRef.current.value = "";
  };
  return (
    <>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 hover:border-blue-300"
      >
        {file ? (
          <p className="break-all text-gray-700">
            {file.name} · {formatBytes(file.size)}
          </p>
        ) : (
          <p>Kéo thả hoặc bấm để chọn file</p>
        )}
        <p className="mt-1 text-[11px] text-gray-400">
          Cho phép: {HR_FILE_ALLOWED_LABEL} · Tối đa {HR_FILE_MAX_BYTES / 1024 / 1024} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {fileError && <HrAlert tone="warning">{fileError}</HrAlert>}
    </>
  );
}

/** File đã chọn và hợp lệ để gửi. */
export const isPickedFileValid = (file: File | null): file is File => !!file && !validateHrUpload(file);
