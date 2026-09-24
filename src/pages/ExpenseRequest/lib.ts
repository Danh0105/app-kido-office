import { getEmployeeId, getEmployeeRoles, hasRole } from "@/utils/auth";
import type {
  EquipmentSource,
  ExpenseAssignment,
  ExpenseRequest,
  ExpenseRequestKind,
  ExpenseStatus,
} from "@/types/expenseRequest";

// Some expense endpoints/notification payloads use different wrappers for the
// same request. Resolve them in one place so an absent `id` never becomes NaN.
//
// `item.id` phải xét SAU CÙNG: một `ExpenseNotification` cũng có `id` riêng
// (khoá của chính dòng thông báo, không phải của đề xuất chi), nếu xét trước
// sẽ luôn thắng vì thông báo nào cũng có `id` — điều hướng nhầm sang
// `/expense-requests/<id thông báo>` rồi 404. Các field cụ thể hơn
// (`entityId`, `suggestId`...) chỉ tồn tại trên object thông báo nên xét
// trước là đúng; với object `ExpenseRequest` thật (chỉ có `.id`) thì các
// field đó vốn `undefined`, tự động rơi xuống `item.id` như cũ.
export const resolveExpenseRequestId = (value: unknown): number | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, any>;
  const rawId =
    item.expenseRequestId ??
    item.suggestId ??
    item.entityId ??
    item.meta?.expenseRequestId ??
    item.meta?.suggestId ??
    item.expenseRequest?.id ??
    item.request?.id ??
    item.suggest?.id ??
    item.id;
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

type CreatorLike = NonNullable<ExpenseRequest["creator"]> & {
  department?: { name?: string } | string;
};

type ExpenseCreatorFields = Pick<
  ExpenseRequest,
  "createdBy" | "createdByUser" | "creator"
>;

// Roles that live under the /director route tree (approvers / accounting / treasury).
export const isApproverSide = () =>
  hasRole(
    "accountant",
    "director",
    "director_la",
    "saleadmin",
    "salesadmin_la",
    "ketoan_congno",
    "ketoan_truong",
    "troly_gd",
    "thuquy",
    // Phòng kỹ thuật giữ hai chốt của nhánh thiết bị (lệnh xuất kho, nhận lại
    // hàng) — cùng vị trí trong luồng như kế toán công nợ + thủ quỹ bên tiền.
    "ky_thuat",
  );

export const isDebtAccountant = () =>
  hasRole("ketoan_congno", "ketoan_truong");

/** Phòng kỹ thuật — xử lý đề xuất thiết bị và sửa chữa. */
export const isTechnical = () => hasRole("ky_thuat");

/**
 * Tài khoản **chỉ** thuộc phòng kỹ thuật: chỉ xem nhánh thiết bị/sửa chữa,
 * không xem đề xuất tiền.
 *
 * Có kiểm tra thêm các role của nhánh tiền vì role trong hệ thống là mảng —
 * người vừa là `ky_thuat` vừa là giám đốc/kế toán/kinh doanh vẫn phải thấy đủ
 * hai loại, khoá luôn thì họ mất việc của vai trò kia.
 */
export const isEquipmentOnlyUser = () =>
  isTechnical() &&
  !hasRole(
    "sales",
    "accountant",
    "director",
    "director_la",
    "saleadmin",
    "salesadmin_la",
    "ketoan_congno",
    "ketoan_truong",
    "troly_gd",
    "thuquy",
  );

/**
 * Loại đề xuất, mặc định `CASH`: đề xuất tạo trước khi tách loại không có
 * `requestKind`, và toàn bộ luồng cũ là luồng tiền.
 */
export const requestKindOf = (req?: {
  requestKind?: ExpenseRequestKind | null;
}): ExpenseRequestKind => req?.requestKind ?? "CASH";

export const isEquipmentRequest = (req?: { requestKind?: ExpenseRequestKind | null }) =>
  requestKindOf(req) === "EQUIPMENT";

