import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  activityLogApi,
  type ActivityLog,
  type ActivityLogActor,
} from "@/service/activityLog.api";
import { getApiErrorMessage } from "@/utils/apiError";
import TeachingLayout from "./components/TeachingLayout";
import TeachingTabs from "./components/TeachingTabs";
import {
  EmptyState,
  FilterCard,
  Loading,
  Pagination,
  selectClass,
} from "./components/Shared";
import {
  RESOURCE_LABELS,
  bodyEntries,
  contextRows,
  contextSummary,
  describeAction,
  fieldLabel,
  itemLines,
  resourceLabel,
  roleLabel,
  snapshotRows,
  subjectName,
  visibleChanges,
  formatActivityValue,
  type ActivityReferenceNames,
} from "./activityLogText";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { subjectCatalogApi } from "@/service/subjectCatalog.api";
import { schoolClassApi, teacherApi, teachingScheduleApi } from "@/service/teaching";
import SearchableSelect from "@/components/SearchableSelect";

const PAGE_SIZE = 30;

const METHOD_META: Record<string, { label: string; className: string }> = {
  POST: { label: "Thêm", className: "bg-emerald-50 text-emerald-700" },
  PATCH: { label: "Sửa", className: "bg-amber-50 text-amber-700" },
  PUT: { label: "Sửa", className: "bg-amber-50 text-amber-700" },
  DELETE: { label: "Xoá", className: "bg-red-50 text-red-600" },
};

const timeOfDay = (d: Date) =>
  d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const dateKey = (iso: string) => iso.slice(0, 10);

