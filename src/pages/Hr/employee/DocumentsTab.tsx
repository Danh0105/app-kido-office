import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Archive, Download, FilePlus2, History, Pencil, Upload } from "lucide-react";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { selectClass } from "@/pages/Teaching/components/Shared";
import { hrDocumentApi, type HrDocument, type HrDocumentFile } from "@/service/hr/hr.api";
import HrFilePicker, { isPickedFileValid } from "../components/HrFilePicker";
import { HrAlert, HrBadge, HrCard, HrEmpty, HrErrorState, HrFormError, HrLoading, StatusBadge, buttonDanger, buttonPrimary, buttonSecondary } from "../components/HrUi";
import ReasonDialog from "../components/ReasonDialog";
import { formatVnDate, hrCapabilities, vnToday } from "../lib/hrAccess";
import {
  DOCUMENT_POLICY,
  DOCUMENT_TYPES,
  EXPIRY_STATUS_VIEW,
  createDocumentFields,
  documentFormFrom,
  documentFormProblems,
  documentPatch,
  emptyDocumentForm,
  type DocumentForm,
  type HrDocumentType,
} from "../lib/hrDocuments";
import { SCAN_STATUS_LABELS, fileNeedsReason, formatBytes } from "../lib/hrFiles";
import { downloadHrFile } from "./downloadHrFile";
import type { EmployeeTabProps } from "./types";

const isoToVn = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

/**
 * Hồ sơ tài liệu (Phase 1.3). Mỗi phiên bản là một file 0.4C: tải = cùng luồng
 * POST .../access (quyền + phạm vi + lý do) → token 5 phút như tab File.
 */