export const isRepairRequest = (req?: { requestKind?: ExpenseRequestKind | null }) =>
  requestKindOf(req) === "REPAIR";

/** Nguồn thiết bị; đề xuất thiết bị cũ chưa có trường này = kho. */
export const equipmentSourceOf = (req?: {
  equipmentSource?: EquipmentSource | null;
}): EquipmentSource => req?.equipmentSource ?? "STOCK";

/** Đề xuất thiết bị mua từ nhà cung cấp (luồng phiếu nhập kho + nghiệm thu). */
export const isSupplierEquipment = (req?: {
  requestKind?: ExpenseRequestKind | null;
  equipmentSource?: EquipmentSource | null;
}) => isEquipmentRequest(req) && equipmentSourceOf(req) === "SUPPLIER";

/**
 * Trạng thái có thật trong từng nhánh — dùng để bộ lọc trạng thái không chào
 * những trạng thái mà loại đang chọn không bao giờ đi tới (VD lọc đề xuất thiết
 * bị mà vẫn có "Đã xuất tiền").
 */
export const KIND_STATUSES: Record<ExpenseRequestKind, ExpenseStatus[]> = {
  CASH: [
    "PENDING_APPROVAL",
    "APPROVED",
    "PAYMENT_ORDERED",
    "CASH_RELEASED",
    "CASH_RECEIVED",
    "SPENT",
    "NOT_SPENT",
    "FUND_RETURNED",
    "REJECTED",
    "WITHDRAWN",
  ],
  EQUIPMENT: [
    "PENDING_APPROVAL",
    "APPROVED",
    "STOCK_IN_COMPLETED",
    "STOCK_ISSUE_ORDERED",
    "EQUIPMENT_RECEIVED",
    "SPENT",
    "NOT_SPENT",
    "EQUIPMENT_RETURNED",
    "REJECTED",
    "WITHDRAWN",
  ],
  REPAIR: [
    "PENDING_APPROVAL",
    "APPROVED",
    "REPAIR_ACCEPTED",
    "REPAIR_REJECTED",
    "REJECTED",
    "WITHDRAWN",
  ],
};

const ALL_EXPENSE_STATUSES: ExpenseStatus[] = [
  ...new Set([
    ...KIND_STATUSES.CASH,
    ...KIND_STATUSES.EQUIPMENT,
    ...KIND_STATUSES.REPAIR,
  ]),
];

// Base route for expense pages depends on which nav tree the current user uses.
export const expenseBasePath = () =>
  isApproverSide() ? "/director/expense-requests" : "/employee/expense-requests";

export const expenseTasksPath = () =>
  isApproverSide() ? "/director/expense-tasks" : "/employee/expense-tasks";

// Creating a request is always a sales/owner action. A multi-role sales user
// may otherwise inherit the director base path from roles such as `thuquy`,
// causing `/director/expense-requests/new` to be parsed as the `:id` route.
export const expenseCreatePath = () => "/employee/expense-requests/new";
export const expenseEditPath = (id: number) =>
  `/employee/expense-requests/${id}/edit`;

export const isOwner = (req?: ExpenseCreatorFields) => {
  const me = Number(getEmployeeId());
  if (!me || !req) return false;
  return creatorId(req) === me;
};

export type ActionKey =
  | "approve"
  | "reject"
  | "withdraw"
  | "edit"
  | "delete"
  | "saleadminReview"
  | "saleadminReject"
  | "paymentOrder"
  | "editPaymentOrder"
  | "cashReleased"
  | "cashReceived"
  | "confirmSpent"
  | "confirmNotSpent"
  | "fundReturned"
  // --- nhánh đề xuất thiết bị ---
  | "stockIssueOrder"
  | "equipmentReceived"
  | "equipmentReturned"
  // --- nhánh đề xuất sửa chữa ---
  | "repairAccept"
  | "repairReject"
  | "reassignRepair"
  // --- thiết bị mua từ nhà cung cấp ---
  | "stockInReceipt"
  | "stockInAccept";

