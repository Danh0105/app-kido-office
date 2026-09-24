import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import { formatVnd } from "@/utils/decimal";
import { hasRole } from "@/utils/auth";
import {
  expenseRequestApi,
  resolveFileUrl,
  type ApproveExpensePayload,
  type PaymentOrderPayload,
  type StockInReceiptPayload,
  type StockIssueOrderPayload,
} from "@/service/expenseRequest";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { policiesApi } from "@/service/policy";
import {
  EQUIPMENT_SOURCE_META,
  FUND_SOURCE_LABEL,
  PAYMENT_METHOD_LABEL,
  STATUS_META,
  type ExpenseRequest,
  type ExpenseAssignment,
  type ExpenseRequestKind,
  type StockInItem,
} from "@/types/expenseRequest";
import PolicyFinanceTable from "@/pages/Director/expense/component/policy/PolicyFinanceTable";
import TtcsTable from "@/pages/Director/expense/component/policy/TtcsTable";
import CashPolicyTable from "@/pages/Director/expense/component/policy/CashPolicyTable";
import DevicePolicyTable from "@/pages/Director/expense/component/policy/DevicePolicyTable";

import StatusBadge from "./components/StatusBadge";
import KindBadge from "./components/KindBadge";
import Timeline from "./components/Timeline";
import ActionModal, { type ActionPayload } from "./components/ActionModal";
import ApproveModal from "./components/ApproveModal";
import PaymentOrderModal from "./components/PaymentOrderModal";
import ReassignRepairModal from "./components/ReassignRepairModal";
import StockIssueOrderModal from "./components/StockIssueOrderModal";
import StockInReceiptModal from "./components/StockInReceiptModal";
import { enrichExpenseRequestWithCreator } from "./creatorProfiles";
import { useExpenseSocket } from "./useExpenseSocket";
import {
  activeAssignments,
  availableActions,
  canReplaceAssignment,
  myDeclinableAssignment,
  creatorDetails,
  creatorName,
  equipmentSourceOf,
  formatDate,
  isEquipmentRequest,
  isSupplierEquipment,
  mainAssigneeLabel,
  requestKindOf,
  waitingMessage,
  expenseBasePath,
  expenseEditPath,
  type ActionKey,
} from "./lib";

type ModalKind =
  | "approve"
  | "reject"
  | "withdraw"
  | "saleadminReview"
  | "saleadminReject"
  | "cashReleased"
  | "cashReceived"
  | "confirmSpent"
  | "confirmNotSpent"
  | "fundReturned"
  | "paymentOrder"
  | "editPaymentOrder"
  | "stockIssueOrder"
  | "equipmentReceived"
  | "equipmentReturned"
  | "repairAccept"
  | "repairReject"
  | "reassignRepair"
  | "stockInReceipt"
  | "stockInAccept"
  | "declineAssignment"
  | "replaceAssignment"
  | null;

type SchoolDetails = {
  id: number;
  name: string;
  address?: string;
  representative?: string;
  phone?: string;
  taxCode?: string;
  scale?: number;
  classCount?: number;
  contractYears?: number | string;
  contractCode?: string;
  contractNumber?: string;
  appendixYears?: number | string;
  appendix?: string;
  startDate?: string;
  ward?: { id?: number; name?: string };
  province?: { id?: number; name?: string };
};

type SchoolSubject = {
  id: number;
  name: string;
  schoolYear?: string;
  studentCount?: number;
  classCount?: number;
  totalLessons?: number;
  contractDuration?: number;
  appendixDuration?: number;
  startDate?: string;
  contractNumber?: string;
  note?: string;
  school?: SchoolDetails;
  policies?: any[];
};

const normalizeList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload?.id) return [payload];
  return [];
};

type ExpenseRequestDetailProps = {
  /** Truyền vào khi chi tiết được mở trong popup thay vì lấy từ URL. */
  requestId?: number;
  embedded?: boolean;
  onClose?: () => void;
  onChanged?: () => void | Promise<void>;
};

