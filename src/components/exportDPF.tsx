import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const exportPDF = async () => {
    const element = document.getElementById("pdf-content");

    if (!element) return;

    const canvas = await html2canvas(element, {
        scale: 2, // nét hơn
        useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
        orientation: "landscape", // 🔥 ngang
        unit: "mm",
        format: "a4",
    });

    const imgWidth = 210; // A4 width
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // nếu dài → tự chia trang
    while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    pdf.save("chinh-sach.pdf");
};