type ExpenseStepDefinition = {
  roles: readonly string[];
  from: readonly ExpenseStatus[];
  owner: boolean;
  /**
   * Vai trò được miễn ràng buộc `owner` ở trên — có role này thì làm được bất
   * kể có phải chủ đơn hay không (giống `overrideRoles` bên BE). Dùng cho
   * Giám đốc rút hộ đơn của người khác.
   */
  overrideRoles?: readonly string[];
  /**
   * Loại đề xuất dùng được bước này. Bỏ trống = cả hai loại (các bước chung:
   * duyệt, từ chối, rút, xoá, xác nhận đã dùng / chưa dùng).
   *
   * Bắt buộc phải có vì hai nhánh **dùng chung trạng thái**: `APPROVED` là việc
   * của kế toán công nợ với đề xuất tiền nhưng là việc của phòng kỹ thuật với
   * đề xuất thiết bị, `NOT_SPENT` cũng vậy (thủ quỹ ↔ kỹ thuật). Chỉ xét theo
   * `status` là hiện nhầm nút rồi bấm vào ăn 409.
   */
  kinds?: readonly ExpenseRequestKind[];
  /** Nguồn thiết bị dùng được bước này (khớp `equipmentSources` bên BE). */
  equipmentSources?: readonly EquipmentSource[];
  /**
   * Bước do đúng người Giám đốc chỉ định giữ (khớp `assignee` bên BE): bỏ
   * qua `roles`/`owner`, chỉ cần id người dùng trùng người được chỉ định.
   */
  assignee?: "stockInHandler" | "acceptor";
};

