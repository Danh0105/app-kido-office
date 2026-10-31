import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gauge,
  Loader2,
  MapPin,
  MessagesSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  recruitmentApi,
  type RecruitmentAiUsage,
  type RecruitmentApplication,
  type RecruitmentHandoff,
  type RecruitmentInterview,
  type RecruitmentJob,
  type RecruitmentOverview,
  type RecruitmentSummary,
} from "@/service/recruitment";
import ApprovalQueue from "./ApprovalQueue";
import CandidatesPanel from "./CandidatesPanel";
import ConversationsPanel from "./ConversationsPanel";
import JobFormModal from "./JobFormModal";
import OperationsPanel from "./OperationsPanel";
import {
  AiUsagePanel,
  Avatar,
  EmptyState,
  Field,
  Info,
  LoadingState,
  ModalShell,
  STATUS_LABEL,
  StatusBadge,
  errorMessage,
  formatDate,
  formatNumber,
  inputClass,
} from "./shared";

import { getEmployeeName, hasRole } from "@/utils/auth";

type Tab =
  | "pipeline"
  | "approvals"
  | "conversations"
  | "candidates"
  | "interviews"
  | "handoffs"
  | "jobs"
  | "operations";

/** Tab có ô tìm/lọc riêng (dữ liệu phân trang phía server). */
const SELF_SEARCH_TABS: Tab[] = [
  "approvals",
  "conversations",
  "candidates",
  "operations",
];

const SOURCE_LABEL: Record<string, string> = {
  ZALO: "Zalo",
  WEBSITE: "Website",
  FACEBOOK: "Facebook",
  REFERRAL: "Giới thiệu",
  MANUAL: "Nhập tay",
  OTHER: "Khác",
};

const HANDOFF_LABEL: Record<string, string> = {
  CANDIDATE_REQUESTED_HUMAN: "Ứng viên muốn gặp HR",
  SALARY_OUT_OF_RANGE: "Lương ngoài khung",
  AI_UNCERTAIN: "AI chưa chắc chắn",
  COMPLAINT: "Khiếu nại",
  DATA_DELETION_REQUEST: "Yêu cầu xoá dữ liệu",
  SPECIAL_CASE: "Trường hợp đặc biệt",
  FINAL_DECISION_REQUIRED: "Cần quyết định cuối",
  OTHER: "Lý do khác",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  CONTRACT: "Hợp đồng",
  INTERNSHIP: "Thực tập",
  COLLABORATOR: "Cộng tác viên",
  SEASONAL: "Thời vụ",
  REMOTE: "Làm việc từ xa",
  HYBRID: "Hybrid",
};

/**
 * Trạng thái mà `POST /recruitment/jobs/:id/publish` chấp nhận (JOB_TRANSITIONS.publish
 * ở backend). Chỉ để ẩn/hiện nút — backend vẫn quyết định và trả 409 nếu không hợp lệ.
 */
const JOB_PUBLISHABLE_STATUSES = ["DRAFT", "PAUSED"];

const PIPELINE_COLUMNS = [
  {
    label: "Tiếp nhận",
    statuses: ["NEW", "COLLECTING_INFO"],
    dot: "bg-sky-500",
  },
  { label: "Sàng lọc", statuses: ["SCREENING"], dot: "bg-amber-500" },
  { label: "Phù hợp", statuses: ["QUALIFIED"], dot: "bg-emerald-500" },
  { label: "HR xử lý", statuses: ["NEEDS_HR_REVIEW"], dot: "bg-rose-500" },
  {
    label: "Phỏng vấn",
    statuses: ["INTERVIEW", "OFFER"],
    dot: "bg-violet-500",
  },
  {
    label: "Hoàn tất",
    statuses: ["HIRED", "REJECTED", "WITHDRAWN"],
    dot: "bg-slate-500",
  },
];

const EMPTY_SUMMARY: RecruitmentSummary = {
  newCandidates: 0,
  screening: 0,
  qualified: 0,
  interviews: 0,
  offers: 0,
  hired: 0,
  needsHrReview: 0,
  totalApplications: 0,
  openHandoffs: 0,
  upcomingInterviews: 0,
  activeJobs: 0,
  byStatus: {},
};

const formatMoney = (value: number | null | undefined) =>
  value == null
    ? "Thương lượng"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value);

