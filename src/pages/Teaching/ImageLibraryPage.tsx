import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import SearchableSelect from "@/components/SearchableSelect";
import { teachingSessionApi } from "@/service/teaching";
import type { LessonImageLibraryItem, LessonImageQuery } from "@/types/teaching";
import { getEmployeeId } from "@/utils/auth";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { IMAGE_FILE_TYPE, saveBlob } from "@/utils/saveBlob";
import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import { EmptyState, FilterCard, Loading, Pagination, selectClass } from "./components/Shared";
import { usePagedList } from "./hooks/usePagedList";
import { useTeachingRefData } from "./hooks/useTeachingRefData";
import { formatDate, formatTime, isDateOrderValid, todayISO } from "./lib";

const PAGE_SIZE = 30;
type Photo = LessonImageLibraryItem;

/** Không gắn `src` cho tới khi ô ảnh gần vùng nhìn thấy — native lazy-load vẫn
 * có thể nạp sớm nhiều ảnh khi lưới dài, còn cách này giới hạn chặt hơn. */
function LazyThumbnail({ photo }: { photo: Photo }) {
  const ref = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const source = photo.thumbnailUrl || photo.url;
  return <img ref={ref} src={visible ? resolveApiFileUrl(source) : undefined}
    alt={`Ảnh báo giảng ${photo.session.teacherName || ""}`} loading="lazy"
    decoding="async" width={320} height={320}
    className="aspect-square w-full bg-slate-100 object-cover" />;
}

