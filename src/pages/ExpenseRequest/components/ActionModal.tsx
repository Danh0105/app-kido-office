import { useState } from "react";

export type ActionPayload = { note?: string; reason?: string; files?: File[] };

type Props = {
  title: string;
  submitLabel: string;
  submitColor?: string;
  showNote?: boolean;
  noteLabel?: string;
  showFiles?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: ActionPayload) => void;
};

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function ActionModal({
  title,
  submitLabel,
  submitColor = "bg-blue-500",
  showNote,
  noteLabel = "Ghi chú",
  showFiles,
  requireReason,
  reasonLabel = "Lý do",
  loading,
  onClose,
  onSubmit,
}: Props) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (arr.length + files.length > MAX_FILES) {
      setError(`Tối đa ${MAX_FILES} tệp`);
      return;
    }
    if (arr.some((f) => f.size > MAX_SIZE)) {
      setError("Mỗi tệp tối đa 50MB");
      return;
    }
    setError("");
    setFiles((prev) => [...prev, ...arr]);
  };

  const handleSubmit = () => {
    if (requireReason && !reason.trim()) {
      setError("Vui lòng nhập lý do");
      return;
    }
    onSubmit({
      note: showNote ? note.trim() || undefined : undefined,
      reason: requireReason ? reason.trim() : undefined,
      files: showFiles ? files : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {requireReason && (
            <div>
              <label className="text-sm text-gray-600">
                {reasonLabel} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="Nhập lý do…"
              />
            </div>
          )}

          {showNote && (
            <div>
              <label className="text-sm text-gray-600">{noteLabel}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                placeholder="Không bắt buộc"
              />
            </div>
          )}

          {showFiles && (
            <div>
              <label className="text-sm text-gray-600">
                Tệp đính kèm (tối đa {MAX_FILES})
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => pickFiles(e.target.files)}
                className="w-full mt-1 text-sm"
              />
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1"
                    >
                      <span className="truncate">📎 {f.name}</span>
                      <button
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className="text-red-500 ml-2"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="p-4 border-t flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-xl border border-gray-300 text-gray-600 font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`flex-1 py-2 text-sm rounded-xl text-white font-medium active:scale-95 disabled:opacity-60 ${submitColor}`}
          >
            {loading ? "Đang xử lý…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
