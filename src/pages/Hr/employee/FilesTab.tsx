import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Archive, Download, Upload } from "lucide-react";
import Modal, { Field } from "@/pages/Teaching/components/Modal";
import { selectClass } from "@/pages/Teaching/components/Shared";
import { hrEmployeeApi, hrFileApi, type HrFileItem } from "@/service/hr/hr.api";
import {
  HrBadge,
  HrCard,
  HrEmpty,
  HrErrorState,
  HrFormError,
  HrLoading,
  StatusBadge,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
} from "../components/HrUi";
import HrFilePicker, { isPickedFileValid } from "../components/HrFilePicker";
import ReasonDialog from "../components/ReasonDialog";
import { downloadHrFile } from "./downloadHrFile";
import { formatVnDate } from "../lib/hrAccess";
import {
  DOCUMENT_TYPE_LABELS,
  FILES_TAB_TYPES,
  IDENTITY_FILE_TYPES,
  SCAN_STATUS_LABELS,
  UPLOADABLE_DOCUMENT_TYPES,
  canRequestFileAccess,
  fileNeedsReason,
  formatBytes,
  type HrFileDocumentType,
} from "../lib/hrFiles";
import { IDENTITY_DOCUMENT_LABELS } from "../lib/hrIdentifiers";
import type { EmployeeTabProps } from "./types";

/**
 * Tài liệu HR riêng tư của nhân viên. Không có link tĩnh tới kho: tải =
 * POST .../access (quyền + phạm vi + lý do) → URL/token 5 phút → tải blob.
 * Token chỉ nằm trong biến cục bộ của hàm tải, không lưu ở đâu.
 */