export default function DocumentsTab({ employee, access }: EmployeeTabProps) {
  const queryClient = useQueryClient();
  const caps = hrCapabilities(access);
  const [showArchived, setShowArchived] = useState(false);
  const key = ["hr", "documents", employee.id, showArchived];
  const list = useQuery({
    queryKey: key,
    queryFn: () => hrDocumentApi.list(employee.id, showArchived ? "ALL" : "ACTIVE"),
    retry: false,
  });
  const [creating, setCreating] = useState(false);
  const [versionTarget, setVersionTarget] = useState<HrDocument | null>(null);
  const [editTarget, setEditTarget] = useState<HrDocument | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<HrDocument | null>(null);
  const [downloadTarget, setDownloadTarget] = useState<{ file: HrDocumentFile; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<unknown>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["hr", "documents", employee.id] });

  const download = async (file: HrDocumentFile, reason?: string) => {
    setBusy(true);
    setDialogError(null);
    try {
      await downloadHrFile(file.id, file.originalName, reason);
      setDownloadTarget(null);
    } catch (err) {
      setDialogError(err);
      if (!reason) toast.error("Không tải được tài liệu.");
    } finally {
      setBusy(false);
    }
  };
  const onDownload = (file: HrDocumentFile, label: string) => {
    setDialogError(null);
    if (fileNeedsReason(file.classification)) setDownloadTarget({ file, label });
    else void download(file);
  };
  const archive = async (reason: string) => {
    if (!archiveTarget) return;
    setBusy(true);
    setDialogError(null);
    try {
      await hrDocumentApi.archive(archiveTarget.id, archiveTarget.version, reason);
      toast.success("Đã lưu trữ tài liệu.");
      setArchiveTarget(null);
      refresh();
    } catch (err) {
      setDialogError(err);
    } finally {
      setBusy(false);
    }
  };

  const docs = list.data?.documents ?? [];
  const legacy = list.data?.legacyOtherFiles ?? [];

  return (
    <HrCard
      title="Tài liệu"
      action={
        caps.canManageDocuments && (
          <button className={buttonPrimary} onClick={() => setCreating(true)}>
            <FilePlus2 size={16} /> Thêm tài liệu
          </button>
        )
      }
    >
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Hiện cả tài liệu đã lưu trữ
      </label>
      {list.isLoading ? (
        <HrLoading />
      ) : list.isError ? (
        <HrErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !docs.length && !legacy.length ? (
        <HrEmpty title="Chưa có tài liệu" />
      ) : (
        <div className="space-y-3">
          {docs.map((d) => {
            const policy = DOCUMENT_POLICY[d.documentType];
            const expiry = d.expiryStatus ? EXPIRY_STATUS_VIEW[d.expiryStatus] : null;
            const current = d.versions.find((v) => v.current) ?? d.versions[0];
            return (
              <div key={d.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{d.title}</p>
                    <p className="text-xs text-gray-500">
                      {policy?.label ?? d.documentType}
                      {d.issuer && ` · ${d.issuer}`} · Cấp: {isoToVn(d.issuedOn)} · Hết hạn: {isoToVn(d.expiresOn)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge value={d.classification} />
                    {expiry && <HrBadge tone={expiry.tone}>{expiry.label}</HrBadge>}
                    {d.status !== "ACTIVE" && <StatusBadge value={d.status} label="Đã lưu trữ" />}
                  </div>
                </div>
                {d.note && <p className="text-xs text-gray-600 whitespace-pre-wrap">{d.note}</p>}
                {!d.canViewContent && policy?.sensitive && (
                  <HrAlert tone="info">Cần quyền "Xem giấy khám sức khỏe" để xem nội dung, tên file và ghi chú.</HrAlert>
                )}
                {d.status === "ARCHIVED" && d.archiveReason && (
                  <p className="text-xs text-gray-500">Lý do lưu trữ: {d.archiveReason}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {current?.canDownload && current.file && (
                    <button className={buttonSecondary} disabled={busy} onClick={() => onDownload(current!.file!, d.title)}>
                      <Download size={14} /> Tải bản hiện hành
                    </button>
                  )}
                  {caps.canManageDocuments && d.status === "ACTIVE" && (
                    <>
                      <button className={buttonSecondary} onClick={() => setVersionTarget(d)}>
                        <Upload size={14} /> Thêm phiên bản
                      </button>
                      <button className={buttonSecondary} onClick={() => setEditTarget(d)}>
                        <Pencil size={14} /> Sửa thông tin
                      </button>
                      <button className={buttonDanger} onClick={() => setArchiveTarget(d)}>
                        <Archive size={14} /> Lưu trữ
                      </button>
                    </>
                  )}
                </div>
                {d.versions.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 inline-flex items-center gap-1">
                      <History size={12} /> Lịch sử phiên bản ({d.versions.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {d.versions.map((v) => (
                        <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1">
                          <span>
                            <b>v{v.versionNo}</b>
                            {v.current && " (hiện hành)"} · {formatVnDate(v.createdAt)}
                            {v.file && ` · ${formatBytes(v.file.sizeBytes)} · ${SCAN_STATUS_LABELS[v.file.scanStatus]?.label ?? v.file.scanStatus}`}
                            {v.file?.originalName && ` · ${v.file.originalName}`}
                            {v.changeNote && ` — ${v.changeNote}`}
                          </span>
                          {v.canDownload && v.file && (
                            <button className="text-blue-600 hover:underline" disabled={busy} onClick={() => onDownload(v.file!, `${d.title} (v${v.versionNo})`)}>
                              Tải
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
          {legacy.length > 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 p-3 space-y-2">
              <p className="text-sm font-medium">Tài liệu khác (tải lên trước đây)</p>
              {legacy.map(({ file, canDownload: legacyDownload }) => (
                <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="break-all">
                    {file.originalName ?? <i className="text-gray-400">Tên file ẩn</i>} · {formatBytes(file.sizeBytes)} · {formatVnDate(file.createdAt)}
                  </span>
                  {legacyDownload && (
                    <button className="text-blue-600 hover:underline" disabled={busy} onClick={() => onDownload(file, "Tài liệu khác")}>
                      Tải
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {creating && (
        <CreateDocumentDialog
          employeeId={employee.id}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
      {versionTarget && (
        <AddVersionDialog
          document={versionTarget}
          onClose={() => setVersionTarget(null)}
          onDone={() => {
            setVersionTarget(null);
            refresh();
          }}
        />
      )}
      {editTarget && (
        <EditDocumentDialog
          document={editTarget}
          onClose={() => setEditTarget(null)}
          onDone={() => {
            setEditTarget(null);
            refresh();
          }}
        />
      )}
      {downloadTarget && (
        <ReasonDialog
          title="Xem tài liệu"
          description={
            <p>
              <HrBadge tone={downloadTarget.file.classification === "RESTRICTED" ? "danger" : "warning"}>
                {downloadTarget.file.classification}
              </HrBadge>{" "}
              {downloadTarget.label} — lượt xem được ghi vào nhật ký HR.
            </p>
          }
          submitLabel="Tải xuống"
          loading={busy}
          error={dialogError}
          onClose={() => setDownloadTarget(null)}
          onSubmit={(reason) => download(downloadTarget.file, reason)}
        />
      )}
      {archiveTarget && (
        <ReasonDialog
          title="Lưu trữ tài liệu"
          description={
            <p>
              Tài liệu và mọi phiên bản sẽ chuyển sang trạng thái <b>lưu trữ</b>: không còn tải được nhưng vẫn được giữ lại
              (không xoá vĩnh viễn).
            </p>
          }
          submitLabel="Lưu trữ"
          submitColor="bg-red-500"
          loading={busy}
          error={dialogError}
          onClose={() => setArchiveTarget(null)}
          onSubmit={archive}
        />
      )}
    </HrCard>
  );
}

function MetadataFields({
  form,
  onChange,
  typeLocked,
  hideNote = false,
}: {
  form: DocumentForm;
  onChange: (f: DocumentForm) => void;
  typeLocked: boolean;
  /** Giấy khám mà người sửa không xem được nội dung: ghi chú đang ẩn → không cho sửa (tránh ghi đè mù). */
  hideNote?: boolean;
}) {
  const today = vnToday();
  const policy = DOCUMENT_POLICY[form.documentType];
  const set = <K extends keyof DocumentForm>(k: K, v: DocumentForm[K]) => onChange({ ...form, [k]: v });
  return (
    <>
      <Field label="Loại tài liệu" required hint="Mức phân loại do hệ thống quyết định theo loại tài liệu.">
        <select
          className={`${selectClass} w-full`}
          value={form.documentType}
          disabled={typeLocked}
          onChange={(e) => {
            const t = e.target.value as HrDocumentType;
            onChange({ ...form, documentType: t, expiresOn: DOCUMENT_POLICY[t].expiry === "NONE" ? "" : form.expiresOn });
          }}
        >
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_POLICY[t].label}
            </option>
          ))}
        </select>
      </Field>
      {policy.sensitive && (
        <HrAlert tone="warning">Dữ liệu sức khoẻ: chỉ người được cấp quyền riêng mới xem được nội dung (mọi lượt xem có lý do và được ghi nhật ký).</HrAlert>
      )}
      <Field label="Tiêu đề" required>
        <input className={inputClass} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="Nơi cấp">
        <input className={inputClass} value={form.issuer} maxLength={200} onChange={(e) => set("issuer", e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ngày cấp">
          <input type="date" className={inputClass} max={today} value={form.issuedOn} onChange={(e) => set("issuedOn", e.target.value)} />
        </Field>
        <Field
          label="Ngày hết hạn"
          required={policy.expiry === "REQUIRED"}
          hint={policy.expiry === "NONE" ? "Loại này không có hạn." : "Ngày cuối còn hiệu lực."}
        >
          <input
            type="date"
            className={inputClass}
            min={form.issuedOn || undefined}
            disabled={policy.expiry === "NONE"}
            value={form.expiresOn}
            onChange={(e) => set("expiresOn", e.target.value)}
          />
        </Field>
      </div>
      {!hideNote && (
        <Field label="Ghi chú">
          <textarea className={inputClass} rows={2} maxLength={2000} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      )}
    </>
  );
}

function Problems({ problems }: { problems: string[] }) {
  if (!problems.length) return null;
  return (
    <ul className="list-disc pl-5 text-xs text-amber-700">
      {problems.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  );
}

function CreateDocumentDialog({ employeeId, onClose, onDone }: { employeeId: number; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(() => emptyDocumentForm());
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const problems = [...documentFormProblems(form, vnToday()), ...(file ? [] : ["Chọn file."])];
  const submit = async () => {
    if (problems.length || !isPickedFileValid(file)) return;
    setLoading(true);
    setError(null);
    try {
      await hrDocumentApi.create(employeeId, createDocumentFields(form), file);
      toast.success("Đã thêm tài liệu.");
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title="Thêm tài liệu" submitLabel="Tải lên" loading={loading} disabled={problems.length > 0 || !isPickedFileValid(file)} onClose={onClose} onSubmit={submit} wide>
      <MetadataFields form={form} onChange={setForm} typeLocked={false} />
      <HrFilePicker file={file} onPick={setFile} />
      {form.title.trim() && <Problems problems={problems} />}
      <HrFormError error={error} />
    </Modal>
  );
}

function AddVersionDialog({ document: doc, onClose, onDone }: { document: HrDocument; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async () => {
    if (!isPickedFileValid(file)) return;
    setLoading(true);
    setError(null);
    try {
      await hrDocumentApi.addVersion(doc.id, doc.version, file, changeNote.trim() || undefined);
      toast.success("Đã thêm phiên bản mới.");
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={`Thêm phiên bản — ${doc.title}`} submitLabel="Tải lên" loading={loading} disabled={!isPickedFileValid(file)} onClose={onClose} onSubmit={submit}>
      <p className="text-xs text-gray-500">Phiên bản cũ vẫn được giữ và xem lại được trong lịch sử.</p>
      <HrFilePicker file={file} onPick={setFile} />
      <Field label="Ghi chú thay đổi">
        <input className={inputClass} maxLength={500} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
      </Field>
      <HrFormError error={error} />
    </Modal>
  );
}

function EditDocumentDialog({ document: doc, onClose, onDone }: { document: HrDocument; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(() => documentFormFrom(doc.documentType, doc));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const problems = documentFormProblems(form, vnToday());
  const noteHidden = !doc.canViewContent && DOCUMENT_POLICY[doc.documentType].sensitive;
  const patch = documentPatch(doc, form);
  if (noteHidden) delete patch.note;
  const changed = Object.keys(patch).length > 0;
  const submit = async () => {
    if (problems.length || !changed) return;
    setLoading(true);
    setError(null);
    try {
      await hrDocumentApi.update(doc.id, { ...patch, version: doc.version });
      toast.success("Đã cập nhật tài liệu.");
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal title={`Sửa thông tin — ${doc.title}`} submitLabel="Lưu" loading={loading} disabled={problems.length > 0 || !changed} onClose={onClose} onSubmit={submit} wide>
      <MetadataFields form={form} onChange={setForm} typeLocked hideNote={noteHidden} />
      <Problems problems={problems} />
      <HrFormError error={error} />
    </Modal>
  );
}
