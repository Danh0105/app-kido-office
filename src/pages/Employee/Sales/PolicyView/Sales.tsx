import PolicyPage from "./policy";
import React, { useEffect, useRef, useState } from "react";
import { formatVND } from "../../../../utils/formatVND";
import Support from "./support";
import './css/Sales.css'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useLocation, useNavigate } from "react-router-dom";
import HeaderWithBack from "@/components/HeaderWithBack";
import PolicyPie from "@/components/PolicyPie";
import ProposalForm from "./ProposalForm";
import { mapToProposalForm } from "@/utils/mapToProposalForm";
import { subjectApi } from "@/service/subject.api";
import { employeeApi } from "@/service/employee";

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
    const { data, user, subjectId, currentHistoryId } = location.state || {};
    console.log("Location state:", location.state);
    const state = location.state as any;
    const subjectName = state?.subjectName;
    const diff = location.state?.diff;
    const [employee, setEmployee] = useState<any>(null);
    const [subject, setSubject] = useState([]);
    const maxLength = Math.max(
        data?.httienmat?.length || 0,
        data?.htthietbi?.length || 0
    );
    const [formProposal, setFormProposal] = useState<any>(null);
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

    const renderContent = () => (
        <div className="">

            <div className="">
                {formProposal && (
                    <ProposalForm
                        form={formProposal}
                        setForm={setFormProposal}
                    />
                )}
                <PolicyPie data={data} subjectName={subjectName} companyProfit={companyProfit} />
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
                                    { label: "Học phí", key: "fee", note: data?.notes?.fee },
                                    { label: "Số tháng", key: "durationMonths", isText: true, note: data?.notes?.durationMonths },
                                    { label: " Sĩ số lớp", key: "studentPerClass", isText: true, note: data?.notes?.studentPerClass },
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
                                ].map((item, i) => (
                                    <div key={i} className="p-4 flex flex-col gap-1">

                                        {/* TOP */}
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

                                        {/* NOTE */}
                                        {item.note && (
                                            <div className="text-xs text-gray-400 italic">
                                                {item.note}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {data?.companyProfitPerHS !== 0 ? (
                                    <div className="p-4 bg-red-50">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-red-600">HP / Tiết</span>
                                            <span className="font-bold text-red-600">
                                                {formatVND(data.companyProfit || companyProfit)}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-red-50">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-red-600">HP / HS</span>
                                            <span className="font-bold text-red-600">
                                                {formatVND(data?.companyProfit || companyProfit)}
                                            </span>
                                        </div>
                                    </div>
                                )}


                                {/* PROFIT / HS */}
                                {data?.companyProfitPerHS !== 0 && (
                                    <div className="p-4 bg-blue-50">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-blue-600">HP / HS</span>
                                            <span className="font-bold text-blue-600">
                                                {formatVND(data?.companyProfitPerHS || companyProfit1)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                            </tbody>
                        </table>
                    </div>
                    <div className="md:hidden divide-y">
                        {[
                            { label: "Học phí", key: "fee", note: data?.notes?.fee },
                            { label: "Số tháng", key: "durationMonths", isText: true, note: data?.notes?.durationMonths },
                            { label: " Sĩ số lớp", key: "studentPerClass", isText: true, note: data?.notes?.studentPerClass },
                            { label: "CSVC", key: "csvc", note: data?.notes?.totalQlCsvc },
                            { label: "Thuế", key: "thue", note: data?.notes?.totalTax },
                            { label: "Giáo viên", key: "giaovien", danger: true, note: data?.notes?.totalTeach },
                            { label: "CS tháng", key: "csthang", note: data?.notes?.totalTeach },
                            { label: "CS ký HĐ", key: "cdhd", note: data?.notes?.totalM },
                            { label: "Thiết bị", key: "thietbi", note: data?.notes?.totalD },
                            { label: "Giáo cụ", key: "giaoCu", note: data?.notes?.giaoCu },
                            { label: "Thuế TNDN", key: "thuetndn", note: data?.notes?.thuetndn },
                            { label: "Vận hành", key: "vanHanh", note: data?.notes?.vanHanh },
                        ].map((item, i) => (
                            <div key={i} className="p-4 flex flex-col gap-1">

                                {/* TOP */}
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

                                {/* NOTE */}
                                {item.note && (
                                    <div className="text-xs text-gray-400 italic">
                                        {item.note}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* PROFIT */}
                        {data?.companyProfitPerHS !== 0 ? (
                            <div className="p-4 bg-red-50">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-red-600">HP / Tiết</span>
                                    <span className="font-bold text-red-600">
                                        {formatVND(data.companyProfit || companyProfit1)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-red-50">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-red-600">HP / HS</span>
                                    <span className="font-bold text-red-600">
                                        {formatVND(data?.companyProfit || companyProfit)}
                                    </span>
                                </div>
                            </div>
                        )}
                        {/* PROFIT / HS */}
                        {data?.companyProfitPerHS !== 0 && (
                            <div className="p-4 bg-blue-50">
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

                {/* RIGHT - FORM */}
                {/*                     <div className="flex-1">
                    <ProposalForm form={formProposal} setForm={setFormProposal} />
                </div> */}

            </div>

            {/* POLICY TABLE */}


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
            <td className="border border-gray-200 p-2 text-center">
                {data?.notes && (
                    <div className="flex items-center justify-center">
                        <div className="flex items-start gap-1 bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-1 rounded-lg shadow-sm max-w-[140px]">
                            <span className="text-sm">📝</span>
                            <span className="text-xs truncate">
                                {data?.notes?.log}
                            </span>
                        </div>
                    </div>
                )}
            </td>
        </div >
    )



    return (
        <div className="">
            <HeaderWithBack title="Chính sách chi tiết" />
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
    );

}
