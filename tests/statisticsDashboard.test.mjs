import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStatisticsDashboardModel,
  filterStatisticsPolicies,
  getCompanyUnit,
} from "../src/pages/Director/Sales/Statistics/statisticsDashboard.ts";

const policies = [
  {
    policyId: 1,
    schoolId: 10,
    schoolName: "THCS Nguyễn Du",
    provinceId: 100,
    provinceName: "TP Hồ Chí Minh",
    subjectId: 1000,
    subjectName: "Kỹ năng sống",
    schoolYear: "2026-2027",
    studentCount: 500,
    totalLessons: 36,
    contractNumber: "HD-01",
    policyData: {
      fee: 100_000,
      csvc: 10_000,
      thue: 5_000,
      giaovien: 20_000,
      htthietbi: [{ category: "Tivi", qty: 2, price: 8_000_000 }],
    },
  },
  {
    policyId: 2,
    schoolId: 11,
    schoolName: "Tiểu học Lê Lợi",
    provinceId: 100,
    provinceName: "TP Hồ Chí Minh",
    subjectId: 1001,
    subjectName: "STEM",
    schoolYear: "2026-2027",
    studentCount: 300,
    totalLessons: 24,
    policyData: {
      fee: 80_000,
      csvc: 10_000,
      tax: 5_000,
      giaovien: 15_000,
      htthietbi: [
        { category: "Tivi", qty: 1, price: 8_000_000 },
        { category: "Robot", qty: 10 },
      ],
    },
  },
];

test("tổng hợp KPI, địa bàn, môn học và thiết bị", () => {
  const model = buildStatisticsDashboardModel(policies);

  assert.equal(model.summary.policies, 2);
  assert.equal(model.summary.schools, 2);
  assert.equal(model.summary.students, 800);
  assert.equal(model.summary.periods, 60);
  assert.equal(model.summary.contractCoverage, 50);
  assert.equal(model.summary.devices, 13);
  assert.equal(model.provinces[0].schools, 2);
  assert.equal(model.subjects.length, 2);
  assert.equal(model.devices[0].name, "Robot");
  assert.equal(model.devices.find((row) => row.name === "Tivi")?.quantity, 3);
  assert.equal(
    model.devices.find((row) => row.name === "Tivi")?.estimatedValue,
    24_000_000
  );
});

test("đơn giá CTY thu hỗ trợ cả khóa thue và tax, không cộng trùng", () => {
  assert.equal(getCompanyUnit(policies[0]), 65_000);
  assert.equal(getCompanyUnit(policies[1]), 50_000);
});

test("lọc không dấu theo trường và lọc kết hợp theo năm học", () => {
  const result = filterStatisticsPolicies(policies, {
    keyword: "nguyen du",
    provinceId: 100,
    schoolId: null,
    subjectId: null,
    schoolYear: "2026-2027",
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].policyId, 1);
});

test("cảnh báo hồ sơ thiếu được phân loại độc lập", () => {
  const model = buildStatisticsDashboardModel([
    {
      policyId: 3,
      schoolId: 12,
      subjectId: 1002,
      studentCount: 0,
      totalLessons: 0,
      policyData: { fee: 0 },
    },
  ]);

  assert.equal(model.alerts.missingContract.length, 1);
  assert.equal(model.alerts.missingStudentCount.length, 1);
  assert.equal(model.alerts.missingPeriods.length, 1);
  assert.equal(model.alerts.nonPositiveCompanyUnit.length, 1);
});
