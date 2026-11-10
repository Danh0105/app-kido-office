import assert from "node:assert/strict";
import test from "node:test";

import {
  hasBroadRoleIn,
  isAccountantOnlyIn,
  isChiefAccountantIn,
  isDirectorAssistantViewerIn,
} from "../src/utils/rolePrecedence.ts";

test("Trợ lý GĐ ưu tiên khi kiêm Thủ quỹ và Kế toán", () => {
  const roles = ["thuquy", "troly_gd", "accountant"];

  assert.equal(isDirectorAssistantViewerIn(roles), true);
  assert.equal(isAccountantOnlyIn(roles), false);
  assert.equal(isChiefAccountantIn(roles), false);
});

test("Trợ lý GĐ ưu tiên khi kiêm Kế toán trưởng", () => {
  const roles = ["ketoan_truong", "troly_gd"];

  assert.equal(isDirectorAssistantViewerIn(roles), true);
  assert.equal(isChiefAccountantIn(roles), false);
});

test("tài khoản chỉ Kế toán vẫn giữ guard Kế toán", () => {
  assert.equal(isAccountantOnlyIn(["accountant"]), true);
  assert.equal(isDirectorAssistantViewerIn(["accountant"]), false);
});

test("vai trò quản lý rộng vẫn ưu tiên hơn Trợ lý GĐ", () => {
  const roles = ["director", "troly_gd", "accountant"];

  assert.equal(hasBroadRoleIn(roles), true);
  assert.equal(isDirectorAssistantViewerIn(roles), false);
  assert.equal(isAccountantOnlyIn(roles), false);
});