export default function RecruitmentPage() {
  const canManage = hasRole("nhansu");
  const [tab, setTab] = useState<Tab>("pipeline");
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [applications, setApplications] = useState<RecruitmentApplication[]>(
    []
  );
  const [applicationCounts, setApplicationCounts] = useState<
    Record<string, number>
  >({});
  const [interviews, setInterviews] = useState<RecruitmentInterview[]>([]);
  const [handoffs, setHandoffs] = useState<RecruitmentHandoff[]>([]);
  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [aiUsage, setAiUsage] = useState<RecruitmentAiUsage | null>(null);
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApplication, setSelectedApplication] =
    useState<RecruitmentApplication | null>(null);
  const [showCreateCandidate, setShowCreateCandidate] = useState(false);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RecruitmentJob | null>(null);

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const [
        summaryData,
        applicationData,
        candidateData,
        interviewData,
        handoffData,
        jobData,
        aiUsageData,
        overviewData,
      ] = await Promise.all([
        recruitmentApi.summary(),
        recruitmentApi.applications({ limit: 100 }),
        recruitmentApi.candidates({ limit: 1 }),
        recruitmentApi.interviews({ limit: 100 }),
        recruitmentApi.handoffs({ limit: 100 }),
        recruitmentApi.jobs({ limit: 100 }),
        // Backend chưa có endpoint (404) hoặc không đủ quyền → ẩn khối, không chặn trang.
        recruitmentApi.aiUsage().catch(() => null),
        // Màn duyệt tin / hội thoại / vận hành chỉ hiện khi backend có API (release G8).
        recruitmentApi.overview().catch(() => null),
      ]);
      setSummary(summaryData);
      setApplications(applicationData.data);
      setApplicationCounts(applicationData.countsByStatus);
      setCandidateTotal(candidateData.total);
      setInterviews(interviewData.data);
      setHandoffs(handoffData.data);
      setJobs(jobData.data);
      setAiUsage(aiUsageData);
      setOverview(overviewData);
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const query = search.trim().toLocaleLowerCase("vi");
  const visibleApplications = useMemo(
    () =>
      applications.filter((item) =>
        [
          item.candidate?.fullName,
          item.candidate?.phone,
          item.candidate?.email,
          item.job?.title,
        ]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("vi").includes(query))
      ),
    [applications, query]
  );
  const visibleJobs = useMemo(
    () =>
      jobs.filter((item) =>
        [item.title, item.code, item.location]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("vi").includes(query))
      ),
    [jobs, query]
  );

  const openApplication = async (id: number) => {
    try {
      setSelectedApplication(await recruitmentApi.application(id));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const refresh = async () => {
    await load(true);
    toast.success("Đã cập nhật dữ liệu tuyển dụng");
  };

  const primaryAction = () => {
    if (tab === "jobs") setShowCreateJob(true);
    else setShowCreateCandidate(true);
  };

  const today = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#FFF8E6] pb-12 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-blue-100/80 bg-white/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#005BEA]">
              Trung tâm tuyển dụng
            </p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 md:text-2xl">
              Tuyển dụng
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:text-[#005BEA] disabled:opacity-50"
              aria-label="Làm mới"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={primaryAction}
                className="flex h-10 items-center gap-2 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">
                  {tab === "jobs" ? "Tạo vị trí" : "Thêm ứng viên"}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pt-6 md:px-8">
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#003FAD] via-[#005BEA] to-[#1597E5] px-6 py-6 text-white shadow-xl shadow-blue-900/10 md:px-8 md:py-7">
          <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-100">
                <span className="h-2 w-2 rounded-full bg-[#FFC928]" />
                {today.charAt(0).toUpperCase() + today.slice(1)}
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                Chào {getEmployeeName()?.split(" ").slice(-1)[0] || "bạn"}, cùng
                tìm đúng người.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                AI hỗ trợ thu thập và sàng lọc. Backend giữ trạng thái nghiệp
                vụ, còn HR luôn là người đưa ra quyết định cuối cùng.
              </p>
            </div>
            <div className="flex w-fit items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFC928] text-[#003FAD]">
                <Bot size={20} />
              </span>
              <div>
                <p className="text-xs font-extrabold">AI Recruiter</p>
                <p className="mt-0.5 text-[10px] text-blue-100">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  Đang đồng hành cùng HR
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border-[42px] border-white/5" />
        </section>

        {!canManage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800">
            <AlertCircle size={16} /> Bạn đang ở chế độ chỉ xem. Quyết định và
            cập nhật hồ sơ thuộc quyền của Nhân sự.
          </div>
        )}

        <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={UsersRound}
            label="Tổng hồ sơ"
            value={summary.totalApplications}
            hint={`${summary.newCandidates} hồ sơ mới`}
            tone="blue"
          />
          <MetricCard
            icon={AlertCircle}
            label="Cần HR xử lý"
            value={summary.openHandoffs}
            hint="Yêu cầu đang mở"
            tone="rose"
          />
          <MetricCard
            icon={CalendarDays}
            label="Lịch sắp tới"
            value={summary.upcomingInterviews}
            hint="Đã đề xuất / xác nhận"
            tone="violet"
          />
          <MetricCard
            icon={BriefcaseBusiness}
            label="Vị trí đang tuyển"
            value={summary.activeJobs}
            hint={`${summary.hired} ứng viên đã tuyển`}
            tone="amber"
          />
        </section>

        {overview && (
          <section className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard
              icon={ShieldCheck}
              label="Tin AI chờ duyệt"
              value={overview.counts.awaitingApproval}
              hint={`${overview.counts.approvedWaitingSend} đã duyệt, chờ gửi`}
              tone="amber"
            />
            <MetricCard
              icon={Send}
              label="Đã gửi Zalo"
              value={overview.counts.sent}
              hint={`${overview.counts.rejected} tin bị từ chối`}
              tone="blue"
            />
            <MetricCard
              icon={MessagesSquare}
              label="Hội thoại đang mở"
              value={overview.counts.activeConversations}
              hint={`${overview.counts.humanConversations} do HR xử lý`}
              tone="violet"
            />
            <MetricCard
              icon={AlertCircle}
              label="Lỗi gửi / cảnh báo"
              value={overview.counts.sendFailed + overview.counts.openAlerts}
              hint={`${overview.counts.sendFailed} lỗi gửi · ${overview.counts.openAlerts} cảnh báo`}
              tone="rose"
            />
          </section>
        )}

        {aiUsage && tab !== "operations" && <AiUsagePanel usage={aiUsage} />}

        <section className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-50 p-1">
              {(
                [
                  ["pipeline", "Pipeline", summary.totalApplications],
                  ...(overview
                    ? ([
                        [
                          "approvals",
                          "Duyệt tin AI",
                          overview.counts.awaitingApproval,
                        ],
                        [
                          "conversations",
                          "Hội thoại Zalo",
                          overview.counts.activeConversations,
                        ],
                      ] as [Tab, string, number][])
                    : []),
                  ["candidates", "Ứng viên", candidateTotal],
                  ["interviews", "Phỏng vấn", summary.upcomingInterviews],
                  ["handoffs", "Yêu cầu HR", summary.openHandoffs],
                  ["jobs", "Vị trí tuyển", summary.activeJobs],
                  ...(overview
                    ? ([
                        ["operations", "Vận hành", overview.counts.openAlerts],
                      ] as [Tab, string, number][])
                    : []),
                ] as [Tab, string, number][]
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                    tab === value
                      ? "bg-white text-[#005BEA] shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                      value === "approvals" && count > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
            {!SELF_SEARCH_TABS.includes(tab) && (
              <div className="flex items-center gap-2">
                <label className="relative flex-1 lg:w-72">
                  <Search
                    size={15}
                    className="absolute left-3 top-2.5 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm tên, SĐT, vị trí…"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}
          </div>

          {loading ? (
            <LoadingState />
          ) : tab === "pipeline" ? (
            <Pipeline
              applications={visibleApplications}
              counts={applicationCounts}
              onOpen={openApplication}
            />
          ) : tab === "approvals" ? (
            <ApprovalQueue
              canManage={canManage}
              counts={overview?.counts}
              onChanged={() => void load(true)}
            />
          ) : tab === "conversations" ? (
            <ConversationsPanel
              canManage={canManage}
              onChanged={() => void load(true)}
            />
          ) : tab === "operations" ? (
            <OperationsPanel
              canManage={canManage}
              overview={overview}
              aiUsage={aiUsage}
              onChanged={() => void load(true)}
            />
          ) : tab === "candidates" ? (
            <CandidatesPanel reloadKey={reloadKey} />
          ) : tab === "interviews" ? (
            <InterviewsList interviews={interviews} />
          ) : tab === "handoffs" ? (
            <HandoffsTable
              handoffs={handoffs}
              canManage={canManage}
              onResolved={() => void load(true)}
            />
          ) : (
            <JobsGrid jobs={visibleJobs} onOpen={setSelectedJob} />
          )}
        </section>
      </main>

      {selectedApplication && (
        <ApplicationDrawer
          application={selectedApplication}
          canManage={canManage}
          onClose={() => setSelectedApplication(null)}
          onChanged={async () => {
            setSelectedApplication(null);
            await load(true);
          }}
        />
      )}
      {selectedJob && (
        <JobDrawer
          key={selectedJob.id}
          initial={selectedJob}
          canManage={canManage}
          onClose={() => setSelectedJob(null)}
          onChanged={() => void load(true)}
        />
      )}
      {showCreateCandidate && (
        <CreateCandidateModal
          onClose={() => setShowCreateCandidate(false)}
          onCreated={async () => {
            setShowCreateCandidate(false);
            await load(true);
          }}
        />
      )}
      {showCreateJob && (
        <JobFormModal
          onClose={() => setShowCreateJob(false)}
          onSaved={async () => {
            setShowCreateJob(false);
            await load(true);
          }}
        />
      )}
    </div>
  );
}
function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  hint: string;
  tone: "blue" | "rose" | "violet" | "amber";
}) {
  const colors = {
    blue: "bg-blue-50 text-[#005BEA]",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors[tone]}`}
        >
          <Icon size={17} />
        </span>
        <span className="text-[10px] font-bold text-slate-500">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
        {formatNumber(value)}
      </p>
      <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
    </article>
  );
}

function Pipeline({
  applications,
  counts,
  onOpen,
}: {
  applications: RecruitmentApplication[];
  counts: Record<string, number>;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="grid auto-cols-[270px] grid-flow-col gap-3 overflow-x-auto bg-slate-50/60 p-4">
      {PIPELINE_COLUMNS.map((column) => {
        const items = applications.filter((item) =>
          column.statuses.includes(item.status)
        );
        const count = column.statuses.reduce(
          (sum, status) => sum + (counts[status] || 0),
          0
        );
        return (
          <section key={column.label}>
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
                  {column.label}
                </h3>
              </div>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-600">
                {count}
              </span>
            </div>
            <div className="min-h-[420px] rounded-xl bg-slate-100 p-2">
              {items.length ? (
                items.map((item) => (
                  <ApplicationCard key={item.id} item={item} onOpen={onOpen} />
                ))
              ) : (
                <p className="py-10 text-center text-[10px] text-slate-400">
                  Chưa có hồ sơ
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ApplicationCard({
  item,
  onOpen,
}: {
  item: RecruitmentApplication;
  onOpen: (id: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="mb-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold text-slate-800">
            {item.candidate?.fullName || "Ứng viên chưa có tên"}
          </p>
          <p className="mt-1 truncate text-[10px] text-slate-500">
            {item.job?.title || `Vị trí #${item.jobId}`}
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-1.5 py-1 text-[8px] font-bold text-slate-500">
          {SOURCE_LABEL[item.source] || item.source}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-8 text-[10px] leading-4 text-slate-500">
        {item.aiSummary ||
          (item.aiMissingInformation?.length
            ? `Cần bổ sung: ${item.aiMissingInformation.join(", ")}`
            : "Hồ sơ đang được cập nhật.")}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="text-[9px] text-slate-400">
          {formatDate(item.updatedAt)}
        </span>
        {item.aiPaused ? (
          <span className="flex items-center gap-1 text-[9px] font-bold text-rose-600">
            <AlertCircle size={11} /> AI tạm dừng
          </span>
        ) : item.aiMatchScore != null ? (
          <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#005BEA]">
            <Sparkles size={11} /> {item.aiMatchScore}%
          </span>
        ) : (
          <span className="text-[9px] text-slate-400">Chưa chấm</span>
        )}
      </div>
    </button>
  );
}

