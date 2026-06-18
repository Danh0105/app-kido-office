import MoneyForm from "./components/MoneyForm";
import DeviceForm from "./components/DeviceForm";


export default function Support({ setTotalD, setTotalM, data, setRowsM, formsM, setRowsD, formsD, activeTab, studentPerClass, setPeriods, periods, realPeriods, setRealPeriods, realStudentPerClass, setRealStudentPerClass }: any) {
    console.log("Support props", { setPeriods, periods });
    return (
        <div className="p-4  text-sm text-gray-800">
            <MoneyForm onTotalChange={setTotalM} data={data} setRowsM={setRowsM} forms={formsM} activeTab={activeTab} studentPerClass={studentPerClass} setPeriods={setPeriods} periods={periods} realPeriods={realPeriods} setRealPeriods={setRealPeriods} realStudentPerClass={realStudentPerClass} setRealStudentPerClass={setRealStudentPerClass}
            />
            <DeviceForm onTotalChange={setTotalD} data={data} setRowsD={setRowsD} formsD={formsD} activeTab={activeTab} studentPerClass={studentPerClass} setPeriods={setPeriods} periods={periods} realPeriods={realPeriods} setRealPeriods={setRealPeriods} realStudentPerClass={realStudentPerClass} setRealStudentPerClass={setRealStudentPerClass}
            />
        </div>
    );
}