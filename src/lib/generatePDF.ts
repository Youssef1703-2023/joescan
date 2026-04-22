import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PlatformHit } from './socialOsint';

interface JsPdfWithAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

function splitList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === 'string') {
    return value.split(/\\\\n|\\n/g).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function manualDownload(doc: jsPDF, filename: string) {
  // Get PDF as base64 data URI string
  const pdfDataUri = doc.output('datauristring', { filename });
  
  // Create download link
  const link = document.createElement('a');
  link.href = pdfDataUri;
  link.download = filename;
  link.style.cssText = 'position:fixed;left:-9999px;';
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  requestAnimationFrame(() => {
    document.body.removeChild(link);
  });
}

function safeAutoTable(doc: jsPDF, options: any) {
  try {
    if (typeof autoTable === 'function') {
      autoTable(doc, options);
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(options);
    } else {
      console.warn('autoTable not available, skipping table');
    }
  } catch (err) {
    console.warn('autoTable error:', err);
  }
}

// Load the icon as base64 for embedding in PDF
let iconBase64Cache: string | null = null;
async function loadIconBase64(): Promise<string | null> {
  if (iconBase64Cache) return iconBase64Cache;
  try {
    const response = await fetch('/icon-512.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        iconBase64Cache = reader.result as string;
        resolve(iconBase64Cache);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Pre-load icon on module load
loadIconBase64();

// Color palette
const COLORS = {
  darkBg: [10, 10, 15] as [number, number, number],
  headerBg: [15, 15, 22] as [number, number, number],
  accent: [0, 255, 100] as [number, number, number],
  accentDim: [0, 180, 70] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [200, 200, 210] as [number, number, number],
  midGray: [120, 120, 140] as [number, number, number],
  dimGray: [80, 80, 95] as [number, number, number],
  sectionBg: [18, 18, 28] as [number, number, number],
  tableBg: [22, 22, 35] as [number, number, number],
  tableAlt: [28, 28, 42] as [number, number, number],
  red: [255, 60, 60] as [number, number, number],
  amber: [255, 180, 30] as [number, number, number],
  green: [0, 255, 100] as [number, number, number],
};

function getRiskColor(risk: string): [number, number, number] {
  const r = (risk || '').toUpperCase();
  if (r === 'HIGH') return COLORS.red;
  if (r === 'MEDIUM') return COLORS.amber;
  return COLORS.green;
}

function drawHeader(doc: jsPDF, scanType: string, lang: string) {
  const pageWidth = doc.internal.pageSize.width;

  // Dark header bar
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Accent line under header
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 48, pageWidth, 2, 'F');

  // Icon
  if (iconBase64Cache) {
    try {
      doc.addImage(iconBase64Cache, 'PNG', 12, 8, 32, 32);
    } catch { /* icon not available */ }
  }

  // Brand text
  const textX = iconBase64Cache ? 50 : 14;
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('JOE', textX, 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.accent);
  doc.text('SCAN', textX + doc.getTextWidth('JOE') + 1, 20);

  // Title
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('Security Intelligence Report', textX, 32);

  // Module & Date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.midGray);
  doc.text(`Module: ${scanType.toUpperCase()} ANALYSIS`, textX, 42);
  doc.text(
    `Generated: ${new Date().toLocaleString(lang === 'ar' ? 'ar' : 'en-US')}`,
    pageWidth - 14,
    42,
    { align: 'right' }
  );

  // Classification badge
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(pageWidth - 48, 10, 34, 10, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.darkBg);
  doc.text('CONFIDENTIAL', pageWidth - 31, 17, { align: 'center' });
}

function addSectionTitle(doc: jsPDF, title: string, y: number, icon?: string) {
  const pageWidth = doc.internal.pageSize.width;

  // Section background strip
  doc.setFillColor(...COLORS.sectionBg);
  doc.rect(10, y - 6, pageWidth - 20, 12, 'F');

  // Accent left bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(10, y - 6, 3, 12, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.accent);
  doc.text(title.toUpperCase(), 18, y + 2);

  return y + 14;
}

function addFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    // Footer background
    doc.setFillColor(...COLORS.headerBg);
    doc.rect(0, pageHeight - 16, pageWidth, 16, 'F');

    // Footer accent line
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, pageHeight - 16, pageWidth, 0.5, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.dimGray);

    doc.text('JoeScan Security Engine™ — OSINT Intelligence Platform', 14, pageHeight - 6);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 6, { align: 'right' });

    // Centermark
    doc.setTextColor(...COLORS.accent);
    doc.text('● VERIFIED REPORT', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }
}