export const EXPENSE_STEPS: Record<ActionKey, ExpenseStepDefinition> = {
  // Sales Admin duyệt/từ chối ngang quyền Giám đốc — cùng một chốt quyết định,
  // ai xử lý trước cũng được (khớp EXPENSE_TRANSITIONS bên BE).
  approve: {
    roles: ["director", "director_la", "saleadmin"],
    from: ["PENDING_APPROVAL"],
    owner: false,
  },
  reject: {
    roles: ["director", "director_la", "saleadmin"],
    from: ["PENDING_APPROVAL"],
    owner: false,
  },
  // Chủ đơn tự rút — chỉ khi còn đang chờ duyệt, giống điều kiện BE (state
  // machine WITHDRAW). Giám đốc rút hộ được đơn của bất kỳ ai (overrideRoles).
  withdraw: {
    roles: ["sales", "director", "director_la"],
    from: ["PENDING_APPROVAL"],
    owner: true,
    overrideRoles: ["director", "director_la"],
  },
  // Chủ đơn được sửa ở mọi trạng thái. Mỗi lần lưu, backend đưa đề xuất về
  // PENDING_APPROVAL và xoá các dấu duyệt để chạy lại quy trình từ đầu.
  edit: {
    roles: ["sales"],
    from: ALL_EXPENSE_STATUSES,
    owner: true,
  },
  // Giám đốc xoá hẳn đề xuất — chỉ khi chưa phát sinh dòng tiền (chưa lên
  // lệnh chi/xuất quỹ) và chưa xuất kho, giống RESOURCE_MOVED_STATUSES bên BE.
  delete: {
    roles: ["director", "director_la"],
    from: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "WITHDRAWN"],
    owner: false,
  },
  saleadminReview: { roles: ["saleadmin", "salesadmin_la"], from: ["PENDING_APPROVAL"], owner: false },
  saleadminReject: { roles: ["saleadmin", "salesadmin_la"], from: ["PENDING_APPROVAL"], owner: false },

  // --- nhánh ĐỀ XUẤT TIỀN ---
  // Kế toán trưởng có toàn quyền của kế toán công nợ + thủ quỹ (khớp
  // ExpenseRole.CHIEF_ACCOUNTANT bên BE).
  paymentOrder: {
    roles: ["ketoan_congno", "ketoan_truong"],
    from: ["APPROVED", "FUND_RETURNED"],
    owner: false,
    kinds: ["CASH"],
  },
  // Kế toán công nợ sửa lệnh chi đã lập — kể cả khi thủ quỹ đã xuất tiền
  // hoặc kinh doanh đã nhận tiền, để sửa sai số liệu (khớp
  // ExpenseAction.EDIT_PAYMENT_ORDER bên BE). Backend quay đề xuất về
  // PAYMENT_ORDERED nên các bước đó phải làm lại.
  editPaymentOrder: {
    roles: ["ketoan_congno", "ketoan_truong"],
    from: [
      "PAYMENT_ORDERED",
      "CASH_RELEASED",
      "CASH_RECEIVED",
      "SPENT",
      "NOT_SPENT",
      "FUND_RETURNED",
    ],
    owner: false,
    kinds: ["CASH"],
  },
  cashReleased: {
    roles: ["thuquy", "ketoan_truong"],
    from: ["PAYMENT_ORDERED"],
    owner: false,
    kinds: ["CASH"],
  },
  fundReturned: {
    roles: ["thuquy", "ketoan_truong"],
    from: ["NOT_SPENT"],
    owner: false,
    kinds: ["CASH"],
  },
  cashReceived: {
    roles: ["sales"],
    from: ["CASH_RELEASED"],
    owner: true,
    kinds: ["CASH"],
  },

  // --- nhánh ĐỀ XUẤT THIẾT BỊ ---
  // Phòng kỹ thuật giữ cả hai chốt: lên lệnh xuất kho và nhận lại hàng.
  stockIssueOrder: {
    roles: ["ky_thuat"],
    from: ["APPROVED", "EQUIPMENT_RETURNED"],
    owner: false,
    kinds: ["EQUIPMENT"],
    equipmentSources: ["STOCK"],
  },
  equipmentReturned: {
    roles: ["ky_thuat"],
    from: ["NOT_SPENT"],
    owner: false,
    kinds: ["EQUIPMENT"],
  },
  equipmentReceived: {
    roles: ["sales"],
    from: ["STOCK_ISSUE_ORDERED"],
    owner: true,
    kinds: ["EQUIPMENT"],
  },

  // --- nhánh ĐỀ XUẤT SỬA CHỮA ---
  repairAccept: {
    roles: ["ky_thuat"],
    from: ["APPROVED"],
    owner: false,
    kinds: ["REPAIR"],
  },
  repairReject: {
    roles: ["ky_thuat"],
    from: ["APPROVED"],
    owner: false,
    kinds: ["REPAIR"],
  },
  // Giám đốc/Sales Admin chỉ định người khác sau khi người trước từ chối.
  reassignRepair: {
    roles: ["director", "director_la", "saleadmin", "salesadmin_la"],
    from: ["REPAIR_REJECTED"],
    owner: false,
    kinds: ["REPAIR"],
  },

  // --- ĐỀ XUẤT THIẾT BỊ mua từ NHÀ CUNG CẤP ---
  // Người xử lý/nghiệm thu có thể thuộc bất kỳ phòng ban nào.
  stockInReceipt: {
    roles: [],
    from: ["APPROVED"],
    owner: false,
    kinds: ["EQUIPMENT"],
    equipmentSources: ["SUPPLIER"],
    assignee: "stockInHandler",
  },
  stockInAccept: {
    roles: [],
    from: ["STOCK_IN_COMPLETED"],
    owner: false,
    kinds: ["EQUIPMENT"],
    equipmentSources: ["SUPPLIER"],
    assignee: "acceptor",
  },

  // --- dùng chung: chủ đơn chốt đã dùng / chưa dùng cho cả hai nhánh ---
  confirmSpent: {
    roles: ["sales"],
    from: ["CASH_RECEIVED", "EQUIPMENT_RECEIVED"],
    owner: true,
  },
  confirmNotSpent: {
    roles: ["sales"],
    from: ["CASH_RECEIVED", "EQUIPMENT_RECEIVED"],
    owner: true,
  },
};