export default function FilesTab({ employee, access, canEdit }: EmployeeTabProps) {
  const queryClient = useQueryClient();
  const key = ["hr", "files", employee.id];
  const files = useQuery({ queryKey: key, queryFn: () => hrFileApi.list(employee.id), retry: false });
  // Phase 1.3: lý lịch, bằng cấp, chứng chỉ, giấy khám, "Tài liệu khác" ở tab Tài liệu.
  const shown = (files.data ?? []).filter((f) => FILES_TAB_TYPES.includes(f.documentType));
  const [uploading, setUploading] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<HrFileItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<HrFileItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<unknown>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const download = async (file: HrFileItem, reason?: string) => {
    setBusy(true);
    setDialogError(null);
    try {
      await downloadHrFile(file.id, file.originalName, reason);
      setDownloadTarget(null);
    } catch (err) {
      setDialogError(err);
      if (!downloadTarget) toast.error("Không tải được tài liệu.");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (reason: string) => {
    if (!archiveTarget) return;
    setBusy(true);
    setDialogError(null);
    try {
      await hrFileApi.archive(archiveTarget.id, archiveTarget.version, reason);
      toast.success("Đã lưu trữ tài liệu.");
      setArchiveTarget(null);
      refresh();
    } catch (err) {
      setDialogError(err);
    } finally {
      setBusy(false);
    }
  };

  const onDownloadClick = (file: HrFileItem) => {
    setDialogError(null);
    if (fileNeedsReason(file.classification)) setDownloadTarget(file);
    else void download(file);
  };

  return (
    <HrCard
      title="File định danh & ngân hàng"
      action={
        canEdit && (
          <button className={buttonPrimary} onClick={() => setUploading(true)}>
            <Upload size={16} /> Tải lên
          </button>
        )
      }
    >
      {files.isLoading ? (
        <HrLoading />
      ) : files.isError ? (
        <HrErrorState error={files.error} onRetry={() => files.refetch()} />
      ) : !shown.length ? (
        <HrEmpty title="Chưa có file định danh / ngân hàng" description="Lý lịch, bằng cấp, chứng chỉ, giấy khám và tài liệu khác nằm ở tab Tài liệu." />
      ) : (
        <div className="space-y-2">
          {shown.map((f) => {
            const downloadable = canRequestFileAccess(f, access);
            const scan = SCAN_STATUS_LABELS[f.scanStatus];
            return (
              <div key={f.id} className="rounded-xl border border-gray-100 p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium break-all">
                      {f.originalName ?? <span className="text-gray-400 italic">Tên file ẩn (cần quyền xem nội dung)</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {DOCUMENT_TYPE_LABELS[f.documentType] ?? f.documentType} · {formatBytes(f.sizeBytes)} ·{" "}
                      {formatVnDate(f.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge value={f.classification} />
                    <StatusBadge value={f.scanStatus} label={scan?.label ?? f.scanStatus} title={scan?.hint} />
                    {f.status !== "ACTIVE" && <StatusBadge value={f.status} />}
                  </div>
                </div>
                {f.scanStatus === "NOT_SCANNED" && (
                  <p className="text-[11px] text-amber-700">{SCAN_STATUS_LABELS.NOT_SCANNED.hint}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {downloadable && (
                    <button className={buttonSecondary} disabled={busy} onClick={() => onDownloadClick(f)}>
                      <Download size={14} /> Tải
                    </button>
                  )}
                  {canEdit && f.status === "ACTIVE" && (
                    <button className={buttonDanger} onClick={() => setArchiveTarget(f)}>
                      <Archive size={14} /> Lưu trữ
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {uploading && (
        <UploadDialog
          employeeId={employee.id}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            refresh();
          }}
        />
      )}
      {downloadTarget && (
        <ReasonDialog
          title="Tải tài liệu hạn chế"
          description={
            <p>
              <HrBadge tone="danger">{downloadTarget.classification}</HrBadge>{" "}
              {DOCUMENT_TYPE_LABELS[downloadTarget.documentType]} — lượt tải được ghi vào nhật ký HR.
            </p>
          }
          submitLabel="Tải xuống"
          loading={busy}
          error={dialogError}
          onClose={() => setDownloadTarget(null)}
          onSubmit={(reason) => download(downloadTarget, reason)}
        />
      )}
      {archiveTarget && (
        <ReasonDialog
          title="Lưu trữ tài liệu"
          description={
            <p>
              Tài liệu sẽ chuyển sang trạng thái <b>lưu trữ</b>: không còn tải được qua giao diện nhưng vẫn được
              giữ lại trong hệ thống (không xoá vĩnh viễn).
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

function UploadDialog({ employeeId, onClose, onDone }: { employeeId: number; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<HrFileDocumentType>("IDENTITY_FRONT");
  const [identityDocumentId, setIdentityDocumentId] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const needsIdentity = IDENTITY_FILE_TYPES.includes(documentType);
  const docs = useQuery({
    queryKey: ["hr", "identity-documents", employeeId],
    queryFn: () => hrEmployeeApi.identityDocuments(employeeId),
    enabled: needsIdentity,
    retry: false,
  });
  const invalid = !isPickedFileValid(file) || (needsIdentity && !identityDocumentId);

  const pick = (f: File | null) => {
    setError(null);
    setFile(f);
  };

  const submit = async () => {
    if (invalid || !file) return;
    setError(null);
    setProgress(0);
    try {
      await hrFileApi.upload(
        employeeId,
        file,
        documentType,
        needsIdentity ? Number(identityDocumentId) : undefined,
        setProgress,
      );
      toast.success("Đã tải lên tài liệu.");
      setFile(null);
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setProgress(null);
    }
  };

  return (
    <Modal
      title="Tải lên tài liệu"
      submitLabel={progress !== null ? `Đang tải ${progress}%` : "Tải lên"}
      loading={progress !== null}
      disabled={invalid}
      onClose={onClose}
      onSubmit={submit}
    >
      <Field label="Loại tài liệu" required hint="Mức phân loại do hệ thống quyết định theo loại tài liệu.">
        <select
          className={`${selectClass} w-full`}
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as HrFileDocumentType)}
        >
          {UPLOADABLE_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      {needsIdentity && (
        <Field label="Giấy tờ" required>
          <select
            className={`${selectClass} w-full`}
            value={identityDocumentId}
            onChange={(e) => setIdentityDocumentId(e.target.value)}
          >
            <option value="">— Chọn giấy tờ —</option>
            {(docs.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {IDENTITY_DOCUMENT_LABELS[d.documentType] ?? d.documentType} ({d.numberMasked})
              </option>
            ))}
          </select>
          {docs.data && !docs.data.length && (
            <p className="text-xs text-amber-700 mt-1">Hãy thêm giấy tờ ở tab Định danh trước.</p>
          )}
        </Field>
      )}
      <HrFilePicker file={file} onPick={pick} />
      {progress !== null && (
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <HrFormError error={error} />
    </Modal>
  );
}
