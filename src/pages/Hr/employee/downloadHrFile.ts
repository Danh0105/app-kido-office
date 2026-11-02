import { hrFileApi } from "@/service/hr/hr.api";

/**
 * Tải nội dung một file HR (0.4C): POST .../access (quyền + phạm vi + lý do)
 * → URL/token 5 phút → tải blob → lưu. Token chỉ nằm trong biến cục bộ, không
 * lưu ở đâu. Dùng chung cho tab File và tab Tài liệu.
 *
 * SECURITY TODO: Move file token from query string to header before production rollout.
 */
export async function downloadHrFile(fileId: number, originalName: string | null, reason?: string): Promise<void> {
  const grant = await hrFileApi.requestAccess(fileId, reason);
  const blob = await hrFileApi.downloadBlob(grant.url);
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = originalName ?? `tai-lieu-${fileId}`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}
