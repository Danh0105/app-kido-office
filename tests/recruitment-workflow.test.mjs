import assert from "node:assert/strict";
import test from "node:test";
import { interviewRange, recruitmentDateTime, localRecruitmentTime, profileChanges, uniqueList } from "../src/pages/Recruitment/workflow.ts";

test("interview time always carries Vietnam timezone regardless of browser timezone", () => {
  assert.equal(recruitmentDateTime("2099-12-01T09:30"), "2099-12-01T09:30:00+07:00");
  assert.equal(localRecruitmentTime("2099-12-01T02:30:00Z"), "2099-12-01T09:30");
});
test("rejects empty dates, reversed ranges and new past interviews", () => {
  assert.throws(() => recruitmentDateTime(""));
  assert.throws(() => recruitmentDateTime("2099-02-31T09:00"));
  assert.throws(() => interviewRange("2099-01-01T10:00", "2099-01-01T09:00"));
  assert.throws(() => interviewRange("2000-01-01T09:00", "2000-01-01T10:00"));
});
test("candidate edit sends only changed fields, keeping clears and zero values", () => {
  assert.deepEqual(profileChanges({ phone: "0900000000", expectedSalary: 10, fullName: "Test" }, { phone: null, expectedSalary: 0, fullName: "Test" }), { phone: null, expectedSalary: 0 });
});
test("skill input removes blanks and duplicates", () => {
  assert.deepEqual(uniqueList("Excel, Giao tiếp, Excel\n, "), ["Excel", "Giao tiếp"]);
});
