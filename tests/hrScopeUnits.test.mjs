import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isValidScopeOption,
  scopeNeedsUnit,
  scopeOptionItems,
  scopeRefIdFor,
  scopeUnitLabel,
} from "../src/pages/Hr/lib/hrScopeUnits.ts";
import { describeHrError } from "../src/pages/Hr/lib/hrErrors.ts";
import { ORG_UNIT_TYPE_LABELS } from "../src/pages/Hr/lib/hrOrg.ts";

// Dữ liệu như backend GET /organization/scope-options trả (đã lọc theo phạm vi quản trị + ngày).
const branchOptions = [{ id: 2, code: "DV0002", name: "Chi nhánh Cà Mau", unitType: "BRANCH", parentId: 1, path: "Công ty > Chi nhánh Cà Mau" }];
const orgUnitOptions = [
  { id: 4, code: "DV0004", name: "Phòng Kinh doanh", unitType: "DEPARTMENT", parentId: 2, path: "Công ty > Chi nhánh Cà Mau > Phòng Kinh doanh" },
  { id: 5, code: "DV0005", name: "Nhóm 1", unitType: "TEAM", parentId: 4, path: "Công ty > Chi nhánh Cà Mau > Phòng Kinh doanh > Nhóm 1" },
];

test("BRANCH / ORG_UNIT: nhãn có tên, mã DV, loại, đường dẫn (để tìm kiếm)", () => {
  assert.deepEqual(scopeOptionItems(branchOptions, ORG_UNIT_TYPE_LABELS), [
    { id: 2, name: "Chi nhánh Cà Mau · DV0002 · Chi nhánh — Công ty > Chi nhánh Cà Mau" },
  ]);
  const items = scopeOptionItems(orgUnitOptions, ORG_UNIT_TYPE_LABELS);
  assert.match(items[0].name, /^Phòng Kinh doanh · DV0004 · Phòng ban — /);
  assert.match(items[1].name, /Nhóm 1$/);
});

test("SELF/TEAM/COMPANY/ALL: không cần đơn vị, không gửi scopeRefId; BRANCH/ORG_UNIT gửi đúng id", () => {
  for (const s of ["SELF", "TEAM", "COMPANY", "ALL"]) {
    assert.equal(scopeNeedsUnit(s), false, s);
    assert.equal(scopeRefIdFor(s, 4), undefined, s);
  }
  assert.equal(scopeNeedsUnit("BRANCH"), true);
  assert.equal(scopeNeedsUnit("ORG_UNIT"), true);
  assert.equal(scopeRefIdFor("BRANCH", 2), 2);
  assert.equal(scopeRefIdFor("ORG_UNIT", 4), 4);
  assert.equal(scopeRefIdFor("BRANCH", null), undefined);
});

test("đổi phạm vi / ngày hiệu lực: đơn vị đã chọn không còn trong danh sách mới → không hợp lệ", () => {
  assert.equal(isValidScopeOption(branchOptions, 2), true);
  assert.equal(isValidScopeOption(orgUnitOptions, 2), false);
  assert.equal(isValidScopeOption([], 2), false, "danh sách tại ngày khác không còn đơn vị");
  assert.equal(isValidScopeOption(branchOptions, null), false);
});

test("nhãn phạm vi của quyền đã cấp: tra được → tên (mã); không tra được → #id", () => {
  assert.equal(scopeUnitLabel([...branchOptions, ...orgUnitOptions], 4), "Phòng Kinh doanh (DV0004)");
  assert.equal(scopeUnitLabel(undefined, 2), "#2");
  assert.equal(scopeUnitLabel(branchOptions, 99), "#99");
  assert.equal(scopeUnitLabel(branchOptions, null), "");
});

test("backend từ chối HR_GRANT_EXCEEDS_OWN_ACCESS → hiển thị lý do (selector không thay M1)", () => {
  const view = describeHrError({
    response: {
      status: 403,
      data: {
        code: "HR_GRANT_EXCEEDS_OWN_ACCESS",
        missingPermissions: ["EMPLOYEE_VIEW"],
        periodNotCovered: [{ permission: "ACCESS_ADMIN", yourEffectiveTo: "2026-12-31" }],
      },
    },
  });
  assert.equal(view.code, "HR_GRANT_EXCEEDS_OWN_ACCESS");
  assert.match(view.message, /vượt quá quyền hoặc phạm vi/);
  assert.ok(view.details.some((d) => d.includes("EMPLOYEE_VIEW")));
  assert.ok(view.details.some((d) => d.includes("31/12/2026")));
});

test("trang Phân quyền: dùng scope-options theo phạm vi + ngày hiệu lực, không còn ô nhập id, đổi phạm vi xoá đơn vị", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const page = strip(readFileSync(new URL("../src/pages/Hr/HrAccessPage.tsx", import.meta.url), "utf8"));
  const dialog = page.slice(page.indexOf("function GrantDialog"));
  assert.doesNotMatch(dialog, /inputMode="numeric"|setScopeRefId|Mã đơn vị|hrOrgApi\.units\(/);
  assert.match(dialog, /queryKey: \["hr", "scope-options", scope, effectiveFrom\]/);
  assert.match(dialog, /hrOrgApi\.scopeOptions\(scope as "BRANCH" \| "ORG_UNIT", effectiveFrom\)/);
  assert.match(dialog, /scopeRefId: scopeRefIdFor\(scope, unitId\)/);
  assert.match(dialog, /const changeScope = \(next: HrScope\) => \{\s*setScope\(next\);\s*setUnitId\(null\);/);
  assert.match(dialog, /<HrFormError error=\{error\} \/>/);
  const api = strip(readFileSync(new URL("../src/service/hr/hr.api.ts", import.meta.url), "utf8"));
  assert.match(api, /\/organization\/scope-options`, \{ params: \{ scopeType, asOf \} \}/);
});
