import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ATTENDANCE_MODES,
  SEARCH_DEBOUNCE_MS,
  createBody,
  emptyProfileForm,
  normalizePhoneInput,
  profileFormFrom,
  profilePatch,
  profileProblems,
} from "../src/pages/Hr/lib/hrEmployeeProfile.ts";

const TODAY = "2026-09-30";
const original = {
  fullName: "Nguyễn Văn A",
  attendanceMode: "UNASSIGNED",
  dateOfBirth: "1990-05-17",
  gender: null,
  phone: "0912345678",
  workEmail: "a@kido.vn",
  personalEmail: null,
};

test("hồ sơ mới mặc định Chưa phân loại (không ngầm SHIFT)", () => {
  assert.equal(emptyProfileForm().attendanceMode, "UNASSIGNED");
  assert.deepEqual(ATTENDANCE_MODES, ["SHIFT", "TEACHING_SESSION", "UNASSIGNED"]);
});

test("patch chỉ gồm trường đã đổi; xoá giá trị = null; không có fullNameSearch/employeeCode/accountId", () => {
  const form = { ...profileFormFrom(original), attendanceMode: "SHIFT", phone: "0912 345.678", workEmail: "", fullName: " Nguyễn Văn A " };
  const patch = profilePatch(original, form);
  assert.deepEqual(patch, { attendanceMode: "SHIFT", workEmail: null });
  for (const k of ["fullNameSearch", "employeeCode", "accountId", "version"]) assert.ok(!(k in patch));
  assert.deepEqual(profilePatch(original, profileFormFrom(original)), {});
});

test("body tạo hồ sơ bỏ trường trống, chuẩn hoá SĐT/email", () => {
  const body = createBody({ ...emptyProfileForm(), fullName: " Lê Thị B ", phone: "0987-654-321", workEmail: " B@KIDO.vn " });
  assert.deepEqual(body, { fullName: "Lê Thị B", attendanceMode: "UNASSIGNED", phone: "0987654321", workEmail: "b@kido.vn" });
});

test("kiểm tra sớm: họ tên, ngày sinh, SĐT, email", () => {
  const ok = { ...emptyProfileForm(), fullName: "A" };
  assert.deepEqual(profileProblems(ok, TODAY), []);
  assert.equal(profileProblems({ ...ok, fullName: "  " }, TODAY).length, 1);
  assert.equal(profileProblems({ ...ok, dateOfBirth: "2026-10-01" }, TODAY).length, 1);
  assert.equal(profileProblems({ ...ok, dateOfBirth: "1899-12-31" }, TODAY).length, 1);
  assert.equal(profileProblems({ ...ok, phone: "12ab" }, TODAY).length, 1);
  assert.equal(profileProblems({ ...ok, phone: "+84 912 345 678" }, TODAY).length, 0);
  assert.equal(profileProblems({ ...ok, workEmail: "khong-hop-le" }, TODAY).length, 1);
  assert.equal(normalizePhoneInput("09.12-34 56"), "09123456");
});

test("ô chọn nhân viên tìm phía server có debounce 250–400 ms, không tải 100 hồ sơ để lọc client", () => {
  assert.ok(SEARCH_DEBOUNCE_MS >= 250 && SEARCH_DEBOUNCE_MS <= 400);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const picker = strip(readFileSync(new URL("../src/pages/Hr/components/HrEmployeePicker.tsx", import.meta.url), "utf8"));
  assert.match(picker, /useDebouncedValue\(/);
  assert.match(picker, /hrEmployeeApi\.list\(\{\s*q/);
  const dialogs = strip(readFileSync(new URL("../src/pages/Hr/org/OrgDialogs.tsx", import.meta.url), "utf8"));
  assert.doesNotMatch(dialogs, /hrEmployeeApi\.list\(1,\s*100\)/);
  assert.match(dialogs, /<HrEmployeePicker/);
});

test("trang danh sách không gửi fullNameSearch và tìm qua server", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const f of ["../src/pages/Hr/HrEmployeesPage.tsx", "../src/pages/Hr/employee/OverviewTab.tsx", "../src/service/hr/hr.api.ts"]) {
    assert.doesNotMatch(strip(readFileSync(new URL(f, import.meta.url), "utf8")), /fullNameSearch/, f);
  }
});
