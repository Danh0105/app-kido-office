import { formatVND } from "../../../../utils/formatVND";

const toNumber = (v: string | number) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};

// Mốc mặc định cố định — khớp với MoneyForm/DeviceForm bên form nhập của
// nhân viên, để "CS ký HĐ" / "Thành tiền" ở đây ra đúng số đã nhập.
const DEFAULT_STUDENTS = 1000;
const DEFAULT_MONTHS = 9;
const DEFAULT_PERIODS = 36;

/** CS ký HĐ + Thành tiền — công thức giống hệt MoneyForm.tsx / DeviceForm.tsx. */
const computeAmounts = (
    thanhTienGoc: number,
    depreciationYears: number,
    realStudents: number,
    months: number,
    realPeriods: number,
    isTiet: boolean,
    studentPerClass: number,
    csKyHDIsDonGia = false,
) => {
    const depreciatedAmount =
        depreciationYears > 0 ? thanhTienGoc / depreciationYears : 0;

    if (isTiet) {
        const donGia1Tiet = depreciatedAmount / DEFAULT_STUDENTS / DEFAULT_PERIODS;
        const thanhTienThucTe =
            donGia1Tiet > 0 && realStudents > 0 && realPeriods > 0
                ? Math.round(donGia1Tiet * realStudents * realPeriods)
                : 0;
        const csKyHD =
            depreciatedAmount > 0 && realPeriods > 0 && realStudents > 0 && studentPerClass > 0
                ? Math.round((depreciatedAmount / realPeriods / realStudents) * studentPerClass)
                : 0;
        return { donGia: donGia1Tiet, csKyHD, thanhTienThucTe };
    }

    const donGiaMacDinh = depreciatedAmount / DEFAULT_STUDENTS / DEFAULT_MONTHS;
    const thanhTienThucTe =
        donGiaMacDinh > 0 && realStudents > 0 && months > 0
            ? Math.round(donGiaMacDinh * realStudents * months)
            : 0;
    // Tiền mặt: CS ký HĐ = Đơn giá mặc định; Thiết bị giữ công thức cũ.
    const csKyHD = csKyHDIsDonGia
        ? Math.round(donGiaMacDinh)
        : depreciatedAmount > 0 && months > 0 && realStudents > 0
            ? Math.round(depreciatedAmount / months / realStudents)
            : 0;
    return { donGia: donGiaMacDinh, csKyHD, thanhTienThucTe };
};

const hasMoneySupport = (row: any) =>
    !!row.type || toNumber(row.money) > 0 || toNumber(row.monthsM) > 0 || toNumber(row.studentsM) > 0;

const hasDeviceSupport = (row: any) =>
    !!row.device || toNumber(row.qty) > 0 || toNumber(row.price) > 0 || toNumber(row.monthsD) > 0 || toNumber(row.studentsD) > 0;

const ReadOnlyField = ({
    label,
    value,
    accent = false,
}: {
    label: string;
    value: string | number;
    accent?: boolean;
}) => (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div
            className={`min-h-[38px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm ${
                accent ? "font-semibold text-blue-700" : "text-gray-800"
            }`}
        >
            {value || "—"}
        </div>
    </div>
);

const ResultField = ({ label, value }: { label: string; value: string }) => (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-800">{value}</span>
    </div>
);

