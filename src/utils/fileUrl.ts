/** Giữ URL tuyệt đối từ backend; chỉ ghép API origin cho đường dẫn tương đối. */
export function resolveApiFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const apiOrigin = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${apiOrigin}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
}
