import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGlobalExpenseReportExcel,
  buildGlobalExpenseReportSheet,
  globalExpenseFilterDescription,
  globalExpenseReportFileName,
} from "../src/pages/Director/expense/components/globalExpenseReportExcel.ts";

const row = (employeeName, revenue, profit) => ({
  employeeName,
  employeeRoles: "Nhân viên KD",
  employeeContact: "0902",
  schoolName: `TH ${employeeName}`,
  schoolTaxCode: "MST",
  periodName: "T9",
  schoolYear: "2026-2027",
  subjectName: "STEM",
  students: 30,
  periods: 20,
  revenue,
  schoolExpense: 20,
  schoolPaid: 10,
  invoice: 70,
  collected: 50,
  outsideExpense: 10,
  outsidePaid: 5,
  schoolTeacher: 8,
  companyTeacher: 7,
  annualPolicy: 6,
  otherExpense: 4,
  profit,
});

const rows = [row("Bình", 200, 100), row("An", 100, 50)];

test("Excel tổng hợp đủ cột theo báo cáo và cộng ô số", () => {
  const sheet = buildGlobalExpenseReportSheet(
    rows,
    { schoolYear: "2026-2027" },
    new Date("2026-11-16T08:00:00Z"),
  );

  assert.equal(sheet.sheet, "Tổng hợp thu chi");
  assert.equal(sheet.data.length, 8);
  assert.equal(sheet.data[5][1].value, "An");
  assert.equal(sheet.data[6][1].value, "Bình");
  const total = sheet.data[7];
  assert.equal(total[9].value, 60);
  assert.equal(total[11].value, 300);
  assert.equal(total[22].value, 150);
  assert.equal(total[11].type, Number);
  assert.equal(rows[0].employeeName, "Bình", "không mutate dữ liệu nguồn");
});

test("mô tả bộ lọc và tên file phản ánh phạm vi xuất", () => {
  const filters = {
    employeeName: "Nguyễn Văn An",
    schoolYear: "2026-2027",
    monthLabel: "09/2026",
  };
  assert.match(globalExpenseFilterDescription(filters), /Nguyễn Văn An/);
  assert.equal(
    globalExpenseReportFileName(filters, new Date(2026, 10, 16)),
    "Bao_cao_tong_hop_thu_chi_Nguyen_Van_An_2026-11-16.xlsx",
  );
});

test("tạo được Blob XLSX thực tế", async () => {
  const blob = await buildGlobalExpenseReportExcel(rows, {});
  assert.equal(
    blob.type,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.ok(blob.size > 1000);
});
