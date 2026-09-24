import MoneyForm from "./components/MoneyForm";
import DeviceForm from "./components/DeviceForm";
import { useEffect } from "react";


export default function Support({
    setTotalD,
    setTotalM,
    data,
    setRowsM,
    formsM,
    setRowsD,
    formsD,
    activeTab,
    studentPerClass,
    onStudentPerClassChange,
    setPeriods,
    periods,
    supportStudentCount,
    setSupportStudentCount,
}: any) {
    // Bảng trên cùng (Bảng tính chi phí), Tiền mặt và Thiết bị dùng chung một
    // giá trị số học sinh: `supportStudentCount`. `students`/`realStudents` chỉ
    // là tên field khác nhau ở mỗi bảng, nhưng luôn phản chiếu cùng một số.
    const sharedValues = {
        students: supportStudentCount ?? formsM?.[0]?.students ?? formsD?.[0]?.students ?? data ?? 0,
        realPeriods: formsM?.[0]?.realPeriods ?? formsD?.[0]?.realPeriods ?? periods ?? 0,
        realStudents: supportStudentCount ?? formsM?.[0]?.realStudents ?? formsD?.[0]?.realStudents ?? 0,
    };

    const updateSharedField = (key: "students" | "realPeriods" | "realStudents", value: number) => {
        if (key === "students" || key === "realStudents") {
            setSupportStudentCount?.(value);
            setRowsM((current: any[]) => current.map((row) => ({ ...row, students: value, realStudents: value })));
            setRowsD((current: any[]) => current.map((row) => ({ ...row, students: value, realStudents: value })));
            return;
        }

        setRowsM((current: any[]) => current.map((row, index) => index === 0 ? { ...row, [key]: value } : row));
        setRowsD((current: any[]) => current.map((row, index) => index === 0 ? { ...row, [key]: value } : row));
    };

    // Đồng bộ Tiền mặt/Thiết bị theo `supportStudentCount` (nguồn chung) mỗi khi
    // nó đổi — kể cả khi đổi từ bảng trên cùng — để cả 3 bảng luôn khớp số.
    useEffect(() => {
        if (supportStudentCount == null) return;
        setRowsM((current: any[]) =>
            current.map((row) =>
                row.students === supportStudentCount && row.realStudents === supportStudentCount
                    ? row
                    : { ...row, students: supportStudentCount, realStudents: supportStudentCount },
            ),
        );
        setRowsD((current: any[]) =>
            current.map((row) =>
                row.students === supportStudentCount && row.realStudents === supportStudentCount
                    ? row
                    : { ...row, students: supportStudentCount, realStudents: supportStudentCount },
            ),
        );
    }, [supportStudentCount]);

    return (
        <div className="p-4  text-sm text-gray-800">
            <MoneyForm onTotalChange={setTotalM} data={data} setRowsM={setRowsM} forms={formsM} activeTab={activeTab} studentPerClass={studentPerClass} onStudentPerClassChange={onStudentPerClassChange} setPeriods={setPeriods} periods={periods} sharedValues={sharedValues} onSharedFieldChange={updateSharedField}
            />
            <DeviceForm onTotalChange={setTotalD} data={data} setRowsD={setRowsD} formsD={formsD} activeTab={activeTab} studentPerClass={studentPerClass} onStudentPerClassChange={onStudentPerClassChange} setPeriods={setPeriods} periods={periods} sharedValues={sharedValues} onSharedFieldChange={updateSharedField}
            />
        </div>
    );
}
