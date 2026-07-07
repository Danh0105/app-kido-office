import { getEmployeeId, hasRole } from "@/utils/auth";
import type { ExpenseRequest, ExpenseStatus } from "@/types/expenseRequest";

type CreatorLike = NonNullable<ExpenseRequest["creator"]> & {
  department?: { name?: string } | string;
};

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
  );

export const isDebtAccountant = () =>
  hasRole("ketoan_congno");

// Base route for expense pages depends on which nav tree the current user uses.
export const expenseBasePath = () =>
  isApproverSide() ? "/director/expense-requests" : "/employee/expense-requests";

export const expenseTasksPath = () =>
  isApproverSide() ? "/director/expense-tasks" : "/employee/expense-tasks";

export const isOwner = (req?: Pick<ExpenseRequest, "createdBy" | "creator">) => {
  const me = Number(getEmployeeId());
  if (!me || !req) return false;
  return creatorId(req) === me;
};

export type ActionKey =
  | "approve"
  | "reject"
  | "paymentOrder"
  | "cashReleased"
  | "cashReceived"
  | "confirmSpent"
  | "confirmNotSpent"
  | "fundReturned";

// Actions the current user may take on a request, derived from status + role + ownership.
// Backend is the source of truth; this only decides which buttons to show.
export const availableActions = (req: ExpenseRequest): ActionKey[] => {
  const owner = isOwner(req);
  const actions: ActionKey[] = [];

  switch (req.status) {
    case "PENDING_APPROVAL":
      if (hasRole("director", "director_la")) actions.push("approve", "reject");
      break;
    case "APPROVED":
      if (isDebtAccountant()) actions.push("paymentOrder");
      break;
    case "PAYMENT_ORDERED":
      if (hasRole("thuquy")) actions.push("cashReleased");
      break;
    case "CASH_RELEASED":
      if (owner) actions.push("cashReceived");
      break;
    case "CASH_RECEIVED":
      if (owner) actions.push("confirmSpent", "confirmNotSpent");
      break;
    case "NOT_SPENT":
      if (hasRole("thuquy")) actions.push("fundReturned");
      break;
    case "FUND_RETURNED":
      if (isDebtAccountant()) actions.push("paymentOrder");
      break;
    default:
      break;
  }

  return actions;
};

// Waiting message shown when the current user has no action but the flow is ongoing.
export const waitingMessage = (req: ExpenseRequest): string | null => {
  switch (req.status) {
    case "PENDING_APPROVAL":
      return "Chờ giám đốc duyệt…";
    case "APPROVED":
      return "Đã duyệt, chờ kế toán lên lệnh chi…";
    case "PAYMENT_ORDERED":
      return req.paymentOrder?.code
        ? `Lệnh chi ${req.paymentOrder.code} đã lập, chờ thủ quỹ xuất tiền…`
        : "Đã lên lệnh chi, chờ thủ quỹ xuất tiền…";
    case "CASH_RELEASED":
      return "Thủ quỹ đã xuất tiền, chờ người đề xuất nhận tiền…";
    case "CASH_RECEIVED":
      return "Đã nhận tiền, chờ người đề xuất xác nhận chi…";
    case "NOT_SPENT":
      return "Chưa chi, chờ thủ quỹ nhận lại quỹ…";
    case "FUND_RETURNED":
      return "Đã hoàn quỹ, chờ kế toán công nợ lên lại lệnh chi…";
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

const getCreator = (req?: Pick<ExpenseRequest, "createdBy" | "creator">) => {
  if (!req) return undefined;
  const createdBy =
    typeof req.createdBy === "object"
      ? (req.createdBy as CreatorLike)
      : undefined;
  return (req.creator || createdBy) as CreatorLike | undefined;
};

export const creatorId = (
  req?: Pick<ExpenseRequest, "createdBy" | "creator">,
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
  req: Pick<ExpenseRequest, "createdBy" | "creator">,
) => {
  const name = cleanText(getCreator(req)?.name);
  if (name) return name;

  const id = creatorId(req);
  return id ? `#${id}` : "—";
};

export const creatorPhone = (
  req: Pick<ExpenseRequest, "createdBy" | "creator">,
) => cleanText(getCreator(req)?.phone);

export const creatorEmail = (
  req: Pick<ExpenseRequest, "createdBy" | "creator">,
) => cleanText(getCreator(req)?.email);

export const creatorDepartment = (
  req: Pick<ExpenseRequest, "createdBy" | "creator">,
) => {
  const creator = getCreator(req);
  if (!creator) return "";
  if (typeof creator.department === "string") return cleanText(creator.department);
  return cleanText(creator.department?.name) || cleanText(creator.departmentName);
};

export const creatorDetails = (
  req: Pick<ExpenseRequest, "createdBy" | "creator">,
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
  req: Pick<ExpenseRequest, "createdBy" | "creator">,
) => creatorDetails(req).map((item) => `${item.label}: ${item.value}`);