export const generateReportPDF = (scanData: any, scanType: string, lang: 'en' | 'ar') => {
  try {
    const doc = new jsPDF() as JsPdfWithAutoTable;

    doc.setProperties({
      title: `JoeScan Report - ${scanData.target || scanData.emailScanned || 'Audit'}`,
      subject: 'Cybersecurity Intelligence Report',
      author: 'JoeScan by JoeTech',
      creator: 'JoeScan OSINT Platform',
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Page background
    doc.setFillColor(...COLORS.darkBg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header with icon
    drawHeader(doc, scanType, lang);

    let cursorY = 62;

    // ─── Section A: Target Summary ───
    cursorY = addSectionTitle(doc, 'A. Target Summary', cursorY);

    const targetLabel = scanData.target || scanData.emailScanned || 'Unknown';
    const riskColor = getRiskColor(scanData.riskLevel);

    safeAutoTable(doc, {
      startY: cursorY,
      theme: 'plain',
      head: [],
      body: [
        ['TARGET', targetLabel],
        ['RISK LEVEL', (scanData.riskLevel || 'UNKNOWN').toUpperCase()],
        ['SECURITY SCORE', typeof scanData.securityScore === 'number' ? `${scanData.securityScore} / 100` : 'N/A'],
        ['SCAN MODULE', scanType.toUpperCase()],
        ['TIMESTAMP', new Date().toISOString()],
      ],
      styles: {
        fontSize: 9,
        cellPadding: { top: 4, bottom: 4, left: 8, right: 8 },
        textColor: COLORS.lightGray,
        fillColor: COLORS.tableBg,
        lineColor: [40, 40, 55],
        lineWidth: 0.3,
      },
      alternateRowStyles: {
        fillColor: COLORS.tableAlt,
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold', textColor: COLORS.midGray, fontSize: 8 },
        1: { fontStyle: 'bold', textColor: COLORS.white },
      },
      didParseCell(data: any) {
        if (data.row.index === 1 && data.column.index === 1) {
          data.cell.styles.textColor = riskColor;
          data.cell.styles.fontSize = 11;
        }
      },
      margin: { left: 14, right: 14 },
    });

    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;

    // ─── Section B: Executive Summary ───
    if (cursorY > pageHeight - 60) {
      doc.addPage();
      doc.setFillColor(...COLORS.darkBg);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      cursorY = 20;
    }
    cursorY = addSectionTitle(doc, 'B. Executive Summary', cursorY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.lightGray);

    const reportText = String(scanData.reportText || scanData.report || 'No detailed findings available.').replace(/\*/g, '');
    const reportLines = doc.splitTextToSize(reportText, pageWidth - 32);
    doc.text(reportLines, 16, cursorY);
    cursorY += (reportLines.length * 4.5) + 12;

    // ─── Section C: Action Plan ───
    const actionPlan = splitList(scanData.actionPlan);
    if (actionPlan.length > 0) {
      if (cursorY > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(...COLORS.darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        cursorY = 20;
      }
      cursorY = addSectionTitle(doc, 'C. Action Plan', cursorY);

      safeAutoTable(doc, {
        startY: cursorY,
        theme: 'plain',
        head: [['#', 'RECOMMENDED ACTION']],
        body: actionPlan.map((step, index) => [String(index + 1), step.replace(/^\d+\.\s*/, '')]),
        styles: {
          fontSize: 9,
          cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
          textColor: COLORS.lightGray,
          fillColor: COLORS.tableBg,
          lineColor: [40, 40, 55],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: COLORS.accentDim,
          textColor: COLORS.darkBg,
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: COLORS.tableAlt },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center', textColor: COLORS.accent, fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      });

      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;
    }

    // ─── Section D: Score Factors ───
    const scoreFactors = splitList(scanData.scoreFactors);
    if (scoreFactors.length > 0) {
      if (cursorY > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(...COLORS.darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        cursorY = 20;
      }
      cursorY = addSectionTitle(doc, 'D. Score Factors', cursorY);

      safeAutoTable(doc, {
        startY: cursorY,
        theme: 'plain',
        head: [['FACTOR']],
        body: scoreFactors.map((factor) => [factor]),
        styles: {
          fontSize: 9,
          cellPadding: { top: 3, bottom: 3, left: 8, right: 8 },
          textColor: COLORS.lightGray,
          fillColor: COLORS.tableBg,
          lineColor: [40, 40, 55],
          lineWidth: 0.3,
        },
        headStyles: { fillColor: [30, 30, 50], textColor: COLORS.accent, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: COLORS.tableAlt },
        margin: { left: 14, right: 14 },
      });

      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;
    }

    // ─── Section E: Breaches (email scans) ───
    const breaches = scanData.breaches;
    if (Array.isArray(breaches) && breaches.length > 0 && scanType === 'email') {
      if (cursorY > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(...COLORS.darkBg);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        cursorY = 20;
      }
      cursorY = addSectionTitle(doc, 'E. Breach Details', cursorY);

      safeAutoTable(doc, {
        startY: cursorY,
        theme: 'plain',
        head: [['BREACH NAME', 'DATE', 'DATA EXPOSED', 'RECORDS']],
        body: breaches.slice(0, 20).map((b: any) => [
          String(b.name || ''),
          String(b.date || ''),
          String(b.dataExposed || '').substring(0, 60),
          String(b.recordCount || '—'),
        ]),
        styles: {
          fontSize: 8,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          textColor: COLORS.lightGray,
          fillColor: COLORS.tableBg,
          lineColor: [40, 40, 55],
          lineWidth: 0.3,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [80, 20, 20],
          textColor: COLORS.red,
          fontStyle: 'bold',
          fontSize: 7,
        },
        alternateRowStyles: { fillColor: COLORS.tableAlt },
        columnStyles: {
          0: { cellWidth: 35, textColor: COLORS.white, fontStyle: 'bold' },
          1: { cellWidth: 22 },
          2: { cellWidth: 83 },
          3: { cellWidth: 28, halign: 'right', textColor: COLORS.red },
        },
        margin: { left: 14, right: 14 },
      });

      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;
    }

    // ─── Section F: Social Footprint (social scans) ───
    if (scanType === 'social') {
      const hits = (scanData.hits || []) as PlatformHit[];
      const groupedHits = hits.reduce((acc, hit) => {
        const category = hit.category || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(hit);
        return acc;
      }, {} as Record<string, PlatformHit[]>);

      const categoryRows = Object.entries(groupedHits)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([category, categoryHits]) => [category.toUpperCase(), String(categoryHits.length)]);

      if (categoryRows.length > 0) {
        if (cursorY > pageHeight - 60) {
          doc.addPage();
          doc.setFillColor(...COLORS.darkBg);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          cursorY = 20;
        }
        cursorY = addSectionTitle(doc, 'E. Social Footprint Summary', cursorY);

        safeAutoTable(doc, {
          startY: cursorY,
          theme: 'plain',
          head: [['CATEGORY', 'ACCOUNTS FOUND']],
          body: categoryRows,
          styles: {
            fontSize: 9,
            cellPadding: { top: 4, bottom: 4, left: 8, right: 8 },
            textColor: COLORS.lightGray,
            fillColor: COLORS.tableBg,
            lineColor: [40, 40, 55],
            lineWidth: 0.3,
          },
          headStyles: { fillColor: COLORS.accentDim, textColor: COLORS.darkBg, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: COLORS.tableAlt },
          columnStyles: {
            1: { halign: 'center', textColor: COLORS.accent, fontStyle: 'bold' },
          },
          margin: { left: 14, right: 14 },
        });

        cursorY = (doc.lastAutoTable?.finalY || cursorY) + 12;
      }

      const hitRows = hits
        .slice()
        .sort((left, right) => left.platform.localeCompare(right.platform))
        .map((hit) => [hit.platform, (hit.category || 'other').toUpperCase(), hit.url]);

      if (hitRows.length > 0) {
        if (cursorY > pageHeight - 80) {
          doc.addPage();
          doc.setFillColor(...COLORS.darkBg);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          cursorY = 20;
        }
        cursorY = addSectionTitle(doc, 'F. Platforms Found', cursorY);

        safeAutoTable(doc, {
          startY: cursorY,
          theme: 'plain',
          head: [['PLATFORM', 'CATEGORY', 'PROFILE URL']],
          body: hitRows,
          styles: {
            fontSize: 8,
            cellPadding: { top: 3, bottom: 3, left: 6, right: 6 },
            textColor: COLORS.lightGray,
            fillColor: COLORS.tableBg,
            lineColor: [40, 40, 55],
            lineWidth: 0.3,
            overflow: 'linebreak',
          },
          headStyles: { fillColor: [30, 30, 50], textColor: COLORS.accent, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: COLORS.tableAlt },
          columnStyles: {
            0: { cellWidth: 40, textColor: COLORS.white, fontStyle: 'bold' },
            1: { cellWidth: 30 },
            2: { cellWidth: pageWidth - 100, textColor: COLORS.midGray },
          },
          margin: { left: 14, right: 14 },
        });
      }
    }

    // Footers on all pages
    addFooters(doc);

    manualDownload(doc, `JoeScan_Report_${scanType}_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (err) {
    console.error('PDF generation error:', err);
    try {
      const fallbackDoc = new jsPDF();
      fallbackDoc.setFontSize(18);
      fallbackDoc.text('JoeScan Report', 14, 20);
      fallbackDoc.setFontSize(12);
      fallbackDoc.text(`Target: ${scanData.target || scanData.emailScanned || 'Unknown'}`, 14, 35);
      fallbackDoc.text(`Risk: ${scanData.riskLevel || 'Unknown'}`, 14, 45);
      fallbackDoc.text(`Score: ${scanData.securityScore ?? 'N/A'} / 100`, 14, 55);
      const text = String(scanData.reportText || '').substring(0, 2000);
      const lines = fallbackDoc.splitTextToSize(text, 180);
      fallbackDoc.text(lines, 14, 70);
      manualDownload(fallbackDoc, `JoeScan_Report_${scanType}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (fallbackErr) {
      console.error('Fallback PDF also failed:', fallbackErr);
      alert('PDF generation failed. Please try again.');
    }
  }
};
