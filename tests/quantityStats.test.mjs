import assert from "node:assert/strict";
import test from "node:test";

import { buildSchoolQuantitySummary } from "../src/pages/Director/Sales/Statistics/quantityStats.ts";

test("tổng hợp số học sinh và số tiết của kinh doanh, kế toán theo trường", () => {
  const result = buildSchoolQuantitySummary(
    [
      {
        schoolId: 1,
        schoolName: "Trường A",
        subjectId: 10,
        studentCount: 100,
        totalLessons: 36,
      },
      {
        schoolId: 1,
        schoolName: "Trường A",
        subjectId: 11,
        studentCount: 80,
        totalLessons: 24,
      },
      {
        schoolId: 2,
        schoolName: "Trường B",
        subjectId: 20,
        studentCount: 50,
        totalLessons: 12,
      },
    ],
    [
      {
        schoolId: 1,
        summary: {
          summary: {
            revenueItems: [
              { subjectId: 10, studentCount: 95, totalPeriods: 35 },
              { subjectId: 11, studentCount: 75, totalPeriods: 20 },
            ],
          },
        },
      },
      {
        school: { id: 2, name: "Trường B" },
        summary: {
          revenueItems: [{ subjectId: 20, studentCount: 48, totalPeriods: 10 }],
        },
      },
    ],
  );

  assert.deepEqual(result, [
    {
      schoolId: 1,
      schoolName: "Trường A",
      policyStudents: 180,
      policyPeriods: 60,
      accountingStudents: 170,
      accountingPeriods: 55,
    },
    {
      schoolId: 2,
      schoolName: "Trường B",
      policyStudents: 50,
      policyPeriods: 12,
      accountingStudents: 48,
      accountingPeriods: 10,
    },
  ]);
});

test("không cộng các bảng chi phí và bỏ môn ngoài bộ lọc chính sách", () => {
  const result = buildSchoolQuantitySummary(
    [
      {
        schoolId: 1,
        schoolName: "Trường A",
        subjectId: 10,
        studentCount: 100,
        totalLessons: 36,
      },
    ],
    [
      {
        schoolId: 1,
        summary: {
          summary: {
            revenueItems: [
              { subjectId: 10, studentCount: 90, totalPeriods: 30 },
              { subjectId: 99, studentCount: 999, totalPeriods: 999 },
            ],
            schoolExpenseItems: [
              { subjectId: 10, studentCount: 90, totalPeriods: 30 },
            ],
            managementExpenseItems: [
              { subjectId: 10, studentCount: 90, totalPeriods: 30 },
            ],
          },
        },
      },
    ],
  );

  assert.equal(result[0].accountingStudents, 90);
  assert.equal(result[0].accountingPeriods, 30);
});
