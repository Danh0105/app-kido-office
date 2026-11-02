import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DOCUMENT_POLICY,
  DOCUMENT_TYPES,
  createDocumentFields,
  documentFormFrom,
  documentFormProblems,
  documentPatch,
  emptyDocumentForm,
} from "../src/pages/Hr/lib/hrDocuments.ts";
import { FILES_TAB_TYPES, FILE_ACCESS_PERMISSIONS, UPLOADABLE_DOCUMENT_TYPES, canRequestFileAccess } from "../src/pages/Hr/lib/hrFiles.ts";
import { hrCapabilities } from "../src/pages/Hr/lib/hrAccess.ts";

const TODAY = "2026-10-05";
const access = (...codes) => ({ accountId: 1, on: TODAY, permissions: codes.map((code) => ({ code, scopes: [{ scope: "COMPANY", scopeRefId: null, source: "x", via: "x" }] })) });
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const read = (f) => strip(readFileSync(new URL(f, import.meta.url), "utf8"));

test("5 loại tài liệu, không có lý lịch tư pháp; giấy khám RESTRICTED + nhạy cảm", () => {
  assert.deepEqual(DOCUMENT_TYPES, ["RESUME", "DEGREE", "CERTIFICATE", "HEALTH_CERTIFICATE", "OTHER"]);
  assert.equal(DOCUMENT_POLICY.HEALTH_CERTIFICATE.classification, "RESTRICTED");
  assert.equal(DOCUMENT_POLICY.HEALTH_CERTIFICATE.sensitive, true);
  assert.equal(DOCUMENT_POLICY.OTHER.classification, "INTERNAL");
});

test("kiểm tra sớm ngày theo loại (phản chiếu backend)", () => {
  const f = (type, over = {}) => ({ ...emptyDocumentForm(type), title: "x", ...over });
  assert.deepEqual(documentFormProblems(f("DEGREE", { expiresOn: "2030-01-01" }), TODAY), ["Bằng cấp không có ngày hết hạn."]);
  assert.deepEqual(documentFormProblems(f("HEALTH_CERTIFICATE"), TODAY), ["Giấy khám sức khỏe bắt buộc có ngày hết hạn."]);
  assert.deepEqual(documentFormProblems(f("HEALTH_CERTIFICATE", { expiresOn: "2027-01-01" }), TODAY), []);
  assert.deepEqual(documentFormProblems(f("CERTIFICATE", { issuedOn: "2026-10-06" }), TODAY), ["Ngày cấp không được ở tương lai."]);
  assert.deepEqual(documentFormProblems(f("CERTIFICATE", { issuedOn: "2026-01-02", expiresOn: "2026-01-01" }), TODAY), ["Ngày hết hạn phải sau hoặc bằng ngày cấp."]);
  assert.equal(documentFormProblems({ ...emptyDocumentForm("OTHER") }, TODAY).length, 1, "thiếu tiêu đề");
});

test("trường tạo: bỏ trống, không có classification; patch chỉ trường đã đổi", () => {
  const fields = createDocumentFields({ ...emptyDocumentForm("CERTIFICATE"), title: " Chứng chỉ ", expiresOn: "2027-01-01" });
  assert.deepEqual(fields, { documentType: "CERTIFICATE", title: "Chứng chỉ", expiresOn: "2027-01-01" });
  assert.ok(!("classification" in fields));
  const original = { title: "A", issuer: null, issuedOn: "2026-01-01", expiresOn: null, note: "ghi chú" };
  const form = { ...documentFormFrom("CERTIFICATE", original), title: "B", note: "" };
  assert.deepEqual(documentPatch(original, form), { title: "B", note: null });
  assert.deepEqual(documentPatch(original, documentFormFrom("CERTIFICATE", original)), {});
});

test("quyền xem nội dung theo loại: giấy khám chỉ HEALTH_DOCUMENT_VIEW; GENERAL (= OTHER) một trong FILE_VIEW / DOCUMENT_VIEW", () => {
  assert.deepEqual(FILE_ACCESS_PERMISSIONS.HEALTH_CERTIFICATE, ["HEALTH_DOCUMENT_VIEW"]);
  const file = (documentType) => ({ status: "ACTIVE", scanStatus: "NOT_SCANNED", documentType });
  assert.equal(canRequestFileAccess(file("HEALTH_CERTIFICATE"), access("DOCUMENT_VIEW")), false);
  assert.equal(canRequestFileAccess(file("HEALTH_CERTIFICATE"), access("HEALTH_DOCUMENT_VIEW")), true);
  assert.equal(canRequestFileAccess(file("GENERAL"), access("DOCUMENT_VIEW")), true);
  assert.equal(canRequestFileAccess(file("GENERAL"), access("FILE_VIEW")), true);
  assert.equal(canRequestFileAccess(file("RESUME"), access("FILE_VIEW")), false);
});