export const canDoStep = (
  step: ActionKey,
  req: ExpenseRequest,
  user = { id: Number(getEmployeeId()), roles: getEmployeeRoles() },
) => {
  const definition = EXPENSE_STEPS[step];

  if (
    definition.equipmentSources &&
    isEquipmentRequest(req) &&
    !definition.equipmentSources.includes(equipmentSourceOf(req))
  ) {
    return false;
  }

  if (definition.assignee) {
    const assigneeId =
      definition.assignee === "acceptor"
        ? req.acceptorId
        : req.stockInHandlerId;
    return (
      Number.isFinite(user.id) &&
      assigneeId != null &&
      Number(assigneeId) === user.id &&
      definition.from.includes(req.status) &&
      (!definition.kinds || definition.kinds.includes(requestKindOf(req)))
    );
  }

  const requestCreatorId = creatorId(req);
  if (!requestCreatorId) return false;
  const owner = requestCreatorId === user.id;

  if (
    !Number.isFinite(user.id) ||
    !definition.roles.some((role) => user.roles.includes(role)) ||
    !definition.from.includes(req.status) ||
    (definition.kinds && !definition.kinds.includes(requestKindOf(req)))
  ) {
    return false;
  }

  const hasOverrideRole = definition.overrideRoles?.some((role) =>
    user.roles.includes(role),
  );
  if (hasOverrideRole) return true;

  return owner === definition.owner;
};

// Actions the current user may take on a request, derived from status + role + ownership.
// Backend is the source of truth; this only decides which buttons to show.
export const availableActions = (req: ExpenseRequest): ActionKey[] => {
  // Kế toán trưởng không thao tác ở màn này — trừ khi được Giám đốc chỉ định
  // xử lý/nghiệm thu thiết bị mua từ nhà cung cấp.
  const readOnly = hasRole("ketoan_truong");
  // Người bàn giao đã từ chối thì không làm bước kỹ thuật nữa (BE chặn), chờ
  // Giám đốc chọn người thay thế.
  const me = Number(getEmployeeId());
  const declinedHandover = (req.assignments || []).some(
    (a) => a.role === "HANDOVER" && a.status === "DECLINED" && a.employeeId === me,
  );
  return (Object.keys(EXPENSE_STEPS) as ActionKey[]).filter((step) => {
    if (readOnly && !EXPENSE_STEPS[step].assignee) return false;
    if (declinedHandover && (step === "stockIssueOrder" || step === "repairAccept")) {
      return false;
    }
    // Thiết bị từ nhà cung cấp đã nhập kho thật thì không sửa được nữa (BE
    // chặn), vì duyệt lại sẽ nhập kho thêm lần nữa.
    if (
      step === "edit" &&
      isSupplierEquipment(req) &&
      ["STOCK_IN_COMPLETED", "SPENT"].includes(req.status)
    ) {
      return false;
    }
    if (
      (step === "saleadminReview" || step === "saleadminReject") &&
      req.saleadminReviewStatus
    ) {
      return false;
    }
    return canDoStep(step, req);
  });
};

// ===== Giao việc: người bàn giao + người hỗ trợ (khớp SuggestService bên BE) =====

/**
 * Tên gọi người chính được giao (role HANDOVER): thiết bị là người bàn giao,
 * sửa chữa là người đảm nhận chính. Hai loại dùng chung người hỗ trợ.
 */
export const mainAssigneeLabel = (kind?: ExpenseRequestKind | null) =>
  kind === "REPAIR" ? "Người đảm nhận chính" : "Người bàn giao";

