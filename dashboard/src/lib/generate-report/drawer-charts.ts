import type { jsPDF } from "jspdf";
import { LIGHT_GRAY, BORDER_COLOR, WHITE, MARGIN, CONTENT_WIDTH } from "./constants";
import type { ChartImage } from "./types";

// ── Chart Sections ────────────────────────────────────────────────────────────

/**
 * Draw chart images in a 2-up grid on landscape A4.
 *
 * The chart images are captured via html2canvas from the live Nivo chart
 * containers. They already include the chart title, description, and the
 * rendered SVG — so we only add a subtle card border around each image,
 * without duplicating the title text.
 */
export function drawChartSections(
  doc: jsPDF,
  charts: ChartImage[],
  startY: number,
): number {
  const cardWidth = (CONTENT_WIDTH - 8) / 2;
  // Chart images are captured at their on-screen aspect ratio (typically ~16:10)
  const cardHeight = cardWidth * 0.72;
  let rowY = startY;

  for (let i = 0; i < charts.length; i += 2) {
    const left = charts[i];
    const right = charts[i + 1];

    // Page break if needed
    if (rowY + cardHeight + 14 > doc.internal.pageSize.height - MARGIN - 14) {
      doc.addPage();
      rowY = MARGIN;
    }

    if (left) drawChartCard(doc, left, MARGIN, rowY, cardWidth, cardHeight);
    if (right) drawChartCard(doc, right, MARGIN + cardWidth + 8, rowY, cardWidth, cardHeight);

    rowY += cardHeight + 12;
  }

  return rowY;
}

// ── Single Chart Card ─────────────────────────────────────────────────────────

function drawChartCard(
  doc: jsPDF,
  chart: ChartImage,
  x: number,
  y: number,
  cardWidth: number,
  cardHeight: number,
): void {
  // Card background + border
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");

  // Chart image (fills the card with a small inner padding)
  const pad = 3;
  const imgW = cardWidth - pad * 2;
  const imgH = cardHeight - pad * 2;

  try {
    doc.addImage(chart.dataUrl, "PNG", x + pad, y + pad, imgW, imgH);
  } catch {
    // Graceful fallback if image data is corrupted
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT_GRAY);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Chart unavailable",
      x + cardWidth / 2,
      y + cardHeight / 2,
      { align: "center" },
    );
  }
}
