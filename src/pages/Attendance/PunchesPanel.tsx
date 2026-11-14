import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, RefreshCw, Search } from "lucide-react";

import { attendanceApi, attendanceError, type Punch } from "@/service/attendance";
import { fmtDay, fmtTime, methodLabel, todayVN } from "./lib";
import { Badge, Empty, ErrorBox, Modal, Spinner, inputClass, secondaryBtn } from "./ui";

/** Ảnh chụp lúc chấm (chỉ Quản trị). Tải bằng token rồi hiển thị qua object URL, không lưu cache. */
export function PunchImageModal({ punch, onClose }: { punch: Punch; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["attendance", "image", punch.id],
    queryFn: () => attendanceApi.punchImage(punch.id),
    gcTime: 0,
    staleTime: 0,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const u = URL.createObjectURL(q.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [q.data]);

  return (
    <Modal title={`Ảnh lúc chấm — ${punch.full_name || `NV ${punch.employee_no}`}`} onClose={onClose}>
      <p className="mb-3 text-xs text-slate-500">
        {fmtTime(punch.time, true)} · {methodLabel(punch.method)}. Ảnh là dữ liệu cá nhân, chỉ dùng để đối chiếu
        chấm công và tự xoá sau 90 ngày.
      </p>
      {q.isLoading && <Spinner label="Đang tải ảnh…" />}
      {q.isError && <ErrorBox message={attendanceError(q.error, "Không tải được ảnh.")} />}
      {url && (
        <img
          src={url}
          alt="Ảnh chụp lúc chấm công"
          className="mx-auto max-h-[60vh] rounded-2xl border border-slate-100 object-contain"
        />
      )}
    </Modal>
  );
}

export function PunchRow({
  punch,
  isAdmin,
  onImage,
  showEmployee = true,
}: {
  punch: Punch;
  isAdmin: boolean;
  onImage: (p: Punch) => void;
  showEmployee?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <span className="w-20 font-mono text-sm font-bold text-slate-900">{fmtTime(punch.time, true)}</span>
      {showEmployee && (
        <span className="min-w-[10rem] flex-1">
          <span className="block text-sm font-bold text-slate-800">
            {punch.full_name || <span className="text-amber-700">Chưa khớp nhân viên</span>}
          </span>
          <span className="text-[11px] text-slate-500">
            Mã NV {punch.employee_no}
            {punch.department ? ` · ${punch.department}` : ""}
          </span>
        </span>
      )}
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone="blue">{methodLabel(punch.method)}</Badge>
        {punch.kind === "unclassified" && <Badge tone="amber">Chưa phân loại — không tính công</Badge>}
        {!punch.matched && <Badge tone="amber">Chưa khớp</Badge>}
      </span>
      {isAdmin && punch.has_image && (
        <button type="button" onClick={() => onImage(punch)} className={`${secondaryBtn} h-8 px-3`}>
          <ImageIcon className="h-3.5 w-3.5" /> Ảnh
        </button>
      )}
    </li>
  );
}

/** Các lần chấm của MỘT nhân viên trong một ngày (mở từ tab Hôm nay). */
export function EmployeeDayModal({
  employeeNo,
  name,
  date,
  isAdmin,
  onClose,
}: {
  employeeNo: string;
  name: string;
  date: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [image, setImage] = useState<Punch | null>(null);
  const q = useQuery({
    queryKey: ["attendance", "punches", date, employeeNo],
    queryFn: () => attendanceApi.punches(date, employeeNo),
  });
  const punches = useMemo(() => [...(q.data?.punches ?? [])].reverse(), [q.data]);

  return (
    <>
      <Modal title={`${name} · ${fmtDay(date)}`} onClose={onClose}>
        {q.isLoading && <Spinner />}
        {q.isError && <ErrorBox message={attendanceError(q.error)} onRetry={() => q.refetch()} />}
        {q.data && punches.length === 0 && <Empty>Không có lần chấm nào trong ngày.</Empty>}
        {punches.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {punches.map((p) => (
              <PunchRow key={p.id} punch={p} isAdmin={isAdmin} onImage={setImage} showEmployee={false} />
            ))}
          </ul>
        )}
      </Modal>
      {image && <PunchImageModal punch={image} onClose={() => setImage(null)} />}
    </>
  );
}

export default function PunchesPanel({ isAdmin }: { isAdmin: boolean }) {
  const [date, setDate] = useState(todayVN());
  const [employeeNo, setEmployeeNo] = useState("");
  const [image, setImage] = useState<Punch | null>(null);
  const isToday = date === todayVN();

  const q = useQuery({
    queryKey: ["attendance", "punches", date, employeeNo.trim()],
    queryFn: () => attendanceApi.punches(date, employeeNo.trim()),
    placeholderData: keepPreviousData,
    refetchInterval: isToday ? 15_000 : false,
  });
  const punches = q.data?.punches ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-40">
          <span className="text-xs font-bold text-slate-600">Ngày</span>
          <input
            type="date"
            value={date}
            max={todayVN()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="w-48">
          <span className="text-xs font-bold text-slate-600">Mã NV</span>
          <span className="relative mt-1 block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="Tất cả"
              className={`${inputClass} pl-9`}
            />
          </span>
        </label>
        <button type="button" onClick={() => q.refetch()} className={secondaryBtn} disabled={q.isFetching}>
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Làm mới
        </button>
        <span className="pb-3 text-xs text-slate-500">
          {punches.length} lần chấm{isToday ? " · tự cập nhật mỗi 15 giây" : ""}
        </span>
      </div>

      {q.isLoading && <Spinner />}
      {q.isError && <ErrorBox message={attendanceError(q.error)} onRetry={() => q.refetch()} />}
      {q.data && punches.length === 0 && <Empty>Không có lần chấm nào ngày {fmtDay(date)}.</Empty>}
      {punches.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-blue-100 bg-white">
          {punches.map((p) => (
            <PunchRow key={p.id} punch={p} isAdmin={isAdmin} onImage={setImage} />
          ))}
        </ul>
      )}
      {image && <PunchImageModal punch={image} onClose={() => setImage(null)} />}
    </div>
  );
}