/** Khối "MẶC ĐỊNH / THỰC TẾ NHẬP" — bố cục và nhãn giống hệt MoneyForm/DeviceForm. */
const DefaultVsActual = ({
    isTiet,
    donGiaLabel,
    donGiaFormula,
    donGia,
    missingDonGia,
    actualSummary,
    csKyHD,
    missingCsKyHD,
    csKyHDFormula,
    thanhTien,
    missingThanhTien,
    thanhTienFormula,
}: {
    isTiet: boolean;
    donGiaLabel: string;
    donGiaFormula: string;
    donGia: number;
    missingDonGia: boolean;
    actualSummary: string;
    csKyHD: number;
    missingCsKyHD: boolean;
    csKyHDFormula: string;
    thanhTien: number;
    missingThanhTien: boolean;
    thanhTienFormula: string;
}) => (
    <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Mặc định
            </div>
            <div className="text-xs text-gray-500">
                {DEFAULT_STUDENTS.toLocaleString()} HS ·{" "}
                {isTiet ? `${DEFAULT_PERIODS} tiết` : `${DEFAULT_MONTHS} tháng`}
            </div>
            <div className="text-xs text-gray-500">{donGiaLabel}</div>
            {missingDonGia ? (
                <div className="text-[11px] italic text-red-500">Chưa nhập số tiền</div>
            ) : (
                <div className="font-semibold text-gray-700">
                    {Math.round(donGia).toLocaleString()} đ
                </div>
            )}
            <div className="text-[10px] text-gray-400">{donGiaFormula}</div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                Thực tế nhập
            </div>
            <div className="text-xs text-blue-700">{actualSummary}</div>
            <div className="text-xs font-semibold text-blue-700 pt-1 border-t border-blue-200">
                CS ký HĐ
            </div>
            {missingCsKyHD ? (
                <div className="text-[11px] italic text-red-500">Chưa nhập đủ số liệu</div>
            ) : (
                <div className="text-base font-bold text-blue-800">
                    {csKyHD.toLocaleString()} đ
                </div>
            )}
            <div className="text-[10px] text-blue-500">{csKyHDFormula}</div>
            <div className="text-xs text-blue-700 pt-1 border-t border-blue-200">
                Thành tiền
            </div>
            {missingThanhTien ? (
                <div className="text-[11px] italic text-red-500">Chưa nhập đủ số liệu</div>
            ) : (
                <div className="font-semibold text-blue-700">
                    {thanhTien.toLocaleString()} đ
                </div>
            )}
            <div className="text-[10px] text-blue-500">{thanhTienFormula}</div>
        </div>
    </div>
);

const EmptySupport = () => (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
        Chưa có hỗ trợ / khuyến mãi
    </div>
);

