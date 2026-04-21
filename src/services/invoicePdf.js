import PDFDocument from 'pdfkit';
import { formatINR, formatDate } from '../utils/format.js';

// Streams a tax-invoice PDF for the given populated invoice document into the response.
export function streamInvoicePDF(invoice, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${invoice.invoiceNo.replace(/\//g, '-')}.pdf"`
  );
  doc.pipe(res);

  // ── Header ──────────────────────────────────────────────────────────────
  doc
    .fontSize(20)
    .fillColor('#1e40af')
    .text('ZatpatLoans', { align: 'left' })
    .fontSize(9)
    .fillColor('#475569')
    .text('Loan Consulting Services · Ahmedabad, Gujarat')
    .moveDown(0.5);

  doc
    .fontSize(16)
    .fillColor('#0f172a')
    .text('TAX INVOICE', { align: 'right' })
    .moveDown(0.2);

  doc
    .fontSize(10)
    .fillColor('#334155')
    .text(`Invoice No: ${invoice.invoiceNo}`, { align: 'right' })
    .text(`Date: ${formatDate(invoice.date)}`, { align: 'right' })
    .text(`FY: ${invoice.financialYear || ''}`, { align: 'right' })
    .moveDown(1);

  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cbd5e1').stroke().moveDown(0.7);

  // ── Bill To ─────────────────────────────────────────────────────────────
  const partnerName = invoice.partner?.name || invoice.snapshot?.partnerName || '—';
  const partnerGST = invoice.partner?.gstNumber || invoice.snapshot?.partnerGST || '';

  doc
    .fontSize(10)
    .fillColor('#64748b')
    .text('BILL TO', { continued: false })
    .moveDown(0.2)
    .fontSize(12)
    .fillColor('#0f172a')
    .text(partnerName);

  if (partnerGST) {
    doc.fontSize(9).fillColor('#475569').text(`GSTIN: ${partnerGST}`);
  }
  if (invoice.partner?.email) doc.text(invoice.partner.email);
  if (invoice.partner?.phone) doc.text(invoice.partner.phone);

  doc.moveDown(1);

  // ── Case reference ──────────────────────────────────────────────────────
  if (invoice.snapshot?.customerName) {
    doc.fontSize(9).fillColor('#64748b').text('CASE REFERENCE');
    doc
      .fontSize(10)
      .fillColor('#0f172a')
      .text(
        `${invoice.snapshot.customerName} · ${invoice.snapshot.bankName || ''} · ${
          invoice.snapshot.product || ''
        }`
      );
    if (invoice.snapshot.disbursedAmount) {
      doc
        .fontSize(9)
        .fillColor('#475569')
        .text(`Disbursed: ${formatINR(invoice.snapshot.disbursedAmount)}`);
    }
    doc.moveDown(0.8);
  }

  // ── Line items table ────────────────────────────────────────────────────
  const tableTop = doc.y + 5;
  const colDesc = 50;
  const colAmt = 450;

  doc
    .rect(50, tableTop, 495, 22)
    .fillColor('#f1f5f9')
    .fill()
    .fillColor('#0f172a')
    .fontSize(10)
    .text('Description', colDesc + 8, tableTop + 6)
    .text('Amount', colAmt, tableTop + 6, { width: 87, align: 'right' });

  let y = tableTop + 30;
  doc
    .fillColor('#334155')
    .text(
      `Commission for ${invoice.snapshot?.customerName || 'loan case'}`,
      colDesc + 8,
      y,
      { width: 380 }
    )
    .text(formatINR(invoice.amount), colAmt, y, { width: 87, align: 'right' });

  y += 30;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
  y += 8;

  // ── Totals block ────────────────────────────────────────────────────────
  const labelX = 360;
  const valueX = 450;
  const totalLine = (label, value, opts = {}) => {
    doc
      .fontSize(10)
      .fillColor(opts.bold ? '#0f172a' : '#475569')
      .text(label, labelX, y, { width: 90, align: 'right' })
      .text(value, valueX, y, { width: 87, align: 'right' });
    y += opts.bold ? 18 : 16;
  };

  totalLine('Subtotal', formatINR(invoice.amount));
  totalLine(`GST (${invoice.gstRate}%)`, formatINR(invoice.gstAmount));
  doc.moveTo(labelX, y).lineTo(545, y).strokeColor('#cbd5e1').stroke();
  y += 6;
  totalLine('TOTAL', formatINR(invoice.totalAmount), { bold: true });

  // ── Footer ──────────────────────────────────────────────────────────────
  doc
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      `Status: ${invoice.status}${invoice.notes ? `   ·   ${invoice.notes}` : ''}`,
      50,
      720,
      { width: 495, align: 'center' }
    )
    .text('This is a system-generated invoice.', { align: 'center' });

  doc.end();
}
