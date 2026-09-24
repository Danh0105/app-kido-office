import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Inbox, Search } from "lucide-react";

import { teacherApi, teacherLocationChangeApi } from "@/service/teaching";

import { AccountRequestRows } from "./TeacherAccountRequestList";
import { LocationRequestRows } from "./TeacherLocationRequestList";

/** Cả hai hàng chờ dùng chung ba trạng thái này. */
export type ReviewStatus = "pending" | "approved" | "rejected";

const STATUSES: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Không duyệt" },
];

type Queue = "account" | "location";

/**
 * Hai hàng chờ duyệt của Nhân sự gộp về một khối.
 *
 * Trước đây mỗi loại là một thẻ riêng, mỗi thẻ tự mang tiêu đề + ô tìm + ba tab
 * — cộng lại đẩy danh sách giáo viên xuống tận cuối trang trong khi phần lớn
 * thời gian chẳng có gì phải duyệt. Giờ chỉ còn một thanh: đóng lại khi rảnh,
 * mở sẵn khi có việc.
 */
export default function ReviewQueues({ onApproved }: { onApproved: () => void }) {
  const [queue, setQueue] = useState<Queue>("account");
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ account: 0, location: 0 });
  /** Chỉ tự mở một lần theo số liệu đầu tiên — sau đó là quyền của người dùng. */
  const [autoOpened, setAutoOpened] = useState(false);

  const loadCounts = useCallback(async () => {
    const [account, location] = await Promise.all([
      teacherApi.accountRequests("pending").catch(() => []),
      teacherLocationChangeApi.list("pending").catch(() => []),
    ]);
    setCounts({ account: account.length, location: location.length });
    return { account: account.length, location: location.length };
  }, []);

  useEffect(() => {
    void loadCounts().then((next) => {
      setAutoOpened((already) => {
        if (already) return already;
        // Có việc thì mở sẵn, và nhảy vào đúng hàng chờ đang có hàng.
        if (next.account > 0 || next.location > 0) {
          setQueue(next.account > 0 ? "account" : "location");
          setOpen(true);
        }
        return true;
      });
    });
  }, [loadCounts]);

  const total = counts.account + counts.location;

  const QUEUES: { key: Queue; label: string; count: number }[] = [
    { key: "account", label: "Mở tài khoản", count: counts.account },
    { key: "location", label: "Đổi vị trí", count: counts.location },
  ];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown size={16} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-gray-400" />
        )}
        <Inbox size={16} className="shrink-0 text-indigo-500" />
        <span className="text-sm font-semibold text-gray-800">Chờ duyệt</span>

        {total > 0 ? (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {total}
          </span>
        ) : (
          <span className="text-xs text-gray-400">không có việc mới</span>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {open ? "Thu gọn" : "Mở"}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Chọn hàng chờ. Badge để biết bên kia có việc mà không phải bấm sang. */}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
              {QUEUES.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setQueue(item.key)}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                    queue === item.key
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  {item.label}
                  {item.count > 0 && (
                    <span className="rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ReviewStatus)
              }
              className="rounded-lg border px-2 py-1.5 text-xs"
            >
              {STATUSES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>

            <div className="relative ml-auto">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm…"
                className="w-36 rounded-lg border py-1.5 pl-7 pr-2 text-xs"
              />
            </div>
          </div>

          <div className="mt-2">
            {queue === "account" ? (
              <AccountRequestRows
                status={status}
                search={search}
                onReviewed={(approved) => {
                  void loadCounts();
                  if (approved) onApproved();
                }}
              />
            ) : (
              <LocationRequestRows
                status={status}
                search={search}
                onReviewed={() => void loadCounts()}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