export default function ExpenseRequestDetail({
  requestId,
  embedded = false,
  onClose,
  onChanged,
}: ExpenseRequestDetailProps = {}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const reqId = Number(requestId ?? id);

  const [data, setData] = useState<ExpenseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  // Người đã từ chối mà Giám đốc đang chọn người thay thế.
  const [replaceTarget, setReplaceTarget] = useState<ExpenseAssignment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [school, setSchool] = useState<SchoolDetails | null>(null);
  const [schoolSubjects, setSchoolSubjects] = useState<SchoolSubject[]>([]);
  const [schoolContextLoading, setSchoolContextLoading] = useState(false);
  const [schoolContextError, setSchoolContextError] = useState("");

  const loadSchoolContext = useCallback(async (request: ExpenseRequest) => {
    const schoolId = Number(request.school?.id || (request as any).schoolId || 0);

    if (!schoolId) {
      setSchool(null);
      setSchoolSubjects([]);
      setSchoolContextError("");
      setSchoolContextLoading(false);
      return;
    }

    setSchoolContextLoading(true);
    setSchoolContextError("");

    const loadSchool = async () => {
      if (request.school?.name) {
        try {
          const searchResponse = await schoolApi.search(request.school.name);
          const matchedSchool = normalizeList<SchoolDetails>(
            searchResponse,
          ).find((item) => Number(item.id) === schoolId);
          if (matchedSchool) return matchedSchool;
        } catch (error) {
          console.warn("School search is unavailable, using fallback:", error);
        }
      }

      const listResponse = await schoolApi.getAll({
        id: schoolId,
        page: 1,
        limit: 1000,
      });
      return normalizeList<SchoolDetails>(listResponse).find(
        (item) => Number(item.id) === schoolId,
      );
    };

    const loadSubjects = async () => {
      const filterByRequestSchoolYear = (subjects: SchoolSubject[]) =>
        request.schoolYear
          ? subjects.filter(
              (subject) => subject.schoolYear === request.schoolYear,
            )
          : subjects;
      const attachPolicies = (subjects: SchoolSubject[]) =>
        Promise.all(
          subjects.map(async (subject) => {
            if (subject.policies?.length) return subject;
            try {
              const policyResponse = await policiesApi.getBySubject(subject.id);
              return {
                ...subject,
                policies: normalizeList<any>(policyResponse),
              };
            } catch (error) {
              console.warn(
                `Policies for subject ${subject.id} are unavailable:`,
                error,
              );
              return { ...subject, policies: [] };
            }
          }),
        );

      try {
        const financeResponse = await subjectApi.getFinanceBySchool(
          schoolId,
          request.schoolYear,
        );
        const financeSubjects = filterByRequestSchoolYear(
          normalizeList<SchoolSubject>(financeResponse),
        );
        if (financeSubjects.length) return attachPolicies(financeSubjects);
      } catch (error) {
        console.warn("Finance subjects are unavailable, using fallback:", error);
      }

      const subjectResponse = request.schoolYear
        ? await subjectApi.getBySchoolYear(request.schoolYear, schoolId)
        : await subjectApi.getBySchool(schoolId);
      const subjects = filterByRequestSchoolYear(
        normalizeList<SchoolSubject>(subjectResponse),
      );
      return attachPolicies(subjects);
    };

    const [schoolResult, subjectResult] = await Promise.allSettled([
      loadSchool(),
      loadSubjects(),
    ]);

    const subjects =
      subjectResult.status === "fulfilled" ? subjectResult.value : [];
    const subjectSchool = subjects.find((subject) => subject.school)?.school;
    const fetchedSchool =
      schoolResult.status === "fulfilled" ? schoolResult.value : undefined;

    setSchool({
      id: schoolId,
      name: request.school?.name || subjectSchool?.name || "Trường đã chọn",
      ...request.school,
      ...subjectSchool,
      ...fetchedSchool,
    });
    setSchoolSubjects(subjects);

    if (subjectResult.status === "rejected") {
      console.error(subjectResult.reason);
      setSchoolContextError("Không tải được thông tin chính sách của trường");
    }

    setSchoolContextLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (!Number.isInteger(reqId) || reqId <= 0) {
      toast.error("Mã đề xuất không hợp lệ");
      if (!embedded) navigate(expenseBasePath(), { replace: true });
      setLoading(false);
      return;
    }
    try {
      const res = await expenseRequestApi.getById(reqId);
      const enrichedRequest = await enrichExpenseRequestWithCreator(res);
      setData(enrichedRequest);
      void loadSchoolContext(enrichedRequest);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được đề xuất");
    } finally {
      setLoading(false);
    }
  }, [loadSchoolContext, navigate, reqId]);

  useEffect(() => {
    load();
  }, [load]);

  useExpenseSocket((n) => {
    if (n.entityId === reqId || n.meta?.suggestId === reqId) load();
  });

  // Run a workflow action with unified success/error handling.
  const run = async (fn: () => Promise<any>, successMsg: string) => {
    setSubmitting(true);
    try {
      await fn();
      toast.success(successMsg);
      setModal(null);
      await load();
      await onChanged?.();
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 409) {
        // 409 còn được backend trả khi action không thuộc luồng của loại đề
        // xuất này (VD kế toán bấm lên lệnh chi cho đề xuất thiết bị).
        toast.error(
          "Trạng thái đã thay đổi hoặc thao tác không thuộc loại đề xuất này, vui lòng tải lại",
        );
        await load();
      } else if (s === 403) {
        // interceptor already alerts
      } else {
        toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () => setModal("approve");

  const onApproveSubmit = (payload: ApproveExpensePayload) => {
    run(() => expenseRequestApi.approve(reqId, payload), "Đã duyệt");
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Xoá vĩnh viễn đề xuất ${data?.code || ""}? Người tạo sẽ được thông báo. Hành động này không thể hoàn tác.`,
      )
    )
      return;

    setSubmitting(true);
    try {
      await expenseRequestApi.remove(reqId);
      toast.success("Đã xoá đề xuất");
      await onChanged?.();
      if (embedded) onClose?.();
      else navigate(expenseBasePath(), { replace: true });
    } catch (err: any) {
      const s = err?.response?.status;
      if (s !== 403) {
        toast.error(err?.response?.data?.message || "Có lỗi xảy ra");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onModalSubmit = (payload: ActionPayload) => {
    switch (modal) {
      case "reject":
        run(() => expenseRequestApi.reject(reqId, payload.reason || ""), "Đã từ chối");
        break;
      case "withdraw":
        run(() => expenseRequestApi.withdraw(reqId, payload.note), "Đã rút đề xuất");
        break;
      case "saleadminReview":
        run(
          () =>
            expenseRequestApi.saleAdminReview(reqId, {
              status: "REVIEWED",
              note: payload.note,
            }),
          "Đã kiểm duyệt",
        );
        break;
      case "saleadminReject":
        run(
          () =>
            expenseRequestApi.saleAdminReview(reqId, {
              status: "REJECTED",
              note: payload.reason || "",
            }),
          "Đã từ chối chính sách",
        );
        break;
      case "cashReleased":
        run(
          () =>
            expenseRequestApi.cashReleased(reqId, {
              fundSource: payload.fundSource!,
              note: payload.note,
              files: payload.files,
            }),
          "Đã xuất tiền",
        );
        break;
      case "cashReceived":
        run(() => expenseRequestApi.cashReceived(reqId, payload.note), "Đã xác nhận nhận tiền");
        break;
      case "confirmSpent":
        run(
          () => expenseRequestApi.confirmSpent(reqId, { note: payload.note, files: payload.files }),
          "Đã xác nhận đã chi",
        );
        break;
      case "confirmNotSpent":
        run(
          () => expenseRequestApi.confirmNotSpent(reqId, payload.reason || ""),
          "Đã xác nhận chưa chi",
        );
        break;
      case "fundReturned":
        run(() => expenseRequestApi.fundReturned(reqId, payload.note), "Đã nhận lại quỹ");
        break;
      case "equipmentReceived":
        run(
          () => expenseRequestApi.equipmentReceived(reqId, payload.note),
          "Đã xác nhận nhận thiết bị",
        );
        break;
      case "equipmentReturned":
        run(
          () => expenseRequestApi.equipmentReturned(reqId, payload.note),
          "Đã xác nhận nhập lại kho",
        );
        break;
      case "repairAccept":
        run(
          () => expenseRequestApi.repairAccept(reqId),
          "Đã xác nhận nhận việc sửa chữa",
        );
        break;
      case "repairReject":
        run(
          () => expenseRequestApi.repairReject(reqId, payload.reason || ""),
          "Đã từ chối việc sửa chữa",
        );
        break;
      case "declineAssignment":
        run(
          () => expenseRequestApi.declineAssignment(reqId, payload.reason || ""),
          "Đã từ chối — lý do đã gửi về giám đốc",
        );
        break;
      case "stockInAccept":
        run(
          () =>
            expenseRequestApi.stockInAccept(reqId, {
              note: payload.note,
              files: payload.files,
            }),
          "Đã nghiệm thu — đề xuất đã chuyển về Quản lý thu chi",
        );
        break;
    }
  };

  const onPaymentOrder = (payload: PaymentOrderPayload) => {
    run(
      () => expenseRequestApi.createPaymentOrder(reqId, payload),
      data?.status === "FUND_RETURNED"
        ? "Đã lên lại lệnh chi"
        : "Đã lên lệnh chi",
    );
  };

  const onReassignRepair = (assignedTechnicianId: number) => {
    run(
      () => expenseRequestApi.repairReassign(reqId, assignedTechnicianId),
      "Đã chỉ định nhân viên kỹ thuật khác",
    );
  };

  const onDeleteAttachment = async (attachmentId: number) => {
    try {
      await expenseRequestApi.deleteAttachment(reqId, attachmentId);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Không xoá được tệp");
    }
  };

  const onEditPaymentOrder = (payload: PaymentOrderPayload) => {
    run(
      () => expenseRequestApi.editPaymentOrder(reqId, payload),
      "Đã sửa lệnh chi",
    );
  };

  const onStockIssueOrder = (payload: StockIssueOrderPayload) => {
    run(
      () => expenseRequestApi.createStockIssueOrder(reqId, payload),
      data?.status === "EQUIPMENT_RETURNED"
        ? "Đã lên lại lệnh xuất kho"
        : "Đã lên lệnh xuất kho",
    );
  };

  const onReplaceAssignment = (employeeId: number) => {
    if (!replaceTarget) return;
    run(
      () => expenseRequestApi.replaceAssignment(reqId, replaceTarget.id, employeeId),
      "Đã chọn người thay thế",
    );
  };

  const onStockInReceipt = (payload: StockInReceiptPayload) => {
    run(
      () => expenseRequestApi.createStockInReceipt(reqId, payload),
      "Đã lập phiếu nhập kho",
    );
  };

  if (loading) {
    if (embedded) {
      return (
        <div className="flex min-h-[320px] items-center justify-center bg-gray-100 text-sm text-gray-400">
          Đang tải…
        </div>
      );
    }
    return (
      <div className="bg-gray-100 min-h-screen">
        <HeaderWithBack title="Chi tiết đề xuất" />
        <div className="text-center text-gray-400 text-sm py-10 mt-[60px]">Đang tải…</div>
      </div>
    );
  }

  if (!data) {
    if (embedded) {
      return (
        <div className="flex min-h-[320px] items-center justify-center bg-gray-100 text-sm text-gray-400">
          Không tìm thấy đề xuất
        </div>
      );
    }
    return (
      <div className="bg-gray-100 min-h-screen">
        <HeaderWithBack title="Chi tiết đề xuất" />
        <div className="text-center text-gray-400 text-sm py-16 mt-[60px]">
          Không tìm thấy đề xuất
        </div>
      </div>
    );
  }

  const actions = availableActions(data);
  const waiting = actions.length === 0 ? waitingMessage(data) : null;
  const kind = requestKindOf(data);
  const equipment = isEquipmentRequest(data);
  // Chứng từ của vòng xử lý cũ được giữ để audit ở backend. Trong lúc đề xuất
  // đang duyệt lại, không hiển thị chúng như chứng từ đang có hiệu lực.
  const hasActiveOrder = ![
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN",
  ].includes(data.status);
  const po = hasActiveOrder ? data.paymentOrder : null;
  const sio = hasActiveOrder ? data.stockIssueOrder : null;
  // `action` chỉ có ở tệp up từ khi thêm trường này; tệp cũ hơn không lọc
  // được theo bước nên vẫn hiện ở mục "Tệp đính kèm" chung như trước — các
  // tệp có `action` đã hiện đúng bước của chúng trong Timeline (kể cả file
  // kinh doanh up khi tạo/sửa đề xuất hoặc xác nhận đã chi).
  const releasedAttachments = (data.attachments || []).filter(
    (a) => a.action === "CONFIRM_CASH_RELEASED",
  );
  const otherAttachments = (data.attachments || []).filter((a) => !a.action);
  const directorApprovedAmount =
    hasRole("thuquy") &&
    !equipment &&
    data.amount != null &&
    !["PENDING_APPROVAL", "REJECTED", "WITHDRAWN"].includes(data.status)
      ? data.amount
      : null;

  return (
    <div
      className={`bg-gray-100 flex flex-col ${
        embedded ? "h-full min-h-0" : "min-h-screen"
      }`}
    >
      {!embedded && <HeaderWithBack title="Chi tiết đề xuất" />}

      <div
        className={`flex-1 px-3 space-y-3 ${
          embedded
            ? "min-h-0 overflow-y-auto py-3 pb-6"
            : "mt-[60px] pb-32"
        }`}
      >
        {/* ===== Header card (sticky khi scroll) ===== */}
        <div
          className={`sticky z-40 -mx-3 px-3 pb-1 bg-gray-100 ${
            embedded ? "-top-3 -mt-3 pt-3" : "top-[60px]"
          }`}
        >
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2 max-h-[55vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={data.status} kind={kind} />
              {!data.requestKind ? (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-slate-100 text-slate-600">
                  {data.status === "PENDING_APPROVAL"
                    ? "Chờ Giám đốc phân loại"
                    : "Chưa phân loại"}
                </span>
              ) : (
                <KindBadge kind={kind} />
              )}
              {equipment && data.status !== "PENDING_APPROVAL" && (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-cyan-100 text-cyan-700">
                  {EQUIPMENT_SOURCE_META[equipmentSourceOf(data)].icon}{" "}
                  {EQUIPMENT_SOURCE_META[equipmentSourceOf(data)].label}
                </span>
              )}
              {data.schoolId ? (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-purple-100 text-purple-700">
                  🏫 Đề xuất cho trường
                </span>
              ) : data.wardId ? (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-teal-100 text-teal-700">
                  🏘️ Đề xuất cho phường/xã
                </span>
              ) : null}
              {data.deductPolicy && (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-orange-100 text-orange-700">
                  📉 Trừ chính sách
                </span>
              )}
              {data.isOverdue && (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-red-100 text-red-700">
                  ⚠️ Quá hạn
                </span>
              )}
              {data.saleadminReviewStatus === "REVIEWED" && (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-green-100 text-green-700">
                  ✅ Sales Admin đã kiểm duyệt
                </span>
              )}
              {data.saleadminReviewStatus === "REJECTED" && (
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-red-100 text-red-700">
                  ⚠️ Sales Admin từ chối chính sách
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">{data.code}</span>
          </div>

          <h1 className="text-lg font-bold text-gray-900">{data.content}</h1>
          {data.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.description}</p>
          )}

          <RequesterInfo request={data} />

          <div className="grid grid-cols-2 gap-y-2 gap-x-3 pt-1 text-sm">
            <Field
              label={
                !data.requestKind
                  ? "Ngày mong muốn"
                  : equipment
                    ? "Ngày cần có thiết bị"
                    : "Ngày dự kiến"
              }
              value={formatDate(data.expectedPaymentDate)}
            />
            {directorApprovedAmount != null && (
              <Field
                label="Số tiền giám đốc duyệt"
                value={`${formatVnd(directorApprovedAmount)} đ`}
                strong
              />
            )}
            {data.school?.name && <Field label="Trường" value={data.school.name} />}
            {data.schoolYear && (
              <Field label="Năm học" value={data.schoolYear} />
            )}
            {data.participants && (
              <Field label="Thành phần tham gia" value={data.participants} span />
            )}
          </div>

          {data.approveNote && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span className="font-medium">Ghi chú của người duyệt: </span>
              {data.approveNote}
            </div>
          )}

          {data.saleadminReviewStatus === "REJECTED" && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <span className="font-semibold">⚠️ Sales Admin từ chối chính sách</span>
              {data.saleadminNote && <p className="mt-1">{data.saleadminNote}</p>}
            </div>
          )}
          {data.status === "REJECTED" && data.rejectReason && (
            <div className="mt-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <span className="font-medium">Lý do từ chối: </span>
              {data.rejectReason}
            </div>
          )}
          {data.notSpentReason && (
            <div className="mt-2 p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
              <span className="font-medium">
                {equipment ? "Lý do chưa dùng: " : "Lý do chưa chi: "}
              </span>
              {data.notSpentReason}
            </div>
          )}
          {data.status === "REPAIR_REJECTED" && data.technicalRejectReason && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <span className="font-medium">Lý do phòng kỹ thuật từ chối: </span>
              {data.technicalRejectReason}
            </div>
          )}
        </div>
        </div>

        {/* ===== School and policies ===== */}
        {(data.school?.id || (data as any).schoolId) && (
          <SchoolPolicyDetails
            school={school || data.school || null}
            subjects={schoolSubjects}
            schoolYear={data.schoolYear}
            loading={schoolContextLoading}
            error={schoolContextError}
          />
        )}

        {/* ===== Payment order ===== */}
        {po && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100">
            <h3 className="font-semibold text-purple-700 text-sm mb-2">🧾 Lệnh chi</h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
              <Field label="Mã lệnh chi" value={po.code} />
              <Field label="Số tiền" value={`${formatVnd(po.amount)} đ`} strong />
              <Field
                label="Hình thức"
                value={PAYMENT_METHOD_LABEL[po.paymentMethod] || po.paymentMethod}
              />
              {po.fundSource && (
                <Field
                  label="Nguồn tiền"
                  value={FUND_SOURCE_LABEL[po.fundSource] || po.fundSource}
                />
              )}
              {po.note && <Field label="Ghi chú" value={po.note} span />}
            </div>
          </div>
        )}

        {/* ===== Stock issue order (đề xuất thiết bị) ===== */}
        {sio && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-violet-100">
            <h3 className="font-semibold text-violet-700 text-sm mb-2">
              📦 Lệnh xuất kho
            </h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
              <Field label="Mã lệnh xuất kho" value={sio.code} strong />
              {sio.warehouse && <Field label="Kho xuất" value={sio.warehouse} />}
              {sio.expectedDeliveryDate && (
                <Field
                  label="Ngày giao dự kiến"
                  value={formatDate(sio.expectedDeliveryDate)}
                />
              )}
              {sio.creator?.name && (
                <Field label="Người lập" value={sio.creator.name} />
              )}
              {sio.note && <Field label="Ghi chú" value={sio.note} span />}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-violet-50 text-violet-800">
                    <th className="border border-violet-100 px-2 py-1.5 text-left font-semibold">
                      Thiết bị
                    </th>
                    <th className="border border-violet-100 px-2 py-1.5 text-right font-semibold w-16">
                      SL
                    </th>
                    <th className="border border-violet-100 px-2 py-1.5 text-left font-semibold w-20">
                      Đơn vị
                    </th>
                    <th className="border border-violet-100 px-2 py-1.5 text-left font-semibold">
                      Ghi chú
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(sio.items || []).map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-800">
                        {item.name}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-right">
                        {item.quantity}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-600">
                        {item.unit || "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-600">
                        {item.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Người bàn giao + người hỗ trợ ===== */}
        {(data.assignments || []).length > 0 && (
          <AssignmentsCard
            request={data}
            onDecline={() => setModal("declineAssignment")}
            onReplace={(a) => {
              setReplaceTarget(a);
              setModal("replaceAssignment");
            }}
          />
        )}

        {/* ===== Phiếu nhập kho (thiết bị từ nhà cung cấp) ===== */}
        {isSupplierEquipment(data) && data.stockInOrder && data.status !== "PENDING_APPROVAL" && (
          <StockInOrderCard request={data} />
        )}

        {/* ===== Attachments ===== */}
        {otherAttachments.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm mb-2">📎 Tệp đính kèm</h3>
            <ul className="space-y-1">
              {otherAttachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={resolveFileUrl(a.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-500 font-medium break-all"
                  >
                    📄 {a.fileName || a.fileUrl}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ===== Timeline ===== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">🕓 Lịch sử</h3>
          <Timeline
            logs={data.logs}
            kind={kind}
            request={data}
            releasedFundSource={po?.fundSource}
            attachments={data.attachments}
          />
        </div>

        {/* ===== Waiting / final ===== */}
        {waiting && (
          <div className="text-center text-sm text-gray-500 bg-white rounded-2xl py-4 border border-gray-100">
            ⏳ {waiting}
          </div>
        )}
        {STATUS_META[data.status].done && (
          <div className="text-center text-sm text-gray-500 py-2">— Kết thúc —</div>
        )}
      </div>

      {/* ===== Action bar ===== */}
      {actions.length > 0 && (
        <div
          className={
            embedded
              ? "shrink-0 border-t bg-white px-3 py-2"
              : "fixed bottom-0 left-0 w-full bg-white border-t px-3 py-2 z-40 md:max-w-6xl md:mx-auto md:left-1/2 md:-translate-x-1/2"
          }
        >
          {actions.includes("approve") && data.saleadminReviewStatus === "REJECTED" && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <span className="font-semibold">⚠️ Sales Admin từ chối chính sách: </span>
              {data.saleadminNote || "Không có ghi chú"}
            </div>
          )}
          <div className="flex gap-2">
            {actions.map((a) => (
              <ActionButton
                key={a}
                action={a}
                status={data.status}
                kind={kind}
                onApprove={handleApprove}
                onDelete={handleDelete}
                onEdit={() => navigate(expenseEditPath(reqId))}
                onOpenModal={setModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== Modals ===== */}
      {modal === "approve" && (
        <ApproveModal
          defaultAmount={data.amount}
          requestedItems={data.requestedItems}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onApproveSubmit}
        />
      )}
      {modal === "reject" && (
        <ActionModal
          title="Từ chối đề xuất"
          submitLabel="Từ chối"
          submitColor="bg-red-500"
          requireReason
          reasonLabel="Lý do từ chối"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "withdraw" && (
        <ActionModal
          title="Rút đề xuất"
          submitLabel="Rút đề xuất"
          submitColor="bg-gray-600"
          showNote
          noteLabel="Lý do rút (không bắt buộc)"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "saleadminReview" && (
        <ActionModal
          title="Kiểm duyệt đạt"
          submitLabel="Kiểm duyệt đạt"
          submitColor="bg-emerald-500"
          showNote
          noteLabel="Ghi chú (không bắt buộc)"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "saleadminReject" && (
        <ActionModal
          title="Từ chối chính sách"
          submitLabel="Từ chối chính sách"
          submitColor="bg-red-500"
          requireReason
          reasonLabel="Ghi chú từ chối chính sách"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "cashReleased" && (
        <ActionModal
          title="Xác nhận xuất tiền"
          submitLabel="Xuất tiền"
          submitColor="bg-orange-500"
          showFundSource
          showNote
          showFiles
          existingAttachments={releasedAttachments}
          onDeleteAttachment={onDeleteAttachment}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "cashReceived" && (
        <ActionModal
          title="Xác nhận nhận tiền"
          submitLabel="Nhận tiền"
          submitColor="bg-lime-600"
          showNote
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "confirmSpent" && (
        <ActionModal
          title={equipment ? "Xác nhận đã bàn giao / lắp đặt" : "Xác nhận đã chi"}
          submitLabel={equipment ? "Đã bàn giao" : "Đã chi"}
          submitColor="bg-green-500"
          showNote
          showFiles
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "confirmNotSpent" && (
        <ActionModal
          title={equipment ? "Xác nhận chưa dùng" : "Xác nhận chưa chi"}
          submitLabel={equipment ? "Chưa dùng" : "Chưa chi"}
          submitColor="bg-amber-500"
          requireReason
          reasonLabel={equipment ? "Lý do chưa dùng" : "Lý do chưa chi"}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "fundReturned" && (
        <ActionModal
          title="Nhận lại quỹ"
          submitLabel="Nhận lại quỹ"
          submitColor="bg-green-600"
          showNote
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "equipmentReceived" && (
        <ActionModal
          title="Xác nhận đã nhận thiết bị"
          submitLabel="Đã nhận thiết bị"
          submitColor="bg-sky-600"
          showNote
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "equipmentReturned" && (
        <ActionModal
          title="Xác nhận đã nhập lại kho"
          submitLabel="Đã nhập lại kho"
          submitColor="bg-teal-600"
          showNote
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "repairAccept" && (
        <ActionModal
          title="Xác nhận nhận việc sửa chữa"
          submitLabel="Nhận việc"
          submitColor="bg-green-600"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "repairReject" && (
        <ActionModal
          title="Từ chối việc sửa chữa"
          submitLabel="Từ chối"
          submitColor="bg-red-500"
          requireReason
          reasonLabel="Lý do từ chối"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "declineAssignment" && (
        <ActionModal
          title={
            myDeclinableAssignment(data)?.role === "SUPPORT"
              ? "Từ chối hỗ trợ"
              : kind === "REPAIR"
                ? "Từ chối đảm nhận"
                : "Từ chối bàn giao"
          }
          submitLabel="Từ chối"
          submitColor="bg-red-500"
          requireReason
          reasonLabel="Lý do từ chối (gửi về giám đốc)"
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "replaceAssignment" && replaceTarget && (
        <ReassignRepairModal
          label={replaceTarget.role === "HANDOVER" ? mainAssigneeLabel(kind) : "Người hỗ trợ"}
          technicalOnly={replaceTarget.role === "HANDOVER"}
          declinedName={replaceTarget.employee?.name}
          rejectReason={replaceTarget.declineReason}
          excludeIds={activeAssignments(data).map((a) => a.employeeId)}
          loading={submitting}
          onClose={() => {
            setModal(null);
            setReplaceTarget(null);
          }}
          onSubmit={onReplaceAssignment}
        />
      )}
      {modal === "reassignRepair" && (
        <ReassignRepairModal
          excludeIds={activeAssignments(data).map((a) => a.employeeId)}
          rejectReason={data.technicalRejectReason}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onReassignRepair}
        />
      )}
      {modal === "paymentOrder" && (
        <PaymentOrderModal
          defaultAmount={0}
          retry={data.status === "FUND_RETURNED"}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onPaymentOrder}
        />
      )}
      {modal === "editPaymentOrder" && po && (
        <PaymentOrderModal
          edit
          defaultAmount={po.amount}
          defaultPaymentMethod={po.paymentMethod}
          defaultNote={po.note || ""}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onEditPaymentOrder}
        />
      )}
      {modal === "stockInReceipt" && (
        <StockInReceiptModal
          order={data.stockInOrder}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onStockInReceipt}
        />
      )}
      {modal === "stockInAccept" && (
        <ActionModal
          title="Nghiệm thu bàn giao — hoàn thành đề xuất"
          submitLabel="Xác nhận hoàn thành"
          submitColor="bg-green-600"
          showNote
          noteLabel="Ghi chú nghiệm thu"
          showFiles
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onModalSubmit}
        />
      )}
      {modal === "stockIssueOrder" && (
        <StockIssueOrderModal
          retry={data.status === "EQUIPMENT_RETURNED"}
          defaultItems={sio?.items}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onStockIssueOrder}
        />
      )}
    </div>
  );
}

const ASSIGNMENT_STATUS_META: Record<
  ExpenseAssignment["status"],
  { label: string; badge: string }
> = {
  ASSIGNED: { label: "Đã giao", badge: "bg-blue-100 text-blue-700" },
  DECLINED: { label: "Đã từ chối", badge: "bg-red-100 text-red-700" },
  REPLACED: { label: "Đã thay người", badge: "bg-gray-100 text-gray-500" },
};

/** Người bàn giao + người hỗ trợ, kèm người đã từ chối và lý do. */
function AssignmentsCard({
  request,
  onDecline,
  onReplace,
}: {
  request: ExpenseRequest;
  onDecline: () => void;
  onReplace: (a: ExpenseAssignment) => void;
}) {
  const mine = myDeclinableAssignment(request);
  const rows = [...(request.assignments || [])].sort(
    (a, b) =>
      Number(a.role === "SUPPORT") - Number(b.role === "SUPPORT") || a.id - b.id,
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-700 text-sm mb-2">
        👷 {mainAssigneeLabel(request.requestKind)} & người hỗ trợ
      </h3>
      <ul className="divide-y divide-gray-100">
        {rows.map((a) => {
          const meta = ASSIGNMENT_STATUS_META[a.status];
          return (
            <li key={a.id} className="py-2 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-2 py-[2px] rounded-full font-medium bg-slate-100 text-slate-600">
                  {a.role === "HANDOVER"
                    ? request.requestKind === "REPAIR"
                      ? "Đảm nhận chính"
                      : "Bàn giao"
                    : "Hỗ trợ"}
                </span>
                <span
                  className={`text-sm font-medium ${
                    a.status === "REPLACED" ? "text-gray-400 line-through" : "text-gray-800"
                  }`}
                >
                  {a.employee?.name || `NV #${a.employeeId}`}
                </span>
                <span className={`text-[10px] px-2 py-[2px] rounded-full font-medium ${meta.badge}`}>
                  {meta.label}
                </span>
                {canReplaceAssignment(request, a) && (
                  <button
                    onClick={() => onReplace(a)}
                    className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-blue-500 text-white font-medium active:scale-95"
                  >
                    🔁 Chọn người thay thế
                  </button>
                )}
              </div>
              {a.declineReason && (
                <p className="text-xs text-red-600">
                  Lý do từ chối: {a.declineReason}
                  {a.declinedAt ? ` (${formatDate(a.declinedAt)})` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {mine && (
        <button
          onClick={onDecline}
          className="mt-2 w-full py-2 text-sm rounded-xl border border-red-300 text-red-600 font-medium active:scale-95"
        >
          ❌{" "}
          {mine.role === "SUPPORT"
            ? "Từ chối hỗ trợ"
            : request.requestKind === "REPAIR"
              ? "Từ chối đảm nhận"
              : "Từ chối bàn giao"}
        </button>
      )}
    </div>
  );
}

/** Phiếu nhập kho của thiết bị mua từ nhà cung cấp: bản dự kiến của GĐ hoặc bản thật đã nhập. */
function StockInOrderCard({ request }: { request: ExpenseRequest }) {
  const order = request.stockInOrder!;
  const stocked = !!order.stockedAt;
  const items: StockInItem[] = (stocked ? order.items : order.draftItems) || [];
  const total = items.reduce(
    (sum, it) => sum + (Number(it.unitPrice) || 0) * it.quantity,
    0,
  );

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-cyan-100">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold text-cyan-700 text-sm">
          📥 {stocked ? "Phiếu nhập kho" : "Phiếu nhập kho dự kiến"}
        </h3>
        <span
          className={`text-[10px] px-2 py-[2px] rounded-full font-medium ${
            stocked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {stocked ? "Đã nhập kho" : "Chờ người xử lý nhập kho"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-sm">
        <Field label="Mã phiếu" value={order.code} strong />
        {order.warehouseReceipt?.code && (
          <Field label="Phiếu kho" value={order.warehouseReceipt.code} strong />
        )}
        {order.creator?.name && <Field label="Giám đốc lập" value={order.creator.name} />}
        <Field
          label="Người xử lý"
          value={request.stockInHandler?.name || (request.stockInHandlerId ? `NV #${request.stockInHandlerId}` : "—")}
        />
        <Field
          label="Người nghiệm thu"
          value={request.acceptor?.name || (request.acceptorId ? `NV #${request.acceptorId}` : "—")}
        />
        {stocked && order.stockedAt && (
          <Field label="Ngày nhập kho" value={formatDate(order.stockedAt)} />
        )}
        {order.draftNote && <Field label="Ghi chú của Giám đốc" value={order.draftNote} span />}
        {order.note && <Field label="Ghi chú nhập kho" value={order.note} span />}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-cyan-50 text-cyan-800">
              <th className="border border-cyan-100 px-2 py-1.5 text-left font-semibold">Thiết bị</th>
              <th className="border border-cyan-100 px-2 py-1.5 text-right font-semibold w-12">SL</th>
              <th className="border border-cyan-100 px-2 py-1.5 text-left font-semibold w-16">ĐVT</th>
              <th className="border border-cyan-100 px-2 py-1.5 text-right font-semibold">Đơn giá</th>
              <th className="border border-cyan-100 px-2 py-1.5 text-right font-semibold">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.name}-${index}`}>
                <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-800">
                  {item.name}
                  {!item.warehouseItemId && !stocked && (
                    <span className="ml-1 text-[10px] text-cyan-600">🆕</span>
                  )}
                </td>
                <td className="border border-gray-200 px-2 py-1.5 text-right">{item.quantity}</td>
                <td className="border border-gray-200 px-2 py-1.5 text-gray-600">{item.unit || "—"}</td>
                <td className="border border-gray-200 px-2 py-1.5 text-right text-gray-600">
                  {item.unitPrice ? formatVnd(item.unitPrice) : "—"}
                </td>
                <td className="border border-gray-200 px-2 py-1.5 text-right">
                  {item.unitPrice ? formatVnd(Number(item.unitPrice) * item.quantity) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          {total > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="border border-gray-200 px-2 py-1.5 text-right font-semibold">
                  Tổng
                </td>
                <td className="border border-gray-200 px-2 py-1.5 text-right font-semibold">
                  {formatVnd(total)} đ
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function SchoolPolicyDetails({
  school,
  subjects,
  schoolYear,
  loading,
  error,
}: {
  school: SchoolDetails | null;
  subjects: SchoolSubject[];
  schoolYear?: string;
  loading: boolean;
  error: string;
}) {
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );

  const schoolYears = useMemo(() => {
    const years = [
      ...new Set(
        subjects
          .map((subject) => subject.schoolYear)
          .filter((schoolYear): schoolYear is string => Boolean(schoolYear)),
      ),
    ];

    return years.sort(
      (first, second) => getSchoolYearStart(second) - getSchoolYearStart(first),
    );
  }, [subjects]);

  useEffect(() => {
    if (!schoolYears.length) {
      setSelectedSchoolYear("");
      return;
    }

    if (schoolYear && schoolYears.includes(schoolYear)) {
      if (selectedSchoolYear !== schoolYear) {
        setSelectedSchoolYear(schoolYear);
      }
      return;
    }

    if (schoolYears.includes(selectedSchoolYear)) return;

    const today = new Date();
    const currentStartYear =
      today.getMonth() + 1 >= 8
        ? today.getFullYear()
        : today.getFullYear() - 1;
    const currentSchoolYear = schoolYears.find(
      (schoolYear) => getSchoolYearStart(schoolYear) === currentStartYear,
    );

    setSelectedSchoolYear(currentSchoolYear || schoolYears[0]);
  }, [schoolYear, schoolYears, selectedSchoolYear]);

  const filteredSubjects = useMemo(
    () =>
      selectedSchoolYear
        ? subjects.filter(
            (subject) => subject.schoolYear === selectedSchoolYear,
          )
        : subjects,
    [selectedSchoolYear, subjects],
  );

  useEffect(() => {
    if (!filteredSubjects.length) {
      setSelectedSubjectId(null);
      return;
    }

    if (
      selectedSubjectId &&
      filteredSubjects.some((subject) => subject.id === selectedSubjectId)
    ) {
      return;
    }

    setSelectedSubjectId(filteredSubjects[0].id);
  }, [filteredSubjects, selectedSubjectId]);

  const activeSubject =
    filteredSubjects.find((subject) => subject.id === selectedSubjectId) ||
    filteredSubjects[0];

  return (
    <section className="space-y-3">
      <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <h2 className="font-bold text-blue-800 text-base">
            Thông tin trường
          </h2>
          {school?.name && (
            <p className="text-sm font-semibold text-gray-900 mt-1">
              {school.name}
            </p>
          )}
        </div>

        {school && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <DetailField label="Mã trường" value={school.id} />
            <DetailField
              label="Địa chỉ"
              value={school.address}
              className="col-span-2 md:col-span-3"
            />
            <DetailField
              label="Khu vực"
              value={[school.ward?.name, school.province?.name]
                .filter(Boolean)
                .join(" - ")}
            />
            <DetailField label="Người đại diện" value={school.representative} />
            <DetailField label="Số điện thoại" value={school.phone} />
            <DetailField label="Mã số thuế" value={school.taxCode} />
            <DetailField label="Quy mô học sinh" value={school.scale} />
            <DetailField label="Số lớp" value={school.classCount} />
            <DetailField
              label="Mã hợp đồng"
              value={school.contractCode || school.contractNumber}
            />
            <DetailField label="Thời hạn hợp đồng" value={school.contractYears} />
            <DetailField label="Phụ lục" value={school.appendix} />
            <DetailField label="Thời hạn phụ lục" value={school.appendixYears} />
            <DetailField
              label="Ngày bắt đầu"
              value={school.startDate ? formatDate(school.startDate) : undefined}
            />
          </div>
        )}

        {loading && (
          <div className="px-4 pb-4 text-sm text-gray-400">
            Đang tải đầy đủ thông tin trường và chính sách…
          </div>
        )}
        {error && !loading && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-amber-50 text-sm text-amber-700">
            {error}
          </div>
        )}
      </div>

      {!loading && subjects.length === 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-sm text-gray-500">
          {schoolYear
            ? `Trường chưa có môn học trong năm học ${schoolYear}.`
            : "Trường chưa có môn học hoặc chính sách."}
        </div>
      )}

      {schoolYears.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-bold text-emerald-800">
              Chi phí vận hành các môn
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {filteredSubjects.length} môn trong năm học đã chọn
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap">Năm học</span>
            <select
              value={selectedSchoolYear}
              onChange={(event) => setSelectedSchoolYear(event.target.value)}
              className="min-w-[150px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {schoolYears.map((schoolYear) => (
                <option key={schoolYear} value={schoolYear}>
                  {schoolYear}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {filteredSubjects.length > 0 && (
        <div
          role="tablist"
          aria-label="Danh sách môn học"
          className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex gap-2 overflow-x-auto"
        >
          {filteredSubjects.map((subject) => {
            const active = subject.id === activeSubject?.id;

            return (
              <button
                key={subject.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedSubjectId(subject.id)}
                className={`min-h-11 px-4 rounded-xl whitespace-nowrap text-sm font-semibold transition-all ${
                  active
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {subject.name}
              </button>
            );
          })}
        </div>
      )}

      {activeSubject && (
        <div
          key={activeSubject.id}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Môn học
                </p>
                <h3 className="font-bold text-slate-900">
                  {activeSubject.name}
                </h3>
              </div>
              {activeSubject.schoolYear && (
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  {activeSubject.schoolYear}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 border-b border-slate-100">
            <DetailField
              label="Số học sinh"
              value={activeSubject.studentCount}
            />
            <DetailField label="Số lớp" value={activeSubject.classCount} />
            <DetailField
              label="Tổng số tiết"
              value={activeSubject.totalLessons}
            />
            <DetailField
              label="Thời hạn hợp đồng"
              value={activeSubject.contractDuration}
            />
            <DetailField
              label="Thời hạn phụ lục"
              value={activeSubject.appendixDuration}
            />
            <DetailField
              label="Số hợp đồng"
              value={activeSubject.contractNumber}
            />
            <DetailField
              label="Ngày bắt đầu"
              value={
                activeSubject.startDate
                  ? formatDate(activeSubject.startDate)
                  : undefined
              }
            />
            <DetailField
              label="Ghi chú"
              value={activeSubject.note}
              className="col-span-2 md:col-span-4"
            />
          </div>

          {!activeSubject.policies?.length ? (
            <div className="p-4 text-sm text-gray-500">
              Môn học này chưa có chính sách.
            </div>
          ) : (
            <div className="p-3 md:p-4 space-y-5 bg-slate-50/50">
              {activeSubject.policies.map((policy, index) => {
                const normalizedPolicy = {
                  ...policy,
                  data: parsePolicyData(policy?.data),
                };

                return (
                  <div
                    key={policy?.id || `${activeSubject.id}-${index}`}
                    className="space-y-4"
                  >
                    <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <DetailField
                        label="Mã chính sách"
                        value={policy?.id}
                      />
                      <DetailField label="Trạng thái" value={policy?.status} />
                      <DetailField
                        label="Thời hạn (tháng)"
                        value={policy?.durationMonths}
                      />
                      <DetailField
                        label="Ngày tạo"
                        value={
                          policy?.createdAt
                            ? formatDate(policy.createdAt)
                            : undefined
                        }
                      />
                      <DetailField
                        label="Ghi chú chính sách"
                        value={policy?.note}
                        className="col-span-2 md:col-span-4"
                      />
                    </div>

                    <PolicyFinanceTable
                      policy={normalizedPolicy}
                      classCount={Number(activeSubject.classCount || 0)}
                    />
                    <TtcsTable policy={normalizedPolicy} />
                    <CashPolicyTable policy={normalizedPolicy} />
                    <DevicePolicyTable policy={normalizedPolicy} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getSchoolYearStart(schoolYear: string) {
  return Number(schoolYear.match(/\d{4}/)?.[0] || 0);
}

function parsePolicyData(data: any) {
  if (!data || typeof data !== "string") return data;

  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function DetailField({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | number | null;
  className?: string;
}) {
  if (value === undefined || value === null || value === "") return null;

  return (
    <div className={className}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm text-gray-800 break-words">
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
      </div>
    </div>
  );
}

function RequesterInfo({ request }: { request: ExpenseRequest }) {
  const details = creatorDetails(request);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
        Người đề xuất
      </div>
      <div className="mt-1 text-base font-semibold text-blue-950">
        {creatorName(request)}
      </div>
      {details.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.label}>
              <div className="text-blue-500">{detail.label}</div>
              <div className="font-semibold text-blue-800 break-words">
                {detail.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  strong,
  span,
}: {
  label: string;
  value?: string;
  strong?: boolean;
  span?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={span ? "col-span-2" : ""}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-gray-800 ${strong ? "font-semibold" : ""}`}>{value}</div>
    </div>
  );
}

function ActionButton({
  action,
  status,
  kind,
  onApprove,
  onDelete,
  onEdit,
  onOpenModal,
}: {
  action: ActionKey;
  status: ExpenseRequest["status"];
  /** Nhãn "đã chi"/"chưa chi" đọc khác nhau giữa hai nhánh. */
  kind: ExpenseRequestKind;
  onApprove: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onOpenModal: (m: ModalKind) => void;
}) {
  const equipment = kind === "EQUIPMENT";
  const cfg: Record<ActionKey, { label: string; color: string; onClick: () => void }> = {
    approve: { label: "✔️ Duyệt", color: "bg-blue-500", onClick: onApprove },
    reject: { label: "❌ Từ chối", color: "bg-red-500", onClick: () => onOpenModal("reject") },
    withdraw: { label: "🗑️ Rút đề xuất", color: "bg-gray-500", onClick: () => onOpenModal("withdraw") },
    edit: {
      label: status === "APPROVED" ? "✏️ Sửa (duyệt lại)" : "✏️ Sửa đề xuất",
      color: "bg-indigo-500",
      onClick: onEdit,
    },
    delete: { label: "🗑️ Xoá đề xuất", color: "bg-red-600", onClick: onDelete },
    saleadminReview: {
      label: "🔍 Kiểm duyệt đạt",
      color: "bg-emerald-500",
      onClick: () => onOpenModal("saleadminReview"),
    },
    saleadminReject: {
      label: "🚫 Từ chối chính sách",
      color: "bg-red-600",
      onClick: () => onOpenModal("saleadminReject"),
    },
    paymentOrder: {
      label:
        status === "FUND_RETURNED"
          ? "🧾 Lên lại lệnh chi"
          : "🧾 Lên lệnh chi",
      color: "bg-purple-500",
      onClick: () => onOpenModal("paymentOrder"),
    },
    editPaymentOrder: {
      label: "✏️ Sửa lệnh chi",
      color: "bg-amber-500",
      onClick: () => onOpenModal("editPaymentOrder"),
    },
    cashReleased: {
      label: "💸 Xuất tiền",
      color: "bg-orange-500",
      onClick: () => onOpenModal("cashReleased"),
    },
    cashReceived: {
      label: "🤝 Nhận tiền",
      color: "bg-lime-600",
      onClick: () => onOpenModal("cashReceived"),
    },
    confirmSpent: {
      label: equipment ? "✅ Đã bàn giao" : "✅ Đã chi",
      color: "bg-green-500",
      onClick: () => onOpenModal("confirmSpent"),
    },
    confirmNotSpent: {
      label: equipment ? "↩️ Chưa dùng" : "↩️ Chưa chi",
      color: "bg-amber-500",
      onClick: () => onOpenModal("confirmNotSpent"),
    },
    fundReturned: {
      label: "🏦 Nhận lại quỹ",
      color: "bg-green-600",
      onClick: () => onOpenModal("fundReturned"),
    },
    stockIssueOrder: {
      label:
        status === "EQUIPMENT_RETURNED"
          ? "📦 Lên lại lệnh xuất kho"
          : "📦 Lên lệnh xuất kho",
      color: "bg-violet-500",
      onClick: () => onOpenModal("stockIssueOrder"),
    },
    equipmentReceived: {
      label: "🤝 Đã nhận thiết bị",
      color: "bg-sky-600",
      onClick: () => onOpenModal("equipmentReceived"),
    },
    repairAccept: {
      label: "✅ Nhận việc",
      color: "bg-green-600",
      onClick: () => onOpenModal("repairAccept"),
    },
    repairReject: {
      label: "❌ Từ chối",
      color: "bg-red-500",
      onClick: () => onOpenModal("repairReject"),
    },
    reassignRepair: {
      label: "🔁 Chỉ định người khác",
      color: "bg-blue-500",
      onClick: () => onOpenModal("reassignRepair"),
    },
    equipmentReturned: {
      label: "🏬 Đã nhập lại kho",
      color: "bg-teal-600",
      onClick: () => onOpenModal("equipmentReturned"),
    },
    stockInReceipt: {
      label: "📥 Lập phiếu nhập kho",
      color: "bg-cyan-600",
      onClick: () => onOpenModal("stockInReceipt"),
    },
    stockInAccept: {
      label: "✅ Nghiệm thu, hoàn thành",
      color: "bg-green-600",
      onClick: () => onOpenModal("stockInAccept"),
    },
  };

  const c = cfg[action];
  return (
    <button
      onClick={c.onClick}
      className={`flex-1 py-2.5 text-sm rounded-xl text-white font-medium active:scale-95 ${c.color}`}
    >
      {c.label}
    </button>
  );
}
