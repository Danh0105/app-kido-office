import { useCallback, useEffect, useState } from "react";
import { AlertCircle, MessageCircle, Search } from "lucide-react";
import toast from "react-hot-toast";
import CandidateActions from "./CandidateActions";

import {
  recruitmentApi,
  type RecruitmentCandidate,
  type RecruitmentCandidateDetail
} from "@/service/recruitment";

import {
  Avatar,
  DrawerShell,
  EmptyState,
  Info,
  LoadingState,
  Pagination,
  StatusBadge,
  errorMessage,
  formatDate,
  formatNumber
} from "./shared";

const SOURCE_LABEL: Record<string, string> = {
  ZALO: "Zalo",
  WEBSITE: "Website",
  FACEBOOK: "Facebook",
  REFERRAL: "Giới thiệu",
  MANUAL: "Nhập tay",
  OTHER: "Khác"
};

export default function CandidatesPanel({
  reloadKey,
  canManage,
  onChanged,
  onOpenApplication
}: {
  reloadKey: number;
  canManage: boolean;
  onChanged: () => void;
  onOpenApplication: (id: number) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    data: RecruitmentCandidate[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await recruitmentApi.candidates({
        keyword: query || undefined,
        source: source || undefined,
        page,
        limit
      });
      setResult({ data: data.data, total: data.total });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [query, source, page]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <div>
      <form
        className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(keyword.trim());
        }}
      >
        <label className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-2.5 text-slate-400"
          />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm tên, SĐT, email…"
            aria-label="Tìm ứng viên"
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <select
          value={source}
          onChange={(event) => {
            setPage(1);
            setSource(event.target.value);
          }}
          aria-label="Lọc nguồn"
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs"
        >
          <option value="">Mọi nguồn</option>
          {Object.entries(SOURCE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white"
        >
          Tìm
        </button>
      </form>
      {loading && !result ? (
        <LoadingState />
      ) : !result?.data.length ? (
        <EmptyState
          title="Chưa có ứng viên"
          text="Ứng viên mới sẽ xuất hiện tại đây khi được AI hoặc HR tiếp nhận."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {result.data.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => setSelected(candidate.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50/40 focus-visible:bg-blue-50/60 focus-visible:outline-none"
              >
                <Avatar name={candidate.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">
                    {candidate.fullName || "Chưa cập nhật tên"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-400">
                    {candidate.phone || candidate.email || "Chưa có liên hệ"}
                    {candidate.location && ` · ${candidate.location}`}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right text-[10px] text-slate-500 sm:block">
                  <p>{SOURCE_LABEL[candidate.source] || candidate.source}</p>
                  <p className="text-slate-400">
                    {formatDate(candidate.createdAt)}
                  </p>
                </div>
                {candidate.deletionRequestedAt && (
                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                    Yêu cầu xoá
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {result && (
        <Pagination
          page={page}
          limit={limit}
          total={result.total}
          onChange={setPage}
        />
      )}
      {selected !== null && (
        <CandidateDrawer
          key={selected}
          candidateId={selected}
          canManage={canManage}
          onChanged={() => {
            void load();
            onChanged();
          }}
          onOpenApplication={onOpenApplication}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CandidateDrawer({
  candidateId,
  onClose,
  canManage,
  onChanged,
  onOpenApplication
}: {
  candidateId: number;
  onClose: () => void;
  canManage: boolean;
  onChanged: () => void;
  onOpenApplication: (id: number) => void;
}) {
  const [candidate, setCandidate] = useState<RecruitmentCandidateDetail | null>(
    null
  );
  const [conversations, setConversations] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    recruitmentApi
      .candidate(candidateId)
      .then(async (data) => {
        if (!active) return;
        setCandidate(data);
        // Exact candidate identity also works before the candidate has supplied a name/phone.
        {
          const list = await recruitmentApi
            .conversations({ candidateId, limit: 1 })
            .catch(() => null);
          if (active && list) setConversations(list.total);
        }
      })
      .catch((error) => active && toast.error(errorMessage(error)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [candidateId]);

  return (
    <DrawerShell
      eyebrow={`Ứng viên #${candidateId}`}
      title={
        candidate
          ? candidate.fullName || `Ứng viên #${candidate.id}`
          : "Hồ sơ ứng viên"
      }
      onClose={onClose}
      busy={loading}
    >
      {!candidate ? (
        loading ? (
          <LoadingState />
        ) : (
          <EmptyState title="Không tải được hồ sơ" text="Thử đóng và mở lại." />
        )
      ) : (
        <div className="space-y-5 p-5">
          {canManage && (
            <CandidateActions
              candidate={candidate}
              onChanged={async () => {
                setCandidate(await recruitmentApi.candidate(candidateId));
                onChanged();
              }}
            />
          )}
          {candidate.deletionRequestedAt && (
            <p className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle size={15} className="shrink-0" /> Ứng viên đã yêu cầu
              xoá dữ liệu ({formatDate(candidate.deletionRequestedAt, true)}).
              AI đã dừng với hồ sơ này.
            </p>
          )}
          <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Info label="Số điện thoại" value={candidate.phone || "—"} />
            <Info label="Email" value={candidate.email || "—"} />
            <Info label="Khu vực" value={candidate.location || "—"} />
            <Info
              label="Nguồn"
              value={SOURCE_LABEL[candidate.source] || candidate.source}
            />
            <Info
              label="Kinh nghiệm"
              value={
                candidate.totalExperienceMonths == null
                  ? "—"
                  : `${candidate.totalExperienceMonths} tháng`
              }
            />
            <Info
              label="Lương mong muốn"
              value={
                candidate.expectedSalary == null
                  ? "—"
                  : `${formatNumber(candidate.expectedSalary)} ₫`
              }
            />
            <Info
              label="Có thể bắt đầu"
              value={formatDate(candidate.availableFrom)}
            />
            <Info
              label="Công việc hiện tại"
              value={candidate.currentJob || "—"}
            />
            <Info
              label="Zalo OA"
              value={
                candidate.zaloUserId
                  ? `Đã liên kết${
                      conversations ? ` · ${conversations} hội thoại` : ""
                    }`
                  : "Chưa liên kết"
              }
            />
            <Info
              label="Tiếp nhận"
              value={formatDate(candidate.createdAt, true)}
            />
          </section>
          {candidate.skills?.length ? (
            <section>
              <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Kỹ năng
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#005BEA]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          {candidate.experienceSummary && (
            <section>
              <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Tóm tắt kinh nghiệm
              </h3>
              <p className="whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600">
                {candidate.experienceSummary}
              </p>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Hồ sơ ứng tuyển
            </h3>
            {candidate.applications?.length ? (
              <ul className="space-y-2">
                {candidate.applications.map((application) => (
                  <li
                    key={application.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenApplication(application.id);
                      }}
                      className="min-w-0 text-left hover:text-blue-700"
                    >
                      <p className="truncate text-xs font-bold text-slate-700">
                        {application.job?.title || "Vị trí"} · #{application.id}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {application.aiMatchScore != null
                          ? `AI chấm ${application.aiMatchScore}/100 · `
                          : ""}
                        {formatDate(application.createdAt)}
                      </p>
                    </button>
                    <StatusBadge status={application.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">
                Chưa ứng tuyển vị trí nào.
              </p>
            )}
          </section>
          {conversations > 0 && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <MessageCircle size={13} /> Xem lịch sử nhắn tin ở mục “Hội thoại
              Zalo” (tìm theo tên hoặc SĐT).
            </p>
          )}
        </div>
      )}
    </DrawerShell>
  );
}
