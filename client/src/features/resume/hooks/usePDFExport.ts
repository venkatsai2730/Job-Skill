import { useCallback, useState } from "react";

/**
 * Captures `elementId` with html2canvas then exports to A4 PDF via jsPDF.
 * Both libraries are lazily imported to keep the initial bundle lean.
 */
export function usePDFExport() {
  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(async (elementId: string, fileName = "resume.pdf") => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error(`Element #${elementId} not found in DOM`);

    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        // Ensure the off-screen element is fully rendered
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;

      // Multi-page: negative position shifts the full image up on each page
      let heightLeft = imgH;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 1) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }

      pdf.save(fileName);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportPDF, exporting };
}
