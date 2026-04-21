import PDFDocument from 'pdfkit';
import { formatINR, formatDate } from '../utils/format.js';

// Shared header chrome — used by both expense sheet & offer letter PDFs.
function header(doc, title) {
  doc
    .fontSize(20)
    .fillColor('#1e40af')
    .text('ZatpatLoans', 50, 50, { align: 'left' })
    .fontSize(9)
    .fillColor('#475569')
    .text('Loan Consulting Services · Ahmedabad, Gujarat');

  doc
    .fontSize(16)
    .fillColor('#0f172a')
    .text(title, 50, 50, { align: 'right' });

  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#cbd5e1').stroke();
  doc.y = 115;
}

function customerBlock(doc, c) {
  doc
    .fontSize(9)
    .fillColor('#64748b')
    .text('CUSTOMER')
    .fontSize(12)
    .fillColor('#0f172a')
    .text(c.customerName);
  doc
    .fontSize(9)
    .fillColor('#475569')
    .text(`${c.phone || ''}${c.email ? ' · ' + c.email : ''}`)
    .text(`Case #${c.srNo} · ${c.product || ''}`);
  doc.moveDown(0.8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loan Expense Sheet PDF — itemizes processingFee, insurance, franking, etc.
// Useful as a customer-facing breakdown of all charges on a loan.
// ─────────────────────────────────────────────────────────────────────────────

const EXPENSE_LABELS = {
  processingFee: 'Processing Fee',
  insurancePremium: 'Insurance Premium',
  franking: 'Franking Charges',
  notary: 'Notary Charges',
  stampDuty: 'Stamp Duty',
  legalCharge: 'Legal Charges',
  technicalCharge: 'Technical Charges',
};

export function streamExpenseSheetPDF(loanCase, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="expense-sheet-${loanCase.srNo}.pdf"`
  );
  doc.pipe(res);

  header(doc, 'LOAN EXPENSE SHEET');
  customerBlock(doc, loanCase);

  // Loan summary band
  doc
    .fontSize(9)
    .fillColor('#64748b')
    .text('LOAN DETAILS');
  doc
    .fontSize(10)
    .fillColor('#0f172a')
    .text(
      `${loanCase.bankName || '—'} · ${loanCase.product || ''}` +
        `   ·   Sanctioned: ${formatINR(loanCase.sanctionedAmount)}` +
        `   ·   Disbursed: ${formatINR(loanCase.disbursedAmount)}`
    );
  doc.moveDown(0.8);

  // Itemized expenses table
  const tableTop = doc.y + 5;
  doc
    .rect(50, tableTop, 495, 22)
    .fillColor('#f1f5f9')
    .fill()
    .fillColor('#0f172a')
    .fontSize(10)
    .text('Item', 58, tableTop + 6)
    .text('Amount (₹)', 450, tableTop + 6, { width: 87, align: 'right' });

  let y = tableTop + 30;
  doc.fontSize(10).fillColor('#334155');

  const expenses = loanCase.loanExpenses || {};
  let total = 0;

  for (const [key, label] of Object.entries(EXPENSE_LABELS)) {
    const amt = expenses[key] || 0;
    if (amt === 0) continue;
    doc.fillColor('#334155').text(label, 58, y, { width: 380 });
    doc.text(formatINR(amt), 450, y, { width: 87, align: 'right' });
    total += amt;
    y += 18;
  }

  // Other expenses array
  for (const item of expenses.otherExpenses || []) {
    if (!item.amount) continue;
    doc.fillColor('#334155').text(item.label || 'Other', 58, y, { width: 380 });
    doc.text(formatINR(item.amount), 450, y, { width: 87, align: 'right' });
    total += item.amount || 0;
    y += 18;
  }

  if (total === 0) {
    doc
      .fillColor('#94a3b8')
      .text('No expenses recorded for this case yet.', 58, y);
    y += 18;
  }

  // Total
  y += 8;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#cbd5e1').stroke();
  y += 10;
  doc
    .fontSize(11)
    .fillColor('#0f172a')
    .text('TOTAL EXPENSES', 360, y, { width: 90, align: 'right' })
    .text(formatINR(total), 450, y, { width: 87, align: 'right' });

  // Footer disclaimer
  doc
    .fontSize(8)
    .fillColor('#64748b')
    .text(
      'This sheet itemizes the charges associated with your loan. ' +
        'All amounts are inclusive of applicable taxes unless stated otherwise.',
      50,
      740,
      { width: 495, align: 'center' }
    );

  doc.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer Letter PDF — for ReadyLogin / Sanctioned cases.
// Pulls from offerBeforeProcess or offerAfterSanction depending on stage.
// ─────────────────────────────────────────────────────────────────────────────

export function streamOfferLetterPDF(loanCase, stage, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="offer-${loanCase.srNo}-${stage}.pdf"`
  );
  doc.pipe(res);

  const isAfter = stage === 'after';
  const offer = isAfter ? loanCase.offerAfterSanction : loanCase.offerBeforeProcess;
  const titleSuffix = isAfter ? 'POST-SANCTION' : 'PRE-PROCESS';

  header(doc, `LOAN OFFER · ${titleSuffix}`);
  customerBlock(doc, loanCase);

  doc
    .fontSize(11)
    .fillColor('#0f172a')
    .text(`Dear ${loanCase.customerName},`);
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor('#334155')
    .text(
      isAfter
        ? `We are pleased to inform you that your loan application with ${
            loanCase.bankName || 'the lender'
          } has been sanctioned. Below are the key terms of your offer:`
        : `Based on the documents you have shared, we are pleased to extend the following indicative offer for your ${
            loanCase.product || 'loan'
          } from ${loanCase.bankName || 'the lender'}:`,
      { align: 'justify' }
    );
  doc.moveDown(0.8);

  // Terms table
  const rows = [
    ['Bank / Lender', loanCase.bankName || '—'],
    ['Product', loanCase.product || '—'],
    ['Loan Amount', formatINR(loanCase.loanAmount)],
    ['Sanctioned Amount', formatINR(loanCase.sanctionedAmount)],
    ['Rate of Interest', loanCase.roi ? `${loanCase.roi}% p.a.` : '—'],
    ['Tenure', loanCase.tenure ? `${loanCase.tenure} months` : '—'],
    ['Sanction Date', formatDate(loanCase.sanctionDate)],
  ];

  let y = doc.y;
  for (const [k, v] of rows) {
    doc
      .fontSize(10)
      .fillColor('#64748b')
      .text(k, 60, y, { width: 180 })
      .fillColor('#0f172a')
      .text(v, 250, y, { width: 280 });
    y += 18;
  }

  doc.y = y + 10;

  if (offer?.details) {
    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text('OFFER DETAILS')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(offer.details, { align: 'justify' });
    doc.moveDown(0.5);
  }

  if (offer?.conditions) {
    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text('CONDITIONS')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(offer.conditions, { align: 'justify' });
    doc.moveDown(0.5);
  }

  doc.moveDown(1);
  doc
    .fontSize(10)
    .fillColor('#334155')
    .text(
      'This offer is indicative and subject to final verification, document submission, ' +
        'and approval by the lending bank. Charges and conditions may vary as per the bank\'s policies.',
      { align: 'justify' }
    );

  doc.moveDown(2);
  doc
    .fontSize(10)
    .fillColor('#0f172a')
    .text('Warm regards,')
    .text('Team ZatpatLoans')
    .fontSize(8)
    .fillColor('#64748b')
    .text('Ahmedabad, Gujarat');

  doc
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(
      `Generated on ${formatDate(new Date())} · Case #${loanCase.srNo}`,
      50,
      770,
      { width: 495, align: 'center' }
    );

  doc.end();
}