/** Còn được từ chối / thay người khi việc chưa bắt đầu (chưa xuất kho). */
const ASSIGNMENT_OPEN_STATUSES: ExpenseStatus[] = ["APPROVED", "EQUIPMENT_RETURNED"];

const ASSIGNMENT_REPLACER_ROLES = ["director", "director_la", "saleadmin", "salesadmin_la"];

/** Người đang được giao (chưa từ chối, chưa bị thay) + người từ chối chờ thay. */
export const activeAssignments = (req: ExpenseRequest) =>
  (req.assignments || []).filter((a) => a.status !== "REPLACED");

/**
 * Việc được giao của người đang đăng nhập mà họ còn từ chối được. Người bàn
 * giao đề xuất sửa chữa dùng nút "Từ chối" sửa chữa sẵn có nên không tính.
 */
export const myDeclinableAssignment = (
  req: ExpenseRequest,
): ExpenseAssignment | null => {
  const me = Number(getEmployeeId());
  if (!me || !ASSIGNMENT_OPEN_STATUSES.includes(req.status)) return null;
  return (
    (req.assignments || []).find(
      (a) =>
        a.employeeId === me &&
        a.status === "ASSIGNED" &&
        !(a.role === "HANDOVER" && isRepairRequest(req)),
    ) || null
  );
};

/** Giám đốc/Sales Admin chọn được người thay thế cho người đã từ chối này. */
export const canReplaceAssignment = (req: ExpenseRequest, a: ExpenseAssignment) => {
  if (a.status !== "DECLINED" || !hasRole(...ASSIGNMENT_REPLACER_ROLES)) return false;
  // Người bàn giao sửa chữa thay bằng "Chỉ định người khác" (REPAIR_REJECTED).
  if (a.role === "HANDOVER" && isRepairRequest(req)) return false;
  const open: ExpenseStatus[] =
    a.role === "SUPPORT"
      ? [...ASSIGNMENT_OPEN_STATUSES, "REPAIR_REJECTED"]
      : ASSIGNMENT_OPEN_STATUSES;
  return open.includes(req.status);
};

// Waiting message shown when the current user has no action but the flow is ongoing.
export const waitingMessage = (req: ExpenseRequest): string | null => {
  const equipment = isEquipmentRequest(req);
  const repair = isRepairRequest(req);
  const purchase = isSupplierEquipment(req);

  switch (req.status) {
    case "PENDING_APPROVAL":
      return "Chờ giám đốc duyệt…";
    case "APPROVED":
      if (
        (req.assignments || []).some(
          (a) => a.role === "HANDOVER" && a.status === "DECLINED",
        )
      ) {
        return "Người bàn giao đã từ chối, chờ giám đốc chọn người thay thế…";
      }
      if (purchase) {
        const who = req.stockInHandler?.name;
        return who
          ? `Đã duyệt, chờ ${who} lập phiếu nhập kho…`
          : "Đã duyệt, chờ người xử lý lập phiếu nhập kho…";
      }
      if (repair) {
        const who = req.assignedTechnician?.name;
        return who
          ? `Đã duyệt, chờ ${who} (người đảm nhận chính) nhận việc hoặc từ chối…`
          : "Đã duyệt, chờ phòng kỹ thuật nhận việc hoặc từ chối…";
      }
      return equipment
        ? "Đã duyệt, chờ phòng kỹ thuật lên lệnh xuất kho…"
        : "Đã duyệt, chờ kế toán lên lệnh chi…";
    case "PAYMENT_ORDERED":
      return req.paymentOrder?.code
        ? `Lệnh chi ${req.paymentOrder.code} đã lập, chờ thủ quỹ xuất tiền…`
        : "Đã lên lệnh chi, chờ thủ quỹ xuất tiền…";
    case "CASH_RELEASED":
      return "Thủ quỹ đã xuất tiền, chờ người đề xuất nhận tiền…";
    case "CASH_RECEIVED":
      return "Đã nhận tiền, chờ người đề xuất xác nhận chi…";
    case "NOT_SPENT":
      return equipment
        ? "Chưa dùng, chờ phòng kỹ thuật nhận lại thiết bị…"
        : "Chưa chi, chờ thủ quỹ nhận lại quỹ…";
    case "FUND_RETURNED":
      return "Đã hoàn quỹ, chờ kế toán công nợ lên lại lệnh chi…";
    case "STOCK_ISSUE_ORDERED":
      return req.stockIssueOrder?.code
        ? `Lệnh xuất kho ${req.stockIssueOrder.code} đã lập, chờ người đề xuất nhận thiết bị…`
        : "Đã lên lệnh xuất kho, chờ người đề xuất nhận thiết bị…";
    case "EQUIPMENT_RECEIVED":
      return "Đã nhận thiết bị, chờ người đề xuất xác nhận bàn giao…";
    case "EQUIPMENT_RETURNED":
      return "Thiết bị đã nhập lại kho, chờ phòng kỹ thuật lên lại lệnh xuất kho…";
    case "STOCK_IN_COMPLETED": {
      const who = req.acceptor?.name;
      return who
        ? `Đã nhập kho, chờ ${who} nghiệm thu bàn giao…`
        : "Đã nhập kho, chờ người nghiệm thu bàn giao…";
    }
    case "REPAIR_ACCEPTED":
      return req.assignedTechnician?.name
        ? `${req.assignedTechnician.name} đã nhận việc sửa chữa.`
        : "Phòng kỹ thuật đã nhận việc sửa chữa.";
    case "REPAIR_REJECTED":
      return "Phòng kỹ thuật đã từ chối việc sửa chữa.";
    default:
      return null;
  }
};

