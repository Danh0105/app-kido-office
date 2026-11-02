import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Pencil, Plus } from "lucide-react";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { hrEmployeeApi } from "@/service/hr/hr.api";
import { HrCard, HrEmpty, HrErrorState, HrFormError, HrLoading, buttonPrimary, buttonSecondary } from "../components/HrUi";
import { validateIdentifier } from "../lib/hrIdentifiers";
import { isNotFound, type EmployeeTabProps } from "./types";

type Kind = "TAX_NUMBER" | "SOCIAL_INSURANCE_NUMBER";

const META: Record<Kind, { title: string; field: string }> = {
  TAX_NUMBER: { title: "Mã số thuế cá nhân", field: "Mã số thuế" },
  SOCIAL_INSURANCE_NUMBER: { title: "Bảo hiểm xã hội", field: "Mã số BHXH" },
};

/**
 * MST / BHXH: chỉ hiển thị dạng che. Backend CHƯA có quyền reveal riêng cho
 * hai loại này → không có nút "Xem đầy đủ" (không mượn IDENTITY/BANK_REVEAL).
 */
export default function NumberProfileTab({
  employee,
  canEdit,
  cryptoWriteUnavailable,
  kind,
}: EmployeeTabProps & { kind: Kind }) {
  const queryClient = useQueryClient();
  const key = ["hr", kind, employee.id];
  const profile = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (kind === "TAX_NUMBER") {
        const p = await hrEmployeeApi.taxProfile(employee.id);
        return { masked: p.taxNumberMasked, version: p.version };
      }
      const p = await hrEmployeeApi.insuranceProfile(employee.id);
      return { masked: p.socialInsuranceNumberMasked, version: p.version };
    },
    retry: false,
  });
  const [editing, setEditing] = useState(false);
  const empty = profile.isError && isNotFound(profile.error);
  const meta = META[kind];

  return (
    <HrCard
      title={meta.title}
      action={
        canEdit &&
        (empty || profile.data) && (
          <button
            className={empty ? buttonPrimary : buttonSecondary}
            disabled={cryptoWriteUnavailable}
            onClick={() => setEditing(true)}
          >
            {empty ? <Plus size={16} /> : <Pencil size={14} />} {empty ? "Thêm" : "Sửa"}
          </button>
        )
      }
    >
      {profile.isLoading ? (
        <HrLoading />
      ) : empty ? (
        <HrEmpty title={`Chưa có ${meta.field.toLowerCase()}`} />
      ) : profile.isError ? (
        <HrErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : profile.data ? (
        <div>
          <p className="text-xs text-gray-500">{meta.field}</p>
          <p className="font-mono text-base tracking-wider break-all">{profile.data.masked ?? "—"}</p>
          <p className="text-[11px] text-gray-400 mt-1">Chưa có quyền xem đầy đủ cho loại dữ liệu này.</p>
        </div>
      ) : null}

      {editing && (
        <NumberForm
          kind={kind}
          currentMasked={profile.data?.masked ?? null}
          onClose={() => setEditing(false)}
          onSubmit={async (value) => {
            const version = profile.data?.version;
            if (kind === "TAX_NUMBER") await hrEmployeeApi.saveTaxProfile(employee.id, value, version);
            else await hrEmployeeApi.saveInsuranceProfile(employee.id, value, version);
            toast.success("Đã lưu.");
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}
    </HrCard>
  );
}

function NumberForm({
  kind,
  currentMasked,
  onClose,
  onSubmit,
}: {
  kind: Kind;
  currentMasked: string | null;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const validation = value ? validateIdentifier(kind, value) : "required";

  const submit = async () => {
    if (validation) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(value);
      setValue("");
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={META[kind].title} submitLabel="Lưu" loading={loading} disabled={!!validation} onClose={onClose} onSubmit={submit}>
      <Field
        label={META[kind].field}
        required
        hint={currentMasked ? `Đang lưu: ${currentMasked}` : undefined}
        error={value && validation ? validation : undefined}
      >
        <input
          className={`${inputClass} font-mono`}
          value={value}
          autoComplete="off"
          spellCheck={false}
          inputMode="numeric"
          maxLength={64}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <HrFormError error={error} />
    </Modal>
  );
}
