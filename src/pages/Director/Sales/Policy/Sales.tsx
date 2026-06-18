import PolicyPage from "./policy";
import React, { useEffect, useRef, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./support";
import './css/Sales.css'
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
    const { data, user, subjectId, currentHistoryId } = location.state || {};
    console.log("data", location.state)
    const [subject, setSubject] = useState([]);
    const [employee, setEmployee] = useState<any>(null);
    const [formProposal, setFormProposal] = useState<any>(null);
    const [openNote, setOpenNote] = useState<string | null>(null);
    const [diff, setDiff] = React.useState<any>(null);
    const [policy, setPolicy] =
        useState<any>(null);

    const [loading, setLoading] =
        useState(false);
    useEffect(() => {
        if (data) return;

        if (!id) return;

        fetchPolicy();
    }, [id, data]);

    const fetchPolicy = async () => {
        try {
            setLoading(true);

            const res =
                await policiesApi.findOne(
                    Number(id),
                );

            console.log(
                'FETCH POLICY:',
                res,
            );

            setPolicy(res);
        } catch (err) {
            console.error(
                'Load policy failed',
                err,
            );
        } finally {
            setLoading(false);
        }
    };
    const finalData =
        data || policy?.data;

    const finalUser =
        user || policy?.createdBy;

    const finalSubjectId =
        subjectId || policy?.subjectId;

    const finalCurrentHistoryId =
        currentHistoryId ||
        policy?.currentHistoryId;
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await policiesApi.getByCurrentHistoryId(Number(finalCurrentHistoryId));
                console.log("data diff", res.diff)
                setDiff(res.diff);
            } catch (err) {
                console.error("Load policy failed", err);
            }
        };

        if (finalData) fetchData();
    }, [finalData]);
    const maxLength = Math.max(
        finalData?.httienmat?.length || 0,
        finalData?.htthietbi?.length || 0
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
                <div className="font-medium text-gray-800">
                    {formatVND(d.old || 0)}
                </div>

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
                <span className="text-gray-400">
                    {formatVND(oldValue || 0)}
                </span>

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
                <div className="truncate">
                    {note}
                </div>

                <div className="text-[11px] text-blue-500 mt-1">
                    🔍 Xem chi tiết
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (!finalData) return;

        const fetchProposal = async () => {
            try {
                const resSubject =
                    await subjectApi.findOne(
                        finalSubjectId,
                    );

                const resEmployee =
                    await employeeApi.getById(
                        Number(finalUser),
                    );

                setSubject(resSubject);
                setEmployee(resEmployee);
            } catch (err) {
                console.error(
                    "Load policy failed",
                    err,
                );
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
        (finalData?.fee || 0)
        - (finalData?.csvc || 0)
        - (finalData?.thue || 0)
        - (finalData?.giaovien || 0)
        - (finalData?.csthang || 0)
        - (finalData?.thietbi || 0)
        - (finalData?.giaoCu || 0)
        - (finalData?.vanHanh || 0)
        - (finalData?.thuetndn || 0);
    const companyProfit = finalData?.companyProfit || companyProfit1;
    const renderContent = () => (
        <div className="bg-gray-100 min-h-screen">

            <div className="">
                {formProposal && (
                    <ProposalForm
                        form={formProposal}
                        setForm={setFormProposal}
                    />
                )}
                <PolicyPie data={finalData} companyProfit={companyProfit} />
                {/* LEFT - TABLE */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-2">

                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-base">

                            {/* HEADER */}
                            <thead>
                                <tr className="bg-gradient-to-r from-green-100 to-green-50 text-gray-700">
                                    <th colSpan={2} className="p-4 text-left text-lg font-semibold">
                                        Bảng tính chi phí
                                    </th>
                                    <th className="p-4 text-center text-sm font-medium text-gray-500">
                                        Ghi chú
                                    </th>
                                </tr>
                            </thead>

                            {/* BODY */}
                            <tbody className="divide-y divide-gray-100">

                                {/* ITEM */}
                                {[
                                    { label: "Học phí", key: "fee", note: finalData?.notes?.fee },
                                    { label: "Số tháng", key: "durationMonths", isText: true, note: finalData?.notes?.durationMonths },
                                    { label: " Sĩ số lớp", key: "studentPerClass", isText: true, note: finalData?.notes?.studentPerClass },
                                    { label: "CSVC", key: "csvc", note: finalData?.notes?.totalQlCsvc },
                                    { label: "Thuế", key: "thue", note: finalData?.notes?.totalTax },
                                    { label: "Giáo viên trường", key: "giaovien", danger: true, note: finalData?.notes?.totalTeach },
                                    { label: "Giáo viên công ty", key: "teacherCompany", danger: true, note: finalData?.notes?.teacherCompany },

                                    { label: "CS tháng", key: "csthang", note: finalData?.notes?.totalTeach },
                                    { label: "CS ký HĐ", key: "cdhd", note: finalData?.notes?.totalM },
                                    { label: "Thiết bị", key: "thietbi", note: finalData?.notes?.totalD },
                                    { label: "Giáo cụ", key: "giaoCu", note: finalData?.notes?.giaoCu },
                                    { label: "Thuế TNDN", key: "thuetndn", note: finalData?.notes?.thuetndn },
                                    { label: "Vận hành", key: "vanHanh", note: finalData?.notes?.vanHanh },
                                ].map((item, i) => (
                                    <div key={i} className="p-4 flex flex-col gap-1">

                                        {/* TOP */}
                                        <div className="flex justify-between items-center">
                                            <span className={`text-sm font-medium ${item.danger ? "text-red-500" : "text-gray-600"}`}>
                                                {item.label}
                                            </span>

                                            <span className="font-semibold text-gray-900">
                                                {item.isText
                                                    ? finalData?.[item.key] || 0
                                                    : renderValue(item.key, finalData?.[item.key] || 0)}
                                            </span>
                                        </div>

                                        {/* NOTE */}
                                        {item.note && (
                                            <div className="text-xs text-gray-400 italic">
                                                {item.note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {finalData?.companyProfitPerHS !== 0 ? (
                                    <div className="p-4 bg-red-50">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-red-600">HP / Tiết</span>
                                            <span className="font-bold text-red-600">
                                                {formatVND(finalData.companyProfit || companyProfit)}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-red-50">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-red-600">HP / HS</span>
                                            <span className="font-bold text-red-600">
                                                {formatVND(finalData?.companyProfit || companyProfit)}
                                            </span>
                                        </div>
                                    </div>
                                )}


                                {/* PROFIT / HS */}
                                {finalData?.companyProfitPerHS !== 0 && (
                                    <div className="p-4 bg-blue-50">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-blue-600">HP / HS</span>
                                            <span className="font-bold text-blue-600">
                                                {formatVND(finalData?.companyProfitPerHS || companyProfit1)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                            </tbody>
                        </table>
                    </div>
                    <div className="md:hidden divide-y">
                        {[
                            { label: "Học phí", key: "fee", note: finalData?.notes?.fee },
                            { label: "Số tháng", key: "durationMonths", isText: true, note: finalData?.notes?.durationMonths },
                            { label: " Sĩ số lớp", key: "studentPerClass", isText: true, note: finalData?.notes?.studentPerClass },
                            { label: "CSVC", key: "csvc", note: finalData?.notes?.totalQlCsvc },
                            { label: "Thuế", key: "thue", note: finalData?.notes?.totalTax },
                            { label: "Giáo viên", key: "giaovien", danger: true, note: finalData?.notes?.totalTeach },
                            { label: "CS tháng", key: "csthang", note: finalData?.notes?.totalTeach },
                            { label: "CS ký HĐ", key: "cdhd", note: finalData?.notes?.totalM },
                            { label: "Thiết bị", key: "thietbi", note: finalData?.notes?.totalD },
                            { label: "Giáo cụ", key: "giaoCu", note: finalData?.notes?.giaoCu },
                            { label: "Thuế TNDN", key: "thuetndn", note: finalData?.notes?.thuetndn },
                            { label: "Vận hành", key: "vanHanh", note: finalData?.notes?.vanHanh },
                        ].map((item, i) => (
                            <div key={i} className="p-4 flex flex-col gap-1">

                                {/* TOP */}
                                <div className="flex justify-between items-center">
                                    <span className={`text-sm font-medium ${item.danger ? "text-red-500" : "text-gray-600"}`}>
                                        {item.label}
                                    </span>

                                    <span className="font-semibold text-gray-900">
                                        {item.isText
                                            ? finalData?.[item.key] || 0
                                            : renderValue(item.key, finalData?.[item.key] || 0)}
                                    </span>
                                </div>

                                {/* NOTE */}
                                {item.note && (
                                    <div className="text-xs text-gray-400 italic">
                                        {item.note}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* PROFIT */}
                        {finalData?.companyProfitPerHS !== 0 ? (
                            <div className="p-4 bg-red-50">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-red-600">HP / Tiết</span>
                                    <span className="font-bold text-red-600">
                                        {formatVND(finalData.companyProfit || companyProfit1)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-red-50">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-red-600">HP / HS</span>
                                    <span className="font-bold text-red-600">
                                        {formatVND(finalData?.companyProfit || companyProfit)}
                                    </span>
                                </div>
                            </div>
                        )}
                        {/* PROFIT / HS */}
                        {finalData?.companyProfitPerHS !== 0 && (
                            <div className="p-4 bg-blue-50">
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

                {/* RIGHT - FORM */}
                {/*                     <div className="flex-1">
                    <ProposalForm form={formProposal} setForm={setFormProposal} />
                </div> */}

            </div>

            {/* POLICY TABLE */}

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
            <td className="border border-gray-200 p-2 text-center" >
                {finalData?.notes?.log && (
                    <div
                        onClick={() => setOpenNote(finalData?.notes?.log)}
                        className="
                                    w-full
                                    flex items-center gap-3
                                    bg-yellow-50
                                    active:bg-yellow-100
                                    border border-yellow-200
                                    px-3 py-3
                                    rounded-xl
                                    cursor-pointer
                                    transition
                                "
                    >
                        {/* icon */}
                        <div className="text-xl shrink-0">📝</div>

                        {/* text */}
                        <div className="flex-1 text-left" onClick={() => setOpenNote(finalData?.notes?.log)}>
                            <div className="text-sm text-gray-800 line-clamp-2" onClick={() => setOpenNote(finalData?.notes?.log)}>
                                {finalData?.notes?.log}
                            </div>
                        </div>
                    </div>
                )}
            </td>

        </div>
    )
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
        return (
            <div className="p-6">
                Loading...
            </div>
        );
    }
    return (
        <div className="">

            <HeaderWithBack title={decodeURIComponent("Chính sách")} />

            <TransformWrapper
                minScale={0.3}
                maxScale={3}
                initialScale={1}
                limitToBounds={true}
                centerOnInit={true}
                doubleClick={{ disabled: true }}
                panning={{
                    velocityDisabled: true,
                    excluded: ["button", "select"]
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

                        {/* Nút reset */}
                        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center gap-4 px-4">

                            <button
                                onClick={() => setShowRejectModal(true)}
                                className="flex-1 max-w-[160px] py-3 bg-red-500 text-white rounded-xl shadow font-semibold"
                            >
                                Từ chối
                            </button>

                            <button
                                onClick={() => resetTransform()}
                                className="px-4 py-3 bg-gray-500 text-white rounded-full shadow"
                            >
                                🏠
                            </button>

                            <button
                                onClick={() => setShowApproveModal(true)}
                                className="flex-1 max-w-[160px] py-3 bg-blue-500 text-white rounded-xl shadow font-semibold"
                            >
                                Duyệt
                            </button>

                        </div>

                    </>
                )}
            </TransformWrapper>
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
                            <h2 className="text-lg font-semibold text-gray-800">
                                Ghi chú
                            </h2>

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