export default function Support({ cdhd, data, studentPerClass, periods, mode }: any) {
    // `periods` luôn có giá trị mặc định (36) bất kể HP/HS hay HP/TIẾT nên
    // không dùng để suy ra loại chính sách — trước đây khiến HP/HS luôn bị
    // hiển thị nhầm thành HP/TIẾT ở màn xem. Ưu tiên `mode` đã lưu.
    const isTietMode = mode === "TIET";

    const totalMoney = data.reduce((sum, row) => {
        return sum + toNumber(row.money);
    }, 0);

    const totalDevice = data.reduce((sum, row) => {
        return sum + toNumber(row.qty) * toNumber(row.price);
    }, 0);

    const totalPerStudentMoney = data.reduce((sum, row) => {
        const money = toNumber(row.money);
        const depreciationYears = toNumber(row.depreciationYearsM);
        const depreciatedMoney =
            depreciationYears > 0 ? money / depreciationYears : 0;
        const students = toNumber(row.studentsM);
        const months = toNumber(row.monthsM);

        if (students > 0 && months > 0) {
            return sum + depreciatedMoney / students / months;
        }
        return sum;
    }, 0);
    const getPerStudentDevice = (row: any) => {
        const total = toNumber(row.qty) * toNumber(row.price);
        const depreciationYears = toNumber(row.depreciationYearsD);
        const depreciatedTotal =
            depreciationYears > 0 ? total / depreciationYears : 0;
        const students = toNumber(row.studentsD);

        if (depreciatedTotal <= 0 || students <= 0) return 0;

        if (isTietMode) {
            if (studentPerClass <= 0) return 0;

            return (depreciatedTotal / periods / students) * studentPerClass;
        }

        const months = toNumber(row.monthsD);
        return months > 0 ? depreciatedTotal / students / months : 0;
    };

    const totalPerStudentDevice = data.reduce(
        (sum, row) => sum + getPerStudentDevice(row),
        0
    );
    const moneyRows = data.filter(hasMoneySupport);
    const deviceRows = data.filter(hasDeviceSupport);

    if (!moneyRows.length && !deviceRows.length) return <EmptySupport />;

    return (
        <div className="space-y-6 p-4 text-sm text-gray-800">
            <div className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <h2 className="text-center text-lg font-semibold text-gray-800">
                    Hỗ trợ / Khuyến mãi
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
                    <div className="rounded-xl bg-red-50 px-4 py-3">
                        Tổng chi tiền mặt: <b className="text-red-600">{formatVND(totalMoney)}</b>
                    </div>
                    <div className="rounded-xl bg-red-50 px-4 py-3">
                        Tổng thiết bị: <b className="text-red-600">{formatVND(totalDevice)}</b>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-4 py-3">
                        Tiền mặt / HS: <b className="text-blue-700">{formatVND(cdhd)}</b>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-4 py-3">
                        Thiết bị / HS: <b className="text-blue-700">{formatVND(totalPerStudentDevice)}</b>
                    </div>
                </div>
            </div>

            {moneyRows.map((row: any, index: number) => {
                const isTiet = isTietMode;
                const realStudents = toNumber(row.realStudents) || toNumber(row.studentsM);
                const realPeriods = toNumber(row.realPeriods) || toNumber(periods);
                const months = toNumber(row.monthsM);
                const money = toNumber(row.money);
                const depreciationYears = toNumber(row.depreciationYearsM);
                const depreciatedMoney =
                    depreciationYears > 0 ? money / depreciationYears : 0;
                const { donGia, csKyHD, thanhTienThucTe } = computeAmounts(
                    money,
                    depreciationYears,
                    realStudents,
                    months,
                    realPeriods,
                    isTiet,
                    toNumber(studentPerClass),
                    true,
                );

                return (
                    <div key={`money-${index}`} className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="rounded bg-yellow-200 py-2 text-center text-lg font-semibold">
                            Tiền mặt #{index + 1}
                        </h3>
                        <div className="mt-4 space-y-4">
                            <ReadOnlyField label="Loại hỗ trợ" value={row.type} />
                            <ReadOnlyField label="Số tiền" value={money ? formatVND(money) : ""} accent />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <ReadOnlyField label="Số năm khấu hao" value={depreciationYears} />
                                <ReadOnlyField
                                    label="Số tiền khấu hao"
                                    value={depreciatedMoney ? formatVND(depreciatedMoney) : ""}
                                    accent
                                />
                            </div>
                            {isTiet ? (
                                <ReadOnlyField label="Sĩ số lớp" value={studentPerClass} />
                            ) : (
                                <ReadOnlyField label="Số học sinh" value={row.studentsM} />
                            )}
                            {!isTiet && <ReadOnlyField label="Số tháng" value={months} />}
                            {isTiet && (
                                <div className="grid grid-cols-2 gap-3">
                                    <ReadOnlyField label="Số học sinh thực" value={row.realStudents} />
                                    <ReadOnlyField label="Số tiết thực" value={row.realPeriods} />
                                </div>
                            )}

                            <DefaultVsActual
                                isTiet={isTiet}
                                donGiaLabel={isTiet ? "Đơn giá 1 tiết" : "Đơn giá"}
                                donGiaFormula={
                                    isTiet
                                        ? `= Số tiền / Số năm khấu hao / ${DEFAULT_STUDENTS.toLocaleString()} / ${DEFAULT_PERIODS}`
                                        : `= Số tiền / Số năm khấu hao / ${DEFAULT_STUDENTS.toLocaleString()} / ${DEFAULT_MONTHS}`
                                }
                                donGia={donGia}
                                missingDonGia={!money}
                                actualSummary={
                                    isTiet
                                        ? `${row.realStudents || 0} HS · ${row.realPeriods || 0} tiết`
                                        : `${row.realStudents || row.studentsM || 0} HS · ${months || 0} tháng`
                                }
                                csKyHD={csKyHD}
                                missingCsKyHD={isTiet ? !realPeriods || !realStudents || !toNumber(studentPerClass) : !money}
                                csKyHDFormula={
                                    isTiet
                                        ? "= Số tiền / Số năm khấu hao / Số tiết thực / Số học sinh thực × Sĩ số lớp"
                                        : "= Đơn giá mặc định"
                                }
                                thanhTien={thanhTienThucTe}
                                missingThanhTien={!realPeriods || !realStudents}
                                thanhTienFormula={
                                    isTiet
                                        ? "= Đơn giá 1 tiết × Số học sinh thực × Số tiết thực"
                                        : "= Đơn giá × Số học sinh × Số tháng"
                                }
                            />
                        </div>
                    </div>
                );
            })}

            {deviceRows.map((row: any, index: number) => {
                const isTiet = isTietMode;
                const total = toNumber(row.qty) * toNumber(row.price);
                const realStudents = toNumber(row.realStudentsD) || toNumber(row.studentsD);
                const realPeriods = toNumber(row.realPeriodsD) || toNumber(periods);
                const months = toNumber(row.monthsD);
                const depreciationYears = toNumber(row.depreciationYearsD);
                const depreciatedTotal =
                    depreciationYears > 0 ? total / depreciationYears : 0;
                const { donGia, csKyHD, thanhTienThucTe } = computeAmounts(
                    total,
                    depreciationYears,
                    realStudents,
                    months,
                    realPeriods,
                    isTiet,
                    toNumber(studentPerClass),
                );

                return (
                    <div key={`device-${index}`} className="mx-auto max-w-3xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="rounded bg-yellow-200 py-2 text-center text-lg font-semibold">
                            Thiết bị #{index + 1}
                        </h3>
                        <div className="mt-4 space-y-4">
                            <ReadOnlyField label="Danh mục" value={row.device} />
                            <ReadOnlyField label="Số lượng" value={row.qty} />
                            <ReadOnlyField label="Đơn giá" value={toNumber(row.price) ? formatVND(row.price) : ""} accent />
                            <ResultField label="Thành tiền" value={total ? formatVND(total) : "0 đ"} />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <ReadOnlyField label="Số năm khấu hao" value={depreciationYears} />
                                <ReadOnlyField
                                    label="Số tiền khấu hao"
                                    value={depreciatedTotal ? formatVND(depreciatedTotal) : ""}
                                    accent
                                />
                            </div>
                            <div className="border-t border-gray-200" />
                            {isTiet ? (
                                <ReadOnlyField label="Sĩ số lớp" value={studentPerClass} />
                            ) : (
                                <ReadOnlyField label="Số học sinh" value={row.studentsD} />
                            )}
                            {!isTiet && <ReadOnlyField label="Số tháng" value={months} />}
                            {isTiet && (
                                <div className="grid grid-cols-2 gap-3">
                                    <ReadOnlyField label="Số học sinh thực" value={row.realStudentsD} />
                                    <ReadOnlyField label="Số tiết thực" value={row.realPeriodsD} />
                                </div>
                            )}

                            <DefaultVsActual
                                isTiet={isTiet}
                                donGiaLabel={isTiet ? "Đơn giá 1 tiết" : "Đơn giá"}
                                donGiaFormula={
                                    isTiet
                                        ? `= Thành tiền / Số năm khấu hao / ${DEFAULT_STUDENTS.toLocaleString()} / ${DEFAULT_PERIODS}`
                                        : `= Thành tiền / Số năm khấu hao / ${DEFAULT_STUDENTS.toLocaleString()} / ${DEFAULT_MONTHS}`
                                }
                                donGia={donGia}
                                missingDonGia={!total}
                                actualSummary={
                                    isTiet
                                        ? `${row.realStudentsD || 0} HS · ${row.realPeriodsD || 0} tiết`
                                        : `${row.realStudentsD || row.studentsD || 0} HS · ${months || 0} tháng`
                                }
                                csKyHD={csKyHD}
                                missingCsKyHD={isTiet ? !realPeriods || !realStudents || !toNumber(studentPerClass) : !months || !realStudents}
                                csKyHDFormula={
                                    isTiet
                                        ? "= Thành tiền / Số năm khấu hao / Số tiết thực / Số học sinh thực × Sĩ số lớp"
                                        : "= Thành tiền / Số năm khấu hao / Số tháng / Số học sinh thực"
                                }
                                thanhTien={thanhTienThucTe}
                                missingThanhTien={!realPeriods || !realStudents}
                                thanhTienFormula={
                                    isTiet
                                        ? "= Đơn giá 1 tiết × Số học sinh thực × Số tiết thực"
                                        : "= Đơn giá × Số học sinh × Số tháng"
                                }
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
