import type { ExpenseRequest, ExpenseRequestKind, ExpenseStatus } from "@/types/expenseRequest";

/**
 * Các mốc cần xử lý của MỘT vòng đề xuất, không phải tất cả log lịch sử.
 * Trạng thái hiện tại (BE) là nguồn sự thật; không suy diễn đã xong chỉ vì
 * từng có log ở một vòng duyệt trước đó.
 */
export type WorkflowStepState = "completed" | "current" | "upcoming" | "stopped";

export type WorkflowStep = {
  id: string;
  label: string;
  owner: string;
  state: WorkflowStepState;
};

type StepDefinition = Omit<WorkflowStep, "state">;

const create = (id: string, label: string, owner: string): StepDefinition => ({
  id,
  label,
  owner,
});

const COMMON = {
  created: create("created", "Tạo đề xuất", "Người đề xuất"),
  accounting: create("accounting", "Nhập số tiền", "Kế toán công nợ"),
  approved: create("approved", "Duyệt đề xuất", "Giám đốc"),
};

const CASH_STEPS: StepDefinition[] = [
  create("payment", "Lập lệnh chi", "Kế toán công nợ"),
  create("release", "Xuất tiền", "Thủ quỹ"),
  create("receive", "Nhận tiền", "Người đề xuất"),
  create("finished", "Xác nhận đã chi", "Người đề xuất"),
];

const STOCK_STEPS: StepDefinition[] = [
  create("stockIssue", "Lệnh xuất kho", "Phòng kỹ thuật"),
  create("receiveEquipment", "Nhận thiết bị", "Người đề xuất"),
  create("finished", "Xác nhận bàn giao", "Người đề xuất"),
];

const SUPPLIER_STEPS: StepDefinition[] = [
  create("stockIn", "Nhập kho", "Người được chỉ định"),
  create("finished", "Nghiệm thu bàn giao", "Người nghiệm thu"),
];

const REPAIR_STEPS: StepDefinition[] = [
  create("finished", "Nhận việc sửa chữa", "Phòng kỹ thuật"),
];

const completedIds: Partial<Record<ExpenseStatus, string>> = {
  APPROVED: "approved",
  PAYMENT_ORDERED: "payment",
  CASH_RELEASED: "release",
  CASH_RECEIVED: "receive",
  STOCK_ISSUE_ORDERED: "stockIssue",
  EQUIPMENT_RECEIVED: "receiveEquipment",
  STOCK_IN_COMPLETED: "stockIn",
  REPAIR_ACCEPTED: "finished",
  SPENT: "finished",
};

const withStates = (
  definitions: StepDefinition[],
  completedThrough: number,
  stoppedAt = -1
): WorkflowStep[] =>
  definitions.map((step, index) => ({
    ...step,
    state:
      index === stoppedAt
        ? "stopped"
        : index <= completedThrough
        ? "completed"
        : index === completedThrough + 1
        ? "current"
        : "upcoming",
  }));

export function getExpenseWorkflowSteps(request: ExpenseRequest): WorkflowStep[] {
  const { status, isMonthlyExpense } = request;
  const kind: ExpenseRequestKind = request.requestKind || "CASH";
  // Chi tháng quy trình Kế toán (từ 20/11/2026): Giám đốc duyệt là hệ thống tự
  // lập lệnh chi, không còn bước Kế toán công nợ lập lệnh chi (trừ lần chi lại
  // sau hoàn quỹ). Đơn duyệt trước đó còn ở APPROVED thì vẫn hiện bước này.
  const autoOrder =
    !!isMonthlyExpense &&
    (request.approvalFlow === "ACCOUNTANT_CHAIN" || request.approvalFlow === "SALES_PICK") &&
    status !== "APPROVED";
  const definitions: StepDefinition[] = [
    COMMON.created,
    ...(isMonthlyExpense ? [COMMON.accounting] : []),
    COMMON.approved,
  ];

  // Chưa duyệt / phân loại thì chưa thể biết chắc sẽ đi nhánh tiền, thiết bị
  // hay sửa chữa. Không hiển thị các bước chưa có cơ sở xác định.
  const unspecified = !request.requestKind && status === "PENDING_APPROVAL" && !isMonthlyExpense;
  if (unspecified) {
    return withStates(
      [...definitions, create("unknown", "Các bước sau duyệt", "Chờ phân loại")],
      0
    );
  }

  if (kind === "REPAIR") {
    definitions.push(...REPAIR_STEPS);
  } else if (kind === "EQUIPMENT") {
    definitions.push(...(request.equipmentSource === "SUPPLIER" ? SUPPLIER_STEPS : STOCK_STEPS));
  } else {
    definitions.push(
      ...(autoOrder ? CASH_STEPS.filter((step) => step.id !== "payment") : CASH_STEPS)
    );
  }

  if (status === "REJECTED" || status === "WITHDRAWN") {
    // Đây là trạng thái đã dừng. Không hiển thị các bước tương lai thành "còn thiếu".
    const reachedAccounting = !!isMonthlyExpense && (request.logs || []).some(
      (log) => log.toStatus === "PENDING_APPROVAL" || log.action === "CREATE_MONTHLY_PAYMENT_ORDER"
    );
    const beforeStop = [COMMON.created, ...(reachedAccounting ? [COMMON.accounting] : [])];
    const stop = create("stopped", status === "REJECTED" ? "Đã từ chối" : "Đã rút đề xuất", "Dừng xử lý");
    return withStates([...beforeStop, stop], beforeStop.length - 1, beforeStop.length);
  }

  // Chưa chi / chưa dùng tạo một nhánh thu hồi; sau thu hồi phải chạy lại
  // các bước giao/chi. Tránh hiển thị sai rằng đề xuất đã hoàn tất.
  if (status === "NOT_SPENT" || status === "FUND_RETURNED" || status === "EQUIPMENT_RETURNED") {
    const isEquipment = kind === "EQUIPMENT";
    const receivedId = isEquipment ? "receiveEquipment" : "receive";
    const receivedIndex = definitions.findIndex((step) => step.id === receivedId);
    const returnStep = create(
      "return",
      isEquipment ? "Nhập lại kho" : "Hoàn quỹ",
      isEquipment ? "Phòng kỹ thuật" : "Thủ quỹ"
    );
    const retry = isEquipment ? STOCK_STEPS : CASH_STEPS;
    const retrySteps = retry.map((step) => ({ ...step, id: `retry-${step.id}` }));
    const beforeReturn = definitions.slice(0, receivedIndex + 1);
    const reroute = [...beforeReturn, returnStep, ...retrySteps];
    const returned = status === "FUND_RETURNED" || status === "EQUIPMENT_RETURNED";
    return withStates(reroute, beforeReturn.length - 1 + (returned ? 1 : 0));
  }

  if (status === "REPAIR_REJECTED") {
    const approvedIndex = definitions.findIndex((step) => step.id === "approved");
    return withStates(
      [...definitions.slice(0, approvedIndex + 1),
        create("reassign", "Chỉ định người khác", "Giám đốc"),
        ...REPAIR_STEPS],
      approvedIndex
    );
  }

  if (status === "PENDING_ACCOUNTING") return withStates(definitions, 0);
  if (status === "PENDING_APPROVAL") {
    return withStates(definitions, isMonthlyExpense ? 1 : 0);
  }

  const completedId =
    autoOrder && status === "PAYMENT_ORDERED" ? "approved" : completedIds[status];
  const completedIndex = completedId
    ? definitions.findIndex((step) => step.id === completedId)
    : -1;
  return withStates(definitions, Math.max(0, completedIndex));
}
