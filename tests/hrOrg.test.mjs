import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildOrgTree, flattenOrgTree, leaderRolesFor, parentCandidates } from "../src/pages/Hr/lib/hrOrg.ts";
import { hrCapabilities, hrNavItems } from "../src/pages/Hr/lib/hrAccess.ts";
import { describeHrError } from "../src/pages/Hr/lib/hrErrors.ts";

const u = (id, unitType, parentId, status = "ACTIVE", name = `U${id}`) => ({ id, code: `C${id}`, name, unitType, parentId, status });
const units = [
  u(1, "COMPANY", null, "ACTIVE", "Công ty"),
  u(3, "BRANCH", 1, "ACTIVE", "Chi nhánh B"),
  u(2, "BRANCH", 1, "ACTIVE", "Chi nhánh A"),
  u(4, "DEPARTMENT", 2, "ACTIVE", "Kinh doanh"),
  u(5, "TEAM", 4, "ACTIVE", "Nhóm 1"),
  u(6, "DEPARTMENT", 2, "INACTIVE", "Phòng đã đóng"),
];
const access = (...grants) => ({ accountId: 1, on: "2026-10-01", permissions: grants.map(([code, scope = "COMPANY", ref = null]) => ({ code, scopes: [{ scope, scopeRefId: ref, source: "assignment", via: "x" }] })) });
const httpError = (status, data) => ({ response: { status, data } });

test("dựng cây: thứ tự loại rồi tên, độ sâu đúng, thu gọn nhánh", () => {
  const rows = flattenOrgTree(buildOrgTree(units));
  assert.deepEqual(rows.map((r) => [r.unit.id, r.depth]), [[1, 0], [2, 1], [4, 2], [5, 3], [6, 2], [3, 1]]);
  const collapsed = flattenOrgTree(buildOrgTree(units), new Set([2]));
  assert.deepEqual(collapsed.map((r) => r.unit.id), [1, 2, 3]);
});

test("dữ liệu vòng lặp / cha không có trong danh sách không làm treo", () => {
  const rows = flattenOrgTree(buildOrgTree([u(1, "DEPARTMENT", 2), u(2, "DEPARTMENT", 1), u(9, "DEPARTMENT", 99)]));
  assert.ok(rows.some((r) => r.unit.id === 9 && r.depth === 0));
});

test("đơn vị cha hợp lệ: đúng loại, đang hoạt động, không gồm chính nó và con cháu", () => {
  assert.deepEqual(parentCandidates(units, "TEAM").map((x) => x.id), [4]);
  assert.deepEqual(parentCandidates(units, "BRANCH").map((x) => x.id), [1]);
  assert.deepEqual(parentCandidates(units, "DEPARTMENT", 4).map((x) => x.id).sort(), [1, 2, 3]);
});

test("vai trò lãnh đạo theo loại đơn vị", () => {
  assert.deepEqual(leaderRolesFor("BRANCH"), ["BRANCH_DIRECTOR", "DEPUTY"]);
  assert.deepEqual(leaderRolesFor("TEAM"), ["DEPARTMENT_HEAD", "DEPUTY"]);
});

test("quyền: ORG_MANAGE mở nút thao tác; danh mục chỉ khi ORG_MANAGE toàn công ty; menu Tổ chức", () => {
  assert.equal(hrCapabilities(access(["EMPLOYEE_VIEW"])).canManageOrg, false);
  assert.equal(hrCapabilities(access(["EMPLOYEE_VIEW"])).canViewOrg, true);
  const branch = hrCapabilities(access(["ORG_MANAGE", "BRANCH", 2]));
  assert.equal(branch.canManageOrg, true);
  assert.equal(branch.canManageOrgCatalog, false);
  assert.equal(hrCapabilities(access(["ORG_MANAGE", "COMPANY"])).canManageOrgCatalog, true);
  assert.ok(hrNavItems(access(["ORG_MANAGE", "BRANCH", 2])).some((i) => i.key === "org"));
  assert.ok(!hrNavItems(access(["AUDIT_VIEW", "COMPANY"])).some((i) => i.key === "org"));
});

test("lỗi cơ cấu: ngoài phạm vi, vòng lặp, chưa cấu hình người duyệt → câu rõ ràng", () => {
  assert.equal(describeHrError(httpError(403, { code: "HR_ORG_OUT_OF_SCOPE", message: "x" })).message, "Đơn vị nằm ngoài phạm vi quản lý cơ cấu của bạn.");
  assert.equal(describeHrError(httpError(409, { code: "HR_ORG_CYCLE", message: "Không thể đặt đơn vị dưới chính đơn vị con của nó" })).message, "Không thể đặt đơn vị dưới chính đơn vị con của nó");
  assert.equal(
    describeHrError(httpError(422, { code: "HR_APPROVER_NOT_CONFIGURED", message: "Chi nhánh chưa cấu hình Giám đốc phê duyệt. Vui lòng liên hệ HR." })).message,
    "Chi nhánh chưa cấu hình Giám đốc phê duyệt. Vui lòng liên hệ HR.",
  );
});

test("mọi form tạo trong HRM không bắt nhập mã: đơn vị (DV####), chức danh (CD####), nhân viên (NV######) do hệ thống sinh", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const read = (f) => strip(readFileSync(new URL(f, import.meta.url), "utf8"));
  const api = read("../src/service/hr/hr.api.ts");
  for (const fn of ["create:", "createPosition:"]) {
    const start = api.indexOf(fn, api.indexOf("export const hrOrgApi"));
    const sig = api.slice(start, api.indexOf("=>", start));
    assert.doesNotMatch(sig, /\bcode\b/, `${fn} không được nhận code`);
  }
  const dialogs = read("../src/pages/Hr/org/OrgDialogs.tsx");
  const createUnit = dialogs.slice(dialogs.indexOf("export function CreateUnitDialog"), dialogs.indexOf("export function", dialogs.indexOf("export function CreateUnitDialog") + 10));
  assert.doesNotMatch(createUnit, /setCode|label="Mã/);
  const catalog = read("../src/pages/Hr/org/OrgCatalogTabs.tsx");
  assert.doesNotMatch(catalog, /setCode|<input[^>]*value=\{code\}/);
  const employees = read("../src/pages/Hr/HrEmployeesPage.tsx");
  assert.doesNotMatch(employees, /employeeCode\s*:/);
});
