import React, { createContext, useContext, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type ExportContextType = {
    exportPDF: () => void;
    setRef: (el: HTMLDivElement | null) => void;
};

const ExportContext = createContext<ExportContextType | null>(null);

export const useExport = () => {
    const ctx = useContext(ExportContext);
    if (!ctx) throw new Error("useExport must be used within ExportProvider");
    return ctx;
};

export const ExportProvider = ({ children }) => {
    const pdfRef = useRef<HTMLDivElement | null>(null);

    const setRef = (el: HTMLDivElement | null) => {
        pdfRef.current = el;
    };

    const exportPDF = async () => {
        if (!pdfRef.current) {
            console.warn("❌ No PDF content registered");
            return;
        }

        const canvas = await html2canvas(pdfRef.current, {
            scale: 2,
            useCORS: true,
        });

        const imgData = canvas.toDataURL("image/png");

        const pdf = new jsPDF("l", "mm", "a4");

        const imgWidth = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        pdf.save("export.pdf");
    };

    return (
        <ExportContext.Provider value={{ exportPDF, setRef }}>
            {children}
        </ExportContext.Provider>
    );
};