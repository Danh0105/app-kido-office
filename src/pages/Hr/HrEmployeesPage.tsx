import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Plus, Search } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import Modal, { Field, inputClass } from "@/pages/Teaching/components/Modal";
import { Pagination, selectClass, tdClass, thClass, theadClass, trClass } from "@/pages/Teaching/components/Shared";
import { hrEmployeeApi, type HrEmployeeListQuery } from "@/service/hr/hr.api";
import HrLayout from "./components/HrLayout";
import { HrBadge, HrEmpty, HrErrorState, HrFormError, HrLoading, StatusBadge, buttonPrimary } from "./components/HrUi";
import ProfileFields, { toastDuplicateWarnings } from "./employee/ProfileFields";
import { useAccountNames, useAccounts } from "./hooks/useAccountNames";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useHrAccess } from "./hooks/useHrAccess";
import { hrCapabilities, vnToday } from "./lib/hrAccess";
import {
  ATTENDANCE_MODE_LABELS,
  ATTENDANCE_MODES,
  SEARCH_DEBOUNCE_MS,
  createBody,
  emptyProfileForm,
  profileProblems,
  type HrAttendanceMode,
} from "./lib/hrEmployeeProfile";

const LIMIT = 25;
/** Trạng thái HỒ SƠ trong hệ thống — không phải trạng thái việc làm (Phase 1.4). */
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Hồ sơ hoạt động", INACTIVE: "Hồ sơ ngừng" };

