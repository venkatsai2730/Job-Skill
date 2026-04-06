import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Initialize PDF.js worker using unpkg to avoid local Vite bundling issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ResumePDFViewerProps {
  fileUrl: string;
  zoom?: number;
}

function PDFLoadingSkeleton() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 640,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {[100, 60, 90, 70, 80, 60, 75, 85, 65].map((w, i) => (
        <div
          key={i}
          className="bg-white/10 rounded animate-pulse"
          style={{
            height: 14,
            width: `${w}%`,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

export const ResumePDFViewer: React.FC<ResumePDFViewerProps> = ({ fileUrl, zoom = 1.0 }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(600);

  useEffect(() => {
    // Determine the base width dynamically from the container
    if (containerRef.current) {
      setBaseWidth(containerRef.current.clientWidth - 32);
    }
    
    // Optional: Add resize listener
    const handleResize = () => {
      if (containerRef.current) {
        setBaseWidth(containerRef.current.clientWidth - 32);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={containerRef}
      id="pdf-viewer-container"
      className="w-full h-full overflow-y-auto bg-gray-50 p-4 flex flex-col items-center gap-4 scroll-smooth"
    >
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<PDFLoadingSkeleton />}
        error={<div className="text-rose-400 p-8 text-center bg-rose-500/10 rounded-xl border border-rose-500/20">Failed to load PDF. Please ensure the file is valid.</div>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            width={baseWidth * zoom}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            canvasBackground="#ffffff"
            className="mb-4 rounded shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
          />
        ))}
      </Document>
    </div>
  );
};
