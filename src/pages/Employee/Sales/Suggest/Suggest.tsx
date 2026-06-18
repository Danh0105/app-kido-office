import { useEffect, useState } from "react";
import HeaderWithBack from "@/components/HeaderWithBack";
import SuggestPopup from "./SuggestPopup";
import { suggestApi } from "@/service/suggest";

type Suggest = {
  id: number;
  content: string;
  component?: string;
  description?: string;
  issueDate?: string;
  fileUrl?: string;
  status: "PENDING" | "REVIEWED" | "APPROVED" | "REJECTED";
  rejectReason?: string;
  policy?: {
    id: number;
    subject?: {
      schoolYear?: string;

      id: number;
      name: string;
      school?: {
        id: number;
        name: string;
      };
    };
  };
};

export default function SuggestPage() {
  const [data, setData] = useState<Suggest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openPopup, setOpenPopup] = useState(false);
  const [editing, setEditing] = useState<Suggest | null>(null);

  // ================= FETCH =================
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await suggestApi.getMySuggests();
      setData(res);
    } catch (err: any) {
      const message = err?.response?.data?.message || "Có lỗi xảy ra";

      setError(message);
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================= DELETE =================
  const handleDelete = async (id: number) => {
    if (!confirm("Xoá đề xuất này?")) return;

    try {
      await suggestApi.delete(id);
      setData((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Xoá thất bại");
    }
  };

  // ================= BADGE =================
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          text: "⏳ Chờ kiểm tra",
          className: "bg-yellow-100 text-yellow-700",
        };
      case "REVIEWED":
        return {
          text: "🔍 Đã kiểm tra",
          className: "bg-blue-100 text-blue-700",
        };
      case "APPROVED":
        return {
          text: "✅ Đã duyệt",
          className: "bg-green-100 text-green-700",
        };
      case "REJECTED":
        return {
          text: "❌ Từ chối",
          className: "bg-red-100 text-red-700",
        };
      default:
        return {
          text: status,
          className: "bg-gray-100 text-gray-600",
        };
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      {/* HEADER */}
      <HeaderWithBack title="Đề xuất" />

      {/* CONTENT */}
      <div className="flex-1 mt-[60px] px-3 pb-28 space-y-3">
        {/* ERROR */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-2 rounded-xl text-center">
            ⚠️ {error}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="text-center text-gray-400 text-sm py-10">
            Đang tải...
          </div>
        )}

        {/* EMPTY */}
        {!loading && data.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-16">
            📭 Chưa có đề xuất
          </div>
        )}

        {/* LIST */}
        {data.map((item) => {
          const badge = getStatusBadge(item.status);
          const canEdit = item.status === "PENDING";

          return (
            <div
              key={item.id}
              /*           onClick={() =>
                                                                   navigate(`/employee/policy/view`, {
                                                                       state: {
                                                                           data: item.data,
                                                                           user: getEmployeeId(),
                                                                           subjectId: item.subjectId,
                                                                           currentHistoryId: item.currentHistoryId,
                                                                       }
                                                                   })
                                                               } */
              className="bg-white rounded-2xl p-3 shadow-sm active:scale-[0.98] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-800 text-[15px] leading-snug line-clamp-2 flex-1">
                  {item.content}
                </p>

                <span
                  className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-medium ${badge.className}`}
                >
                  {badge.text}
                </span>
              </div>

              {/* META */}
              <div className="mt-2 space-y-1">
                {item.component && (
                  <p className="text-xs text-gray-500">🧩 {item.component}</p>
                )}

                {item.issueDate && (
                  <p className="text-xs text-gray-400">📅 {item.issueDate}</p>
                )}
              </div>

              {/* FILE */}
              {item.fileUrl && (
                <a
                  href={item.fileUrl}
                  target="_blank"
                  className="inline-block mt-2 text-xs text-blue-500 underline"
                >
                  📎 Xem file
                </a>
              )}

              {/* REJECT REASON */}
              {item.status === "REJECTED" && item.rejectReason && (
                <p className="text-xs text-red-500 mt-2">
                  ❗ {item.rejectReason}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {item.policy?.subject?.school?.name && (
                  <span className="px-2 py-[3px] text-[10px] bg-purple-100 text-purple-700 rounded-full font-medium">
                    🏫 {item.policy.subject.school.name}
                  </span>
                )}

                {item.policy?.subject?.name && (
                  <span className="px-2 py-[3px] text-[10px] bg-blue-100 text-blue-700 rounded-full font-medium">
                    📘 {item.policy.subject.name}
                  </span>
                )}

                {item.policy?.subject?.schoolYear && (
                  <span className="px-2 py-[3px] text-[10px] bg-green-100 text-green-700 rounded-full font-medium">
                    🎓 {item.policy.subject.schoolYear}
                  </span>
                )}
              </div>
              {/* ACTION */}
              <div className="flex gap-2 mt-3">
                {/* EDIT */}
                <button
                  disabled={!canEdit}
                  onClick={() => {
                    setEditing(item);
                    setOpenPopup(true);
                  }}
                  className={`
            flex-1 py-2 rounded-xl text-sm font-medium transition

            ${
              item.status !== "PENDING"
                ? "opacity-40 pointer-events-none"
                : "active:scale-95"
            }

            bg-yellow-50 text-yellow-700
            dark:bg-yellow-900/30 dark:text-yellow-300
        `}
                >
                  ✏️ Sửa
                </button>

                {/* DELETE */}
                <button
                  disabled={!canEdit}
                  onClick={() => handleDelete(item.id)}
                  className={`
            flex-1 py-2 rounded-xl text-sm font-medium transition

            ${
              item.status !== "PENDING"
                ? "opacity-40 pointer-events-none"
                : "active:scale-95"
            }

            bg-red-50 text-red-600
            dark:bg-red-900/30 dark:text-red-300
        `}
                >
                  🗑️ Xoá
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FLOAT BUTTON */}
      <button
        onClick={() => {
          setEditing(null);
          setOpenPopup(true);
        }}
        className="fixed bottom-5 right-5 z-50 bg-blue-600 text-white w-14 h-14 rounded-full text-3xl shadow-xl active:scale-90 transition"
      >
        +
      </button>

      {/* POPUP */}
      <SuggestPopup
        open={openPopup}
        onClose={() => setOpenPopup(false)}
        onSuccess={fetchData}
        initialData={editing}
      />
    </div>
  );
}