/** "Hôm nay" / "Hôm qua" / "Thứ Hai, 09/09/2026" — tiêu đề nhóm theo ngày. */
function dayLabel(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;

  const today = new Date();
  const diff = Math.round(
    (new Date(today.toDateString()).getTime() - d.getTime()) / 86_400_000,
  );
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Hôm qua";

  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function LogRow({
  log,
  references,
}: {
  log: ActivityLog;
  references: ActivityReferenceNames;
}) {
  const [open, setOpen] = useState(false);
  const method = METHOD_META[log.method] ?? {
    label: log.method,
    className: "bg-gray-100 text-gray-600",
  };

  const target = subjectName(log, references);
  // Khi đã có tên đối tượng, ID trong câu hành động chỉ lặp lại thông tin và
  // làm tiêu đề khó đọc ("Sửa trường #365 · Trường A").
  const action = target
    ? describeAction(log).replace(/ #\d+(?=$|\))/g, "")
    : describeAction(log);
  const entries = bodyEntries(log.body, log.context, references);
  const summary = contextSummary(log.context);
  const rows = contextRows(log.context);
  const changes = visibleChanges(
    log.changes,
    log.beforeData,
    log.afterData,
    references,
  );
  // Bản ghi bị xoá không có "sau" để so — hiện nguyên trạng lúc trước khi xoá.
  const deletedRows =
    log.method === "DELETE" ? snapshotRows(log.beforeData, references) : [];

  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-3 py-3 text-left hover:bg-blue-50/60"
      >
        <span className="mt-0.5 shrink-0 text-gray-300">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <span className="min-w-0 flex-1">
          {/* Câu mô tả đứng đầu — đọc một dòng là hiểu ai vừa làm gì. */}
          <span className="block text-sm text-gray-800">
            <span className="font-semibold">
              {log.actorName || `Người dùng #${log.actorId}`}
            </span>{" "}
            <span className="text-gray-600">{action.toLowerCase()}</span>
            {target && (
              <span className="font-medium text-gray-800"> · {target}</span>
            )}
          </span>

          {/* Trường · lớp · môn · giáo viên · ngày giờ — đủ để nhận ra tiết
              nào mà không phải mở chi tiết. */}
          {summary && (
            <span className="mt-0.5 block truncate text-xs text-gray-500">
              {summary}
            </span>
          )}

          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${method.className}`}
            >
              {method.label}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
              {resourceLabel(log.resource)}
            </span>
            {log.actorRoles?.map((r) => (
              <span
                key={r}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-600"
              >
                {roleLabel(r)}
              </span>
            ))}
            {changes.length > 0 && (
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700">
                {changes.length} thay đổi
              </span>
            )}
            {!log.success && (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">
                Không thành công
              </span>
            )}
          </span>
        </span>

        <span className="shrink-0 whitespace-nowrap text-[11px] text-gray-400">
          {timeOfDay(new Date(log.createdAt))}
        </span>
      </button>

      {open && (
        <div className="space-y-3 bg-slate-50/60 px-3 pb-3 pl-9 pt-1">
          {!log.success && (
            <p className="rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-600">
              Hệ thống từ chối thao tác này
              {log.errorMessage ? `: ${log.errorMessage}` : "."}
            </p>
          )}

          {rows.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Thông tin liên quan
              </p>
              <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {rows.map((row) => (
                  <div key={row.label} className="flex gap-2 px-2 py-1.5 text-xs">
                    <dt className="w-32 shrink-0 text-gray-500">{row.label}</dt>
                    <dd className="min-w-0 flex-1 break-words font-medium text-gray-800">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {changes.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Đã thay đổi
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex gap-2 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                  <span className="w-28 shrink-0">Mục</span>
                  <span className="min-w-0 flex-1">Dữ liệu cũ</span>
                  <span className="min-w-0 flex-1">Dữ liệu mới</span>
                </div>
                {changes.map((c) => (
                  <div
                    key={c.field}
                    className="flex gap-2 border-t border-slate-100 px-2 py-1.5 text-xs"
                  >
                    <span className="w-28 shrink-0 text-gray-500">{c.label}</span>
                    {/* Gạch ngang giá trị cũ: liếc mắt là biết đâu là cái đã bị thay. */}
                    <span className="min-w-0 flex-1 break-words text-gray-400 line-through">
                      {c.before}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-medium text-emerald-700">
                      {c.after}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deletedRows.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Dữ liệu đã bị xoá
              </p>
              <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-red-100 bg-white">
                {deletedRows.map((row) => (
                  <div key={row.label} className="flex gap-2 px-2 py-1.5 text-xs">
                    <dt className="w-32 shrink-0 text-gray-500">{row.label}</dt>
                    <dd className="min-w-0 flex-1 break-words text-gray-800 line-through">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {log.method === "DELETE" && deletedRows.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
              Nhật ký này chưa lưu chi tiết lịch dạy trước khi xoá. Các lần xoá
              mới sẽ hiện đầy đủ trường, lớp, môn học, giáo viên và giờ dạy sau
              khi backend lưu dữ liệu trước khi xoá.
            </p>
          )}

          {entries.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Nội dung đã gửi
              </p>
              <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {entries.map(({ key, value }) => {
                  const lines = itemLines(value, references);
                  return (
                    <div key={key} className="flex gap-2 px-2 py-1.5 text-xs">
                      <dt className="w-32 shrink-0 text-gray-500">
                        {fieldLabel(key)}
                      </dt>
                      <dd className="min-w-0 flex-1 break-words text-gray-800">
                        {/* Mảng: liệt kê từng dòng, không rút gọn thành "13 dòng". */}
                        {lines.length ? (
                          <ul className="space-y-0.5">
                            {lines.map((line, i) => (
                              <li key={i}>• {line}</li>
                            ))}
                          </ul>
                        ) : (
                          formatActivityValue(value, key, references)
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            {new Date(log.createdAt).toLocaleString("vi-VN")}
            {log.ip ? ` · IP ${log.ip}` : ""}
          </p>

          {/* Đường dẫn kỹ thuật để bộ phận IT tra khi cần, để cuối và mờ đi. */}
          <details className="text-[11px] text-gray-400">
            <summary className="cursor-pointer">Thông tin kỹ thuật</summary>
            <p className="mt-1 break-all font-mono">
              {log.method} {log.path}
            </p>
            <pre className="mt-1 max-h-52 overflow-auto rounded bg-white p-2 font-mono">
              {JSON.stringify(
                {
                  body: log.body,
                  query: log.query,
                  params: log.params,
                  beforeData: log.beforeData,
                  afterData: log.afterData,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [references, setReferences] = useState<ActivityReferenceNames>({
    schools: {},
    subjects: {},
    catalogs: {},
    teachers: {},
    classes: {},
    schedules: {},
  });

  const [actors, setActors] = useState<ActivityLogActor[]>([]);
  const [actorId, setActorId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [resource, setResource] = useState("");
  const [method, setMethod] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityLogApi.list({
        page,
        limit: PAGE_SIZE,
        actorId: actorId ? Number(actorId) : undefined,
        schoolId: schoolId ? Number(schoolId) : undefined,
        teacherId: teacherId ? Number(teacherId) : undefined,
        resource: resource || undefined,
        method: method || undefined,
        success: onlyFailed ? false : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setLogs(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được nhật ký thao tác"));
    } finally {
      setLoading(false);
    }
  }, [page, actorId, schoolId, teacherId, resource, method, onlyFailed, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Lịch dạy mang ID riêng, còn tên trường nằm trong bản ghi lịch. Tra các
  // lịch đang có trên trang để tiêu đề log không phải hiện "lịch dạy #1787".
  useEffect(() => {
    const ids = [...new Set(
      logs
        .filter((log) => log.resource === "teaching-schedules")
        .map((log) => Number(log.path.match(/\/teaching-schedules\/(\d+)/)?.[1]))
        .filter(Boolean),
    )];
    if (!ids.length) return;

    let alive = true;
    Promise.all(
      ids.map((id) => teachingScheduleApi.findOne(id).catch(() => null)),
    ).then((schedules) => {
      if (!alive) return;
      setReferences((current) => ({
        ...current,
        schedules: {
          ...current.schedules,
          ...Object.fromEntries(
            schedules
              .filter((schedule): schedule is NonNullable<typeof schedule> => !!schedule)
              .map((schedule) => [schedule.id, { schoolName: schedule.schoolName }]),
          ),
        },
      }));
    });
    return () => {
      alive = false;
    };
  }, [logs]);

  useEffect(() => {
    activityLogApi
      .actors()
      .then(setActors)
      .catch(() => setActors([]));
  }, []);

  // Log cũ không có context nên chỉ gửi schoolId/subjectId/teacherId. Nạp danh
  // mục một lần để phần "Nội dung đã gửi" vẫn hiện tên thay vì mã số.
  useEffect(() => {
    let alive = true;

    Promise.all([
      schoolApi.getAll({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
      subjectApi.getAll().catch(() => []),
      subjectCatalogApi.list({ includeInactive: true }).catch(() => []),
      teacherApi.list({ page: 1, limit: 100 }).catch(() => null),
      schoolClassApi.list({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
    ]).then(([schoolResult, subjects, catalogs, teacherResult, classResult]) => {
      if (!alive) return;
      const schools = Array.isArray(schoolResult)
        ? schoolResult
        : schoolResult?.data || [];
      const teachers = teacherResult?.data || [];
      // Giữ lại `schedules` do effect trên nạp, ghi đè cả object sẽ làm nó
      // thành undefined và subjectName() nổ khi tra tên lịch dạy.
      setReferences((current) => ({
        ...current,
        schools: Object.fromEntries(schools.map((x: any) => [x.id, x.name])),
        subjects: Object.fromEntries(subjects.map((x) => [x.id, x.name])),
        catalogs: Object.fromEntries(catalogs.map((x) => [x.id, x.name])),
        teachers: Object.fromEntries(teachers.map((x) => [x.id, x.name])),
        classes: Object.fromEntries(
          (classResult?.data || []).map((x) => [
            x.id,
            { name: x.name, schoolName: x.schoolName },
          ]),
        ),
      }));

      // API giới hạn mỗi trang 100 giáo viên. Lấy tiếp các trang còn lại để
      // tên vẫn được tra đúng kể cả với giáo viên không nằm ở trang đầu.
      const totalPages = Math.min(teacherResult?.pagination?.totalPages || 1, 10);
      if (totalPages <= 1) return;
      Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          teacherApi.list({ page: index + 2, limit: 100 }).catch(() => null),
        ),
      ).then((pages) => {
        if (!alive) return;
        const allTeachers = [
          ...teachers,
          ...pages.flatMap((result) => result?.data || []),
        ];
        setReferences((current) => ({
          ...current,
          teachers: Object.fromEntries(
            allTeachers.map((teacher) => [teacher.id, teacher.name]),
          ),
        }));
      });
    });

    return () => {
      alive = false;
    };
  }, []);

  // Đổi bộ lọc thì phải về trang 1, không thì đang ở trang 5 lọc lại ra trắng.
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resourceOptions = useMemo(() => {
    const found = new Set(logs.map((l) => l.resource));
    return [...new Set([...Object.keys(RESOURCE_LABELS), ...found])].sort(
      (a, b) => resourceLabel(a).localeCompare(resourceLabel(b), "vi"),
    );
  }, [logs]);

  /** Gom theo ngày: nhật ký đọc theo mốc thời gian dễ hơn một danh sách phẳng. */
  const groups = useMemo(() => {
    const map = new Map<string, ActivityLog[]>();
    for (const log of logs) {
      const key = dateKey(log.createdAt);
      map.set(key, [...(map.get(key) ?? []), log]);
    }
    return [...map.entries()];
  }, [logs]);

  return (
    <TeachingLayout title="Nhật ký thao tác">
      <TeachingTabs />

      <FilterCard>
        <SearchableSelect
          value={actorId}
          onChange={withReset(setActorId)}
          options={actors.map((a) => ({
            id: a.actorId,
            name: `${a.actorName || `#${a.actorId}`} (${a.total})`,
          }))}
          placeholder="Tất cả người thao tác"
          searchPlaceholder="Tìm người thao tác…"
          className="min-w-[220px]"
        />

        <SearchableSelect
          value={schoolId}
          onChange={withReset(setSchoolId)}
          options={Object.entries(references.schools)
            .sort(([, a], [, b]) => a.localeCompare(b, "vi"))
            .map(([id, name]) => ({ id, name }))}
          placeholder="Tất cả trường"
          searchPlaceholder="Tìm trường…"
          className="min-w-[220px]"
        />

        <SearchableSelect
          value={teacherId}
          onChange={withReset(setTeacherId)}
          options={Object.entries(references.teachers)
            .sort(([, a], [, b]) => a.localeCompare(b, "vi"))
            .map(([id, name]) => ({ id, name }))}
          placeholder="Tất cả giáo viên"
          searchPlaceholder="Tìm giáo viên…"
          className="min-w-[220px]"
        />

        <SearchableSelect
          value={resource}
          onChange={withReset(setResource)}
          options={resourceOptions.map((r) => ({ id: r, name: resourceLabel(r) }))}
          placeholder="Tất cả dữ liệu"
          searchPlaceholder="Tìm loại dữ liệu…"
          className="min-w-[180px]"
        />

        <select
          value={method}
          onChange={(e) => withReset(setMethod)(e.target.value)}
          className={selectClass}
        >
          <option value="">Mọi hành động</option>
          <option value="POST">Thêm mới</option>
          <option value="PATCH">Chỉnh sửa</option>
          <option value="DELETE">Xoá</option>
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => withReset(setFromDate)(e.target.value)}
          className={selectClass}
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => withReset(setToDate)(e.target.value)}
          className={selectClass}
        />

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyFailed}
            onChange={(e) => withReset(setOnlyFailed)(e.target.checked)}
          />
          Chỉ thao tác bị từ chối
        </label>
      </FilterCard>

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <EmptyState
          icon="🗒️"
          title="Chưa có thao tác nào"
          description="Nhật ký chỉ ghi các thao tác thêm/sửa/xoá của Giáo vụ và Nhân sự."
        />
      ) : (
        <>
          <p className="px-1 text-xs text-gray-400">{total} thao tác</p>

          {groups.map(([key, items]) => (
            <div key={key} className="space-y-1">
              <p className="px-1 text-xs font-semibold text-gray-500">
                {dayLabel(key)}
              </p>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {items.map((log) => (
                  <LogRow key={log.id} log={log} references={references} />
                ))}
              </div>
            </div>
          ))}

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            disabled={loading}
          />
        </>
      )}
    </TeachingLayout>
  );
}
