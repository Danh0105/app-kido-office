import { useState, type ReactNode } from "react";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { HrFormError } from "./HrUi";
import { MIN_REASON_LENGTH, isValidReason } from "../lib/hrAccess";


/** Hỏi lý do trước một thao tác nhạy cảm (reveal, tải tài liệu hạn chế, lưu trữ…). */
export default function ReasonDialog({
  title,
  description,
  submitLabel,
  submitColor,
  error,
  loading,
  required = true,
  onClose,
  onSubmit,
}: {
  title: string;
  description?: ReactNode;
  submitLabel: string;
  submitColor?: string;
  error?: unknown;
  loading?: boolean;
  required?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const invalid = required && !isValidReason(trimmed);

  return (
    <Modal
      title={title}
      submitLabel={submitLabel}
      submitColor={submitColor}
      loading={loading}
      disabled={invalid}
      onClose={onClose}
      onSubmit={() => !invalid && onSubmit(trimmed)}
    >
      {description && <div className="text-sm text-gray-700">{description}</div>}
      <Field
        label="Lý do"
        required={required}
        hint={required ? `Tối thiểu ${MIN_REASON_LENGTH} ký tự. Lý do được ghi vào nhật ký HR.` : undefined}
      >
        <textarea
          className={inputClass}
          rows={3}
          maxLength={2000}
          value={reason}
          autoComplete="off"
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <HrFormError error={error} />
    </Modal>
  );
}
