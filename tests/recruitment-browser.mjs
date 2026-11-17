/** Isolated UI contract test: VITE_API_URL=/__recruitment_test_api vite --host 127.0.0.1 --port 4188
 * PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/recruitment-browser.mjs
 * Every Recruitment API request is mocked. No production data or provider calls.
 */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/New_York" });
const calls = [];
const errors = [];
let passed = 0;
const candidate = { id: 47, fullName: "Ứng viên giả lập", phone: "0900000000", email: null, source: "MANUAL", location: "Cà Mau", skills: ["Excel"], createdAt: "2026-10-01T00:00:00Z", applications: [] };
const job = { id: 3, code: "TEST-ONLY", title: "Vị trí giả lập", status: "ACTIVE", employmentType: "FULL_TIME", numberOfPositions: 1, currency: "VND", salaryMin: null, salaryMax: null, location: "Cà Mau", screeningCriteria: {}, createdAt: "2026-10-01T00:00:00Z" };
const app = { id: 12, candidateId: 47, candidate, jobId: 3, job, status: "QUALIFIED", aiPaused: false, allowedNextStatuses: ["INTERVIEW", "NEEDS_HR_REVIEW"], createdAt: candidate.createdAt, updatedAt: candidate.createdAt };
let interview = { id: 8, applicationId: 12, candidateId: 47, candidate, jobId: 3, job, status: "PROPOSED", allowedNextStatuses: ["CONFIRMED", "CANCELLED"], scheduledStart: "2099-12-01T02:00:00Z", scheduledEnd: "2099-12-01T03:00:00Z", location: "Văn phòng giả lập" };
let slot = { id: 9, jobId: null, startAt: "2099-12-01T02:00:00Z", endAt: "2099-12-01T03:00:00Z", capacity: 2, bookedCount: 0, isActive: true, location: "Văn phòng giả lập" };
let duplicate = false;
const handoff = { id: 4, candidateId: 47, candidate, applicationId: 12, application: app, reason: "CANDIDATE_REQUESTED_HUMAN", priority: "NORMAL", summary: "Yêu cầu giả lập", status: "OPEN", createdAt: candidate.createdAt };
const conversation = { id: 5, candidateId: 47, candidateName: "Ứng viên giả lập", channel: "ZALO", status: "ACTIVE", controlMode: "HUMAN_TAKEOVER", createdAt: candidate.createdAt, pendingApprovals: 0 };
const hrMessage = { id: 60, senderType: "HR", content: "Tin giả lập đang chờ gửi", createdAt: candidate.createdAt, outboxId: 77, outboxStatus: "PENDING" };
const hrUnknowns = [81, 82, 83].map(id => ({ id, senderType: "HR", content: `Tin giả lập cần đối soát #${id}`, createdAt: candidate.createdAt, outboxId: id, outboxStatus: "UNKNOWN" }));
const paged = (data, url, total = data.length) => ({ data, total, page: Number(url.searchParams.get("page") || 1), limit: Number(url.searchParams.get("limit") || 20) });
page.on("pageerror", e => errors.push(e.message));
page.on("dialog", d => d.accept());
await page.route("**/__recruitment_test_api/**", async route => {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname.replace("/__recruitment_test_api", "");
  const method = req.method();
  const body = req.postDataJSON();
  calls.push({ path, method, body, query: Object.fromEntries(url.searchParams) });
  let data;
  if (path.endsWith("/summary")) data = { newCandidates: 0, screening: 0, qualified: 131, interviews: 1, offers: 0, hired: 0, needsHrReview: 0, totalApplications: 131, openHandoffs: 0, upcomingInterviews: 1, activeJobs: 1, byStatus: {} };
  else if (path.endsWith("/overview")) data = { counts: { awaitingApproval: 0, approvedWaitingSend: 0, activeConversations: 0, humanConversations: 0, sent: 0, rejected: 0, sendFailed: 0, openAlerts: 0, sendRetrying: 0 }, recent: [] };
  else if (path.endsWith("/ai-usage")) { await route.fulfill({ status: 404, json: { message: "not enabled in test" } }); return; }
  else if (path.endsWith("/applications/pipeline")) data = { ...paged([app], url, url.searchParams.has("keyword") ? 1 : 131), countsByStatus: { QUALIFIED: 131 } };
  else if (path === "/recruitment/applications/12") data = app;
  else if (path === "/recruitment/candidates") {
    if (method === "POST") {
      if (!body.allowDuplicate) { await route.fulfill({ status: 409, json: { code: "POSSIBLE_DUPLICATE", message: "Ứng viên giả lập trùng liên hệ" } }); return; }
      data = { ...candidate, id: 48 };
    } else data = paged([candidate], url);
  }
  else if (path === "/recruitment/candidates/47") {
    if (method === "PATCH") {
      if (duplicate && !body.allowDuplicate) { await route.fulfill({ status: 409, json: { code: "POSSIBLE_DUPLICATE", message: "Liên hệ trùng hồ sơ giả lập" } }); return; }
      Object.assign(candidate, body);
    }
    data = candidate;
  }
  else if (path === "/recruitment/conversations") data = paged([conversation], url);
  else if (path === "/recruitment/conversations/5/messages") data = { conversation, messages: [hrMessage, ...hrUnknowns] };
  else if (path === "/recruitment/conversations/5/control") data = { state: "HUMAN_TAKEOVER", mode: "HUMAN_TAKEOVER", pausedBy: [] };
  else if (path === "/recruitment/operations/outbox/77/cancel") { hrMessage.outboxStatus = "DEAD_LETTER"; data = { id: 77 }; }
  else if (/\/operations\/outbox\/8[123]\/(mark-sent|retry|dead-letter)$/.test(path)) {
    const id = Number(path.split('/').at(-2));
    hrUnknowns.find(m => m.id === id).outboxStatus = path.endsWith('mark-sent') ? 'SENT' : path.endsWith('retry') ? 'RETRY' : 'DEAD_LETTER';
    data = { id };
  }
  else if (path.endsWith("/deletion-request")) { candidate.deletionRequestedAt = "2026-10-24T00:00:00Z"; data = { aiStopped: true }; }
  else if (path === "/recruitment/jobs/positions") data = [{ value: "sales", label: "Nhân viên KD" }, { value: "giaovien_ctv", label: "Giáo viên CTV" }];
  else if (path === "/departments") data = [];
  else if (path === "/recruitment/jobs") data = method === "POST" ? { ...job, ...body, id: 4, status: "DRAFT" } : paged([job], url);
  else if (path === "/recruitment/applications/12/status") { Object.assign(app, { status: body.status, employeeId: 91, allowedNextStatuses: [] }); data = app; }
  else if (path === "/recruitment/jobs/3") { if (method === "PATCH") Object.assign(job, body); data = job; }
  else if (/\/jobs\/3\/(pause|close|publish)$/.test(path)) { job.status = path.endsWith("pause") ? "PAUSED" : path.endsWith("close") ? "CLOSED" : "ACTIVE"; data = job; }
  else if (path === "/recruitment/applications" && method === "POST") { candidate.applications = [{ id: 12, status: "NEW", job }]; data = app; }
  else if (path === "/recruitment/interviews") { data = method === "GET" ? paged([interview], url) : interview; }
  else if (path === "/recruitment/interviews/8") { if (method === "PATCH") { Object.assign(interview, body); interview.allowedNextStatuses = interview.status === "CONFIRMED" ? ["COMPLETED", "CANCELLED", "NO_SHOW"] : []; } data = interview; }
  else if (path === "/recruitment/interview-slots") { if (method === "POST") Object.assign(slot, body); data = method === "GET" ? paged([slot], url) : slot; }
  else if (path === "/recruitment/interview-slots/9") { Object.assign(slot, body); data = slot; }
  else if (path === "/recruitment/handoffs") data = paged(handoff.status === "OPEN" ? [handoff] : [], url);
  else if (path === "/recruitment/handoffs/4/resolve") { handoff.status = "RESOLVED"; data = handoff; }
  else if (path.endsWith("/runtime-controls")) data = { aiHalted: false, workerHalted: false, outboundHalted: true, failsafeHalted: false, failClosed: false };
  else if (path.endsWith("/events/stats")) data = { byStatus: [] };
  else if (path.endsWith("/alerts")) data = [];
  else if (path.endsWith("/outbound-usage")) data = { productionMode: true, authorizationId: 1, today: { requests: 3, estimatedCostVnd: 0 }, month: { requests: 3, estimatedCostVnd: 0 }, limits: { maxRequestsPerRecipientWindow: 25, recipientWindowHours: 5, maxRequestsPerRecipientDay: 25, maxRequestsPerDay: 100, dailyCostBudgetVnd: 0, monthlyCostBudgetVnd: 0, interactionWindowHours: 48, freeWindowHours: 48 } };
  else { await route.fulfill({ status: 500, json: { message: `Unhandled mock ${method} ${path}` } }); return; }
  await route.fulfill({ json: data });
});
const token = role => `test.${Buffer.from(JSON.stringify({ roles: [role], sub: 9999, name: "HR giả lập", exp: 9999999999 })).toString("base64url")}.test`;
await page.addInitScript(value => { if (!localStorage.getItem("access_token")) localStorage.setItem("access_token", value); }, token("nhansu"));
const check = name => { passed++; console.log(`PASS ${name}`); };
const write = (path, method) => calls.filter(c => c.path === path && c.method === method).at(-1);
const until = async fn => { for (let i = 0; i < 100; i++) { if (fn()) return; await page.waitForTimeout(100); } assert.fail("timed out waiting for API call"); };
const closeModal = async () => { await page.getByRole("dialog").getByRole("button").filter({ has: page.locator("svg") }).first().click(); };
try {
  await page.goto(process.env.RECRUITMENT_UI_URL || "http://127.0.0.1:4188/tests/recruitment-harness.html");
  await page.getByText("Trang 1/5", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Sau", exact: true }).click();
  await until(() => calls.some(c => c.path.endsWith("/pipeline") && c.query.page === "2"));
  await page.getByPlaceholder("Tìm tên, SĐT, email ứng viên…").fill("giả lập");
  await until(() => calls.some(c => c.path.endsWith("/pipeline") && c.query.keyword === "giả lập" && c.query.page === "1"));
  check("pipeline paginates beyond 100 and searches on server");

  await page.getByRole("button", { name: "Thêm ứng viên", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Họ và tên", { exact: true }).fill("Ứng viên nhập tay giả lập");
  await page.getByRole("dialog").getByLabel("Số điện thoại", { exact: true }).fill("0900000000");
  await page.getByRole("button", { name: "Tạo ứng viên", exact: true }).click();
  await page.getByRole("checkbox", { name: /Tôi đã đối chiếu liên hệ trùng/ }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Tạo ứng viên", exact: true }).isDisabled(), true);
  await page.getByRole("checkbox", { name: /Tôi đã đối chiếu liên hệ trùng/ }).check();
  await page.getByRole("button", { name: "Tạo ứng viên", exact: true }).click();
  await until(() => write("/recruitment/candidates", "POST")?.body.allowDuplicate === true);
  check("creating a duplicate candidate requires explicit HR acknowledgement");

  await page.getByRole("button", { name: /^Ứng viên\s*1$/ }).click();
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click();
  await page.getByLabel("Khu vực", { exact: true }).fill("Khu vực giả lập mới");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await until(() => !!write("/recruitment/candidates/47", "PATCH"));
  assert.deepEqual(write("/recruitment/candidates/47", "PATCH").body, { location: "Khu vực giả lập mới" });
  check("candidate profile patch only sends changed fields");

  await page.getByRole("button", { name: "Gắn vị trí tuyển dụng" }).click();
  await page.getByLabel("Vị trí ứng tuyển", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Tạo hồ sơ ứng tuyển", exact: true }).click();
  await until(() => !!write("/recruitment/applications", "POST"));
  assert.deepEqual(write("/recruitment/applications", "POST").body, { candidateId: 47, jobId: 3 });
  check("manual application binds exact candidate and job");

  duplicate = true;
  await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).click();
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0900000001");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await page.getByText("Tôi đã đối chiếu", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).isDisabled(), true);
  await page.getByRole("checkbox", { name: /Tôi đã đối chiếu/ }).check();
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await until(() => write("/recruitment/candidates/47", "PATCH")?.body.allowDuplicate === true);
  check("duplicate contact requires explicit HR acknowledgement");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();

  await page.getByRole("button", { name: /^Phỏng vấn\s*1$/ }).click();
  await page.getByRole("button", { name: "Khung giờ cho AI đề xuất" }).click();
  await page.getByRole("button", { name: "Mở khung giờ", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Bắt đầu", { exact: true }).fill("2099-12-01T09:00");
  await page.getByRole("dialog").getByLabel("Kết thúc", { exact: true }).fill("2099-12-01T10:00");
  await page.getByRole("button", { name: "Lưu khung giờ", exact: true }).click();
  await until(() => !!write("/recruitment/interview-slots", "POST"));
  assert.equal(write("/recruitment/interview-slots", "POST").body.startAt, "2099-12-01T09:00:00+07:00");
  check("slot creation uses Vietnam time even on a US browser");
  await page.getByRole("button", { name: "Đóng khung giờ", exact: true }).click();
  await until(() => write("/recruitment/interview-slots/9", "PATCH")?.body.isActive === false);
  check("closing a slot does not cancel booked interviews");

  slot.isActive = true;
  await page.getByRole("button", { name: "Lịch phỏng vấn", exact: true }).click();
  await page.getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true }).click();
  await page.getByLabel("Hồ sơ phỏng vấn", { exact: true }).selectOption("12");
  await page.getByLabel("Khung giờ phỏng vấn", { exact: true }).selectOption("9");
  await page.getByRole("button", { name: "Tạo lịch chờ xác nhận", exact: true }).click();
  await until(() => !!write("/recruitment/interviews", "POST"));
  assert.deepEqual(write("/recruitment/interviews", "POST").body, { applicationId: 12, slotId: 9 });
  check("HR schedules through backend without inventing workflow state");

  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByLabel("Trạng thái mới", { exact: true }).waitFor();
  const statuses = await page.getByLabel("Trạng thái mới", { exact: true }).locator("option").allTextContents();
  assert.deepEqual(statuses, ["Giữ trạng thái hiện tại", "Đã xác nhận", "Đã huỷ"]);
  await page.getByLabel("Trạng thái mới", { exact: true }).selectOption("CONFIRMED");
  await page.getByRole("button", { name: "Lưu lịch phỏng vấn", exact: true }).click();
  await until(() => write("/recruitment/interviews/8", "PATCH")?.body.status === "CONFIRMED");
  check("interview actions come only from backend allowedNextStatuses");
  await page.getByLabel("Trạng thái mới", { exact: true }).selectOption("CANCELLED");
  assert.equal(await page.getByRole("button", { name: "Lưu lịch phỏng vấn", exact: true }).isDisabled(), true);
  await page.getByLabel("Lý do huỷ", { exact: true }).fill("Ứng viên giả lập xin huỷ");
  await page.getByRole("button", { name: "Lưu lịch phỏng vấn", exact: true }).click();
  await until(() => write("/recruitment/interviews/8", "PATCH")?.body.status === "CANCELLED");
  assert.equal(write("/recruitment/interviews/8", "PATCH").body.cancellationReason, "Ứng viên giả lập xin huỷ");
  check("cancelling interviews requires a reason");
  await closeModal();

  assert.equal(await page.getByRole("button", { name: "Tạo vị trí", exact: true }).count(), 0);
  await page.getByRole("button", { name: /^Vị trí tuyển\s*1$/ }).click();
  await page.getByPlaceholder("Tìm tên hoặc mã vị trí…").waitFor();
  assert.equal(await page.locator("header").getByRole("button", { name: "Tạo vị trí", exact: true }).count(), 0);
  assert.equal(await page.locator("header").getByRole("button", { name: "Thêm ứng viên", exact: true }).count(), 1);
  check("create-job button lives in the jobs tab, header keeps add-candidate");
  await page.getByRole("button", { name: "Tạo vị trí", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Mã vị trí", { exact: true }).fill("NEW-SYNTHETIC");
  assert.equal(await page.getByRole("dialog").locator('input[name="title"]').count(), 0);
  await page.getByLabel("Chức danh hệ thống", { exact: true }).selectOption("giaovien_ctv");
  await page.getByRole("dialog").getByLabel("Kinh nghiệm tối thiểu (tháng)", { exact: true }).fill("12");
  await page.getByRole("dialog").getByLabel("Kỹ năng bắt buộc (dấu phẩy)", { exact: true }).fill("Giao tiếp, Excel, Giao tiếp");
  await page.getByRole("dialog").getByRole("checkbox", { name: "Ưu tiên có thể bắt đầu ngay" }).check();
  if (process.env.RECRUITMENT_JOB_SCREENSHOT) await page.screenshot({ path: process.env.RECRUITMENT_JOB_SCREENSHOT });
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await until(() => !!write("/recruitment/jobs", "POST"));
  assert.equal(write("/recruitment/jobs", "POST").body.positionRole, "giaovien_ctv");
  assert.equal(write("/recruitment/jobs", "POST").body.title, "Giáo viên CTV");
  check("new job selects an existing system position, not a free-form role");
  assert.deepEqual(write("/recruitment/jobs", "POST").body.screeningCriteria, { minimumExperienceMonths: 12, requiredSkills: ["Giao tiếp", "Excel"], preferredSkills: [], locations: [], availableImmediatelyPreferred: true });
  check("new job sends screening criteria in the create request");
  await page.getByRole("button", { name: /TEST-ONLY/ }).click();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await page.getByLabel("Chức danh hệ thống", { exact: true }).selectOption("sales");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await until(() => write("/recruitment/jobs/3", "PATCH")?.body.positionRole === "sales");
  check("legacy job can be explicitly mapped to a system position");
  await page.getByRole("button", { name: "Sửa tiêu chí sàng lọc", exact: true }).click();
  await page.getByLabel("Kinh nghiệm tối thiểu (tháng)", { exact: true }).fill("6");
  await page.getByRole("button", { name: "Lưu tiêu chí", exact: true }).click();
  await until(() => write("/recruitment/jobs/3", "PATCH")?.body.screeningCriteria?.minimumExperienceMonths === 6);
  check("HR screening criteria reach the existing backend schema");
  await page.getByRole("button", { name: "Tạm dừng tuyển", exact: true }).click();
  await until(() => !!write("/recruitment/jobs/3/pause", "POST"));
  await page.getByRole("button", { name: "Đóng vị trí", exact: true }).click();
  await until(() => !!write("/recruitment/jobs/3/close", "POST"));
  check("HR can pause and close recruitment jobs");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();

  await page.getByRole("button", { name: /^Vận hành/ }).click();
  await page.getByText("Cửa sổ trượt:", { exact: false }).waitFor();
  assert.match(await page.locator("body").innerText(), /25 lượt\/ứng viên trong 5 giờ/);
  check("operations shows effective rolling quotas and costs");

  await page.getByRole("button", { name: /^Yêu cầu HR/ }).click();
  await page.getByRole("button", { name: "Đã xử lý", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Lưu kết quả xử lý", exact: true }).isDisabled(), true);
  await page.getByLabel("Kết quả xử lý", { exact: true }).fill("HR giả lập đã liên hệ ứng viên");
  await page.getByRole("button", { name: "Lưu kết quả xử lý", exact: true }).click();
  await until(() => !!write("/recruitment/handoffs/4/resolve", "POST"));
  assert.equal(write("/recruitment/handoffs/4/resolve", "POST").body.note, "HR giả lập đã liên hệ ứng viên");
  check("HR handoff completion records a meaningful resolution note");

  await page.getByRole("button", { name: /^Hội thoại Zalo/ }).click();
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByRole("button", { name: "Huỷ tin HR chờ gửi", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("textbox").fill("HR giả lập huỷ tin cũ");
  await page.getByRole("alertdialog").getByRole("button", { name: "Huỷ tin", exact: true }).click();
  await until(() => !!write("/recruitment/operations/outbox/77/cancel", "POST"));
  assert.equal(write("/recruitment/operations/outbox/77/cancel", "POST").body.reason, "HR giả lập huỷ tin cũ");
  check("HR can cancel only a queued HR message with an audit reason");

  await page.getByRole("button", { name: "Đánh dấu HR đã gửi", exact: true }).first().click();
  await page.getByRole("button", { name: "Xác nhận đã gửi", exact: true }).click();
  await until(() => !!write("/recruitment/operations/outbox/81/mark-sent", "POST"));
  check("HR can reconcile an UNKNOWN message as delivered after confirmation");
  await page.getByRole("button", { name: "Gửi lại tin HR chưa rõ", exact: true }).first().click();
  assert.equal(await page.getByRole("button", { name: "Xác nhận gửi lại", exact: true }).isDisabled(), true);
  await page.getByRole("checkbox", { name: /Tôi chấp nhận khả năng/ }).check();
  await page.getByRole("button", { name: "Xác nhận gửi lại", exact: true }).click();
  await until(() => !!write("/recruitment/operations/outbox/82/retry", "POST"));
  assert.equal(write("/recruitment/operations/outbox/82/retry", "POST").body.confirmDuplicateRisk, true);
  check("UNKNOWN retry requires explicit duplicate-risk acceptance");
  await page.getByRole("button", { name: "Bỏ tin HR chưa rõ", exact: true }).first().click();
  await page.getByRole("button", { name: "Kết thúc tin chưa rõ", exact: true }).click();
  await until(() => !!write("/recruitment/operations/outbox/83/dead-letter", "POST"));
  check("HR can terminate UNKNOWN tracking without resending");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();

  app.status = "OFFER"; app.allowedNextStatuses = ["HIRED", "REJECTED", "WITHDRAWN"];
  job.positionRole = null;
  await page.getByRole("button", { name: /^Pipeline/ }).click();
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByLabel("Trạng thái hồ sơ mới").selectOption("HIRED");
  assert.equal(await page.getByRole("button", { name: "Cập nhật trạng thái", exact: true }).isDisabled(), true);
  await page.getByText("Vị trí cũ chưa gắn chức danh.", { exact: false }).waitFor();
  check("unmapped legacy job cannot grant an account");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  job.positionRole = "sales";
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByLabel("Trạng thái hồ sơ mới").selectOption("HIRED");
  assert.equal(await page.getByRole("button", { name: "Cập nhật trạng thái", exact: true }).isDisabled(), true);
  await page.getByLabel("Mật khẩu ban đầu", { exact: true }).fill("Synthetic-only-2026");
  assert.equal(await page.getByRole("button", { name: "Cập nhật trạng thái", exact: true }).isDisabled(), true);
  await page.getByRole("checkbox", { name: /Tôi xác nhận tuyển thành công/ }).check();
  await page.getByRole("button", { name: "Cập nhật trạng thái", exact: true }).click();
  await until(() => !!write("/recruitment/applications/12/status", "PATCH"));
  assert.deepEqual(write("/recruitment/applications/12/status", "PATCH").body, { status: "HIRED", password: "Synthetic-only-2026", confirmAccountRole: true, accountPositionRole: "sales" });
  check("hiring requires credential and explicit role consent and submits the backend transition");
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByText("Đã tạo tài khoản nhân viên #91.", { exact: false }).waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  check("hired application shows account reference but never exposes its password");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await page.getByRole("button", { name: /^Ứng viên\s*1$/ }).click();
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  await page.getByRole("button", { name: "Ghi nhận yêu cầu xoá", exact: true }).click();
  await page.getByLabel("Nội dung yêu cầu của ứng viên", { exact: true }).fill("Ứng viên giả lập yêu cầu dừng và xoá dữ liệu");
  await page.getByRole("button", { name: "Xác nhận ghi nhận yêu cầu", exact: true }).click();
  await until(() => !!write("/recruitment/candidates/47/deletion-request", "POST"));
  check("privacy request uses the existing pause-and-HR-handoff API");

  await page.evaluate(value => localStorage.setItem("access_token", value), token("director"));
  await page.reload();
  await page.getByText("Bạn đang ở chế độ chỉ xem.", { exact: false }).waitFor();
  await page.getByRole("button", { name: /^Vị trí tuyển\s*1$/ }).click();
  await page.getByPlaceholder("Tìm tên hoặc mã vị trí…").waitFor();
  assert.equal(await page.getByRole("button", { name: "Tạo vị trí", exact: true }).count(), 0);
  await page.getByRole("button", { name: /^Phỏng vấn\s*1$/ }).click();
  assert.equal(await page.getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true }).count(), 0);
  await page.getByRole("button", { name: /^Ứng viên\s*1$/ }).click();
  await page.getByRole("button", { name: /Ứng viên giả lập/ }).click();
  assert.equal(await page.getByRole("button", { name: "Sửa hồ sơ", exact: true }).count(), 0);
  check("director read-only role has no candidate or interview mutation controls");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await page.evaluate(value => localStorage.setItem("access_token", value), token("nhansu"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: /^Phỏng vấn\s*1$/ }).click();
  await page.getByRole("button", { name: "Tạo lịch phỏng vấn", exact: true }).click();
  const mobileBox = await page.getByRole("dialog").boundingBox();
  assert(mobileBox && mobileBox.x >= 0 && mobileBox.x + mobileBox.width <= 391);
  if (process.env.RECRUITMENT_SCREENSHOT) await page.screenshot({ path: process.env.RECRUITMENT_SCREENSHOT });
  check("interview form stays inside the mobile viewport");
  assert.deepEqual(errors, []);
  console.log(`\n${passed}/${passed} browser scenarios PASS; 0 page errors; mocked API only`);
} catch (error) {
  console.error("Page errors", errors);
  console.error("Last requests", calls.slice(-8));
  console.error((await page.locator("body").innerText()).slice(-7000));
  throw error;
} finally { await browser.close(); }
