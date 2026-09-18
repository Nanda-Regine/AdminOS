/**
 * Shared bits for the self-contained printable-HTML documents (payslips,
 * invoices, receipts, ...). Each document still owns its full template —
 * this only factors out the pieces that must stay identical across all of
 * them: XSS escaping and the print/screen shell.
 */

export function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A4 print rules + screen preview shell, shared by every generated document. */
export const DOC_PRINT_CSS = `
  @media print {
    body { padding: 0; }
    .doc { border: none; box-shadow: none; }
    @page { size: A4; margin: 20mm; }
  }
  @media screen { body { background: #eee; } .doc { box-shadow: 0 2px 12px rgba(0,0,0,0.12); } }
`
