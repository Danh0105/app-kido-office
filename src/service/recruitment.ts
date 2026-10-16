import api from "./api";

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type RecruitmentSummary = {
  newCandidates: number;
  screening: number;
  qualified: number;
  interviews: number;
  offers: number;
  hired: number;
  needsHrReview: number;
  totalApplications: number;
  openHandoffs: number;
  upcomingInterviews: number;
  activeJobs: number;
  byStatus: Record<string, number>;
};

export type RecruitmentCandidate = {
  id: number;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  location: string | null;
  currentJob: string | null;
  totalExperienceMonths: number | null;
  expectedSalary: number | null;
  skills: string[];
  suspectedDuplicateIds?: number[];
  deletionRequestedAt?: string | null;
  createdAt: string;
};

/** Schema cố định của `screening_criteria` (ScreeningCriteriaDto ở backend). */
export type RecruitmentScreeningCriteria = {
  minimumExperienceMonths?: number;
  requiredSkills?: string[];
  preferredSkills?: string[];
  locations?: string[];
  availableImmediatelyPreferred?: boolean;
  maxStartDelayDays?: number;
};

export type RecruitmentJob = {
  id: number;
  code: string;
  title: string;
  departmentId?: number | null;
  department?: { id: number; name: string } | null;
  location: string | null;
  employmentType: string;
  numberOfPositions: number;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  screeningCriteria?: RecruitmentScreeningCriteria;
  status: string;
  publishedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

/**
 * Body của `PATCH /recruitment/jobs/:id` (UpdateJobDto). `null` xoá field tuỳ chọn;
 * trạng thái không sửa qua PATCH mà qua publish/pause/close.
 */
export type UpdateRecruitmentJobPayload = Partial<{
  code: string;
  title: string;
  description: string | null;
  departmentId: number | null;
  location: string | null;
  employmentType: string;
  numberOfPositions: number;
  salaryMin: number | null;
  salaryMax: number | null;
  requirements: string | null;
  responsibilities: string | null;
}>;

export type RecruitmentApplication = {
  id: number;
  candidateId: number;
  candidate?: RecruitmentCandidate;
  jobId: number;
  job?: RecruitmentJob;
  status: string;
  source: string;
  aiMatchScore: number | null;
  aiMatchLevel: string | null;
  aiSummary: string | null;
  aiStrengths?: string[];
  aiConcerns?: string[];
  aiMissingInformation?: string[];
  aiPaused: boolean;
  allowedNextStatuses?: string[];
  interviews?: RecruitmentInterview[];
  handoffs?: RecruitmentHandoff[];
  createdAt: string;
  updatedAt: string;
};

export type RecruitmentInterview = {
  id: number;
  applicationId: number;
  candidateId: number;
  candidate?: RecruitmentCandidate;
  jobId: number;
  job?: RecruitmentJob;
  scheduledStart: string;
  scheduledEnd: string;
  location: string | null;
  meetingUrl: string | null;
  status: string;
};

export type RecruitmentHandoff = {
  id: number;
  candidateId: number;
  candidate?: RecruitmentCandidate;
  applicationId: number | null;
  application?: RecruitmentApplication;
  reason: string;
  priority: string;
  summary: string;
  status: string;
  createdAt: string;
};

/** Token "reserved" = số tính vào trần (gồm phần giữ chỗ cho lượt đang chạy). */
export type RecruitmentAiUsage = {
  today: {
    turns: number;
    tokens: number;
    reservedTokens: number;
    reservationOverruns: number;
  };
  month: { tokens: number; reservedTokens: number };
  limits: {
    maxTurnsPerSenderHour: number;
    maxTurnsPerSenderDay: number;
    maxTurnsPerDay: number;
    dailyTokenBudget: number;
    monthlyTokenBudget: number;
    tokenReservationPerTurn: number;
  };
  pilot: { enabled: boolean; senders: number };
};

// ---- Màn Nhân sự: hội thoại Zalo, duyệt tin AI (p32), vận hành --------------------------

export type ConversationControlMode = "AI_ACTIVE" | "HUMAN_TAKEOVER" | "CLOSED";

export type RecruitmentConversationSummary = {
  id: number;
  channel: string;
  status: string;
  controlMode: ConversationControlMode;
  lastMessageAt: string | null;
  createdAt: string;
  candidateId: number;
  candidateName: string | null;
  candidatePhone: string | null;
  applicationId: number | null;
  applicationStatus: string | null;
  aiPaused: boolean | null;
  jobTitle: string | null;
  lastSenderType: string | null;
  lastMessagePreview: string | null;
  pendingApprovals: number;
};

export type RecruitmentChatMessage = {
  id: number;
  senderType: "CANDIDATE" | "AI" | "HR" | "SYSTEM";
  direction: "INBOUND" | "OUTBOUND";
  content: string | null;
  contentType: string;
  createdAt: string;
  authorId: number | null;
  authorName: string | null;
  delivery: string | null;
  outboxId: number | null;
  outboxStatus: string | null;
  outboxError: string | null;
  sentAt: string | null;
  approvalState: string | null;
};

export type RecruitmentConversationDetail = {
  conversation: {
    id: number;
    status: string;
    controlMode: ConversationControlMode;
    controlVersion: number;
    candidateId: number;
    candidateName: string | null;
    candidatePhone: string | null;
    applicationId: number | null;
    applicationStatus: string | null;
    aiPaused: boolean | null;
    jobTitle: string | null;
    takenOverById: number | null;
    takenOverByName: string | null;
  };
  messages: RecruitmentChatMessage[];
};

export type RecruitmentConversationControl = {
  conversationId: number;
  candidateId: number;
  state: "AI_ACTIVE" | "AI_PAUSED" | "HUMAN_TAKEOVER" | "CLOSED";
  mode: ConversationControlMode;
  version: number;
  pausedBy: string[];
  resumeSignalPending: boolean;
  takenOverBy: number | null;
};

export type ApprovalView =
  | "pending"
  | "approved"
  | "sent"
  | "rejected"
  | "failed"
  | "all";

export type RecruitmentApprovalItem = {
  outboxId: number;
  status: string;
  createdAt: string;
  sentAt: string | null;
  dispatchedAt: string | null;
  lastErrorCode: string | null;
  attemptCount: number;
  approvalState: string | null;
  approvalVersion: number | null;
  approvedAt: string | null;
  expiresAt: string | null;
  approvedById: number | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedById: number | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  messageId: number;
  messageText: string | null;
  draftedAt: string;
  conversationId: number;
  controlMode: ConversationControlMode;
  conversationStatus: string;
  candidateId: number;
  candidateName: string | null;
  applicationId: number | null;
  applicationStatus: string | null;
  jobTitle: string | null;
};

export type RecruitmentApprovalEvent = {
  id: number;
  version: number;
  action: string;
  actorId: number | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
  edited: boolean;
};

export type RecruitmentApprovalDetail = RecruitmentApprovalItem & {
  events: RecruitmentApprovalEvent[];
  context: RecruitmentChatMessage[];
};

export type RecruitmentOverview = {
  counts: {
    candidates: number;
    activeConversations: number;
    humanConversations: number;
    awaitingApproval: number;
    approvedWaitingSend: number;
    approved: number;
    rejected: number;
    revokedOrExpired: number;
    sent: number;
    sendFailed: number;
    sendRetrying: number;
    inboxPending: number;
    inboxFailed: number;
    openAlerts: number;
  };
  recent: {
    id: number;
    createdAt: string;
    actorId: number | null;
    actorName: string | null;
    action: string;
    path: string;
  }[];
};

export type RuntimeScope = "AI" | "WORKER" | "OUTBOUND";

export type RecruitmentRuntimeControls = {
  aiHalted: boolean;
  workerHalted: boolean;
  outboundHalted: boolean;
  reason: string | null;
  updatedBy: number | null;
  updatedAt: string | null;
  failsafeHalted: boolean;
  failsafeReason: string | null;
  failsafeAt: string | null;
  failClosed: boolean;
};

export type RecruitmentEventStats = {
  byStatus: {
    status: string;
    failureCode: string | null;
    count: number;
    oldest: string | null;
  }[];
} & Record<string, unknown>;

export type RecruitmentHrAlert = {
  id: number;
  type: string;
  severity: string;
  status: string;
  sourceKey: string;
  candidateId: number | null;
  applicationId: number | null;
  conversationId: number | null;
  handoffId: number | null;
  outboxId: number | null;
  eventId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: number | null;
  acknowledgedByName: string | null;
};

export type RecruitmentCandidateDetail = RecruitmentCandidate & {
  education?: string | null;
  experienceSummary?: string | null;
  availableFrom?: string | null;
  cvUrl?: string | null;
  notes?: string | null;
  aiStoppedAt?: string | null;
  zaloOaId?: string | null;
  zaloUserId?: string | null;
  updatedAt?: string;
  applications?: {
    id: number;
    status: string;
    job?: { id: number; title: string; code?: string } | null;
    aiMatchScore?: number | null;
    createdAt?: string;
  }[];
};

export const recruitmentApi = {
  summary: async () =>
    (await api.get<RecruitmentSummary>("/recruitment/dashboard/summary")).data,

  aiUsage: async () =>
    (await api.get<RecruitmentAiUsage>("/recruitment/operations/ai-usage"))
      .data,

  applications: async (params: Record<string, unknown> = {}) =>
    (
      await api.get<
        Paginated<RecruitmentApplication> & {
          countsByStatus: Record<string, number>;
        }
      >("/recruitment/applications/pipeline", { params })
    ).data,

  application: async (id: number) =>
    (await api.get<RecruitmentApplication>(`/recruitment/applications/${id}`))
      .data,

  candidates: async (params: Record<string, unknown> = {}) =>
    (
      await api.get<Paginated<RecruitmentCandidate>>(
        "/recruitment/candidates",
        { params }
      )
    ).data,

  jobs: async (params: Record<string, unknown> = {}) =>
    (
      await api.get<Paginated<RecruitmentJob>>("/recruitment/jobs", {
        params,
      })
    ).data,

  interviews: async (params: Record<string, unknown> = {}) =>
    (
      await api.get<Paginated<RecruitmentInterview>>(
        "/recruitment/interviews",
        { params }
      )
    ).data,

  handoffs: async (params: Record<string, unknown> = {}) =>
    (
      await api.get<Paginated<RecruitmentHandoff>>("/recruitment/handoffs", {
        params,
      })
    ).data,

  createCandidate: async (payload: Record<string, unknown>) =>
    (await api.post<RecruitmentCandidate>("/recruitment/candidates", payload))
      .data,

  createJob: async (payload: Record<string, unknown>) =>
    (await api.post<RecruitmentJob>("/recruitment/jobs", payload)).data,

  job: async (id: number) =>
    (await api.get<RecruitmentJob>(`/recruitment/jobs/${id}`)).data,

  updateJob: async (id: number, payload: UpdateRecruitmentJobPayload) =>
    (await api.patch<RecruitmentJob>(`/recruitment/jobs/${id}`, payload)).data,

  /** DRAFT/PAUSED → ACTIVE; backend trả 409 nếu trạng thái hiện tại không cho phép. */
  publishJob: async (id: number) =>
    (await api.post<RecruitmentJob>(`/recruitment/jobs/${id}/publish`)).data,

  changeApplicationStatus: async (
    id: number,
    payload: { status: string; rejectedReason?: string; note?: string }
  ) =>
    (
      await api.patch<RecruitmentApplication>(
        `/recruitment/applications/${id}/status`,
        payload
      )
    ).data,

  resumeAi: async (id: number) =>
    (
      await api.post<RecruitmentApplication>(
        `/recruitment/applications/${id}/resume-ai`,
        {
          status: "COLLECTING_INFO",
          note: "HR trả hồ sơ lại cho AI từ giao diện quản trị",
        }
      )
    ).data,

  resolveHandoff: async (id: number, note?: string) =>
    (
      await api.post<RecruitmentHandoff>(
        `/recruitment/handoffs/${id}/resolve`,
        { note: note || undefined }
      )
    ).data,

  // ---- màn Nhân sự -----------------------------------------------------------------------
  overview: async () =>
    (await api.get<RecruitmentOverview>("/recruitment/operations/overview"))
      .data,

  approvals: async (params: {
    view?: ApprovalView;
    page?: number;
    limit?: number;
  }) =>
    (
      await api.get<Paginated<RecruitmentApprovalItem>>(
        "/recruitment/operations/approvals",
        { params }
      )
    ).data,

  approval: async (outboxId: number) =>
    (
      await api.get<RecruitmentApprovalDetail>(
        `/recruitment/operations/approvals/${outboxId}`
      )
    ).data,

  /** p32 — requestId giữ nguyên khi bấm lại cùng thao tác (idempotent). */
  approveOutbox: async (outboxId: number, requestId: string) =>
    (
      await api.post(`/recruitment/operations/outbox/${outboxId}/approve`, {
        requestId,
      })
    ).data,

  editAndApproveOutbox: async (
    outboxId: number,
    text: string,
    requestId: string
  ) =>
    (
      await api.post(
        `/recruitment/operations/outbox/${outboxId}/edit-and-approve`,
        { requestId, text }
      )
    ).data,

  rejectOutbox: async (outboxId: number, reason: string, requestId: string) =>
    (
      await api.post(`/recruitment/operations/outbox/${outboxId}/reject`, {
        requestId,
        reason,
      })
    ).data,

  /** Đối soát tin UNKNOWN (có thể đã tới Zalo): chỉ chạy được khi tin đang UNKNOWN. */
  markOutboxSent: async (outboxId: number) =>
    (await api.post(`/recruitment/operations/outbox/${outboxId}/mark-sent`, {}))
      .data,

  retryOutbox: async (outboxId: number) =>
    (
      await api.post(`/recruitment/operations/outbox/${outboxId}/retry`, {
        confirmDuplicateRisk: true,
      })
    ).data,

  deadLetterOutbox: async (outboxId: number) =>
    (await api.post(`/recruitment/operations/outbox/${outboxId}/dead-letter`))
      .data,

  conversations: async (params: {
    keyword?: string;
    mode?: ConversationControlMode;
    pendingOnly?: boolean;
    page?: number;
    limit?: number;
  }) =>
    (
      await api.get<Paginated<RecruitmentConversationSummary>>(
        "/recruitment/conversations",
        { params }
      )
    ).data,

  conversationMessages: async (id: number, limit = 200) =>
    (
      await api.get<RecruitmentConversationDetail>(
        `/recruitment/conversations/${id}/messages`,
        { params: { limit } }
      )
    ).data,

  conversationControl: async (id: number) =>
    (
      await api.get<RecruitmentConversationControl>(
        `/recruitment/conversations/${id}/control`
      )
    ).data,

  takeoverConversation: async (id: number) =>
    (await api.post(`/recruitment/conversations/${id}/takeover`)).data,

  sendHrMessage: async (id: number, content: string, clientMessageId: string) =>
    (
      await api.post(`/recruitment/conversations/${id}/messages`, {
        content,
        clientMessageId,
      })
    ).data,

  resumeConversationAi: async (id: number, note?: string) =>
    (
      await api.post(`/recruitment/conversations/${id}/resume-ai`, {
        note: note || undefined,
      })
    ).data,

  closeConversation: async (id: number) =>
    (await api.post(`/recruitment/conversations/${id}/close`)).data,

  runtimeControls: async () =>
    (
      await api.get<RecruitmentRuntimeControls>(
        "/recruitment/operations/runtime-controls"
      )
    ).data,

  stopRuntime: async (scopes: RuntimeScope[], reason: string) =>
    (
      await api.post<RecruitmentRuntimeControls>(
        "/recruitment/operations/runtime-controls/stop",
        { scopes, reason }
      )
    ).data,

  resumeRuntime: async (scopes: RuntimeScope[], reason: string) =>
    (
      await api.post<RecruitmentRuntimeControls>(
        "/recruitment/operations/runtime-controls/resume",
        { scopes, reason }
      )
    ).data,

  eventStats: async () =>
    (
      await api.get<RecruitmentEventStats>(
        "/recruitment/operations/events/stats"
      )
    ).data,

  alerts: async (params: {
    status?: "OPEN" | "ACKNOWLEDGED";
    limit?: number;
  }) =>
    (
      await api.get<RecruitmentHrAlert[]>("/recruitment/operations/alerts", {
        params,
      })
    ).data,

  acknowledgeAlert: async (id: number) =>
    (await api.post(`/recruitment/operations/alerts/${id}/acknowledge`)).data,

  candidate: async (id: number) =>
    (await api.get<RecruitmentCandidateDetail>(`/recruitment/candidates/${id}`))
      .data,
};