/** Danh sách hồ sơ — tìm kiếm phía server, chỉ trường cơ bản (không dữ liệu định danh). */
export default function HrEmployeesPage() {
  const navigate = useNavigate();
  const { access } = useHrAccess();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");
  const [attendanceMode, setAttendanceMode] = useState<"" | HrAttendanceMode>("");
  const [creating, setCreating] = useState(false);
  const names = useAccountNames();
  const q = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const query: HrEmployeeListQuery = {
    page,
    limit: LIMIT,
    q: q || undefined,
    status: status || undefined,
    attendanceMode: attendanceMode || undefined,
  };
  const list = useQuery({
    queryKey: ["hr", "employees", query],
    queryFn: () => hrEmployeeApi.list(query),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const filtered = Boolean(q || status || attendanceMode);
  // Đổi điều kiện lọc → về trang 1.
  const resetting = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  // Tạo hồ sơ chỉ cho quyền sửa ở phạm vi toàn công ty (backend quy định).
  const canCreate = hrCapabilities(access).canCreateEmployees;
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / LIMIT)) : 1;
  const accountLabel = (id: number | null) => (id === null ? "—" : names.get(id) ?? `#${id}`);
  const modeBadge = (m: HrAttendanceMode) => (
    <HrBadge tone={m === "UNASSIGNED" ? "warning" : "neutral"}>{ATTENDANCE_MODE_LABELS[m]}</HrBadge>
  );

  return (
    <HrLayout title="HRM — Hồ sơ nhân viên" require={(has) => has("EMPLOYEE_VIEW")}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${inputClass} pl-8`}
            value={search}
            maxLength={100}
            placeholder="Tìm mã NV, họ tên (không dấu cũng được), SĐT, email"
            onChange={(e) => resetting(setSearch)(e.target.value)}
          />
        </div>
        <select className={selectClass} value={status} onChange={(e) => resetting(setStatus)(e.target.value as typeof status)}>
          <option value="">Mọi trạng thái hồ sơ</option>
          <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
          <option value="INACTIVE">{STATUS_LABEL.INACTIVE}</option>
        </select>
        <select
          className={selectClass}
          value={attendanceMode}
          onChange={(e) => resetting(setAttendanceMode)(e.target.value as typeof attendanceMode)}
        >
          <option value="">Mọi kiểu chấm công</option>
          {ATTENDANCE_MODES.map((m) => (
            <option key={m} value={m}>
              {ATTENDANCE_MODE_LABELS[m]}
            </option>
          ))}
        </select>
        {canCreate && (
          <button className={buttonPrimary} onClick={() => setCreating(true)}>
            <Plus size={16} /> Thêm hồ sơ
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500">{list.data ? `${list.data.total} hồ sơ` : ""}</p>

      {list.isLoading ? (
        <HrLoading />
      ) : list.isError ? (
        <HrErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.data.length ? (
        <HrEmpty
          title={filtered ? "Không có hồ sơ phù hợp" : "Chưa có hồ sơ nhân viên nào trong phạm vi của bạn"}
          description={filtered ? "Thử từ khoá khác hoặc bỏ bớt bộ lọc." : undefined}
        />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className={thClass}>Mã NV</th>
                  <th className={thClass}>Họ tên</th>
                  <th className={thClass}>Liên hệ</th>
                  <th className={thClass}>Kiểu chấm công</th>
                  <th className={thClass}>Tài khoản liên kết</th>
                  <th className={thClass}>Trạng thái hồ sơ</th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((e) => (
                  <tr key={e.id} className={`${trClass} cursor-pointer`} onClick={() => navigate(`/hr/employees/${e.id}`)}>
                    <td className={`${tdClass} font-mono`}>{e.employeeCode}</td>
                    <td className={`${tdClass} font-medium`}>{e.fullName}</td>
                    <td className={`${tdClass} text-xs text-gray-600`}>
                      {e.phone && <div>{e.phone}</div>}
                      {e.workEmail && <div className="break-all">{e.workEmail}</div>}
                      {!e.phone && !e.workEmail && "—"}
                    </td>
                    <td className={tdClass}>{modeBadge(e.attendanceMode)}</td>
                    <td className={tdClass}>{accountLabel(e.accountId)}</td>
                    <td className={tdClass}>
                      <StatusBadge value={e.status} label={STATUS_LABEL[e.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2">
            {list.data.data.map((e) => (
              <button
                key={e.id}
                onClick={() => navigate(`/hr/employees/${e.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{e.fullName}</p>
                  <StatusBadge value={e.status} label={STATUS_LABEL[e.status]} />
                </div>
                <p className="text-xs text-gray-500">
                  {e.employeeCode} · {e.phone ?? accountLabel(e.accountId)}
                </p>
                <div>{modeBadge(e.attendanceMode)}</div>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {creating && <CreateEmployeeDialog onClose={() => setCreating(false)} />}
    </HrLayout>
  );
}

function CreateEmployeeDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const today = vnToday();
  const [form, setForm] = useState(emptyProfileForm);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const problems = profileProblems(form, today);

  const submit = async () => {
    if (problems.length) return;
    setLoading(true);
    setError(null);
    try {
      const created = await hrEmployeeApi.create({
        ...createBody(form),
        fullName: form.fullName.trim(),
        accountId: accountId ? Number(accountId) : undefined,
      });
      toast.success(`Đã tạo hồ sơ ${created.employeeCode}.`);
      toastDuplicateWarnings(created.warnings);
      queryClient.invalidateQueries({ queryKey: ["hr", "employees"] });
      onClose();
      navigate(`/hr/employees/${created.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Thêm hồ sơ nhân viên"
      submitLabel="Tạo hồ sơ"
      loading={loading}
      disabled={problems.length > 0}
      onClose={onClose}
      onSubmit={submit}
      wide
    >
      <p className="text-xs text-gray-500">Mã nhân viên do hệ thống tự sinh (NV + 6 số) sau khi tạo.</p>
      <ProfileFields form={form} onChange={setForm} today={today} />
      <Field label="Tài khoản đăng nhập liên kết" hint="Không bắt buộc — nhân sự chưa có tài khoản vẫn tạo được hồ sơ.">
        <SearchableSelect
          value={accountId}
          onChange={setAccountId}
          options={(accounts.data ?? []).map((a) => ({ id: a.id, name: `${a.name || a.email || "Tài khoản"} (#${a.id})` }))}
          className={`${selectClass} w-full text-left`}
          placeholder="— Không liên kết —"
          searchPlaceholder="Tìm theo tên / email"
        />
      </Field>
      {form.fullName.trim() && problems.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-700">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <HrFormError error={error} />
    </Modal>
  );
}
