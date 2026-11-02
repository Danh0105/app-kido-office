import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Eye, Pencil, Plus } from "lucide-react";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { selectClass } from "@/pages/Teaching/components/Shared";
import { hrEmployeeApi, type HrIdentityDocument, type HrIdentityDocumentType } from "@/service/hr/hr.api";
import { HrCard, HrEmpty, HrErrorState, HrFormError, HrLoading, buttonPrimary, buttonSecondary } from "../components/HrUi";
import RevealDialog from "../components/RevealDialog";
import { formatVnDate, hrCapabilities } from "../lib/hrAccess";
import { IDENTITY_DOCUMENT_LABELS, validateIdentifier } from "../lib/hrIdentifiers";
import type { EmployeeTabProps } from "./types";

const TYPES: HrIdentityDocumentType[] = ["CCCD", "CMND", "PASSPORT", "WORK_PERMIT"];

export default function IdentityTab({
  employee,
  access,
  canEdit,
  cryptoWriteUnavailable,
  cryptoRevealUnavailable,
}: EmployeeTabProps) {
  const queryClient = useQueryClient();
  const key = ["hr", "identity-documents", employee.id];
  const docs = useQuery({ queryKey: key, queryFn: () => hrEmployeeApi.identityDocuments(employee.id), retry: false });
  const [editing, setEditing] = useState<HrIdentityDocument | "new" | null>(null);
  const [revealing, setRevealing] = useState<HrIdentityDocument | null>(null);
  const canReveal = hrCapabilities(access).canRevealIdentity;
  const usedTypes = new Set((docs.data ?? []).map((d) => d.documentType));

  return (
    <HrCard
      title="Giấy tờ định danh"
      action={
        canEdit &&
        usedTypes.size < TYPES.length && (
          <button className={buttonPrimary} disabled={cryptoWriteUnavailable} onClick={() => setEditing("new")}>
            <Plus size={16} /> Thêm
          </button>
        )
      }
    >
      {docs.isLoading ? (
        <HrLoading />
      ) : docs.isError ? (
        <HrErrorState error={docs.error} onRetry={() => docs.refetch()} />
      ) : !docs.data?.length ? (
        <HrEmpty title="Chưa có giấy tờ định danh" />
      ) : (
        <div className="space-y-2">
          {docs.data.map((d) => (
            <div key={d.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{IDENTITY_DOCUMENT_LABELS[d.documentType] ?? d.documentType}</p>
                  <p className="font-mono text-base tracking-wider break-all">{d.numberMasked ?? "—"}</p>
                </div>
                <div className="flex gap-2">
                  {canReveal && (
                    <button
                      className={buttonSecondary}
                      disabled={cryptoRevealUnavailable}
                      onClick={() => setRevealing(d)}
                    >
                      <Eye size={14} /> Xem đầy đủ
                    </button>
                  )}
                  {canEdit && (
                    <button className={buttonSecondary} disabled={cryptoWriteUnavailable} onClick={() => setEditing(d)}>
                      <Pencil size={14} /> Sửa
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-3">
                <span>Ngày cấp: {formatVnDate(d.issuedOn)}</span>
                <span>Hết hạn: {formatVnDate(d.expiresOn)}</span>
                <span className="col-span-2 sm:col-span-1 break-words">Nơi cấp: {d.issuedPlace ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <IdentityForm
          employeeId={employee.id}
          doc={editing === "new" ? null : editing}
          availableTypes={TYPES.filter((t) => !usedTypes.has(t))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}
      {revealing && (
        <RevealDialog
          title={`Xem đầy đủ — ${IDENTITY_DOCUMENT_LABELS[revealing.documentType] ?? revealing.documentType}`}
          fieldLabel="Số giấy tờ"
          reveal={async (reason) =>
            (await hrEmployeeApi.revealIdentityDocument(employee.id, revealing.id, reason)).number
          }
          onClose={() => setRevealing(null)}
        />
      )}
    </HrCard>
  );
}

/**
 * Form số giấy tờ: giá trị chỉ nằm trong state của modal (mất khi đóng),
 * không autocomplete, không persist, không đưa lên URL / log.
 */
function IdentityForm({
  employeeId,
  doc,
  availableTypes,
  onClose,
  onSaved,
}: {
  employeeId: number;
  doc: HrIdentityDocument | null;
  availableTypes: HrIdentityDocumentType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [documentType, setDocumentType] = useState<HrIdentityDocumentType>(doc?.documentType ?? availableTypes[0] ?? "CCCD");
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState(doc?.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(doc?.expiresOn ?? "");
  const [issuedPlace, setIssuedPlace] = useState(doc?.issuedPlace ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const numberError = number ? validateIdentifier(documentType, number) : doc ? null : "Nhập số giấy tờ.";
  const periodError = issuedOn && expiresOn && expiresOn < issuedOn ? "Ngày hết hạn phải sau ngày cấp." : null;
  const invalid = !!numberError || !!periodError;

  const submit = async () => {
    if (invalid) return;
    setLoading(true);
    setError(null);
    try {
      if (doc) {
        await hrEmployeeApi.updateIdentityDocument(employeeId, doc.id, {
          version: doc.version,
          ...(number ? { number } : {}),
          issuedOn: issuedOn || null,
          expiresOn: expiresOn || null,
          issuedPlace: issuedPlace.trim() || null,
        });
      } else {
        await hrEmployeeApi.createIdentityDocument(employeeId, {
          documentType,
          number,
          issuedOn: issuedOn || null,
          expiresOn: expiresOn || null,
          issuedPlace: issuedPlace.trim() || null,
        });
      }
      setNumber("");
      toast.success(doc ? "Đã cập nhật giấy tờ." : "Đã thêm giấy tờ.");
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={doc ? "Sửa giấy tờ định danh" : "Thêm giấy tờ định danh"}
      submitLabel={doc ? "Lưu" : "Thêm"}
      loading={loading}
      disabled={invalid}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="Loại giấy tờ" required>
        <select
          className={`${selectClass} w-full`}
          value={documentType}
          disabled={!!doc}
          onChange={(e) => setDocumentType(e.target.value as HrIdentityDocumentType)}
        >
          {(doc ? [doc.documentType] : availableTypes).map((t) => (
            <option key={t} value={t}>
              {IDENTITY_DOCUMENT_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Số giấy tờ"
        required={!doc}
        hint={doc ? `Đang lưu: ${doc.numberMasked ?? "—"}. Để trống nếu không đổi.` : undefined}
        error={number ? numberError ?? undefined : undefined}
      >
        <input
          className={`${inputClass} font-mono`}
          value={number}
          autoComplete="off"
          spellCheck={false}
          inputMode={documentType === "CCCD" || documentType === "CMND" ? "numeric" : "text"}
          maxLength={64}
          onChange={(e) => setNumber(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày cấp">
          <input type="date" className={inputClass} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
        </Field>
        <Field label="Ngày hết hạn" error={periodError ?? undefined}>
          <input type="date" className={inputClass} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </Field>
      </div>
      <Field label="Nơi cấp">
        <input className={inputClass} value={issuedPlace} maxLength={255} onChange={(e) => setIssuedPlace(e.target.value)} />
      </Field>
      <HrFormError error={error} />
    </Modal>
  );
}