export const formatDate = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("vi-VN");
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// today (local) in YYYY-MM-DD, used as the min date for expectedPaymentDate.
export const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

const cleanText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const getCreator = (req?: ExpenseCreatorFields) => {
  if (!req) return undefined;
  const createdBy =
    typeof req.createdBy === "object"
      ? (req.createdBy as CreatorLike)
      : undefined;
  return (req.creator || req.createdByUser || createdBy) as CreatorLike | undefined;
};

export const creatorId = (
  req?: ExpenseCreatorFields,
) => {
  if (!req) return undefined;
  const creator = getCreator(req);
  const rawId =
    creator?.id ??
    (typeof req.createdBy === "number" || typeof req.createdBy === "string"
      ? req.createdBy
      : undefined);
  const id = Number(rawId);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};

export const creatorName = (
  req: ExpenseCreatorFields,
) => {
  const name = cleanText(getCreator(req)?.name);
  if (name) return name;

  const id = creatorId(req);
  return id ? `#${id}` : "—";
};

export const creatorPhone = (
  req: ExpenseCreatorFields,
) => cleanText(getCreator(req)?.phone);

export const creatorEmail = (
  req: ExpenseCreatorFields,
) => cleanText(getCreator(req)?.email);

export const creatorDepartment = (
  req: ExpenseCreatorFields,
) => {
  const creator = getCreator(req);
  if (!creator) return "";
  if (typeof creator.department === "string") return cleanText(creator.department);
  return cleanText(creator.department?.name) || cleanText(creator.departmentName);
};

export const creatorDetails = (
  req: ExpenseCreatorFields,
) => {
  const details: { label: string; value: string }[] = [];
  const phone = creatorPhone(req);
  const email = creatorEmail(req);
  const id = creatorId(req);
  const department = creatorDepartment(req);

  if (phone) details.push({ label: "SĐT", value: phone });
  if (email) details.push({ label: "Email", value: email });
  if (id) details.push({ label: "Mã NV", value: String(id) });
  if (department) details.push({ label: "Phòng ban", value: department });

  return details;
};

export const creatorInlineDetails = (
  req: ExpenseCreatorFields,
) => creatorDetails(req).map((item) => `${item.label}: ${item.value}`);
