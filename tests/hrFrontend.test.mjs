import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  addDays,
  assignmentStatus,
  hasPermission,
  hrCapabilities,
  hrNavItems,
  isSensitiveRole,
  isValidReason,
  latestSensitiveEffectiveTo,
  vnToday,
} from "../src/pages/Hr/lib/hrAccess.ts";
import { describeHrError, NOT_FOUND_OR_FORBIDDEN } from "../src/pages/Hr/lib/hrErrors.ts";
import {
  canRequestFileAccess,
  fileNeedsReason,
  UPLOADABLE_DOCUMENT_TYPES,
  validateHrUpload,
} from "../src/pages/Hr/lib/hrFiles.ts";
import { ExpiringSecret, REVEAL_TTL_MS } from "../src/pages/Hr/lib/expiringSecret.ts";
import { validateIdentifier } from "../src/pages/Hr/lib/hrIdentifiers.ts";
import { summarizeAuditValue, auditActionLabel } from "../src/pages/Hr/lib/hrAudit.ts";

const access = (...grants) => ({
  accountId: 1,
  on: "2026-09-30",
  permissions: grants.map(([code, scope = "COMPANY"]) => ({
    code,
    scopes: [{ scope, scopeRefId: null, source: "assignment", via: "x" }],
  })),
});
const httpError = (status, data) => ({ response: { status, data } });

// ── Permission ──────────────────────────────────────────────────────────

test("[1] không có ACCESS_ADMIN → không có nút cấp quyền", () => {
  assert.equal(hrCapabilities(access(["ACCESS_VIEW"])).canGrantRoles, false);
  assert.equal(hrCapabilities(null).canGrantRoles, false);
});

test("[2] có ACCESS_ADMIN → có nút cấp quyền", () => {
  assert.equal(hrCapabilities(access(["ACCESS_ADMIN"])).canGrantRoles, true);
});

test("[3] không có IDENTITY_REVEAL → không có nút xem đầy đủ giấy tờ", () => {
  assert.equal(hrCapabilities(access(["EMPLOYEE_VIEW", "BANK_REVEAL"])).canRevealIdentity, false);
  assert.equal(hrCapabilities(access(["IDENTITY_REVEAL"])).canRevealIdentity, true);
});

test("[4] không có BANK_REVEAL → không có nút xem đầy đủ số TK", () => {
  assert.equal(hrCapabilities(access(["EMPLOYEE_VIEW", "IDENTITY_REVEAL"])).canRevealBank, false);
  assert.equal(hrCapabilities(access(["BANK_REVEAL"])).canRevealBank, true);
});

test("MST / BHXH không bao giờ có nút reveal (chưa có quyền riêng, không mượn quyền khác)", () => {
  const all = access(["IDENTITY_REVEAL"], ["BANK_REVEAL"], ["ACCESS_ADMIN"]);
  assert.equal(hrCapabilities(all).canRevealTax, false);
  assert.equal(hrCapabilities(all).canRevealInsurance, false);
});

test("[5] EMPLOYEE_VIEW (kể cả toàn công ty) không mở được file RESTRICTED", () => {
  const viewer = access(["EMPLOYEE_VIEW", "COMPANY"], ["FILE_VIEW", "COMPANY"]);
  const file = { status: "ACTIVE", scanStatus: "NOT_SCANNED", documentType: "IDENTITY_FRONT" };
  assert.equal(canRequestFileAccess(file, viewer), false);
  assert.equal(canRequestFileAccess({ ...file, documentType: "BANK_PROOF" }, viewer), false);
  assert.equal(canRequestFileAccess({ ...file, documentType: "GENERAL" }, viewer), true);
});

test("menu HRM theo quyền: không có quyền → rỗng; Nhật ký cần AUDIT_VIEW toàn công ty", () => {
  assert.deepEqual(hrNavItems(null), []);
  assert.deepEqual(hrNavItems(access()), []);
  const keys = (a) => hrNavItems(a).map((i) => i.key);
  assert.deepEqual(keys(access(["EMPLOYEE_VIEW"])), ["overview", "employees", "org"]);
  assert.ok(!keys(access(["AUDIT_VIEW", "BRANCH"])).includes("audit"));
  assert.ok(keys(access(["AUDIT_VIEW", "COMPANY"])).includes("audit"));
  assert.deepEqual(keys(access(["ACCESS_VIEW"])), ["overview", "access", "settings"]);
});

test("không dùng tên role: quyết định chỉ theo mã quyền", () => {
  assert.equal(hasPermission(access(["EMPLOYEE_VIEW"]), "EMPLOYEE_VIEW"), true);
  assert.equal(hasPermission({ accountId: 1, on: "", permissions: [{ code: "HR_ADMIN", scopes: [] }] }, "ACCESS_ADMIN"), false);
});

