import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import HeaderWithBack from "@/components/HeaderWithBack";
import { formatVnd } from "@/utils/decimal";
import {
  expenseRequestApi,
  resolveFileUrl,
  type PaymentOrderPayload,
} from "@/service/expenseRequest";
import { schoolApi } from "@/service/school.api";
import { subjectApi } from "@/service/subject.api";
import { policiesApi } from "@/service/policy";
import {
  PAYMENT_METHOD_LABEL,
  STATUS_META,
  type ExpenseRequest,
} from "@/types/expenseRequest";
import PolicyFinanceTable from "@/pages/Director/expense/component/policy/PolicyFinanceTable";
import TtcsTable from "@/pages/Director/expense/component/policy/TtcsTable";
import CashPolicyTable from "@/pages/Director/expense/component/policy/CashPolicyTable";
import DevicePolicyTable from "@/pages/Director/expense/component/policy/DevicePolicyTable";

import StatusBadge from "./components/StatusBadge";
import Timeline from "./components/Timeline";
import ActionModal, { type ActionPayload } from "./components/ActionModal";
import PaymentOrderModal from "./components/PaymentOrderModal";
import { enrichExpenseRequestWithCreator } from "./creatorProfiles";
import { useExpenseSocket } from "./useExpenseSocket";
import {
  availableActions,
  creatorDetails,
  creatorName,
  formatDate,
  waitingMessage,
  type ActionKey,
} from "./lib";

type ModalKind =
  | "reject"
  | "saleadminReview"
  | "saleadminReject"
  | "cashReleased"
  | "cashReceived"
  | "confirmSpent"
  | "confirmNotSpent"
  | "fundReturned"
  | "paymentOrder"
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

export default function ExpenseRequestDetail() {
  const { id } = useParams();
  const reqId = Number(id);

  const [data, setData] = useState<ExpenseRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
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
  }, [loadSchoolContext, reqId]);

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
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 409) {
        toast.error("Trạng thái đã thay đổi, vui lòng tải lại");
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

  const handleApprove = () => {
    if (!window.confirm("Duyệt đề xuất này?")) return;
    run(() => expenseRequestApi.approve(reqId), "Đã duyệt");
  };

  const onModalSubmit = (payload: ActionPayload) => {
    switch (modal) {
      case "reject":
        run(() => expenseRequestApi.reject(reqId, payload.reason || ""), "Đã từ chối");
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
          () => expenseRequestApi.cashReleased(reqId, { note: payload.note, files: payload.files }),
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

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <HeaderWithBack title="Chi tiết đề xuất" />
        <div className="text-center text-gray-400 text-sm py-10 mt-[60px]">Đang tải…</div>
      </div>
    );
  }

  if (!data) {
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
  const po = data.paymentOrder;

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      <HeaderWithBack title="Chi tiết đề xuất" />

      <div className="flex-1 mt-[60px] px-3 pb-32 space-y-3">
        {/* ===== Header card ===== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={data.status} />
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
            <Field label="Số tiền" value={`${formatVnd(data.amount)} đ`} strong />
            <Field label="Ngày dự kiến chi" value={formatDate(data.expectedPaymentDate)} />
            {data.school?.name && <Field label="Trường" value={data.school.name} />}
            {data.schoolYear && (
              <Field label="Năm học" value={data.schoolYear} />
            )}
            {data.participants && (
              <Field label="Thành phần tham gia" value={data.participants} span />
            )}
          </div>

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
              <span className="font-medium">Lý do chưa chi: </span>
              {data.notSpentReason}
            </div>
          )}
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
              {po.note && <Field label="Ghi chú" value={po.note} span />}
            </div>
          </div>
        )}

        {/* ===== Attachments ===== */}
        {data.attachments && data.attachments.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 text-sm mb-2">📎 Tệp đính kèm</h3>
            <ul className="space-y-1">
              {data.attachments.map((a) => (
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
          <Timeline logs={data.logs} />
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
        <div className="fixed bottom-0 left-0 w-full bg-white border-t px-3 py-2 z-40 md:max-w-6xl md:mx-auto md:left-1/2 md:-translate-x-1/2">
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
                onApprove={handleApprove}
                onOpenModal={setModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== Modals ===== */}
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
          showNote
          showFiles
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
          title="Xác nhận đã chi"
          submitLabel="Đã chi"
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
          title="Xác nhận chưa chi"
          submitLabel="Chưa chi"
          submitColor="bg-amber-500"
          requireReason
          reasonLabel="Lý do chưa chi"
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
      {modal === "paymentOrder" && (
        <PaymentOrderModal
          defaultAmount={data.amount}
          retry={data.status === "FUND_RETURNED"}
          loading={submitting}
          onClose={() => setModal(null)}
          onSubmit={onPaymentOrder}
        />
      )}
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
  onApprove,
  onOpenModal,
}: {
  action: ActionKey;
  status: ExpenseRequest["status"];
  onApprove: () => void;
  onOpenModal: (m: ModalKind) => void;
}) {
  const cfg: Record<ActionKey, { label: string; color: string; onClick: () => void }> = {
    approve: { label: "✔️ Duyệt", color: "bg-blue-500", onClick: onApprove },
    reject: { label: "❌ Từ chối", color: "bg-red-500", onClick: () => onOpenModal("reject") },
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
      label: "✅ Đã chi",
      color: "bg-green-500",
      onClick: () => onOpenModal("confirmSpent"),
    },
    confirmNotSpent: {
      label: "↩️ Chưa chi",
      color: "bg-amber-500",
      onClick: () => onOpenModal("confirmNotSpent"),
    },
    fundReturned: {
      label: "🏦 Nhận lại quỹ",
      color: "bg-green-600",
      onClick: () => onOpenModal("fundReturned"),
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
