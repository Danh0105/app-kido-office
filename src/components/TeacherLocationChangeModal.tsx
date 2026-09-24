import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { toast } from "react-hot-toast";

import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { teacherApi, teacherLocationChangeApi } from "@/service/teaching";
import type { Teacher, TeacherLocationChangeRequest } from "@/types/teaching";
import { getApiErrorMessage } from "@/utils/apiError";
import { distanceInMeters, formatCoord, formatDistance, toLatLng } from "@/utils/geo";
import { hasRole } from "@/utils/auth";

type Props = { requestId: number; onClose: () => void; onReviewed?: (id: number, status: "approved" | "rejected") => void | Promise<void> };
const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
const statusLabel = { pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Không duyệt" };

export default function TeacherLocationChangeModal({ requestId, onClose, onReviewed }: Props) {
  const canReview = hasRole("nhansu", "giaovu");
  const [request, setRequest] = useState<TeacherLocationChangeRequest | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<"approve" | "reject" | null>(null);
  const [step, setStep] = useState<"detail" | "approve" | "reject">("detail");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (notifyProcessed = false) => {
    setLoading(true); setError("");
    try {
      const pending = await teacherLocationChangeApi.list("pending");
      let found = pending.find((item) => item.id === requestId) || null;
      if (!found) {
        const [approved, rejected] = await Promise.all([teacherLocationChangeApi.list("approved"), teacherLocationChangeApi.list("rejected")]);
        found = [...approved, ...rejected].find((item) => item.id === requestId) || null;
        if (found && notifyProcessed) {
          toast("Yêu cầu này đã được xử lý", {
            id: `teacher-location-processed-${requestId}`,
          });
        }
      }
      if (!found) throw new Error("Yêu cầu thay đổi vị trí không còn tồn tại");
      setTeacher(await teacherApi.findOne(found.teacherId));
      setRequest(found); setStep("detail");
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause, cause instanceof Error ? cause.message : "Không tải được yêu cầu"));
    } finally { setLoading(false); }
  }, [requestId]);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => { if (step === "reject") noteRef.current?.focus(); }, [step]);

  const review = async (action: "approve" | "reject") => {
    if (!request || processing) return;
    const cleanNote = note.trim();
    if (action === "reject" && cleanNote.length < 3) { setError("Lý do từ chối phải có ít nhất 3 ký tự"); noteRef.current?.focus(); return; }
    setProcessing(action); setError("");
    try {
      if (action === "approve") await teacherLocationChangeApi.approve(request.id, cleanNote);
      else await teacherLocationChangeApi.reject(request.id, cleanNote);
      const status = action === "approve" ? "approved" : "rejected";
      const name = request.teacherName || teacher?.name || "giáo viên";
      toast.success(action === "approve" ? `Đã cập nhật vị trí mới cho ${name}` : `Đã từ chối yêu cầu thay đổi vị trí của ${name}`);
      setRequest((current) => current ? { ...current, status, reviewNote: cleanNote || null, reviewedAt: new Date().toISOString() } : current);
      setStep("detail"); await onReviewed?.(request.id, status);
    } catch (cause: unknown) {
      const code = (cause as { response?: { status?: number } })?.response?.status;
      if (code === 409) {
        toast("Yêu cầu này đã được xử lý", {
          id: `teacher-location-processed-${requestId}`,
        });
        await load();
      }
      else if (code === 403) setError("Bạn không có quyền duyệt thay đổi vị trí");
      else if (code === 404) setError("Yêu cầu thay đổi vị trí không còn tồn tại");
      else setError(getApiErrorMessage(cause, "Không thể xử lý yêu cầu, vui lòng thử lại"));
    } finally { setProcessing(null); }
  };

  const previous = toLatLng({ latitude: request?.previousLatitude, longitude: request?.previousLongitude });
  const proposed = toLatLng(request);
  const distance = previous && proposed ? formatDistance(distanceInMeters(previous, proposed)) : null;
  const pending = request?.status === "pending";

  return <Modal title="Duyệt thay đổi vị trí giáo viên" onClose={onClose} wide hideFooter loading={!!processing}>
    {loading ? <p className="py-8 text-center text-sm text-gray-400">Đang tải thông tin…</p> : request && teacher ? <>
      <div className="grid gap-2 rounded-xl border bg-gray-50 p-3 text-sm sm:grid-cols-2">
        <p><span className="text-gray-500">Giáo viên:</span> <b>{request.teacherName || teacher.name}</b></p><p><span className="text-gray-500">Mã giáo viên:</span> #{request.teacherId}</p>
        <p><span className="text-gray-500">Thời gian gửi:</span> {new Date(request.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p><p><span className="text-gray-500">Trạng thái:</span> <b>{statusLabel[request.status]}</b></p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-xl border p-3 text-sm"><p className="flex items-center gap-1 font-medium"><MapPin size={15}/> Vị trí hiện tại</p><p className="my-2 text-xs text-gray-500">{previous ? `${formatCoord(previous.latitude)}, ${formatCoord(previous.longitude)}` : "Chưa có vị trí"}</p>{previous && <a href={mapsUrl(previous.latitude, previous.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600">Mở vị trí hiện tại <ExternalLink size={12}/></a>}</div>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm"><p className="flex items-center gap-1 font-medium text-teal-800"><MapPin size={15}/> Vị trí đề nghị</p><p className="my-2 text-xs text-teal-700">{proposed ? `${formatCoord(proposed.latitude)}, ${formatCoord(proposed.longitude)}` : "Tọa độ không hợp lệ"}</p>{proposed && <a href={mapsUrl(proposed.latitude, proposed.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-700">Mở vị trí đề nghị <ExternalLink size={12}/></a>}</div>
      </div>
      {distance && <p className="text-sm text-gray-600">Khoảng cách thay đổi: <b>{distance}</b></p>}
      {!pending && <div className="rounded-xl bg-gray-50 p-3 text-sm space-y-1"><p>Người xử lý: <b>{request.reviewerName || (request.reviewedBy ? `#${request.reviewedBy}` : "—")}</b></p><p>Thời gian: {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</p><p>Ghi chú: {request.reviewNote || "Không có"}</p></div>}
      {pending && canReview && step !== "detail" && <>{step === "approve" && <p className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">Xác nhận cập nhật vị trí mới cho <b>{request.teacherName || teacher.name}</b>?</p>}<Field label={step === "reject" ? "Lý do không duyệt" : "Ghi chú duyệt (tùy chọn)"} required={step === "reject"} error={error || undefined} hint="Tối đa 500 ký tự."><textarea ref={noteRef} value={note} maxLength={500} onChange={(event) => { setNote(event.target.value); setError(""); }} rows={3} className={inputClass}/></Field></>}
      {error && step === "detail" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {pending && canReview && <div className="flex flex-wrap gap-2 border-t pt-3"><button onClick={onClose} disabled={!!processing} className="flex-1 rounded-xl border py-2 text-sm">Đóng</button>{step === "detail" ? <><button onClick={() => setStep("reject")} className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-medium text-white">Không duyệt</button><button onClick={() => setStep("approve")} className="flex-1 rounded-xl bg-teal-600 py-2 text-sm font-medium text-white">Duyệt vị trí</button></> : <><button onClick={() => { setStep("detail"); setError(""); }} disabled={!!processing} className="flex-1 rounded-xl border py-2 text-sm">Quay lại</button><button onClick={() => void review(step)} disabled={!!processing} className={`flex-1 rounded-xl py-2 text-sm font-medium text-white disabled:opacity-60 ${step === "reject" ? "bg-red-500" : "bg-teal-600"}`}>{processing ? "Đang xử lý…" : step === "approve" ? `Xác nhận cập nhật cho ${request.teacherName || teacher.name}?` : "Xác nhận không duyệt"}</button></>}</div>}
    </> : <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error || "Không tìm thấy yêu cầu"}</p>}
  </Modal>;
}
