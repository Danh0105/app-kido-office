import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { subjectCatalogApi, type SubjectCatalog } from "@/service/subjectCatalog.api";
import { schoolClassApi, teachingBulkApi } from "@/service/teaching";
import type { BulkScheduleResult, SchoolClassWithSubject, Teacher } from "@/types/teaching";
import { getApiErrorMessage } from "@/utils/apiError";
import Modal, { Field, inputClass } from "./Modal";
import { DAY_OF_WEEK_OPTIONS } from "@/types/teaching";
import { currentSchoolYear, endOfMonth, startOfMonth, todayISO } from "../lib";
import SearchableSelect from "@/components/SearchableSelect";

type Props = { teachers: Teacher[]; onClose: () => void; onCreated: () => void };

export default function BulkScheduleWizard({ teachers, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [catalogs, setCatalogs] = useState<SubjectCatalog[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [schoolYear, setSchoolYear] = useState(currentSchoolYear());
  const [classes, setClasses] = useState<SchoolClassWithSubject[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [day, setDay] = useState("2");
  const [startTime, setStartTime] = useState("07:30");
  const [endTime, setEndTime] = useState("09:00");
  const [from, setFrom] = useState(startOfMonth(todayISO()));
  const [to, setTo] = useState(endOfMonth(todayISO()));
  const [generate, setGenerate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkScheduleResult | null>(null);

  useEffect(() => { subjectCatalogApi.list().then(setCatalogs).catch(() => toast.error("Không tải được danh mục môn")); }, []);

  const groups = useMemo(() => {
    const map = new Map<string, SchoolClassWithSubject[]>();
    classes.forEach((item) => map.set(item.schoolName, [...(map.get(item.schoolName) || []), item]));
    return [...map.entries()];
  }, [classes]);

  const loadClasses = async () => {
    if (!catalogId || !schoolYear.trim()) return toast.error("Vui lòng chọn môn và năm học");
    setLoading(true);
    try {
      const res = await schoolClassApi.list({ catalogId: Number(catalogId), schoolYear: schoolYear.trim(), isActive: true, limit: 200 });
      setClasses(res.data || []); setSelected([]); setStep(2);
    } catch (e) { toast.error(getApiErrorMessage(e, "Không tải được danh sách lớp")); }
    finally { setLoading(false); }
  };

  const toggle = (id: number) => setSelected((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  const save = async (ids = selected) => {
    if (!teacherId || !startTime || !endTime || !from || ids.length === 0) return toast.error("Vui lòng khai đủ giáo viên, thời gian và lớp");
    setLoading(true);
    try {
      const res = await teachingBulkApi.createSchedules({
        catalogId: Number(catalogId), schoolYear: schoolYear.trim(), teacherId: Number(teacherId),
        dayOfWeek: Number(day), startTime, endTime, effectiveFrom: from, effectiveTo: to || null,
        items: ids.map((classId) => ({ classId })),
        ...(generate ? { generateSessions: { fromDate: from, toDate: to || endOfMonth(from) } } : {}),
      });
      setResult(res); setStep(4); onCreated();
    } catch (e) { toast.error(getApiErrorMessage(e, "Áp môn hàng loạt thất bại")); }
    finally { setLoading(false); }
  };

  if (step === 4 && result) {
    const skipped = result.results.filter((row) => row.status === "SKIPPED");
    return <Modal title="Kết quả áp môn" submitLabel="Đóng" onClose={onClose} onSubmit={onClose}>
      <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Đã tạo <b>{result.created}</b> lịch, sinh <b>{result.sessionsCreated || 0}</b> buổi. <b>{result.skipped}</b> lớp bị bỏ qua.</p>
      {skipped.map((row) => <div key={row.classId} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm"><b>{row.schoolName} · {row.className}</b><p className="mt-1 text-xs text-amber-700">{row.reason}</p></div>)}
      {skipped.length > 0 && <button type="button" disabled={loading} onClick={() => save(skipped.map((x) => x.classId))} className="w-full rounded-xl border border-amber-300 py-2 text-sm font-medium text-amber-700">Thử lại các lớp bị bỏ qua</button>}
    </Modal>;
  }

  return <Modal title={`Áp môn cho nhiều lớp · Bước ${step}/3`} submitLabel={step === 1 ? "Xem lớp" : step === 2 ? "Tiếp tục" : "Tạo lịch"} loading={loading} onClose={onClose} onSubmit={() => step === 1 ? loadClasses() : step === 2 ? (selected.length ? setStep(3) : toast.error("Vui lòng chọn ít nhất một lớp")) : save()}>
    {step === 1 && <><Field label="Môn trong danh mục" required><SearchableSelect value={catalogId} onChange={setCatalogId} options={catalogs.map((item) => ({ id: item.id, name: `${item.code ? `[${item.code}] ` : ""}${item.name}` }))} placeholder="— Chọn môn —" searchPlaceholder="Tìm môn học…" /></Field><Field label="Năm học" required><input className={inputClass} maxLength={20} value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} /></Field></>}
    {step === 2 && <div className="space-y-3"><p className="text-xs text-gray-500">Chọn lớp thuộc nhiều trường. Lớp thiếu môn bị khoá và hiện nguyên lý do từ hệ thống.</p>{groups.map(([school, rows]) => { const enabled = rows.filter((x) => x.subjectStatus !== "MISSING"); return <div key={school} className="rounded-xl border p-3"><label className="flex gap-2 font-semibold"><input type="checkbox" disabled={enabled.length === 0} checked={enabled.length > 0 && enabled.every((x) => selected.includes(x.id))} onChange={() => setSelected((old) => enabled.every((x) => old.includes(x.id)) ? old.filter((id) => !enabled.some((x) => x.id === id)) : [...new Set([...old, ...enabled.map((x) => x.id)])])}/>{school}</label>{rows.map((x) => <label key={x.id} title={x.subjectReason || ""} className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={selected.includes(x.id)} disabled={x.subjectStatus === "MISSING"} onChange={() => toggle(x.id)}/><span>{x.name} <small className={x.subjectStatus === "MISSING" ? "text-red-500" : "text-gray-400"}>{x.subjectStatus === "RESOLVED" ? `· ${x.subjectName}` : x.subjectReason}</small></span></label>)}</div>; })}</div>}
    {step === 3 && <><Field label={`Giáo viên mặc định · ${selected.length} lớp`} required><SearchableSelect value={teacherId} onChange={setTeacherId} options={teachers} placeholder="— Chọn giáo viên —" searchPlaceholder="Tìm giáo viên…" /></Field><div className="grid grid-cols-3 gap-2"><Field label="Thứ"><select className={inputClass} value={day} onChange={(e) => setDay(e.target.value)}>{DAY_OF_WEEK_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field><Field label="Bắt đầu"><input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)}/></Field><Field label="Kết thúc"><input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)}/></Field></div><div className="grid grid-cols-2 gap-2"><Field label="Hiệu lực từ"><input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)}/></Field><Field label="Đến"><input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)}/></Field></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)}/>Sinh buổi luôn trong khoảng hiệu lực</label></>}
  </Modal>;
}
