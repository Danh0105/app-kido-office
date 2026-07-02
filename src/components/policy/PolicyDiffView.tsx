import { PolicyDiff, PolicyDiffValue } from "@/types/policy";

const fieldLabels: Record<string, string> = {
  fee: "Học phí",
  durationMonths: "Số tháng",
  studentPerClass: "Sĩ số lớp",
  csvc: "CSVC",
  thue: "Thuế",
  giaovien: "Giáo viên trường",
  teacherCompany: "Giáo viên công ty",
  csthang: "CS tháng",
  cdhd: "CS ký hợp đồng",
  thietbi: "Thiết bị",
  giaoCu: "Giáo cụ",
  vanHanh: "Vận hành",
  thuetndn: "Thuế TNDN",
  companyProfit: "Lợi nhuận công ty",
  companyProfitPerHS: "Lợi nhuận / học sinh",
  ttcs: "Chính sách vận hành",
  notes: "Ghi chú",
  giaTriHopDong: "Giá trị hợp đồng",
  soTietThucDay: "Số tiết thực dạy",
  donGia: "Đơn giá",
  ghiChu: "Ghi chú",
};

const isDiffValue = (value: unknown): value is PolicyDiffValue =>
  Boolean(
    value &&
      typeof value === "object" &&
      (Object.prototype.hasOwnProperty.call(value, "old") ||
        Object.prototype.hasOwnProperty.call(value, "new")),
  );

const formatFieldName = (fieldName: string) =>
  fieldLabels[fieldName] ||
  fieldName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

const formatValue = (value: any) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") {
    return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

function DiffBranch({
  diff,
  path = "",
}: {
  diff: PolicyDiff;
  path?: string;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(diff || {}).map(([fieldName, value]) => {
        const fieldPath = path ? `${path}.${fieldName}` : fieldName;

        if (!isDiffValue(value)) {
          return (
            <div
              key={fieldPath}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
                {formatFieldName(fieldName)}
              </p>
              <DiffBranch diff={value as PolicyDiff} path={fieldPath} />
            </div>
          );
        }

        const oldValue = formatValue(value.old);
        const newValue = formatValue(value.new);
        const containsStructuredValue =
          typeof value.old === "object" || typeof value.new === "object";

        return (
          <div
            key={fieldPath}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {formatFieldName(fieldName)}
            </p>
            <div
              className={`mt-2 grid gap-2 ${
                containsStructuredValue
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              <div className="rounded-lg bg-red-50 px-3 py-2">
                <p className="text-[11px] font-bold uppercase text-red-500">
                  Giá trị cũ
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm text-red-700 line-through decoration-red-400">
                  {oldValue}
                </pre>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2">
                <p className="text-[11px] font-bold uppercase text-emerald-600">
                  Giá trị mới
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-sm font-semibold text-emerald-800">
                  {newValue}
                </pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PolicyDiffView({
  diff,
  emptyText = "Không có thay đổi dữ liệu",
}: {
  diff?: PolicyDiff | null;
  emptyText?: string;
}) {
  if (!diff || Object.keys(diff).length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
        {emptyText}
      </p>
    );
  }

  return <DiffBranch diff={diff} />;
}
