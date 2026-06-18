export const mapToProposalForm = (data: any, employee: any) => {
    const formatDate = (date: string) => {
        if (!date) return "";
        const d = new Date(date);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    return {
        subject: data.name || "",
        date: new Date().toLocaleDateString("vi-VN"),

        consultant: employee?.name || "",
        phone: employee?.phone || "",

        schoolYear: data.schoolYear || "",
        totalLessons: String(data.totalLessons || ""),
        totalStudents: String(data.studentCount || ""),

        school: data.school?.name || "",
        address: data.school?.address || "",
        representative: data.school?.representative || "",
        scale: String(data.school?.scale || ""),

        termHD: data.contractDuration || 0,
        contract1: "",

        termPL: data.appendixDuration || 0,
        contract3: "",

        startDate: formatDate(data.startDate),
        contractNo: data.contractNumber || "",

        mst: data.school?.taxCode || "",
        schoolPhone: data.school?.phone || "",
    };
};