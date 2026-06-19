import PolicyPage from "./policy";
import React, { useEffect, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./support";
import "./css/Sales.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { policiesApi } from "../../../../service/policy";
import { PolicyStatus } from "../../enum/PolicyStatus";
import { getEmployeeRole } from "../../../../utils/auth";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import { subjectApi } from "@/service/subject.api";
import ProposalForm from "./ProposalForm";
import { mapToProposalForm } from "../../../../utils/mapToProposalForm";
import { employeeApi } from "@/service/employee";
import PolicyPie from "@/components/PolicyPie";
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
};
type Props = {
  onLogout?: () => void;
};

export default function Sales({ onLogout }: Props) {
  const { id } = useParams();
  const location = useLocation();
  const { data, user, subjectId, currentHistoryId, status } =
    location.state || {};
  console.log("data", location.state);
  const [subject, setSubject] = useState([]);
  const [employee, setEmployee] = useState<any>(null);
  const [formProposal, setFormProposal] = useState<any>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [diff, setDiff] = React.useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (data) return;

    if (!id) return;

    fetchPolicy();
  }, [id, data]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);

      const res = await policiesApi.findOne(Number(id));

      console.log("FETCH POLICY:", res);

      setPolicy(res);
    } catch (err) {
      console.error("Load policy failed", err);
    } finally {
      setLoading(false);
    }
  };
  const finalData = data || policy?.data;

  const finalUser = user || policy?.createdBy;

  const finalSubjectId = subjectId || policy?.subjectId;

  const finalCurrentHistoryId = currentHistoryId || policy?.currentHistoryId;

  const finalStatus = status || policy?.status;

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
  const isApproved =
    finalStatus === PolicyStatus.DIRECTOR_APPROVED ||
    finalStatus === PolicyStatus.SALE_ADMIN_APPROVED;
  const isRejected = finalStatus === PolicyStatus.REJECTED;
  const showActions = !isApproved && !isRejected;
  useEffect(() => {
    const fetchData = async () => {
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

    if (finalData) fetchData();
  }, [finalData]);
  const maxLength = Math.max(
    finalData?.httienmat?.length || 0,
    finalData?.htthietbi?.length || 0,
  );
  const navigate = useNavigate();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [note, setNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const merged = Array.from({ length: maxLength }).map((_, i) => {
    const tm = finalData?.httienmat?.[i];
    const tb = finalData?.htthietbi?.[i];

    return {
      type: tm?.type || "",
      money: tm?.money || 0,
      monthsM: tm?.months || 0,
      studentsM: tm?.students || 0,

      device: tb?.category || "",
      qty: tb?.qty || 0,
      price: tb?.price || 0,
      studentsD: tb?.students || 0,
      monthsD: tb?.months || 0,

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
  const costItems: {
    label: string;
    key: string;
    note?: string;
    isText?: boolean;
    danger?: boolean;
  }[] = [
    { label: "Học phí", key: "fee", note: finalData?.notes?.fee },
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
    { label: "Thuế TNDN", key: "thuetndn", note: finalData?.notes?.thuetndn },
    { label: "Vận hành", key: "vanHanh", note: finalData?.notes?.vanHanh },
  ];

  const renderCostCard = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-2 lg:mt-0">
      <div className="bg-gradient-to-r from-green-100 to-green-50 p-4">
        <h2 className="text-lg font-semibold text-gray-700">
          Bảng tính chi phí
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {costItems.map((item, i) => (
          <div
            key={i}
            className="px-4 py-3 flex flex-col gap-1 hover:bg-gray-50 transition"
          >
            <div className="flex justify-between items-center">
              <span
                className={`text-sm font-medium ${
                  item.danger ? "text-red-500" : "text-gray-600"
                }`}
              >
                {item.label}
              </span>
              <span className="font-semibold text-gray-900">
                {item.isText
                  ? finalData?.[item.key] || 0
                  : renderValue(item.key, finalData?.[item.key] || 0)}
              </span>
            </div>
            {item.note && (
              <div className="text-xs text-gray-400 italic">{item.note}</div>
            )}
          </div>
        ))}

        {finalData?.companyProfitPerHS !== 0 ? (
          <div className="px-4 py-3 bg-red-50">
            <div className="flex justify-between">
              <span className="font-semibold text-red-600">HP / Tiết</span>
              <span className="font-bold text-red-600">
                {formatVND(finalData.companyProfit || companyProfit)}
              </span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 bg-red-50">
            <div className="flex justify-between">
              <span className="font-semibold text-red-600">HP / HS</span>
              <span className="font-bold text-red-600">
                {formatVND(finalData?.companyProfit || companyProfit)}
              </span>
            </div>
          </div>
        )}

        {finalData?.companyProfitPerHS !== 0 && (
          <div className="px-4 py-3 bg-blue-50">
            <div className="flex justify-between">
              <span className="font-semibold text-blue-600">HP / HS</span>
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
    <div className="bg-gray-100 min-h-screen">
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
            <PolicyPie data={finalData} companyProfit={companyProfit} />
          </div>

          <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
            {renderCostCard()}
          </div>
        </div>

        <div className="lg:mt-6">
          <PolicyPage
            data={finalData?.ttcs}
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
          />
          {renderLogNote()}
        </div>
      </div>
    </div>
  );
  const handleApprove = async () => {
    try {
      let status = PolicyStatus.DIRECTOR_APPROVED;
      const role = getEmployeeRole();
      if (role === "salesadmin" || role === "salesadmin_la") {
        status = PolicyStatus.SALE_ADMIN_APPROVED;
      }

      await policiesApi.adminUpdateStatusNote(Number(id), {
        status,
        note,
        subjectId: finalSubjectId,
        userId: Number(finalUser),
      });

      alert("Đã duyệt");
      navigate(-1);
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
      navigate(-1);
      setShowRejectModal(false);
      setNote("");
    } catch (err: any) {
      alert(err.message);
    }
  };
  if (loading && !finalData) {
    return <div className="p-6">Loading...</div>;
  }
  return (
    <div>
      <HeaderWithBack title={decodeURIComponent("Chính sách")} />

      {/* DESKTOP */}
      <div className="hidden lg:block pt-16 pb-24 overflow-auto min-h-screen">
        {renderContent()}

        {showActions && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg">
            <div className="max-w-[1400px] mx-auto px-6 py-3 flex justify-end gap-4">
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-8 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition"
              >
                Từ chối
              </button>
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition"
              >
                Duyệt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE */}
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

              <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center gap-4 px-4">
                {showActions && (
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 max-w-[160px] py-3 bg-red-500 text-white rounded-xl shadow font-semibold"
                  >
                    Từ chối
                  </button>
                )}
                <button
                  onClick={() => resetTransform()}
                  className="px-4 py-3 bg-gray-500 text-white rounded-full shadow"
                >
                  🏠
                </button>
                {showActions && (
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="flex-1 max-w-[160px] py-3 bg-blue-500 text-white rounded-xl shadow font-semibold"
                  >
                    Duyệt
                  </button>
                )}
              </div>
            </>
          )}
        </TransformWrapper>
      </div>
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
    </div>
  );
}
