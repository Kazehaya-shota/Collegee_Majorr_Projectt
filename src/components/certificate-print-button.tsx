'use client';

export function CertificatePrintButton() {
  return <button type="button" className="certificate-print-button" onClick={() => window.print()}>
    Print or save as PDF
  </button>;
}