test("tạo hồ sơ chỉ khi EMPLOYEE_EDIT toàn công ty (khớp backend)", () => {
  assert.equal(hrCapabilities(access(["EMPLOYEE_EDIT", "SELF"])).canCreateEmployees, false);
  assert.equal(hrCapabilities(access(["EMPLOYEE_EDIT", "COMPANY"])).canCreateEmployees, true);
});

// ── M2 / trạng thái assignment ─────────────────────────────────────────

test("M2: 180 ngày tính cả hai đầu (2026-01-01 → 2026-06-29), năm nhuận", () => {
  assert.equal(latestSensitiveEffectiveTo("2026-01-01"), "2026-06-29");
  assert.equal(addDays("2027-12-31", 60), "2028-02-29");
  assert.equal(isSensitiveRole(["IDENTITY_REVEAL"]), true);
  assert.equal(isSensitiveRole(["ACCESS_ADMIN", "EMPLOYEE_VIEW"]), false);
});

test("trạng thái assignment ACTIVE / UPCOMING / EXPIRED / REVOKED", () => {
  const t = "2026-09-30";
  assert.equal(assignmentStatus({ revokedAt: null, effectiveFrom: "2026-09-01", effectiveTo: null }, t), "ACTIVE");
  assert.equal(assignmentStatus({ revokedAt: null, effectiveFrom: "2026-10-01", effectiveTo: null }, t), "UPCOMING");
  assert.equal(assignmentStatus({ revokedAt: null, effectiveFrom: "2026-01-01", effectiveTo: "2026-09-29" }, t), "EXPIRED");
  assert.equal(assignmentStatus({ revokedAt: null, effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30" }, t), "ACTIVE");
  assert.equal(assignmentStatus({ revokedAt: "2026-09-10T00:00:00Z", effectiveFrom: "2026-01-01", effectiveTo: null }, t), "REVOKED");
});

test("hôm nay theo giờ Việt Nam (01:30 VN = 18:30Z hôm trước)", () => {
  assert.equal(vnToday(new Date("2026-09-24T18:30:00Z")), "2026-09-25");
});

test("M1 / M2: lỗi backend → câu thân thiện + chi tiết có cấu trúc", () => {
  const m1 = describeHrError(
    httpError(403, {
      code: "HR_GRANT_EXCEEDS_OWN_ACCESS",
      message: "Cannot grant ... SALARY_VIEW",
      missingPermissions: ["SALARY_VIEW", "BANK_REVEAL"],
      periodNotCovered: [{ permission: "IDENTITY_REVEAL", yourEffectiveTo: "2026-12-15" }],
    }),
  );
  assert.equal(m1.message, "Bạn không thể cấp quyền vượt quá quyền hoặc phạm vi hiện tại của mình.");
  assert.deepEqual(m1.details, [
    "Không đủ quyền: SALARY_VIEW, BANK_REVEAL",
    "Quyền IDENTITY_REVEAL của bạn chỉ có hiệu lực đến 15/12/2026.",
  ]);
  const m2 = describeHrError(httpError(400, { code: "HR_SENSITIVE_ACCESS_DURATION", latestEffectiveTo: "2027-03-28" }));
  assert.equal(m2.message, "Quyền truy cập dữ liệu nhạy cảm không được vượt quá 180 ngày.");
  assert.deepEqual(m2.details, ["Ngày hết hạn tối đa: 28/03/2027"]);
});

test("protected admin 409 → hiện nguyên câu của server", () => {
  const e = describeHrError(httpError(409, { code: "HR_ADMIN_MINIMUM", messageVi: "Không thu hồi được: công ty sẽ chỉ còn 1 quản trị HR" }));
  assert.equal(e.message, "Không thu hồi được: công ty sẽ chỉ còn 1 quản trị HR");
});

// ── Sensitive data ─────────────────────────────────────────────────────

test("[6] danh sách chỉ render trường dạng che (kiểm tra mã nguồn)", () => {
  const src = (p) => readFileSync(new URL(`../src/pages/Hr/${p}`, import.meta.url), "utf8");
  assert.match(src("employee/IdentityTab.tsx"), /d\.numberMasked/);
  assert.match(src("employee/BankTab.tsx"), /account\.accountNumberMasked/);
  const employees = src("HrEmployeesPage.tsx");
  assert.doesNotMatch(employees, /numberMasked|accountNumber|taxNumber|socialInsurance/);
});

test("[7] reveal bắt buộc lý do (≥ 5 ký tự, bỏ khoảng trắng)", () => {
  assert.equal(isValidReason(""), false);
  assert.equal(isValidReason("   abc  "), false);
  assert.equal(isValidReason("Đối chiếu"), true);
});

test("[8][9] giá trị reveal: hiện đúng, xoá khi đóng, tự che sau 45 giây", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    const seen = [];
    const secret = new ExpiringSecret(REVEAL_TTL_MS, (v) => seen.push(v));
    secret.set("079201001234");
    assert.equal(secret.get(), "079201001234");
    secret.clear(); // đóng dialog
    assert.equal(secret.get(), null);
    secret.set("079201001234");
    mock.timers.tick(REVEAL_TTL_MS - 1);
    assert.equal(secret.get(), "079201001234");
    mock.timers.tick(1);
    assert.equal(secret.get(), null);
    assert.deepEqual(seen, ["079201001234", null, "079201001234", null]);
  } finally {
    mock.timers.reset();
  }
});

test("[10] crypto 503 → câu thân thiện, không lộ kỹ thuật", () => {
  const e = describeHrError(httpError(503, { code: "HR_CRYPTO_UNAVAILABLE", message: "HR sensitive data features are temporarily unavailable." }));
  assert.equal(e.message, "Chức năng bảo mật dữ liệu HR hiện chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống.");
});

test("[11] trùng định danh 409 → câu chung, không lộ nhân viên khác", () => {
  const e = describeHrError(httpError(409, { code: "HR_IDENTIFIER_DUPLICATE", message: "Số định danh này đã được dùng cho một hồ sơ khác" }));
  assert.equal(e.message, "Thông tin định danh này đã tồn tại trong hệ thống.");
  assert.deepEqual(e.details, []);
});

test("kiểm tra định dạng số định danh: báo lỗi không lặp lại giá trị", () => {
  assert.equal(validateIdentifier("CCCD", "0792 0100 1234"), null);
  const msg = validateIdentifier("CCCD", "12345");
  assert.ok(msg && !msg.includes("12345"));
  assert.equal(validateIdentifier("TAX_NUMBER", "0312345678-001"), null);
  assert.ok(validateIdentifier("SOCIAL_INSURANCE_NUMBER", "123"));
});

// ── File ───────────────────────────────────────────────────────────────

test("[12] file > 10 MB → cảnh báo", () => {
  assert.equal(validateHrUpload({ name: "a.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" }), "File vượt quá 10 MB.");
  assert.equal(validateHrUpload({ name: "a.pdf", size: 10 * 1024 * 1024, type: "application/pdf" }), null);
});

test("[13] MIME / đuôi không hợp lệ → cảnh báo", () => {
  assert.ok(validateHrUpload({ name: "a.exe", size: 10, type: "application/octet-stream" }));
  assert.ok(validateHrUpload({ name: "a.pdf", size: 10, type: "text/html" }));
  assert.ok(validateHrUpload({ name: "a.pdf.html", size: 10, type: "text/html" }));
  assert.equal(validateHrUpload({ name: "a.JPG", size: 10, type: "image/jpeg" }), null);
});

test("[14] file hạn chế khi thiếu quyền reveal → không có nút tải", () => {
  const hrOfficer = access(["EMPLOYEE_VIEW"], ["EMPLOYEE_EDIT"], ["FILE_VIEW"]);
  assert.equal(canRequestFileAccess({ status: "ACTIVE", scanStatus: "NOT_SCANNED", documentType: "IDENTITY_BACK" }, hrOfficer), false);
  assert.equal(canRequestFileAccess({ status: "ACTIVE", scanStatus: "CLEAN", documentType: "IDENTITY_BACK" }, access(["IDENTITY_REVEAL"])), true);
  assert.equal(fileNeedsReason("RESTRICTED"), true);
  assert.equal(fileNeedsReason("INTERNAL"), false);
});

test("loại hợp đồng / thuế / BHXH (backend fail closed) không có trong danh sách upload và không tải được", () => {
  for (const t of ["CONTRACT", "TAX", "INSURANCE"]) {
    assert.ok(!UPLOADABLE_DOCUMENT_TYPES.includes(t));
    assert.equal(canRequestFileAccess({ status: "ACTIVE", scanStatus: "CLEAN", documentType: t }, access(["IDENTITY_REVEAL"], ["BANK_REVEAL"], ["FILE_VIEW"])), false);
  }
});

test("[16] file ARCHIVED / quét bị chặn → không có nút tải", () => {
  const a = access(["IDENTITY_REVEAL"]);
  assert.equal(canRequestFileAccess({ status: "ARCHIVED", scanStatus: "CLEAN", documentType: "IDENTITY_FRONT" }, a), false);
  assert.equal(canRequestFileAccess({ status: "ACTIVE", scanStatus: "INFECTED", documentType: "IDENTITY_FRONT" }, a), false);
  assert.equal(canRequestFileAccess({ status: "ACTIVE", scanStatus: "PENDING", documentType: "IDENTITY_FRONT" }, a), false);
});

// ── Error ──────────────────────────────────────────────────────────────

test("[17] 404 do phạm vi → câu chung", () => {
  assert.equal(describeHrError(httpError(404, { message: "Không tìm thấy dữ liệu" })).message, NOT_FOUND_OR_FORBIDDEN);
});

test("[18] kho chưa sẵn sàng 503 → câu phù hợp", () => {
  assert.equal(
    describeHrError(httpError(503, { code: "HR_FILE_STORAGE_UNAVAILABLE" })).message,
    "Kho tài liệu HR hiện chưa sẵn sàng. Vui lòng liên hệ quản trị hệ thống.",
  );
  assert.match(describeHrError(httpError(403, { code: "HR_FILE_TOKEN_INVALID" })).message, /hết hạn/);
});

test("[19] 403 / lỗi mạng / dữ liệu lạ → không ném, luôn có câu hiển thị", () => {
  assert.equal(describeHrError(httpError(403, { message: "x" })).message, "Bạn không có quyền thực hiện thao tác này.");
  assert.match(describeHrError(new Error("Network Error")).message, /Không kết nối/);
  assert.ok(describeHrError(undefined).message);
  assert.ok(describeHrError(httpError(500, "<html>stack trace</html>")).message.startsWith("Máy chủ"));
  assert.ok(!describeHrError(httpError(500, "<html>stack trace</html>")).message.includes("stack"));
});

// ── Audit ──────────────────────────────────────────────────────────────

test("audit: nhãn tiếng Việt; không hiển thị ciphertext / hash / token", () => {
  assert.equal(auditActionLabel("IDENTITY_REVEAL"), "Xem số giấy tờ đầy đủ");
  assert.equal(auditActionLabel("FILE_ACCESS"), "Xin quyền truy cập tài liệu");
  const lines = summarizeAuditValue({
    numberMasked: "********1234",
    numberHash: "hbi:1:v1:abc",
    note: "hrenc:1:v1:a:b:c",
    url: "/api/hr/v1/files/1/content?token=abc",
  });
  assert.deepEqual(lines, ["numberMasked: ********1234", "numberHash: [ẩn]", "note: [ẩn]", "url: [ẩn]"]);
});

// ── [15][41][42] Không log / không persist dữ liệu nhạy cảm (quét mã nguồn HR) ──

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
const hrSources = [
  ...walk(new URL("../src/pages/Hr", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  ...walk(new URL("../src/service/hr", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
];

/** Bỏ comment để câu giải thích trong comment không làm test sai. */
const codeOnly = (file) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

test("[15] token file / giá trị reveal / form nhạy cảm không bị lưu vào storage", () => {
  assert.ok(hrSources.length > 10);
  for (const file of hrSources) {
    const code = codeOnly(file);
    assert.doesNotMatch(code, /localStorage\.setItem|sessionStorage|indexedDB|atomWithStorage/, file);
  }
});

test("[41] mã HR không console.log / console.error", () => {
  for (const file of hrSources) {
    assert.doesNotMatch(codeOnly(file), /console\.(log|error|warn|info|debug)/, file);
  }
});

test("reveal / token không đi qua react-query (không nằm trong cache)", () => {
  for (const file of hrSources) {
    const code = codeOnly(file);
    if (/useMutation/.test(code)) assert.fail(`${file} dùng useMutation — dữ liệu có thể nằm lại trong MutationCache`);
    if (/queryFn:.*reveal|queryFn:.*requestAccess/.test(code)) assert.fail(`${file} cache reveal/token`);
  }
});

test("mã nhân viên do hệ thống sinh: form tạo hồ sơ không gửi employeeCode", () => {
  const api = readFileSync(new URL("../src/service/hr/hr.api.ts", import.meta.url), "utf8");
  assert.match(api, /create: \(body: ProfileBody & \{ fullName: string; accountId\?: number \}\)/);
  const profile = readFileSync(new URL("../src/pages/Hr/lib/hrEmployeeProfile.ts", import.meta.url), "utf8");
  const bodyType = profile.slice(profile.indexOf("export interface ProfileBody"), profile.indexOf("}", profile.indexOf("export interface ProfileBody")));
  assert.doesNotMatch(bodyType, /employeeCode|accountId|fullNameSearch/);
  const page = readFileSync(new URL("../src/pages/Hr/HrEmployeesPage.tsx", import.meta.url), "utf8");
  const start = page.indexOf("hrEmployeeApi.create(");
  const createCall = page.slice(start, page.indexOf("});", start));
  assert.doesNotMatch(createCall, /employeeCode/);
});
