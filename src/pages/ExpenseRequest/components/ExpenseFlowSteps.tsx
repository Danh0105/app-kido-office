import type { CashflowSource } from "@/types/expenseRequest";

/**
 * Quy trình duyệt của hình thức đề xuất đang chọn — hiện ngay trên form tạo /
 * sửa để người đề xuất biết đề xuất sẽ đi qua những ai. Khớp state machine BE
 * (src/suggest/expense-flow.state-machine.ts).
 */

type Step = { who: string; what: string };

const STEP_DOT =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold";

function StepList({ steps, start = 1 }: { steps: Step[]; start?: number }) {
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-2">
          <span className={`${STEP_DOT} bg-blue-500 text-white`}>
            {start + index}
          </span>
          <span className="text-xs leading-5 text-gray-700">
            <b className="font-semibold text-gray-900">{step.who}</b>{" "}
            {step.what}
          </span>
        </li>
      ))}
    </ol>
  );
}

const MONTHLY_TABLE: Record<CashflowSource, string> = {
  MANAGEMENT: "Chi Ngoài",
  SCHOOL_EXPENSE: "Chi Trường",
  SCHOOL_TEACHER: "Giáo viên trường",
};

function monthlySteps(source: CashflowSource): Step[] {
  const table = MONTHLY_TABLE[source];
  return [
    { who: "Bạn", what: "chọn trường + kỳ kế toán và gửi đề xuất." },
    {
      who: "Kế toán",
      what: `nhập số liệu bảng ${table} ở QL thu chi rồi gửi Kế toán trưởng.`,
    },
    { who: "Kế toán trưởng", what: "duyệt (hoặc từ chối)." },
    { who: "Giám đốc", what: "duyệt (hoặc từ chối)." },
    { who: "Kế toán công nợ", what: "lập lệnh chi." },
    { who: "Thủ quỹ", what: "xuất tiền." },
    {
      who: "Bạn",
      what: `nhận tiền và xác nhận đã chi — số tiền ghi vào Đã chi của bảng ${table}.`,
    },
  ];
}

const YEAR_BRANCHES: { title: string; steps: Step[] }[] = [
  {
    title: "💵 Tiền",
    steps: [
      { who: "Kế toán công nợ", what: "lập lệnh chi." },
      { who: "Thủ quỹ", what: "xuất tiền." },
      { who: "Bạn", what: "nhận tiền rồi xác nhận đã chi." },
    ],
  },
  {
    title: "📦 Thiết bị có sẵn trong kho",
    steps: [
      { who: "Phòng kỹ thuật", what: "lập lệnh xuất kho." },
      { who: "Bạn", what: "nhận thiết bị rồi xác nhận đã chi." },
    ],
  },
  {
    title: "🛒 Thiết bị mua từ nhà cung cấp",
    steps: [
      { who: "Người xử lý", what: "(Giám đốc chỉ định) lập phiếu nhập kho." },
      { who: "Người nghiệm thu", what: "(Giám đốc chỉ định) xác nhận hoàn thành." },
    ],
  },
  {
    title: "🔧 Sửa chữa",
    steps: [
      {
        who: "Phòng kỹ thuật",
        what: "nhận việc và hoàn thành (từ chối thì Giám đốc chỉ định người khác).",
      },
    ],
  },
];

export default function ExpenseFlowSteps({
  source,
}: {
  /** `null` = Đề xuất chi Năm. */
  source: CashflowSource | null;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-700">
        Quy trình duyệt
      </p>
      {source ? (
        <>
          <StepList steps={monthlySteps(source)} />
          <p className="mt-2 text-[11px] text-gray-500">
            Số tiền = Còn lại của bảng lúc Kế toán gửi. Sửa đề xuất trước khi
            Thủ quỹ xuất tiền sẽ chạy lại quy trình từ bước Kế toán.
          </p>
        </>
      ) : (
        <>
          <StepList
            steps={[
              {
                who: "Bạn",
                what: "gửi đề xuất (đề xuất cho trường: tích dòng tiền mặt / thiết bị của chính sách năm và nhập số tiền).",
              },
              {
                who: "Giám đốc",
                what: "duyệt (hoặc từ chối) và chọn loại xử lý:",
              },
            ]}
          />
          <div className="mt-2 space-y-2 pl-7">
            {YEAR_BRANCHES.map((branch) => (
              <div
                key={branch.title}
                className="rounded-lg border border-blue-100 bg-white p-2"
              >
                <p className="mb-1 text-[11px] font-semibold text-gray-600">
                  {branch.title}
                </p>
                <StepList steps={branch.steps} start={3} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">
            Hoàn thành thì số tiền đã nhập ghi vào Đã chi của từng dòng chính
            sách năm. Bị từ chối hoặc rút lại thì không ghi gì.
          </p>
        </>
      )}
    </div>
  );
}
