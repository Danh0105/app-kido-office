import { useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { teacherApi } from "@/service/teaching";
import type { Teacher } from "@/types/teaching";
import { getApiErrorMessage } from "@/utils/apiError";

import { isValidGoogleMapsUrl } from "../lib";
import Modal, { Field, inputClass } from "./Modal";

export default function TeacherLocationModal({
  teacher,
  onClose,
  onSaved,
}: {
  teacher: Teacher;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mapsUrl, setMapsUrl] = useState(teacher.googleMapsUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const value = mapsUrl.trim();
    if (!value) {
      setError("Vui lòng dán link vị trí Google Maps của giáo viên");
      inputRef.current?.focus();
      return;
    }
    if (!isValidGoogleMapsUrl(value)) {
      setError("Vị trí phải là link Google Maps hợp lệ");
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await teacherApi.update(teacher.id, { googleMapsUrl: value });
      toast.success(`Đã thêm vị trí cho ${teacher.name}`);
      onSaved();
      onClose();
    } catch (requestError: any) {
      const message = getApiErrorMessage(
        requestError,
        "Không lưu được vị trí giáo viên"
      );
      setError(message);
      if (requestError?.response?.status !== 403) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Thêm vị trí · ${teacher.name}`}
      submitLabel="Lưu vị trí"
      loading={saving}
      onClose={onClose}
      onSubmit={submit}
    >
      <p className="text-xs leading-relaxed text-gray-500">
        Mở Google Maps tại nhà giáo viên, chọn{" "}
        <b>Chia sẻ → Sao chép liên kết</b>, rồi dán vào ô dưới đây. Hệ thống sẽ
        tự đọc toạ độ và tính lại phụ cấp.
      </p>

      <Field label="Link vị trí Google Maps" required error={error}>
        <input
          ref={inputRef}
          value={mapsUrl}
          onChange={(event) => {
            setMapsUrl(event.target.value);
            if (error) setError("");
          }}
          autoFocus
          placeholder="https://maps.app.goo.gl/..."
          className={inputClass}
        />
      </Field>
    </Modal>
  );
}
