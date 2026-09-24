import PolicyPage from "./policy";
import React, { useEffect, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./support";
import SupportCards from "@/pages/Employee/Sales/PolicyView/support";
import "./css/Sales.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { policiesApi } from "../../../../service/policy";
import { PolicyStatus } from "../../enum/PolicyStatus";
import { hasRole, isChiefAccountant } from "../../../../utils/auth";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import { subjectApi } from "@/service/subject.api";
import ProposalForm from "./ProposalForm";
import { mapToProposalForm } from "../../../../utils/mapToProposalForm";
import { employeeApi } from "@/service/employee";
import PolicyPie from "@/components/PolicyPie";
import DepreciationRemainingSummary from "@/pages/Employee/Sales/Policy/components/DepreciationRemainingSummary";
import DirectorEditPolicy from "@/components/policy/DirectorEditPolicy";
import PolicyHistoryTimeline from "@/components/policy/PolicyHistoryTimeline";
import {
  PolicyHistoryEntry,
  PolicyContractFile,
  PolicyContractCategory,
  POLICY_CONTRACT_CATEGORIES,
  POLICY_CONTRACT_CATEGORY_LABELS,
  policyPercentBase,
} from "@/types/policy";
import { isDirectorBrandUiEnabled } from "@/utils/directorUi";
import { resolveApiFileUrl } from "@/utils/fileUrl";
import { Paperclip, ExternalLink, X, Upload, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "@/utils/apiError";
type OtherCost = {
  id: string;
  name: string;
  percent: number;
  tax: number;
};
type RowType = {
  id: number;
  name: string;
  qlCsvc: number;
  tax: number;
  teacher: number;
  totalPercent: number;
  company: number;
  ql1Percent: number;
  ql1Tax: number;
  ql2Percent: number;
  ql2Tax: number;
  tgPercent: number;
  tgTax: number;
  total: number;
  fee: number;
  otherCosts?: OtherCost[];
  percentAfterTax?: boolean;
};
type Props = {
  onLogout?: () => void;
  /**
   * Nhúng trong popup (danh sách chính sách): lấy id + state từ props thay
   * vì URL, bỏ header trang, và "quay lại" = đóng popup.
   */
  embedded?: boolean;
  policyId?: number;
  initialState?: any;
  onClose?: () => void;
};

export default function Sales({
  onLogout,
  embedded = false,
  policyId,
  initialState,
  onClose,
}: Props) {
  const params = useParams();
  const id = embedded ? String(policyId ?? "") : params.id;
  const isBrand = isDirectorBrandUiEnabled();
  const location = useLocation();
  const { data, user, subjectId, currentHistoryId, status } =
    (embedded ? initialState : location.state) || {};
  const [subject, setSubject] = useState([]);
  const [employee, setEmployee] = useState<any>(null);
  const [formProposal, setFormProposal] = useState<any>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [diff, setDiff] = React.useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);

  const [loading, setLoading] = useState(Boolean(id && !data));
  const [loadError, setLoadError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editHistories, setEditHistories] = useState<PolicyHistoryEntry[]>([]);

  useEffect(() => {
    if (!id) return;

    fetchPolicy();
  }, [id]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const res = await policiesApi.findOne(Number(id));

      console.log("FETCH POLICY:", res);

      setPolicy((res as any)?.policy || res);
    } catch (err) {
      console.error("Load policy failed", err);
      setLoadError("Không thể tải chi tiết chính sách.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const fetchHistory = async () => {
      if (!id) return;

      try {
        const histories = await policiesApi.getHistoryByPolicy(Number(id));
        setEditHistories(
          Array.isArray(histories) ? histories : histories?.data || [],
        );
      } catch (error) {
        console.error("Load policy history failed", error);
      }
    };

    fetchHistory();
  }, [id]);

  const finalData = policy?.data || data;

  const isImageFile = (file: PolicyContractFile) =>
    /\.(jpe?g|png)$/i.test(file.originalName || file.url || "");

  const contractFiles: PolicyContractFile[] = policy?.contractFiles?.length
    ? policy.contractFiles
    : policy?.contractFileUrl
      ? [
          {
            id: "legacy",
            url: policy.contractFileUrl,
            originalName: policy.contractFileName || "Hợp đồng PDF",
            size: 0,
            uploadedById: 0,
            uploadedAt: "",
          },
        ]
      : [];
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadCategoryRef = React.useRef<PolicyContractCategory>("CONTRACT");

  const canEditPolicyFiles = hasRole(
    "director",
    "director_la",
    "saleadmin",
    "salesadmin",
    "salesadmin_la",
  );

  const uploadContract = async (fileList?: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || !id) return;

    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`"${file.name}" vượt quá 20 MB`);
        return;
      }
    }

    setUploadingContract(true);
    try {
      await policiesApi.uploadContract(
        Number(id),
        files,
        uploadCategoryRef.current,
      );
      await fetchPolicy();
      toast.success(
        files.length > 1
          ? `Đã upload ${files.length} file`
          : "Đã upload file",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể upload file"));
    } finally {
      setUploadingContract(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeContract = async (file: PolicyContractFile) => {
    if (!id) return;
    if (!window.confirm(`Xoá file "${file.originalName}"?`)) return;
    setUploadingContract(true);
    try {
      await policiesApi.removeContract(Number(id), file.id);
      await fetchPolicy();
      toast.success("Đã xoá file");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xoá file"));
    } finally {
      setUploadingContract(false);
    }
  };

  const renderCategorySection = (category: PolicyContractCategory) => {
    const categoryFiles = contractFiles.filter(
      (file) => (file.category ?? "CONTRACT") === category,
    );
    return (
      <div
        key={category}
        className="rounded-xl border border-gray-100 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-50 to-white px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-semibold text-gray-800">
              {POLICY_CONTRACT_CATEGORY_LABELS[category]}
            </span>
            <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {categoryFiles.length}
            </span>
          </div>
          {canEditPolicyFiles && (
            <button
              type="button"
              disabled={uploadingContract}
              onClick={() => {
                uploadCategoryRef.current = category;
                fileInputRef.current?.click();
              }}
              className="shrink-0 inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingContract ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              Thêm file
            </button>
          )}
        </div>
        {categoryFiles.length === 0 ? (
          <p className="px-3 py-3 text-xs text-gray-400">Chưa có file</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto p-3">
            {categoryFiles.map((file) => (
              <li
                key={file.id}
                className="rounded-xl border border-gray-100 p-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {isImageFile(file) && (
                    <a
                      href={resolveApiFileUrl(file.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <img
                        src={resolveApiFileUrl(file.url)}
                        alt={file.originalName}
                        className="h-12 w-12 rounded-md border border-gray-100 object-cover"
                      />
                    </a>
                  )}
                  <a
                    href={resolveApiFileUrl(file.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={file.originalName}
                    className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  >
                    {!isImageFile(file) && (
                      <span className="shrink-0" aria-hidden>
                        📎
                      </span>
                    )}
                    <span className="truncate">{file.originalName}</span>
                    <ExternalLink size={14} className="shrink-0" />
                  </a>
                  {canEditPolicyFiles && file.id !== "legacy" && (
                    <button
                      type="button"
                      disabled={uploadingContract}
                      onClick={() => void removeContract(file)}
                      title="Xoá file này"
                      className="ml-auto shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const policyOwner =
    policy?.employeeId ??
    policy?.createdById ??
    (typeof policy?.createdBy === "object"
      ? policy?.createdBy?.id
      : policy?.createdBy);
  const finalUser = user || policyOwner;

  const finalSubjectId = policy?.subjectId || subjectId;

  const finalCurrentHistoryId = policy?.currentHistoryId || currentHistoryId;

  const finalStatus = policy?.status || status;

  const statusConfig: Record<
    string,
    {
      label: string;
      icon: string;
      className: string;
      dotClassName: string;
    }
  > = {
    [PolicyStatus.PENDING]: {
      label: "Chờ duyệt",
      icon: "⏳",
      className:
        "bg-gradient-to-r from-yellow-50 to-amber-100 text-amber-800 border-amber-300 shadow-amber-100",
      dotClassName: "bg-amber-500",
    },
    [PolicyStatus.SALE_ADMIN_APPROVED]: {
      label: "Sale Admin đã duyệt",
      icon: "🛡️",
      className:
        "bg-gradient-to-r from-blue-50 to-sky-100 text-blue-800 border-blue-300 shadow-blue-100",
      dotClassName: "bg-blue-500",
    },
    [PolicyStatus.DIRECTOR_APPROVED]: {
      label: "Giám đốc đã duyệt",
      icon: "✅",
      className:
        "bg-gradient-to-r from-green-50 to-emerald-100 text-emerald-800 border-emerald-300 shadow-emerald-100",
      dotClassName: "bg-emerald-500",
    },
    [PolicyStatus.REJECTED]: {
      label: "Đã từ chối",
      icon: "❌",
      className:
        "bg-gradient-to-r from-red-50 to-rose-100 text-red-800 border-red-300 shadow-red-100",
      dotClassName: "bg-red-500",
    },
  };
  // DIRECTOR_APPROVED là chốt cuối — không ai còn duyệt được nữa.
  // SALE_ADMIN_APPROVED chỉ xong lượt của Sale Admin, giám đốc vẫn phải tự
  // duyệt tiếp — không được coi là "đã xong" chung cho mọi người xem, nếu
  // không giám đốc sẽ mất luôn nút Duyệt/Từ chối ở đúng bước cần họ nhất.
  const isFinalApproved = finalStatus === PolicyStatus.DIRECTOR_APPROVED;
  const isWaitingOnDirector =
    finalStatus === PolicyStatus.SALE_ADMIN_APPROVED &&
    hasRole("saleadmin", "salesadmin_la") &&
    !hasRole("director", "director_la");
  const isRejected = finalStatus === PolicyStatus.REJECTED;
  const readOnly = isChiefAccountant();
  const showActions =
    !isFinalApproved && !isRejected && !readOnly && !isWaitingOnDirector;
  useEffect(() => {
    const fetchData = async () => {
      if (!finalCurrentHistoryId) return;

      try {
        const res = await policiesApi.getByCurrentHistoryId(
          Number(finalCurrentHistoryId),
        );
        console.log("data diff", res.diff);
        setDiff(res.diff);
      } catch (err) {
        console.error("Load policy failed", err);
      }
    };

    if (finalData && finalCurrentHistoryId) fetchData();
  }, [finalCurrentHistoryId, finalData]);
  const maxLength = Math.max(
    finalData?.httienmat?.length || 0,
    finalData?.htthietbi?.length || 0,
  );
  const navigate = useNavigate();
  const goBack = () => (embedded ? onClose?.() : navigate(-1));
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [note, setNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const merged = Array.from({ length: maxLength }).map((_, i) => {
    const tm = finalData?.httienmat?.[i];
    const tb = finalData?.htthietbi?.[i];

    return {
      type: tm?.type || "",
      money: tm?.money || 0,
      depreciationYearsM: tm?.depreciationYears || 1,
      monthsM: tm?.months || 0,
      studentsM: tm?.students || 0,
      realStudents: tm?.realStudents || 0,
      realPeriods: tm?.realPeriods || 0,

      device: tb?.category || "",
      qty: tb?.qty || 0,
      price: tb?.price || 0,
      depreciationYearsD: tb?.depreciationYears || 1,
      studentsD: tb?.students || 0,
      monthsD: tb?.months || 0,
      realStudentsD: tb?.realStudents || 0,
      realPeriodsD: tb?.realPeriods || 0,

      condMonths: tb?.months || tm?.months || 0,
      condStudents: tb?.students || tm?.students || 0,
    };
  });

  const getRowDiff = (rowId: number, field: string) => {
    if (!diff?.ttcs?.old || !diff?.ttcs?.new) return null;

    const oldRow = diff.ttcs.old.find((r: any) => r.id === rowId);
    const newRow = diff.ttcs.new.find((r: any) => r.id === rowId);

    if (!oldRow || !newRow) return null;

    if (oldRow[field] !== newRow[field]) {
      return {
        old: oldRow[field],
        new: newRow[field],
      };
    }

    return null;
  };
  const renderRowValue = (rowId: number, field: string, value: number) => {
    const d = getRowDiff(rowId, field);

    if (!d) {
      return formatVND(value || 0);
    }

    return (
      <div className="bg-yellow-100 rounded text-[8px]">
        <div className="font-medium text-gray-800">{formatVND(d.old || 0)}</div>

        <div className="font-medium text-green-600">
          {formatVND(d.new || 0)}
        </div>
      </div>
    );
  };
  const renderValue = (field: string, value: number) => {
    const changed = diff?.[field];
    const oldValue = changed?.old;

    if (!changed) {
      return <span className="text-sm">{formatVND(value || 0)}</span>;
    }

    const delta = (value || 0) - (oldValue || 0);

    return (
      <div className="text-xs text-gray-700 flex items-center gap-2">
        <span className="text-gray-400">{formatVND(oldValue || 0)}</span>

        <span>→</span>

        <span className="font-medium text-red-700">
          {formatVND(value || 0)}
        </span>

        <span className={delta > 0 ? "text-green-600" : "text-red-600"}>
          ({delta > 0 ? "+" : ""}
          {formatVND(delta)})
        </span>
      </div>
    );
  };

  const NoteCell = ({ note }: { note?: string }) => {
    if (!note) return <span className="text-gray-300">—</span>;

    return (
      <div
        onClick={() => setOpenNote(note)}
        className="text-xs text-gray-600 max-w-[220px] mx-auto cursor-pointer hover:text-blue-600"
      >
        <div className="truncate">{note}</div>

        <div className="text-[11px] text-blue-500 mt-1">🔍 Xem chi tiết</div>
      </div>
    );
  };

  useEffect(() => {
    if (!finalData) return;

    const fetchProposal = async () => {
      try {
        const resSubject = await subjectApi.findOne(finalSubjectId);

        const resEmployee = await employeeApi.getById(Number(finalUser));

        setSubject(resSubject);
        setEmployee(resEmployee);
      } catch (err) {
        console.error("Load policy failed", err);
      }
    };

    fetchProposal();
  }, [finalData]);

  useEffect(() => {
    if (subject && employee) {
      const mapped = mapToProposalForm(subject, employee);
      setFormProposal(mapped);
    }
  }, [subject, employee]);
  const companyProfit1 =
    (finalData?.fee || 0) -
    (finalData?.csvc || 0) -
    (finalData?.thue || 0) -
    (finalData?.giaovien || 0) -
    (finalData?.csthang || 0) -
    (finalData?.thietbi || 0) -
    (finalData?.giaoCu || 0) -
    (finalData?.vanHanh || 0) -
    (finalData?.thuetndn || 0);
  const companyProfit = finalData?.companyProfit || companyProfit1;
  const percentAfterTax =
    Boolean(finalData?.percentAfterTax) ||
    Boolean(finalData?.ttcs?.some((row: RowType) => row.percentAfterTax));
  const percentFeeBase = policyPercentBase({
    fee: finalData?.fee,
    percentAfterTax,
  });
  const formatPercentOfFee = (value: number, isText?: boolean, key?: string) => {
    if (key === "fee" || key === "feeAfterTax") return "100%";
    if (isText || percentFeeBase <= 0) return "—";
    return `${((Number(value) || 0) / percentFeeBase * 100).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })}%`;
  };
  const costItems: {
    label: string;
    key: string;
    note?: string;
    isText?: boolean;
    danger?: boolean;
    formula?: string;
  }[] = [
    { label: "Học phí", key: "fee", note: finalData?.notes?.fee },
    ...(percentAfterTax
      ? [{ label: "Học phí sau thuế", key: "feeAfterTax" }]
      : []),
    {
      label: "Số tháng",
      key: "durationMonths",
      isText: true,
      note: finalData?.notes?.durationMonths,
    },
    {
      label: "Sĩ số lớp",
      key: "studentPerClass",
      isText: true,
      note: finalData?.notes?.studentPerClass,
    },
    { label: "CSVC", key: "csvc", note: finalData?.notes?.totalQlCsvc },
    { label: "Thuế", key: "thue", note: finalData?.notes?.totalTax },
    {
      label: "Giáo viên trường",
      key: "giaovien",
      danger: true,
      note: finalData?.notes?.totalTeach,
    },
    {
      label: "Giáo viên công ty",
      key: "teacherCompany",
      danger: true,
      note: finalData?.notes?.teacherCompany,
    },
    { label: "CS tháng", key: "csthang", note: finalData?.notes?.totalTeach },
    { label: "CS ký HĐ", key: "cdhd", note: finalData?.notes?.totalM },
    { label: "Thiết bị", key: "thietbi", note: finalData?.notes?.totalD },
    { label: "Giáo cụ", key: "giaoCu", note: finalData?.notes?.giaoCu },
    {
      label: "Thuế TNDN",
      key: "thuetndn",
      note: finalData?.notes?.thuetndn,
      formula: "(CS tháng + CS ký HĐ) × 22%",
    },
    { label: "Vận hành", key: "vanHanh", note: finalData?.notes?.vanHanh },
  ];

  const renderCostCard = () => (
    <div className="mx-auto mt-2 w-[calc(100%-1.5rem)] max-w-[360px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:mt-0 lg:w-full lg:max-w-none">
      <div className="bg-gradient-to-r from-green-100 to-green-50 px-3 py-3 lg:p-4">
        <h2 className="text-base font-semibold text-gray-700 lg:text-lg">
          Bảng tính chi phí
        </h2>
        <div className="mt-2 grid grid-cols-[1fr_64px_104px] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          <span>Khoản mục</span>
          <span className="text-right">% HP</span>
          <span className="text-right">Số tiền</span>
        </div>
        {percentAfterTax && (
          <div className="mt-2 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-medium text-gray-600">
            Chính sách trừ 2% thuế trước; các % bên dưới tính trên học phí sau thuế:{" "}
            <b className="text-gray-800">{formatVND(percentFeeBase)}</b>
          </div>
        )}
      </div>
      <div className="divide-y divide-gray-100">
        {costItems.map((item, i) => {
          const value =
            item.key === "feeAfterTax"
              ? percentFeeBase
              : finalData?.[item.key] || 0;
          return (
          <div
            key={i}
            className="flex flex-col gap-1 px-3 py-2 hover:bg-gray-50 transition lg:px-4 lg:py-3"
          >
            <div className="grid grid-cols-[1fr_64px_104px] items-center gap-2">
              <span
                className={`text-sm font-medium ${
                  item.danger ? "text-red-500" : "text-gray-600"
                }`}
              >
                {item.label}
              </span>
              <span className="text-right text-xs font-semibold text-gray-500">
                {formatPercentOfFee(value, item.isText, item.key)}
              </span>
              <span className="break-words text-right text-sm font-semibold text-gray-900">
                {item.isText
                  ? value
                  : renderValue(item.key, value)}
              </span>
            </div>
            {item.formula && (
              <div className="text-xs text-red-500 italic">{item.formula}</div>
            )}
            {item.note && (
              <div className="text-xs text-gray-400 italic">{item.note}</div>
            )}
          </div>
          );
        })}

        {finalData?.companyProfitPerHS !== 0 ? (
          <div className="bg-red-50 px-3 py-2.5 lg:px-4 lg:py-3">
            <div className="grid grid-cols-[1fr_64px_104px] items-center gap-2">
              <span className="font-semibold text-red-600">HP / Tiết</span>
              <span className="text-right text-xs font-semibold text-red-500">
                {formatPercentOfFee(finalData.companyProfit || companyProfit)}
              </span>
              <span className="font-bold text-red-600">
                {formatVND(finalData.companyProfit || companyProfit)}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 px-3 py-2.5 lg:px-4 lg:py-3">
            <div className="grid grid-cols-[1fr_64px_104px] items-center gap-2">
              <span className="font-semibold text-red-600">HP / HS</span>
              <span className="text-right text-xs font-semibold text-red-500">
                {formatPercentOfFee(finalData?.companyProfit || companyProfit)}
              </span>
              <span className="font-bold text-red-600">
                {formatVND(finalData?.companyProfit || companyProfit)}
              </span>
            </div>
          </div>
        )}

        {finalData?.companyProfitPerHS !== 0 && (
          <div className="bg-blue-50 px-3 py-2.5 lg:px-4 lg:py-3">
            <div className="grid grid-cols-[1fr_64px_104px] items-center gap-2">
              <span className="font-semibold text-blue-600">HP / HS</span>
              <span className="text-right text-xs font-semibold text-blue-500">
                {formatPercentOfFee(finalData?.companyProfitPerHS || companyProfit1)}
              </span>
              <span className="font-bold text-blue-600">
                {formatVND(finalData?.companyProfitPerHS || companyProfit1)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderLogNote = () => (
    <>
      {finalData?.notes?.log && (
        <div
          onClick={() => setOpenNote(finalData?.notes?.log)}
          className="mx-4 mb-4 flex items-center gap-3 bg-yellow-50 active:bg-yellow-100 border border-yellow-200 px-4 py-3 rounded-xl cursor-pointer transition hover:shadow-sm"
        >
          <div className="text-xl shrink-0">📝</div>
          <div className="flex-1 text-left">
            <div className="text-sm text-gray-800 line-clamp-2">
              {finalData?.notes?.log}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderContent = () => (
    <div className={`${embedded ? "" : "min-h-screen"} pb-24 lg:pb-0 ${isBrand ? "bg-[#FFF8E6] text-[#0047B8]" : "bg-gray-100"}`}>
      <div className="lg:max-w-[1400px] lg:mx-auto lg:px-6 lg:pt-4">
        {finalStatus && statusConfig[finalStatus] && (
          <div
            className={`
            mx-4 lg:mx-0 mt-3 px-4 py-3 rounded-2xl border
            font-semibold text-sm flex items-center justify-between
            shadow-lg backdrop-blur-sm
            ${statusConfig[finalStatus].className}
        `}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span
                  className={`
                        absolute inline-flex h-3 w-3 rounded-full opacity-75 animate-ping
                        ${statusConfig[finalStatus].dotClassName}
                    `}
                />

                <span
                  className={`
                        relative inline-flex h-3 w-3 rounded-full
                        ${statusConfig[finalStatus].dotClassName}
                    `}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {statusConfig[finalStatus].icon}
                </span>

                <span>{statusConfig[finalStatus].label}</span>
              </div>
            </div>

            <span className="text-[11px] uppercase tracking-wide opacity-70">
              Trạng thái
            </span>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-5 lg:gap-6 mt-2">
          <div className="lg:col-span-3">
            {formProposal && (
              <ProposalForm form={formProposal} setForm={setFormProposal} />
            )}
            <div className="relative">
              {contractFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFilesModal(true)}
                  className={`
                    absolute top-1/2 left-3 -translate-y-1/2 z-10
                    inline-flex items-center gap-1.5
                    px-3 py-2 rounded-full border font-semibold text-xs
                    shadow-lg backdrop-blur
                    ${
                      isBrand
                        ? "border-[#0047B8]/20 bg-white/95 text-[#0047B8]"
                        : "border-gray-200 bg-white/95 text-gray-700"
                    }
                  `}
                >
                  <Paperclip size={14} />
                  <span>Xem tất cả file</span>
                  <span
                    className={`
                      inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1
                      rounded-full text-[11px] font-bold
                      ${isBrand ? "bg-[#0047B8] text-white" : "bg-indigo-600 text-white"}
                    `}
                  >
                    {contractFiles.length}
                  </span>
                </button>
              )}
              <PolicyPie
                data={finalData}
                subjectName={(subject as any)?.name}
                companyProfit={companyProfit}
              />
              <DepreciationRemainingSummary
                moneyRows={finalData?.httienmat || []}
                deviceRows={finalData?.htthietbi || []}
                savedRemainingMoney={
                  finalData?.remainingCashDepreciationAmount
                }
                savedRemainingDevice={
                  finalData?.remainingDeviceDepreciationAmount
                }
              />
            </div>
          </div>

          <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
            {renderCostCard()}
          </div>
        </div>

        <div className="lg:mt-6">
          <PolicyPage
            data={(finalData?.ttcs || []).map((row: RowType) => ({
              ...row,
              percentAfterTax: Boolean(row.percentAfterTax ?? percentAfterTax),
            }))}
            diff={diff}
            renderRowValue={renderRowValue}
            studentPerClass={finalData?.studentPerClass}
            periods={finalData?.periods}
          />
          <Support
            cdhd={finalData?.cdhd}
            data={merged}
            studentPerClass={finalData?.studentPerClass}
            periods={finalData?.periods}
            mode={finalData?.mode}
          />
          {/* Từng khoản Tiền mặt #n / Thiết bị #n dạng thẻ (cùng UI với màn
              xem chính sách của Kinh doanh) — bảng tổng ở trên chỉ gom số. */}
          {merged.length > 0 && (
            <SupportCards
              cdhd={finalData?.cdhd}
              data={merged}
              studentPerClass={finalData?.studentPerClass}
              periods={finalData?.periods}
              mode={finalData?.mode}
            />
          )}
          {renderLogNote()}
          {editHistories.length > 0 && (
            <div className="mx-4 mb-24 mt-4 lg:mx-0">
              <PolicyHistoryTimeline histories={editHistories} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
  const canEditPolicy = hasRole(
    "director",
    "director_la",
    "saleadmin",
    "salesadmin",
    "salesadmin_la",
  );

  const handleOpenEdit = () => {
    if (!finalData) return;
    setShowEditModal(true);
  };

  const handleApprove = async () => {
    try {
      let status = PolicyStatus.DIRECTOR_APPROVED;
      if (hasRole("salesadmin", "salesadmin_la")) {
        status = PolicyStatus.SALE_ADMIN_APPROVED;
      }

      await policiesApi.adminUpdateStatusNote(Number(id), {
        status,
        note,
        subjectId: finalSubjectId,
        userId: Number(finalUser),
      });

      alert("Đã duyệt");
      goBack();
      setShowApproveModal(false);
      setNote("");
    } catch (err: any) {
      if (err.response) {
        alert(err.response.data.message);
      } else {
        alert("Lỗi kết nối server");
      }
    }
  };

  const handleReject = async () => {
    try {
      await policiesApi.adminUpdateStatusNote(Number(id), {
        status: PolicyStatus.REJECTED,
        note,
        subjectId: finalSubjectId,
        userId: Number(finalUser),
      });

      alert("Đã từ chối");
      goBack();
      setShowRejectModal(false);
      setNote("");
    } catch (err: any) {
      alert(err.message);
    }
  };
  const statusText =
    loadError || (loading ? "Đang tải chính sách..." : "Không tìm thấy chính sách.");

  if (!finalData) {
    if (embedded) {
      return (
        <div className="px-6 py-16 text-center text-gray-500">{statusText}</div>
      );
    }
    return (
      <>
      <div className={isBrand ? "bg-[#FFF8E6] min-h-screen text-[#0047B8]" : "bg-gray-100 min-h-screen"}>
        <HeaderWithBack title={decodeURIComponent("Chính sách")} brandSidebarInset={isBrand} />
        <div className="pt-24 px-6 text-center text-gray-500">
          {statusText}
        </div>
      </div>
      </>
    );
  }
  return (
    <>
    <div className={embedded ? "" : isBrand ? "bg-[#FFF8E6] min-h-screen" : ""}>
      {!embedded && (
        <HeaderWithBack title={decodeURIComponent("Chính sách")} brandSidebarInset={isBrand} />
      )}

      {/* DESKTOP — popup nhúng thì hiện ở mọi cỡ màn hình, thanh nút bám đáy popup */}
      <div
        className={
          embedded
            ? "block"
            : `hidden lg:block pt-16 pb-24 overflow-auto min-h-screen ${isBrand ? "bg-[#FFF8E6]" : ""}`
        }
      >
        {renderContent()}

        <div
          className={
            embedded
              ? "sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t border-blue-900/10 shadow-lg"
              : `fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t shadow-lg ${isBrand ? "border-blue-900/10 lg:left-[286px]" : "border-gray-200"}`
          }
        >
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex justify-end gap-4">
            {canEditPolicy && (
              <button
                onClick={handleOpenEdit}
                className="px-8 py-2.5 bg-[#FFC928] hover:bg-amber-400 text-[#3f2d05] rounded-xl font-semibold transition"
              >
                Chỉnh sửa chính sách
              </button>
            )}
            {showActions && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-8 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition"
                >
                  Từ chối
                </button>
                <button
                  onClick={() => setShowApproveModal(true)}
                  className={`px-8 py-2.5 text-white rounded-xl font-semibold transition ${isBrand ? "bg-[#005BEA] hover:bg-[#0047B8]" : "bg-blue-500 hover:bg-blue-600"}`}
                >
                  Duyệt
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE */}
      {!embedded && (
      <div className="lg:hidden">
        <TransformWrapper
          minScale={0.3}
          maxScale={3}
          initialScale={1}
          limitToBounds={true}
          centerOnInit={true}
          doubleClick={{ disabled: true }}
          panning={{
            velocityDisabled: true,
            excluded: ["button", "select"],
          }}
        >
          {({ resetTransform }) => (
            <>
              <TransformComponent
                wrapperStyle={{
                  width: "100vw",
                  height: "100vh",
                  overflow: "auto",
                }}
              >
                {renderContent()}
              </TransformComponent>

              <div
                className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 gap-2 border-t border-gray-200 bg-white/95 px-3 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <button
                  onClick={() => resetTransform()}
                  className="min-h-11 rounded-xl bg-gray-600 px-1.5 py-2 text-xs font-semibold text-white shadow active:scale-95"
                >
                  Về giữa
                </button>
                {canEditPolicy && (
                  <button
                    onClick={handleOpenEdit}
                    className="min-h-11 rounded-xl bg-amber-500 px-1.5 py-2 text-xs font-semibold text-white shadow active:scale-95"
                  >
                    Chỉnh sửa
                  </button>
                )}
                {showActions && (
                  <>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="min-h-11 rounded-xl bg-red-500 px-1.5 py-2 text-xs font-semibold text-white shadow active:scale-95"
                    >
                      Từ chối
                    </button>
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="min-h-11 rounded-xl bg-blue-500 px-1.5 py-2 text-xs font-semibold text-white shadow active:scale-95"
                    >
                      Duyệt
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </TransformWrapper>
      </div>
      )}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-3 text-red-500">
              Nhập ghi chú từ chối
            </h3>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="w-full border rounded-xl p-3 h-28 outline-none focus:ring-2 focus:ring-red-400"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2 rounded-xl bg-gray-200"
              >
                Hủy
              </button>

              <button
                onClick={handleReject}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void uploadContract(event.target.files)}
      />
      {showFilesModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowFilesModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-base font-bold text-gray-900">
                Tổng hợp file ({contractFiles.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowFilesModal(false)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 sm:grid sm:grid-cols-1 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
              {POLICY_CONTRACT_CATEGORIES.map((category) =>
                renderCategorySection(category),
              )}
            </div>
          </div>
        </div>
      )}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-5 w-[90%] max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-3 text-blue-500">
              Nhập ghi chú duyệt
            </h3>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú khi duyệt..."
              className="w-full border rounded-xl p-3 h-28 outline-none focus:ring-2 focus:ring-blue-400"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-2 rounded-xl bg-gray-200"
              >
                Hủy
              </button>

              <button
                onClick={handleApprove}
                className="flex-1 py-2 rounded-xl bg-blue-500 text-white"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
      {openNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpenNote(null)}
          />

          {/* modal */}
          <div className="relative bg-white w-[420px] rounded-2xl shadow-xl p-5 animate-[fadeIn_.2s_ease]">
            {/* header */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Ghi chú</h2>

              <button
                onClick={() => setOpenNote(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            {/* content */}
            <div className="text-sm text-gray-700 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-line pr-1">
              {openNote}
            </div>

            {/* footer */}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setOpenNote(null)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-[100] overflow-auto bg-white">
          <DirectorEditPolicy
            policyId={Number(id)}
            employeeId={Number(finalUser)}
            defaultData={finalData}
            onClose={() => setShowEditModal(false)}
            onSuccess={() => {
              fetchPolicy();
              policiesApi.getHistoryByPolicy(Number(id)).then((res) => {
                setEditHistories(Array.isArray(res) ? res : res?.data || []);
              });
            }}
          />
        </div>
      )}
    </div>
    </>
  );
}
