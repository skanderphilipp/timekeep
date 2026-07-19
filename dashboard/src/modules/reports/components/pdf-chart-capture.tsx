import { type ReactNode } from "react";

/**
 * PDF chart capture wrapper.
 *
 * Wraps a chart section in a <div> with data-pdf-chart attributes
 * so the PDF export can query and capture chart SVGs via html2canvas.
 * This is a functional wrapper (not visual) — the raw <div> is intentional.
 */

/* oxlint-disable-next-line bentech/no-raw-html-elements -- functional wrapper for PDF chart capture */
export function PdfChartCapture({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      data-pdf-chart={id}
      data-pdf-chart-title={title}
      data-pdf-chart-description={description}
    >
      {children}
    </div>
  );
}