test("tab File chỉ còn định danh / ngân hàng; GENERAL không còn upload ở tab File", () => {
  assert.deepEqual(FILES_TAB_TYPES, ["IDENTITY_FRONT", "IDENTITY_BACK", "BANK_PROOF"]);
  assert.ok(!UPLOADABLE_DOCUMENT_TYPES.includes("GENERAL"));
  assert.ok(!UPLOADABLE_DOCUMENT_TYPES.includes("RESUME"));
});

test("capabilities tài liệu", () => {
  assert.equal(hrCapabilities(access("DOCUMENT_VIEW")).canViewDocuments, true);
  assert.equal(hrCapabilities(access("DOCUMENT_VIEW")).canManageDocuments, false);
  assert.equal(hrCapabilities(access("DOCUMENT_MANAGE")).canManageDocuments, true);
});

test("tab Tài liệu dùng lại luồng tải 0.4C (requestAccess → token), không có endpoint tải mới; không gửi classification", () => {
  const tab = read("../src/pages/Hr/employee/DocumentsTab.tsx");
  assert.match(tab, /downloadHrFile\(/);
  assert.doesNotMatch(tab, /classification:\s*["']/);
  const dl = read("../src/pages/Hr/employee/downloadHrFile.ts");
  assert.match(dl, /hrFileApi\.requestAccess\(/);
  const api = read("../src/service/hr/hr.api.ts");
  const docApi = api.slice(api.indexOf("export const hrDocumentApi"), api.indexOf("};", api.indexOf("export const hrDocumentApi")));
  assert.doesNotMatch(docApi, /content|access/);
  const files = read("../src/pages/Hr/employee/FilesTab.tsx");
  assert.match(files, /downloadHrFile\(/);
  assert.match(files, /FILES_TAB_TYPES\.includes/);
});

test("sửa giấy khám khi không xem được nội dung: ẩn ô ghi chú và không gửi note (tránh ghi đè mù)", () => {
  const tab = read("../src/pages/Hr/employee/DocumentsTab.tsx");
  assert.match(tab, /const noteHidden = !doc\.canViewContent && DOCUMENT_POLICY\[doc\.documentType\]\.sensitive;/);
  assert.match(tab, /if \(noteHidden\) delete patch\.note;/);
  assert.match(tab, /hideNote=\{noteHidden\}/);
});

test("quyết định 1.3: HEALTH_DOCUMENT_VIEW là quyền nhạy cảm (M2), cấp lẻ được; ACCESS_ADMIN không cấp lẻ", async () => {
  const { SENSITIVE_PERMISSIONS, DIRECT_GRANT_PERMISSIONS, isSensitiveRole } = await import("../src/pages/Hr/lib/hrAccess.ts");
  assert.ok(SENSITIVE_PERMISSIONS.includes("HEALTH_DOCUMENT_VIEW"));
  assert.ok(isSensitiveRole(["HEALTH_DOCUMENT_VIEW"]));
  assert.ok(DIRECT_GRANT_PERMISSIONS.includes("HEALTH_DOCUMENT_VIEW"));
  assert.ok(!DIRECT_GRANT_PERMISSIONS.includes("ACCESS_ADMIN"));
  assert.ok(!SENSITIVE_PERMISSIONS.includes("HEALTH_DOCUMENT_REVEAL"));
});

test("tab Tài liệu: nút tải theo canDownload của backend (bản cũ ARCHIVED vẫn tải được)", () => {
  const tab = read("../src/pages/Hr/employee/DocumentsTab.tsx");
  assert.match(tab, /current\?\.canDownload/);
  assert.match(tab, /v\.canDownload/);
  assert.doesNotMatch(tab, /status === "ACTIVE" && DOWNLOADABLE_SCAN/);
});

test("trang Phân quyền: quyền lẻ dùng chung hộp thoại cấp quyền, thu hồi gửi version + lý do", () => {
  const page = read("../src/pages/Hr/HrAccessPage.tsx");
  assert.match(page, /kind="permission"/);
  assert.match(page, /hrAccessApi\.grantPermission\(/);
  assert.match(page, /hrAccessApi\.revokePermissionGrant\(revoking\.id, \{ reason, version: revoking\.version \}\)/);
  const api = read("../src/service/hr/hr.api.ts");
  assert.match(api, /\/access\/accounts\/\$\{accountId\}\/permission-grants/);
  assert.match(api, /\/access\/permission-grants\/\$\{grantId\}\/revoke/);
});