export default function ImageLibraryPage({ salesView = false }: { salesView?: boolean }) {
  // Kinh doanh: ô chọn trường chỉ gồm trường mình phụ trách, như màn TKB.
  const { schools, teachers, provinces } = useTeachingRefData(
    salesView ? { schoolsOfEmployee: Number(getEmployeeId()) || undefined } : undefined,
  );
  const [params, setParams] = useSearchParams();
  const value = (key: string) => params.get(key) || "";
  const update = (key: string, next: string, replace = false) => setParams((prev) => {
    const out = new URLSearchParams(prev);
    next ? out.set(key, next) : out.delete(key);
    if (key !== "page") out.delete("page");
    return out;
  }, { replace });
  const fromDate = value("fromDate") || todayISO();
  const toDate = value("toDate") || todayISO();
  const provinceId = value("provinceId");
  const schoolId = value("schoolId");
  const teacherId = value("teacherId");
  const search = value("search");
  const status = value("status");
  // Gõ tới đâu gọi API tới đó thì mỗi phím một request (kèm tạo thumbnail);
  // chờ ngừng gõ mới đẩy vào URL, và thay history để nút Back không đi qua từng ký tự.
  const [searchDraft, setSearchDraft] = useState(search);
  // URL đổi từ ngoài (Xoá lọc, Back) thì theo URL; còn lại giữ nguyên chữ đang gõ.
  useEffect(() => {
    setSearchDraft((draft) => (draft.trim() === search ? draft : search));
  }, [search]);
  useEffect(() => {
    if (searchDraft.trim() === search) return;
    const timer = window.setTimeout(() => update("search", searchDraft.trim(), true), 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft]); // eslint-disable-line react-hooks/exhaustive-deps
  const [preview, setPreview] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const schoolOptions = useMemo(() => provinceId
    ? schools.filter((school) => String(school.provinceId) === provinceId)
    : schools, [schools, provinceId]);
  const query = useMemo<LessonImageQuery>(() => ({
    fromDate, toDate,
    provinceId: !schoolId && provinceId ? Number(provinceId) : undefined,
    schoolId: schoolId ? Number(schoolId) : undefined,
    teacherId: teacherId ? Number(teacherId) : undefined,
    search: search || undefined,
    status: status as LessonImageQuery["status"] || undefined,
  }), [fromDate, toDate, provinceId, schoolId, teacherId, search, status]);
  const { items: photos, pagination, page, setPage, loading } = usePagedList<LessonImageLibraryItem, LessonImageQuery>({
    fetcher: teachingSessionApi.lessonImages, query, limit: PAGE_SIZE,
    enabled: isDateOrderValid(fromDate, toDate), errorMessage: "Không tải được ảnh báo giảng",
  });
  const active = preview == null ? null : photos[preview];
  const clear = () => setParams({ fromDate, toDate });
  /** Tải thẳng về máy: `download` trên thẻ <a> bị bỏ qua khi ảnh khác origin,
   * nên phải lấy blob rồi lưu. Nếu trình duyệt hỗ trợ thì mở hộp thoại chọn nơi lưu. */
  const download = async (photo: Photo) => {
    const url = resolveApiFileUrl(photo.url);
    const fileName = `bao-giang-${photo.session.date}-${photo.id}.jpg`;
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      await saveBlob(blob, fileName, IMAGE_FILE_TYPE);
    } catch {
      window.open(url, "_blank", "noreferrer");
    }
  };
  const toggle = (id: number) => setSelected((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const downloadSelected = async () => {
    const targets = photos.filter((photo) => selected.has(photo.id));
    // Tải tuần tự để chỉ giữ một blob trong RAM tại một thời điểm.
    for (const photo of targets) await download(photo);
  };

  return <TeachingLayout title={salesView ? "Hình ảnh giáo viên" : "Thư viện hình ảnh báo giảng"}>
    {!salesView && <TeachingTabs />}
    <FilterCard>
      <div className="flex min-w-[220px] flex-1 items-center gap-2"><input type="date" value={fromDate} onChange={(e) => update("fromDate", e.target.value)} className={selectClass} /><span>→</span><input type="date" value={toDate} onChange={(e) => update("toDate", e.target.value)} className={selectClass} /></div>
      <SearchableSelect value={provinceId} onChange={(v) => { update("provinceId", v); update("schoolId", ""); }} options={provinces} placeholder="Tất cả khu vực" searchPlaceholder="Tìm khu vực…" className="min-w-[190px]" />
      <SearchableSelect value={schoolId} onChange={(v) => update("schoolId", v)} options={schoolOptions} placeholder="Tất cả trường" searchPlaceholder="Tìm trường…" className="min-w-[220px]" />
      {!salesView && <SearchableSelect value={teacherId} onChange={(v) => update("teacherId", v)} options={teachers} placeholder="Tất cả giáo viên" searchPlaceholder="Tìm giáo viên…" className="min-w-[220px]" />}
      <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Tìm tên hoặc mã giáo viên" maxLength={100} className={`${selectClass} min-w-[220px]`} />
      <select value={status} onChange={(e) => update("status", e.target.value)} className={selectClass}><option value="">Mọi trạng thái</option><option value="PRESENT">Có dạy</option><option value="ABSENT">Vắng</option><option value="EXCUSED">Có phép</option></select>
      <button onClick={clear} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600">Xoá lọc</button>
    </FilterCard>
    {loading ? <Loading /> : photos.length === 0 ? <EmptyState icon="🖼️" title="Chưa có ảnh báo giảng" description="Thử đổi bộ lọc hoặc khoảng thời gian." /> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-gray-500"><span>{pagination.total} hình ảnh · {photos.length} ảnh trên trang này</span><button disabled={selected.size === 0} onClick={downloadSelected} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"><Download size={15} className="mr-1 inline" />Tải {selected.size} ảnh đã chọn</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{photos.map((photo, index) => <div key={photo.id} style={{ contentVisibility: "auto", containIntrinsicSize: "320px" }} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:ring-2 hover:ring-blue-300"><div className="relative"><button onClick={() => setPreview(index)} className="block w-full"><LazyThumbnail photo={photo} /></button><label className="absolute left-2 top-2 rounded bg-white/90 p-1.5"><input type="checkbox" checked={selected.has(photo.id)} onChange={() => toggle(photo.id)} aria-label="Chọn ảnh để tải" /></label><button onClick={() => download(photo)} className="absolute right-2 top-2 rounded bg-white/90 p-1.5 text-blue-700" title="Tải ảnh"><Download size={16} /></button></div><span className="block space-y-0.5 p-2 text-xs"><b className="block truncate">{photo.session.teacherName || "Chưa phân công"}</b><span className="block truncate text-gray-500">{photo.session.schoolName}</span><span className="block text-gray-400">{formatDate(photo.session.date)} · {formatTime(photo.session.startTime)}–{formatTime(photo.session.endTime)}</span></span></div>)}</div>
      <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} disabled={loading} />
    </>}
    {active && <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-4"><button onClick={() => setPreview(null)} className="absolute right-4 top-4 rounded-full bg-white p-2 text-gray-700"><X /></button><button disabled={preview === 0} onClick={() => setPreview((x) => Math.max(0, (x || 0) - 1))} className="mr-3 rounded-full bg-white p-2 disabled:opacity-30"><ChevronLeft /></button><img src={resolveApiFileUrl(active.url)} alt="Ảnh báo giảng" className="max-h-[85vh] max-w-[80vw] rounded-xl object-contain" /><button disabled={preview === photos.length - 1} onClick={() => setPreview((x) => Math.min(photos.length - 1, (x || 0) + 1))} className="ml-3 rounded-full bg-white p-2 disabled:opacity-30"><ChevronRight /></button><a href={resolveApiFileUrl(active.url)} target="_blank" rel="noreferrer" className="absolute bottom-4 rounded-xl bg-white px-3 py-2 text-sm font-medium text-gray-700"><Download size={15} className="mr-1 inline" />Tải ảnh</a></div>}
  </TeachingLayout>;
}
