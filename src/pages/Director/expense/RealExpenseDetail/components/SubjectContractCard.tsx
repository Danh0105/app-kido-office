import { ExternalLink, FileText } from "lucide-react";

import type { PolicyContractFile } from "@/types/policy";
import { resolveApiFileUrl } from "@/utils/fileUrl";

const formatSize = (bytes?: number) =>
  bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : "";

/**
 * Hợp đồng PDF của chính sách môn học đang xem — hiện ở đầu mỗi tab môn để kế
 * toán đối chiếu số liệu chi với hợp đồng mà không phải sang màn Chính sách.
 * Chỉ đọc; upload/xoá vẫn làm ở luồng duyệt chính sách.
 */
export default function SubjectContractCard({
  policy,
  subjectName,
}: {
  policy?: {
    contractFiles?: PolicyContractFile[] | null;
    contractFileUrl?: string | null;
    contractFileName?: string | null;
  } | null;
  subjectName?: string;
}) {
  // Dữ liệu cũ chỉ có một cặp url/name — quy về cùng dạng danh sách.
  type ContractLink = Pick<PolicyContractFile, "id" | "url" | "originalName"> &
    Partial<Pick<PolicyContractFile, "size">>;
  const files: ContractLink[] =
    policy?.contractFiles?.length
      ? policy.contractFiles
      : policy?.contractFileUrl
        ? [
            {
              id: "legacy",
              url: policy.contractFileUrl,
              originalName: policy.contractFileName || "Hợp đồng PDF",
            },
          ]
        : [];

  return (
    <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FileText size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">
            Hợp đồng{subjectName ? ` · ${subjectName}` : ""}
          </h3>
          <p className="text-xs font-semibold text-slate-400">
            {files.length > 0
              ? `${files.length} file PDF đính kèm chính sách đã duyệt`
              : "Chính sách này chưa có hợp đồng PDF"}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {files.map((file) => (
            <a
              key={file.id}
              href={resolveApiFileUrl(file.url)}
              target="_blank"
              rel="noopener noreferrer"
              title={file.originalName}
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              <FileText size={15} className="shrink-0" />
              <span className="truncate">{file.originalName}</span>
              {file.size ? (
                <span className="shrink-0 text-xs font-normal text-slate-400">
                  {formatSize(file.size)}
                </span>
              ) : null}
              <ExternalLink size={13} className="shrink-0" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