function InterviewsList({
  interviews,
}: {
  interviews: RecruitmentInterview[];
}) {
  if (!interviews.length)
    return (
      <EmptyState
        title="Chưa có lịch phỏng vấn"
        text="Lịch do AI đề xuất hoặc HR tạo sẽ xuất hiện tại đây."
      />
    );
  return (
    <div className="space-y-2 p-4">
      {interviews.map((item) => (
        <article
          key={item.id}
          className="grid grid-cols-[76px_1fr_auto] items-center gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-[90px_1fr_1fr_auto]"
        >
          <div className="border-r border-slate-100">
            <p className="text-base font-black text-slate-900">
              {new Intl.DateTimeFormat("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(item.scheduledStart))}
            </p>
            <p className="mt-1 text-[9px] text-slate-400">
              {formatDate(item.scheduledStart)}
            </p>
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-800">
              {item.candidate?.fullName || `Ứng viên #${item.candidateId}`}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              {item.job?.title || `Vị trí #${item.jobId}`}
            </p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
            <MapPin size={14} className="text-[#005BEA]" />
            {item.location ||
              (item.meetingUrl ? "Trực tuyến" : "Chưa cập nhật")}
          </div>
          <StatusBadge status={item.status} />
        </article>
      ))}
    </div>
  );
}

function HandoffsTable({
  handoffs,
  canManage,
  onResolved,
}: {
  handoffs: RecruitmentHandoff[];
  canManage: boolean;
  onResolved: () => void;
}) {
  const resolve = async (item: RecruitmentHandoff) => {
    if (
      !window.confirm(
        `Đánh dấu yêu cầu của ${
          item.candidate?.fullName || "ứng viên"
        } là đã xử lý?`
      )
    )
      return;
    try {
      await recruitmentApi.resolveHandoff(
        item.id,
        "HR đã xử lý từ giao diện tuyển dụng"
      );
      toast.success("Đã xử lý yêu cầu HR");
      onResolved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  if (!handoffs.length)
    return (
      <EmptyState
        title="Không có yêu cầu HR"
        text="Các tình huống AI cần người thật hỗ trợ sẽ xuất hiện tại đây."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <thead className="bg-slate-50 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3">Ứng viên</th>
            <th className="px-5 py-3">Lý do</th>
            <th className="px-5 py-3">Ưu tiên</th>
            <th className="px-5 py-3">Trạng thái</th>
            <th className="px-5 py-3">Thời gian</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {handoffs.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={item.candidate?.fullName} />
                  <div>
                    <p className="text-xs font-bold">
                      {item.candidate?.fullName ||
                        `Ứng viên #${item.candidateId}`}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {item.application?.job?.title || "Chưa gắn vị trí"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3">
                <p className="text-xs font-semibold text-slate-700">
                  {HANDOFF_LABEL[item.reason] || item.reason}
                </p>
                <p className="mt-1 max-w-xs truncate text-[10px] text-slate-400">
                  {item.summary}
                </p>
              </td>
              <td className="px-5 py-3 text-xs font-bold text-slate-600">
                {item.priority}
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-5 py-3 text-xs text-slate-500">
                {formatDate(item.createdAt, true)}
              </td>
              <td className="px-5 py-3">
                {canManage && item.status === "OPEN" && (
                  <button
                    type="button"
                    onClick={() => void resolve(item)}
                    className="rounded-lg bg-[#005BEA] px-3 py-2 text-[10px] font-bold text-white"
                  >
                    Đã xử lý
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobsGrid({
  jobs,
  onOpen,
}: {
  jobs: RecruitmentJob[];
  onOpen: (job: RecruitmentJob) => void;
}) {
  if (!jobs.length)
    return (
      <EmptyState
        title="Chưa có vị trí tuyển"
        text="Tạo vị trí đầu tiên để bắt đầu nhận hồ sơ."
      />
    );
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {jobs.map((job) => (
        <article
          key={job.id}
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          onClick={() => onOpen(job)}
          onKeyDown={(event) => {
            if (event.repeat || (event.key !== "Enter" && event.key !== " "))
              return;
            event.preventDefault();
            onOpen(job);
          }}
          className="cursor-pointer rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-md focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#005BEA]">
                {job.code}
              </p>
              <h3 className="mt-2 text-sm font-black text-slate-800">
                {job.title}
              </h3>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                <MapPin size={12} />
                {job.location || "Chưa cập nhật"}
              </p>
            </div>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-4 grid grid-cols-2 border-t border-slate-100 pt-3">
            <div>
              <p className="text-[9px] text-slate-400">Số lượng</p>
              <p className="mt-1 text-xs font-extrabold">
                {job.numberOfPositions} người
              </p>
            </div>
            <div className="border-l border-slate-100 pl-3">
              <p className="text-[9px] text-slate-400">Mức lương</p>
              <p className="mt-1 truncate text-xs font-extrabold">
                {job.salaryMin == null && job.salaryMax == null
                  ? "Thương lượng"
                  : `${formatMoney(job.salaryMin)} – ${formatMoney(
                      job.salaryMax
                    )}`}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

const formatSalaryRange = (job: RecruitmentJob) => {
  const money = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: job.currency || "VND",
      maximumFractionDigits: 0,
    }).format(value);
  if (job.salaryMin == null && job.salaryMax == null) return "Thương lượng";
  if (job.salaryMax == null) return `Từ ${money(job.salaryMin!)}`;
  if (job.salaryMin == null) return `Đến ${money(job.salaryMax)}`;
  return `${money(job.salaryMin)} – ${money(job.salaryMax)}`;
};

const safeJobHtml = (value: string) =>
  value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ""
    )
    .replace(/<\/?([a-z0-9]+)(?:\s[^>]*)?>/gi, (tag, rawName) => {
      const name = String(rawName).toLowerCase();
      const allowed = [
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "ul",
        "ol",
        "li",
        "blockquote",
        "h2",
        "h3",
        "div",
      ];
      if (!allowed.includes(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      if (name === "br") return "<br>";
      const align = tag.match(
        /text-align\s*:\s*(left|center|right|justify)/i
      )?.[1];
      return align && ["p", "div"].includes(name)
        ? `<${name} style="text-align:${align.toLowerCase()}">`
        : `<${name}>`;
    });

function JobDrawer({
  initial,
  canManage,
  onClose,
  onChanged,
}: {
  initial: RecruitmentJob;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [job, setJob] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `job-drawer-title-${initial.id}`;
  const busy = publishing;

  // Danh sách có thể cũ — luôn lấy bản mới nhất từ API khi mở.
  useEffect(() => {
    let active = true;
    recruitmentApi
      .job(initial.id)
      .then((data) => active && setJob(data))
      .catch((error) => active && toast.error(errorMessage(error)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [initial.id]);

  // Đưa focus vào drawer khi mở và trả về thẻ vị trí khi đóng.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const requestClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  const trapFocus = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = panelRef.current.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const startEdit = () => setEditing(true);

  const publish = async () => {
    const reopen = job.status === "PAUSED";
    if (
      !window.confirm(
        `${reopen ? "Mở lại" : "Công bố"} vị trí ${job.code} – ${
          job.title
        }?\n\nVị trí sẽ chuyển sang "Đang tuyển" và AI Recruiter có thể giới thiệu vị trí này cho ứng viên.`
      )
    )
      return;
    setPublishing(true);
    try {
      setJob(await recruitmentApi.publishJob(job.id));
      toast.success(reopen ? "Đã mở lại vị trí" : "Đã công bố vị trí");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
      // Trạng thái có thể đã đổi ở nơi khác — tải lại để nút hiển thị đúng.
      recruitmentApi.job(job.id).then(setJob, () => undefined);
    } finally {
      setPublishing(false);
    }
  };

  const criteria = job.screeningCriteria ?? {};
  const criteriaRows = [
    criteria.minimumExperienceMonths != null &&
      `Kinh nghiệm tối thiểu: ${criteria.minimumExperienceMonths} tháng`,
    criteria.requiredSkills?.length &&
      `Kỹ năng bắt buộc: ${criteria.requiredSkills.join(", ")}`,
    criteria.preferredSkills?.length &&
      `Kỹ năng ưu tiên: ${criteria.preferredSkills.join(", ")}`,
    criteria.locations?.length && `Khu vực: ${criteria.locations.join(", ")}`,
    criteria.availableImmediatelyPreferred && "Ưu tiên đi làm ngay",
    criteria.maxStartDelayDays != null &&
      `Bắt đầu chậm nhất sau ${criteria.maxStartDelayDays} ngày`,
  ].filter(Boolean) as string[];
  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        tabIndex={-1}
        onClick={requestClose}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={loading || busy}
        onKeyDown={trapFocus}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[#FAFBFF] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#005BEA]">
              Vị trí tuyển dụng · {job.code}
            </p>
            <h2
              id={titleId}
              className="mt-1 truncate text-lg font-black text-slate-900"
            >
              {job.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {loading && (
              <Loader2
                size={16}
                className="animate-spin text-[#005BEA]"
                aria-label="Đang tải chi tiết"
              />
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              aria-label="Đóng"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
            <div className="space-y-5 p-6">
              <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Info label="Mã vị trí" value={job.code} />
                <div className="border-b border-r border-slate-100 p-4">
                  <p className="text-[9px] text-slate-400">Trạng thái</p>
                  <div className="mt-1">
                    <StatusBadge status={job.status} />
                  </div>
                </div>
                <Info
                  label="Phòng ban"
                  value={job.department?.name || "Chưa cập nhật"}
                />
                <Info
                  label="Địa điểm"
                  value={job.location || "Chưa cập nhật"}
                />
                <Info
                  label="Hình thức"
                  value={
                    EMPLOYMENT_LABEL[job.employmentType] || job.employmentType
                  }
                />
                <Info
                  label="Số lượng"
                  value={`${job.numberOfPositions} người`}
                />
                <Info label="Mức lương" value={formatSalaryRange(job)} />
                <Info
                  label="Hạn nộp hồ sơ"
                  value={formatDate(job.applicationDeadline)}
                />
                <Info
                  label="Công bố"
                  value={
                    job.publishedAt
                      ? formatDate(job.publishedAt, true)
                      : "Chưa công bố"
                  }
                />
              </section>
              {(
                [
                  ["Mô tả công việc", job.description],
                  ["Yêu cầu", job.requirements],
                  ["Quyền lợi", job.benefits],
                ] as const
              ).map(([label, value]) => (
                <section key={label}>
                  <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    {label}
                  </h3>
                  <div
                    className={`whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 ${
                      value ? "text-slate-600" : "text-slate-400"
                    }`}
                    {...(value
                      ? { dangerouslySetInnerHTML: { __html: safeJobHtml(value) } }
                      : { children: "Chưa cập nhật" })}
                  />
                </section>
              ))}
              <section>
                <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Tiêu chí sàng lọc
                </h3>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                  {criteriaRows.length ? (
                    criteriaRows.map((row) => (
                      <p key={row} className="mb-2 flex gap-2 last:mb-0">
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-emerald-500"
                        />
                        {row}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-400">Chưa khai báo tiêu chí.</p>
                  )}
                </div>
              </section>
              <p className="text-[10px] text-slate-400">
                Tạo {formatDate(job.createdAt, true)}
                {job.updatedAt &&
                  ` · Cập nhật ${formatDate(job.updatedAt, true)}`}
                {job.closedAt && ` · Đóng ${formatDate(job.closedAt, true)}`}
              </p>
            </div>
        </div>

        <footer className="border-t border-slate-200 bg-white px-6 py-4">
          {!canManage ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-blue-800">
              <AlertCircle size={15} /> Chế độ chỉ xem. Chỉnh sửa vị trí thuộc
              quyền của Nhân sự.
            </p>
          ) : job.status === "CLOSED" ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <AlertCircle size={15} /> Vị trí đã đóng, không chỉnh sửa được
              nữa.
            </p>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={startEdit}
                disabled={loading || busy}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:text-[#005BEA] disabled:opacity-50"
              >
                <Pencil size={14} /> Chỉnh sửa
              </button>
              {JOB_PUBLISHABLE_STATUSES.includes(job.status) && (
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={loading || busy}
                  className="flex h-10 items-center gap-2 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {publishing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {job.status === "PAUSED" ? "Mở lại tuyển dụng" : "Công bố"}
                </button>
              )}
            </div>
          )}
        </footer>
      </aside>
      {editing && (
        <JobFormModal
          job={job}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setJob(saved);
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ApplicationDrawer({
  application,
  canManage,
  onClose,
  onChanged,
}: {
  application: RecruitmentApplication;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(
    application.allowedNextStatuses?.[0] || ""
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const saveStatus = async () => {
    if (!status) return;
    if (status === "REJECTED" && !reason.trim()) {
      toast.error("Vui lòng nhập lý do không phù hợp");
      return;
    }
    setSaving(true);
    try {
      await recruitmentApi.changeApplicationStatus(application.id, {
        status,
        rejectedReason: status === "REJECTED" ? reason : undefined,
      });
      toast.success("Đã cập nhật hồ sơ");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const resume = async () => {
    setSaving(true);
    try {
      await recruitmentApi.resumeAi(application.id);
      toast.success("Đã trả hồ sơ lại cho AI");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto bg-[#FAFBFF] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#005BEA]">
              Hồ sơ ứng tuyển
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-900">
              Hồ sơ #{application.id}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </header>
        <div className="space-y-5 p-6">
          <section className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <Avatar
              name={application.candidate?.fullName}
              className="h-12 w-12"
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-black">
                {application.candidate?.fullName || "Ứng viên chưa có tên"}
              </h3>
              <p className="mt-1 truncate text-[11px] text-slate-500">
                {application.candidate?.phone ||
                  application.candidate?.email ||
                  "Chưa có liên hệ"}{" "}
                · {application.job?.title}
              </p>
            </div>
            <StatusBadge status={application.status} />
          </section>
          <section>
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              Đánh giá từ AI
            </h3>
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Info
                label="Mức phù hợp"
                value={
                  application.aiMatchScore == null
                    ? "Chưa sàng lọc"
                    : `${application.aiMatchScore}/100`
                }
              />
              <Info
                label="Nguồn hồ sơ"
                value={SOURCE_LABEL[application.source] || application.source}
              />
              <Info
                label="Ngày tiếp nhận"
                value={formatDate(application.createdAt)}
              />
              <Info
                label="AI Recruiter"
                value={application.aiPaused ? "Đã tạm dừng" : "Đang hỗ trợ"}
              />
            </div>
            {application.aiSummary && (
              <p className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600">
                {application.aiSummary}
              </p>
            )}
          </section>
          {(application.aiStrengths?.length ||
            application.aiConcerns?.length) && (
            <section>
              <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Điểm nổi bật
              </h3>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                {application.aiStrengths?.map((item) => (
                  <p key={item} className="mb-2 flex gap-2">
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-emerald-500"
                    />
                    {item}
                  </p>
                ))}
                {application.aiConcerns?.map((item) => (
                  <p key={item} className="mb-2 flex gap-2">
                    <AlertCircle
                      size={14}
                      className="mt-0.5 shrink-0 text-amber-500"
                    />
                    {item}
                  </p>
                ))}
              </div>
            </section>
          )}
          {canManage && (
            <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <h3 className="text-xs font-extrabold text-slate-800">
                Thao tác của HR
              </h3>
              {application.aiPaused && (
                <button
                  type="button"
                  onClick={() => void resume()}
                  disabled={saving}
                  className="mt-3 flex w-full items-center justify-between rounded-xl border border-blue-200 bg-white px-4 py-3 text-xs font-bold text-[#005BEA]"
                >
                  Trả hồ sơ lại cho AI <ArrowRight size={15} />
                </button>
              )}
              {application.allowedNextStatuses?.length ? (
                <div className="mt-3 space-y-2">
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"
                  >
                    <option value="">Chọn trạng thái mới</option>
                    {application.allowedNextStatuses.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABEL[value] || value}
                      </option>
                    ))}
                  </select>
                  {status === "REJECTED" && (
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Lý do không phù hợp (bắt buộc)"
                      className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-xs outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => void saveStatus()}
                    disabled={saving || !status}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#005BEA] text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}{" "}
                    Cập nhật trạng thái
                  </button>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function CreateCandidateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      [...form.entries()].filter(([, value]) => String(value).trim() !== "")
    );
    setSaving(true);
    try {
      await recruitmentApi.createCandidate(payload);
      toast.success("Đã tạo ứng viên");
      onCreated();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <ModalShell
      title="Thêm ứng viên"
      subtitle="Chỉ thu thập thông tin phục vụ tuyển dụng."
      onClose={onClose}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Họ và tên">
            <input
              name="fullName"
              required
              className={inputClass}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              name="phone"
              className={inputClass}
              placeholder="0901 234 567"
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              className={inputClass}
              placeholder="ungvien@example.com"
            />
          </Field>
          <Field label="Khu vực">
            <input
              name="location"
              className={inputClass}
              placeholder="TP. Hồ Chí Minh"
            />
          </Field>
          <Field label="Nguồn ứng viên">
            <select name="source" className={inputClass}>
              <option value="MANUAL">Nhập tay</option>
              <option value="REFERRAL">Giới thiệu</option>
              <option value="WEBSITE">Website</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="OTHER">Khác</option>
            </select>
          </Field>
          <Field label="Công việc hiện tại">
            <input name="currentJob" className={inputClass} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#005BEA] px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}Tạo ứng
            viên
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
