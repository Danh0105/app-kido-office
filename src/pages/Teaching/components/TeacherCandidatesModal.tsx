import { useState } from "react";
import type { TeacherCandidate, TeacherCandidatesResult } from "@/types/teaching";
import Modal from "./Modal";

const reasonStyle = {
  PASS: "text-emerald-700 bg-emerald-50",
  UNKNOWN: "text-amber-700 bg-amber-50",
  FAIL: "text-red-700 bg-red-50",
};

export default function TeacherCandidatesModal({ result, context, onClose, onPick }: {
  result: TeacherCandidatesResult;
  context: string;
  onClose: () => void;
  onPick: (teacher: TeacherCandidate) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? result.candidates : result.candidates.filter((x) => x.eligible);
  const eligibleCount = result.candidates.filter((x) => x.eligible).length;

  return <Modal title="Gợi ý giáo viên" wide cancelLabel="Đóng" onClose={onClose}>
    <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{context}</p>
    {(result.warnings || []).map((warning) => <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{warning}</p>)}
    <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)}/>Hiện giáo viên không phù hợp</label>
    {eligibleCount === 0 && !showAll && <div className="rounded-xl border border-dashed p-5 text-center"><p className="text-sm text-gray-600">Chưa có giáo viên phù hợp với trường, môn và khung giờ đã chọn.</p><button type="button" onClick={() => setShowAll(true)} className="mt-2 text-sm font-medium text-blue-600">Hiện tất cả và xem lý do</button></div>}
    {visible.map((candidate) => {
      const disabledReason = candidate.reasons.filter((x) => x.kind !== "PASS").map((x) => x.message).join(" · ");
      return <article key={candidate.teacherId} className="rounded-2xl border border-gray-200 p-3">
        <div className="flex flex-wrap items-center gap-2"><b className="mr-auto text-gray-800">{candidate.teacherName}</b><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{candidate.score}/100</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${candidate.eligible ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{candidate.eligible ? "Phù hợp" : "Không phù hợp"}</span></div>
        <div className="mt-2 grid gap-1 text-xs text-gray-600 sm:grid-cols-2"><p>{candidate.distanceKm == null ? "Chưa có dữ liệu khoảng cách" : `Cách trường ${candidate.distanceKm.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`}</p><p>{candidate.maxPeriodsPerWeek == null ? `Đang dạy ${candidate.assignedPeriodsInWeek} tiết/tuần · chưa khai giới hạn` : `${candidate.assignedPeriodsInWeek}/${candidate.maxPeriodsPerWeek} tiết/tuần`}</p></div>
        <div className="mt-2 space-y-1">{candidate.reasons.map((reason, index) => <p key={`${reason.code}-${index}`} className={`rounded-lg px-2 py-1 text-xs ${reasonStyle[reason.kind]}`}>{reason.kind === "PASS" ? "✓" : reason.kind === "FAIL" ? "✕" : "?"} {reason.message}</p>)}</div>
        <button type="button" disabled={!candidate.eligible} title={!candidate.eligible ? disabledReason : undefined} onClick={() => onPick(candidate)} className="mt-3 w-full rounded-xl bg-blue-500 py-2 text-sm font-medium text-white disabled:bg-gray-200 disabled:text-gray-500">Chọn giáo viên</button>
      </article>;
    })}
  </Modal>;
}
