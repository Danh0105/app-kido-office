import { useEffect, useState } from "react";
import api from "@/service/api";
import { Field, inputClass } from "./shared";

export type SystemPosition = { value: string; label: string };

/** Danh mục do server quản lý, không nhập role tự do hay đoán từ tên vị trí. */
export default function PositionSelect({
  value,
  onChange,
  name = "positionRole",
  required = true
}: {
  value?: string;
  onChange: (value: string, label: string) => void;
  name?: string;
  required?: boolean;
}) {
  const [positions, setPositions] = useState<SystemPosition[]>([]);
  const [state, setState] = useState("Đang tải chức danh…");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api.get<SystemPosition[]>("/recruitment/jobs/positions").then(
      ({ data }) => {
        if (active) {
          setPositions(data);
          setState("Chọn chức danh hệ thống");
        }
      },
      () => {
        if (active) setState("Không tải được chức danh; vui lòng thử lại");
      }
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <Field label="Chức danh hệ thống">
      <select
        aria-label="Chức danh hệ thống"
        name={name}
        value={value ?? ""}
        required={required}
        className={inputClass}
        onChange={(e) =>
          onChange(
            e.target.value,
            positions.find((p) => p.value === e.target.value)?.label ?? ""
          )
        }
      >
        <option value="">{state}</option>
        {positions.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {state.startsWith("Không tải") && (
        <button type="button" onClick={() => setAttempt((v) => v + 1)}>
          Thử lại danh mục
        </button>
      )}
    </Field>
  );
}
