import PolicyPage from "./policy";
import React, { useEffect, useRef, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./support";
import './css/Sales.css'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import PolicyPie from "@/components/PolicyPie";
import ProposalForm from "./ProposalForm";
import { mapToProposalForm } from "@/utils/mapToProposalForm";
import { subjectApi } from "@/service/subject.api";
import { employeeApi } from "@/service/employee";
import { policiesApi } from "@/service/policy";
import PolicyHistoryTimeline from "@/components/policy/PolicyHistoryTimeline";
import { PolicyHistoryEntry } from "@/types/policy";
import { getApiErrorMessage } from "@/utils/apiError";

const renderLabel = (props: any) => {
    const { name, percent, x, y } = props;

    if (!percent || percent < 0.05) return null; // ẩn nếu nhỏ

    return (
        <text
            x={x}
            y={y}
            fill="#fff"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fontWeight="600"
        >
            {name}
            {"\n"}
            {(percent * 100).toFixed(0)}%
        </text>
    );
};

export default function Sales() {
    const location = useLocation();
    const { policyId } = useParams();
    const routeState = location.state || {};
    const [policy, setPolicy] = useState<any>(null);
    const [histories, setHistories] = useState<PolicyHistoryEntry[]>([]);
    const [loadingPolicy, setLoadingPolicy] = useState(
        Boolean(policyId && !routeState.data),
    );
    const [policyError, setPolicyError] = useState("");
    const data = routeState.data || policy?.data;
    const policyOwner =
        policy?.employeeId ??
        policy?.createdById ??
        (typeof policy?.createdBy === "object"
            ? policy?.createdBy?.id
            : policy?.createdBy);
    const user = routeState.user || policyOwner;
    const subjectId = routeState.subjectId || policy?.subjectId;
    const currentHistoryId =
        routeState.currentHistoryId || policy?.currentHistoryId;
    console.log("Location state:", location.state);
    const state = routeState as any;
    const subjectName = state?.subjectName;
    const diff = routeState.diff || histories[0]?.diff;
    const [employee, setEmployee] = useState<any>(null);
    const [subject, setSubject] = useState([]);
    const maxLength = Math.max(
        data?.httienmat?.length || 0,
        data?.htthietbi?.length || 0
    );
    const [formProposal, setFormProposal] = useState<any>(null);
    useEffect(() => {
        const fetchPolicyDetail = async () => {
            if (!policyId) return;

            try {
                setLoadingPolicy(true);
                setPolicyError("");

                const policyResponse = await policiesApi.findOne(Number(policyId));
                setPolicy(policyResponse?.policy || policyResponse);

                try {
                    const historyResponse =
                        await policiesApi.getHistoryByPolicy(Number(policyId));
                    setHistories(
                        Array.isArray(historyResponse)
                            ? historyResponse
                            : historyResponse?.data || [],
                    );
                } catch (historyError) {
                    console.error("Load employee policy history failed", historyError);
                    setHistories([]);
                }
            } catch (error) {
                console.error("Load employee policy detail failed", error);
                setPolicyError(
                    getApiErrorMessage(error, "Không thể tải chi tiết chính sách"),
                );
            } finally {
                setLoadingPolicy(false);
            }
        };

        fetchPolicyDetail();
    }, [policyId]);
    useEffect(() => {
        if (!data) return;

        const fetchProposal = async () => {
            try {
                const resSubject = await subjectApi.findOne(subjectId);
                const resEmployee = await employeeApi.getById(Number(user));

                setSubject(resSubject);
                setEmployee(resEmployee);

            } catch (err) {
                console.error("Load policy failed", err);
            }
        };

        fetchProposal();
    }, [data]);
    const merged = Array.from({ length: maxLength }).map((_, i) => {
        const tm = data?.httienmat?.[i];
        const tb = data?.htthietbi?.[i];

        return {
            type: tm?.type || "",
            money: tm?.money || 0,
            monthsM: tm?.months || 0,
            studentsM: tm?.students || 0,
            realStudents: tm?.realStudents || 0,
            realPeriods: tm?.realPeriods || 0,
            device: tb?.category || "",
            qty: tb?.qty || 0,
            price: tb?.price || 0,
            studentsD: tb?.students || 0,
            monthsD: tb?.months || 0,

            condMonths: tb?.months || tm?.months || 0,
            condStudents: tb?.students || tm?.students || 0,
        };
    });
    useEffect(() => {
        if (subject && employee) {
            const mapped = mapToProposalForm(subject, employee);
            setFormProposal(mapped);
        }
    }, [subject, employee]);
    const getRowDiff = (rowId: number, field: string) => {
        if (!diff?.ttcs) return null;

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
    const companyProfit1 =
        (data?.fee || 0)
        - (data?.csvc || 0)
        - (data?.thue || 0)
        - (data?.giaovien || 0)
        - (data?.csthang || 0)
        - (data?.thietbi || 0)
        - (data?.giaoCu || 0)
        - (data?.vanHanh || 0)
        - (data?.thuetndn || 0);
    const companyProfit = data?.companyProfit || companyProfit1;

    const costItems = [
        { label: "Học phí", key: "fee", note: data?.notes?.fee },
        { label: "Số tháng", key: "durationMonths", isText: true, note: data?.notes?.durationMonths },
        { label: "Sĩ số lớp", key: "studentPerClass", isText: true, note: data?.notes?.studentPerClass },
        { label: "CSVC", key: "csvc", note: data?.notes?.totalQlCsvc },
        { label: "Thuế", key: "thue", note: data?.notes?.totalTax },
        { label: "Giáo viên trường", key: "giaovien", danger: true, note: data?.notes?.totalTeach },
        { label: "Giáo viên công ty", key: "teacherCompany", danger: true, note: data?.notes?.teacherCompany },
        { label: "CS tháng", key: "csthang", note: data?.notes?.totalTeach },
        { label: "CS ký HĐ", key: "cdhd", note: data?.notes?.totalM },
        { label: "Thiết bị", key: "thietbi", note: data?.notes?.totalD },
        { label: "Giáo cụ", key: "giaoCu", note: data?.notes?.giaoCu },
        { label: "Thuế TNDN", key: "thuetndn", note: data?.notes?.thuetndn },
        { label: "Vận hành", key: "vanHanh", note: data?.notes?.vanHanh },
    ] as { label: string; key: string; note?: string; isText?: boolean; danger?: boolean }[];

    const renderCostCard = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-2 lg:mt-0">
            <div className="bg-gradient-to-r from-green-100 to-green-50 p-4">
                <h2 className="text-lg font-semibold text-gray-700">Bảng tính chi phí</h2>
            </div>
            <div className="divide-y divide-gray-100">
                {costItems.map((item, i) => (
                    <div key={i} className="px-4 py-3 flex flex-col gap-1 hover:bg-gray-50 transition">
                        <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium ${item.danger ? "text-red-500" : "text-gray-600"}`}>
                                {item.label}
                            </span>
                            <span className="font-semibold text-gray-900">
                                {item.isText
                                    ? data?.[item.key] || 0
                                    : renderValue(item.key, data?.[item.key] || 0)}
                            </span>
                        </div>
                        {item.note && (
                            <div className="text-xs text-gray-400 italic">{item.note}</div>
                        )}
                    </div>
                ))}

                {data?.companyProfitPerHS !== 0 ? (
                    <div className="px-4 py-3 bg-red-50">
                        <div className="flex justify-between">
                            <span className="font-semibold text-red-600">HP / Tiết</span>
                            <span className="font-bold text-red-600">
                                {formatVND(data?.companyProfit || companyProfit)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="px-4 py-3 bg-red-50">
                        <div className="flex justify-between">
                            <span className="font-semibold text-red-600">HP / HS</span>
                            <span className="font-bold text-red-600">
                                {formatVND(data?.companyProfit || companyProfit)}
                            </span>
                        </div>
                    </div>
                )}

                {data?.companyProfitPerHS !== 0 && (
                    <div className="px-4 py-3 bg-blue-50">
                        <div className="flex justify-between">
                            <span className="font-semibold text-blue-600">HP / HS</span>
                            <span className="font-bold text-blue-600">
                                {formatVND(data?.companyProfitPerHS || companyProfit1)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderLogNote = () => (
        <>
            {data?.notes?.log && (
                <div className="mx-4 mb-4 flex items-center gap-3 bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-xl">
                    <div className="text-xl shrink-0">📝</div>
                    <div className="flex-1 text-left">
                        <div className="text-sm text-gray-800 line-clamp-2">
                            {data?.notes?.log}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    const renderContent = () => (
        <div className="bg-gray-100 min-h-screen">
            <div className="lg:max-w-[1400px] lg:mx-auto lg:px-6 lg:pt-4">
                <div className="lg:grid lg:grid-cols-5 lg:gap-6 mt-2">
                    <div className="lg:col-span-3">
                        {formProposal && (
                            <ProposalForm form={formProposal} setForm={setFormProposal} />
                        )}
                        <PolicyPie data={data} subjectName={subjectName} companyProfit={companyProfit} />
                    </div>
                    <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
                        {renderCostCard()}
                    </div>
                </div>

                <div className="lg:mt-6">
                    <PolicyPage
                        data={data?.ttcs}
                        diff={diff}
                        renderRowValue={renderRowValue}
                        studentPerClass={data?.studentPerClass}
                        periods={data?.periods}
                    />
                    <Support
                        cdhd={data?.cdhd}
                        data={merged}
                        studentPerClass={data?.studentPerClass}
                        periods={data?.periods}
                    />
                    {renderLogNote()}
                    {histories.length > 0 && (
                        <div className="mx-4 mb-24 mt-4 lg:mx-0">
                            <PolicyHistoryTimeline histories={histories} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )



    if (!data) {
        return (
            <div className="min-h-screen bg-slate-100">
                <HeaderWithBack title="Chính sách chi tiết" />
                <div className="flex min-h-screen items-center justify-center px-4 pt-16">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
                        {loadingPolicy ? (
                            <>
                                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                                <p className="mt-4 text-sm font-semibold text-slate-600">
                                    Đang tải chính sách...
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-base font-bold text-slate-800">
                                    Không thể hiển thị chính sách
                                </p>
                                <p className="mt-2 text-sm text-slate-500">
                                    {policyError || "Không tìm thấy dữ liệu chính sách."}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <HeaderWithBack title="Chính sách chi tiết" />

            {/* DESKTOP */}
            <div className="hidden lg:block pt-16 pb-24 overflow-auto min-h-screen">
                {renderContent()}
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
                                <button
                                    onClick={() => resetTransform()}
                                    className="px-4 py-3 bg-gray-500 text-white rounded-full shadow"
                                >
                                    🏠
                                </button>
                            </div>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </div>
    );

}
