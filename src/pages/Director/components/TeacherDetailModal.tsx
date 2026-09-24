import { MapPin, X } from "lucide-react";
import { Link } from "react-router-dom";

import type { Teacher, TeachingRefItem } from "@/types/teaching";
import { canManageTeaching, canSetTeachingRates, formatMoney } from "@/pages/Teaching/lib";

export type TeacherAccount = {
  id: number;
  name: string;
  phone: string;
  email: string;
  roles: string[];
};

type Props = {
  /** Tài khoản nhân viên đang xem — luôn có, kể cả khi chưa có hồ sơ giáo viên. */
  account: TeacherAccount;
  /** Hồ sơ trong module Giảng dạy; null = chưa tạo hoặc chưa tải được. */
  teacher: Teacher | null;
  loading: boolean;
  /** Lỗi khi tải danh sách giáo viên (thường là 403 với role không xem được). */
  error?: string;
  roleLabel: (role: string) => string;
  roleColor: (role: string) => string;
  onClose: () => void;
  onAssignRoles: () => void;
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-xs text-gray-500 shrink-0">{label}</span>
    <span className="text-xs font-medium text-gray-800 text-right break-words">
      {value}
    </span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
      {title}
    </p>
    {children}
  </div>
);

/** Danh sách xã/phường, môn, trường — hiện hết dưới dạng chip, rỗng thì báo rõ. */
const Chips = ({ items, empty }: { items: TeachingRefItem[]; empty: string }) => {
  if (!items?.length) return <p className="text-xs text-gray-400 italic">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.id}
          className="text-[11px] px-2 py-[2px] rounded-full bg-gray-100 text-gray-600"
        >
          {item.name}
        </span>
      ))}
    </div>
  );
};

const dash = (value?: string | null) => value?.trim() || "—";

/**
 * Các khối hồ sơ giảng dạy — dùng chung cho màn Quản lý nhân viên và danh sách
 * giáo viên của module Giảng dạy, để hai nơi luôn hiện cùng một bộ thông tin.
 */
export function TeacherProfileSections({ teacher }: { teacher: Teacher }) {
  const showRate = canSetTeachingRates();

  return (
    <>
      <Section title="Hồ sơ giảng dạy">
        <Row label="Mã giáo viên" value={`#${teacher.id}`} />
        <Row label="SĐT hồ sơ" value={dash(teacher.phone)} />
        <Row label="Email hồ sơ" value={dash(teacher.email)} />
        <Row
          label="Định mức tuần"
          value={
            teacher.maxPeriodsPerWeek == null
              ? "Không giới hạn"
              : `${teacher.maxPeriodsPerWeek} tiết/tuần`
          }
        />
        {showRate && (
          <Row
            label="Đơn giá/tiết"
            value={formatMoney(teacher.defaultRatePerPeriod)}
          />
        )}
      </Section>

      <Section title="Môn có thể dạy">
        <Chips items={teacher.teachableSubjects} empty="Chưa khai môn dạy" />
      </Section>

      <Section title="Xã/phường nhận dạy">
        <Chips
          items={teacher.allowedWards}
          empty="Chưa giới hạn xã/phường"
        />
        {!!teacher.allowedSchools?.length && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 mb-1">
              Trường trong phạm vi ({teacher.allowedSchools.length})
            </p>
            <Chips items={teacher.allowedSchools} empty="—" />
          </div>
        )}
      </Section>

      <Section title="Vị trí & liên hệ">
        {teacher.googleMapsUrl ? (
          <a
            href={teacher.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 py-1"
          >
            <MapPin size={13} /> Mở vị trí trên Google Maps
          </a>
        ) : (
          <p className="text-xs text-gray-400 italic py-1">Chưa khai vị trí</p>
        )}
        {teacher.latitude != null && teacher.longitude != null && (
          <Row
            label="Toạ độ"
            value={`${teacher.latitude}, ${teacher.longitude}`}
          />
        )}
        <Row label="Zalo Mini App" value={dash(teacher.zaloUid)} />
        <Row label="Zalo OA" value={dash(teacher.zaloUserId)} />
      </Section>

      <Section title="Ghi chú">
        <p className="text-xs text-gray-700 whitespace-pre-wrap">
          {teacher.note?.trim() || "—"}
        </p>
      </Section>
    </>
  );
}

export default function TeacherDetailModal({
  account,
  teacher,
  loading,
  error,
  roleLabel,
  roleColor,
  onClose,
  onAssignRoles,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-gray-50 w-full sm:w-[92%] max-w-md rounded-t-3xl sm:rounded-3xl shadow-lg max-h-[88vh] flex flex-col">
        {/* ── Header ── */}
        <div className="flex items-start gap-3 p-4 pb-3 bg-white rounded-t-3xl border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-2xl shrink-0">
            👤
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 leading-tight">
              {teacher?.name || account.name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{dash(account.phone)}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className="text-[11px] px-2 py-[2px] rounded-full font-medium bg-cyan-100 text-cyan-700">
                Giáo viên CTV
              </span>
              {teacher && (
                <span
                  className={`text-[11px] px-2 py-[2px] rounded-full font-medium ${
                    teacher.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {teacher.isActive ? "Đang hoạt động" : "Ngưng hoạt động"}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <Section title="Tài khoản">
            <Row label="Mã nhân viên" value={`#${account.id}`} />
            <Row label="Họ tên" value={dash(account.name)} />
            <Row label="Số điện thoại" value={dash(account.phone)} />
            <Row label="Email" value={dash(account.email)} />
            <div className="pt-1.5">
              <p className="text-xs text-gray-500 mb-1">Chức vụ</p>
              <div className="flex flex-wrap gap-1">
                {(account.roles ?? []).map((r) => (
                  <span
                    key={r}
                    className={`text-[11px] px-2 py-[2px] rounded-full font-medium ${roleColor(r)}`}
                  >
                    {roleLabel(r)}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          {loading && (
            <p className="text-center text-xs text-gray-400 py-4">
              Đang tải hồ sơ giáo viên…
            </p>
          )}

          {!loading && error && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {!loading && !error && !teacher && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              Tài khoản này chưa có hồ sơ trong module Giảng dạy. Nhân sự cần tạo hồ sơ
              giáo viên rồi gắn với tài khoản để xếp lịch dạy.
            </p>
          )}

          {!loading && teacher && <TeacherProfileSections teacher={teacher} />}
        </div>

        {/* ── Footer ── */}
        <div className="p-3 bg-white border-t border-gray-100 flex gap-2 rounded-b-3xl">
          <button onClick={onClose} className="flex-1 bg-gray-200 py-3 rounded-xl text-sm">
            Đóng
          </button>
          {canManageTeaching() && (
            <Link
              to="/nhan-su/giao-vien"
              className="flex-1 bg-cyan-500 text-white py-3 rounded-xl text-sm font-medium text-center"
            >
              Hồ sơ giảng dạy
            </Link>
          )}
          <button
            onClick={onAssignRoles}
            className="flex-1 bg-indigo-500 text-white py-3 rounded-xl text-sm font-medium"
          >
            Phân quyền
          </button>
        </div>
      </div>
    </div>
  );
}
