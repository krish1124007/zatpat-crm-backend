// Sample-data seed for ZatpatLoans CRM. Idempotent: skips records that already
// exist (matched by a natural key per collection). Run with:
//
//   npm run seed:sample --workspace server
//
// Wipes nothing. To start fresh, drop the DB and re-run /seed + this script.

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Partner from '../models/Partner.js';
import LoanCase from '../models/LoanCase.js';
import Invoice from '../models/Invoice.js';
import Expense from '../models/Expense.js';
import Salary from '../models/Salary.js';
import Insurance from '../models/Insurance.js';
import Contest from '../models/Contest.js';

const lakh = (n) => n * 100000 * 100; // Rs lakh -> paisa
const rupees = (n) => n * 100;

function daysAgo(d) {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}

function daysFromNow(d) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x;
}

async function ensureUsers() {
  const defs = [
    { name: 'Ravi Patel',    email: 'ravi@zatpat.test',    phone: '9000000001', role: 'Manager',  password: 'Test@1234' },
    { name: 'Anjali Mehta',  email: 'anjali@zatpat.test',  phone: '9000000002', role: 'Employee', password: 'Test@1234' },
    { name: 'Vikram Shah',   email: 'vikram@zatpat.test',  phone: '9000000003', role: 'Employee', password: 'Test@1234' },
    { name: 'Priya Desai',   email: 'priya@zatpat.test',   phone: '9000000004', role: 'Employee', password: 'Test@1234' },
  ];
  const out = {};
  for (const d of defs) {
    let u = await User.findOne({ email: d.email });
    if (!u) {
      u = await User.create({ ...d, isActive: true });
      console.log(`  + user ${d.email}`);
    }
    out[d.email] = u;
  }
  return out;
}

async function ensurePartners(creator) {
  const defs = [
    {
      name: 'Andromeda DSA',
      contactPerson: 'Mehul Joshi',
      phone: '9820011111',
      email: 'mehul@andromeda.test',
      gstNumber: '24AAAAA1111A1Z5',
      commissionPercent: 1.5,
      bankDetails: { accountName: 'Andromeda Sales Pvt Ltd', accountNumber: '1234567890', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' },
    },
    {
      name: 'MMK Associates',
      contactPerson: 'Karan Mehta',
      phone: '9820022222',
      email: 'karan@mmk.test',
      gstNumber: '24BBBBB2222B2Z6',
      commissionPercent: 1.25,
      bankDetails: { accountName: 'MMK Associates', accountNumber: '2345678901', ifsc: 'ICIC0002345', bankName: 'ICICI Bank' },
    },
    {
      name: 'Urban Money',
      contactPerson: 'Sneha Roy',
      phone: '9820033333',
      email: 'sneha@urbanmoney.test',
      gstNumber: '24CCCCC3333C3Z7',
      commissionPercent: 1.75,
    },
  ];
  const out = {};
  for (const d of defs) {
    let p = await Partner.findOne({ name: d.name });
    if (!p) {
      p = await Partner.create({ ...d, createdBy: creator?._id });
      console.log(`  + partner ${d.name}`);
    }
    out[d.name] = p;
  }
  return out;
}

async function ensureCases(users) {
  const handlers = [users['anjali@zatpat.test'], users['vikram@zatpat.test'], users['priya@zatpat.test']];
  const pick = (i) => handlers[i % handlers.length];

  const defs = [
    // 1. Fully disbursed with insurance, part payments, franking
    {
      customerName: 'Rakesh Shah', phone: '9898980001', email: 'rakesh.shah@example.com',
      profession: 'Salaried', product: 'HL', propertyType: 'Flat',
      fileNumber: 'ZL-2025-001',
      loanAmount: lakh(45), sanctionedAmount: lakh(42), disbursedAmount: lakh(42),
      roi: 8.5, tenure: 240, bankName: 'HDFC', channelName: 'Zatpat',
      currentStatus: 'Disbursed', disbursementType: 'Part',
      postDisbursementStage: 'PaymentReceived',
      referenceName: 'Mahesh Trivedi', referencePhone: '9876543210',
      loginDate: daysAgo(60), sanctionDate: daysAgo(35), disbursementDate: daysAgo(20),
      insuranceCompany: 'HDFC Life', insuranceAmount: rupees(45000), insurancePolicyNumber: 'HL-TERM-2025-001', insuranceStatus: 'Active',
      documents: { kycDone: true, itrDone: true, bankStatementDone: true, salarySlipDone: true, propertyDocsDone: true },
      paymentReceived: [
        { amount: rupees(25000), mode: 'Bank', date: daysAgo(15), reference: 'NEFT/882211', disbursementNumber: '1st Disb', note: 'First installment consulting fee', gstStatus: 'Received', gstAmount: rupees(4500) },
        { amount: rupees(15000), mode: 'UPI', date: daysAgo(5), reference: 'rakesh@upi', disbursementNumber: '2nd Disb', note: 'Second part payment', gstStatus: 'Pending', gstAmount: rupees(2700) },
      ],
      partDisbursements: [
        { date: daysAgo(20), amount: lakh(25), bankRef: 'HDFC/DISB/001', disbursementNumber: '1st' },
        { date: daysAgo(8), amount: lakh(17), bankRef: 'HDFC/DISB/002', disbursementNumber: '2nd' },
      ],
      frankingNotary: { frankingActual: rupees(2500), notaryActual: rupees(500), amountTakenFromCustomer: rupees(4000), notes: 'Collected at disbursement' },
      loanExpenses: { processingFee: rupees(21000), franking: rupees(2500), notary: rupees(500), legalCharge: rupees(1500), technicalCharge: rupees(1500), insurancePremium: rupees(45000) },
      followUps: [
        { date: daysAgo(40), details: 'Submitted income docs to HDFC RM', nextFollowUpDate: daysAgo(35), nextFollowUpDetails: 'Check sanction status', followUpType: 'FollowUp' },
        { date: daysAgo(25), details: 'Login done with HDFC', followUpType: 'Login' },
        { date: daysAgo(20), details: '1st disbursement to vendor account', nextFollowUpDate: daysAgo(8), nextFollowUpDetails: '2nd part disbursement', followUpType: 'Disbursement' },
        { date: daysAgo(8), details: '2nd part disbursed - full amount released', followUpType: 'Disbursement' },
        { date: daysAgo(5), details: 'Collected 2nd consulting fee via UPI', nextFollowUpDate: daysFromNow(10), nextFollowUpDetails: 'Collect GST payment', followUpType: 'FollowUp' },
      ],
    },
    // 2. Sanctioned, awaiting disbursement
    {
      customerName: 'Neha Patel', phone: '9898980002', email: 'neha.p@example.com',
      profession: 'Salaried', product: 'HL', propertyType: 'Flat',
      fileNumber: 'ZL-2025-002',
      loanAmount: lakh(60), sanctionedAmount: lakh(55), disbursedAmount: 0,
      roi: 8.75, tenure: 300, bankName: 'ICICI', channelName: 'MMK',
      currentStatus: 'Sanctioned',
      referenceName: 'Atul Sharma', referencePhone: '9876543211',
      loginDate: daysAgo(25), sanctionDate: daysAgo(5),
      documents: { kycDone: true, itrDone: true, bankStatementDone: true, salarySlipDone: true },
      followUps: [
        { date: daysAgo(2), details: 'Sanction letter received, awaiting customer signature', nextFollowUpDate: daysFromNow(1), nextFollowUpDetails: 'Collect signed sanction letter', followUpType: 'FollowUp' },
      ],
      offerAfterSanction: { details: 'Loan of Rs 55,00,000 sanctioned at 8.75% for 25 years.', conditions: 'Subject to property valuation and legal clearance.' },
    },
    // 3. Under process
    {
      customerName: 'Suresh Joshi', phone: '9898980003',
      profession: 'Businessman', product: 'LAP', propertyType: 'Commercial Shop',
      fileNumber: 'ZL-2025-003',
      loanAmount: lakh(80), sanctionedAmount: 0, disbursedAmount: 0,
      roi: 0, tenure: 0, bankName: 'Axis', channelName: 'Zatpat',
      currentStatus: 'UnderProcess',
      provisionalBanks: ['Axis', 'HDFC', 'SBI'],
      referenceName: 'Ramesh Patel', referencePhone: '9876543212',
      loginDate: daysAgo(12),
      documents: { kycDone: true, itrDone: true, bankStatementDone: true },
      followUps: [
        { date: daysAgo(7), details: 'CAM under review at Axis credit team', nextFollowUpDate: daysAgo(1), nextFollowUpDetails: 'Push for sanction', followUpType: 'Login' },
      ],
    },
    // 4. Login done
    {
      customerName: 'Kavita Iyer', phone: '9898980004', email: 'kavita.i@example.com',
      profession: 'Professional', product: 'BT', propertyType: 'Bungalow',
      fileNumber: 'ZL-2025-004',
      loanAmount: lakh(35), sanctionedAmount: 0, disbursedAmount: 0,
      bankName: 'Kotak', channelName: 'Andromeda',
      currentStatus: 'LoginDone',
      referenceName: 'Mahesh Trivedi', referencePhone: '9876543210',
      loginDate: daysAgo(4),
      documents: { kycDone: true, itrDone: true },
      followUps: [
        { date: daysAgo(3), details: 'Logged in with Kotak - pending property docs', nextFollowUpDate: daysFromNow(0), nextFollowUpDetails: 'Pickup property papers from customer', followUpType: 'Login' },
      ],
    },
    // 5. Ready login
    {
      customerName: 'Amit Gupta', phone: '9898980005',
      profession: 'Salaried', product: 'HL', propertyType: 'Flat',
      fileNumber: 'ZL-2025-005',
      loanAmount: lakh(28), bankName: 'SBI', channelName: 'Zatpat',
      currentStatus: 'ReadyLogin',
      referenceName: 'Jayesh Modi', referencePhone: '9876543213',
      documents: { kycDone: true, itrDone: false, bankStatementDone: true },
      followUps: [
        { date: daysAgo(1), details: 'Docs almost ready, missing latest 3 ITRs', nextFollowUpDate: daysFromNow(2), nextFollowUpDetails: 'Collect ITR copies', followUpType: 'FollowUp' },
      ],
      offerBeforeProcess: { details: 'Indicative offer Rs28L at ~8.6% for 20 years.', conditions: 'Subject to verification of income and credit profile.' },
    },
    // 6. Fully disbursed with insurance + part payments
    {
      customerName: 'Pooja Sharma', phone: '9898980006', email: 'pooja@example.com',
      profession: 'Salaried', product: 'TOPUP', propertyType: 'Flat',
      fileNumber: 'ZL-2025-006',
      loanAmount: lakh(8), sanctionedAmount: lakh(8), disbursedAmount: lakh(8),
      roi: 9.25, tenure: 60, bankName: 'HDFC', channelName: 'Zatpat',
      currentStatus: 'Disbursed', disbursementType: 'Full',
      postDisbursementStage: 'InvoicePrepared',
      referenceName: 'Ramesh Patel', referencePhone: '9876543212',
      insuranceCompany: 'ICICI Prudential', insuranceAmount: rupees(12000), insurancePolicyNumber: 'IP-TOP-006', insuranceStatus: 'Active',
      loginDate: daysAgo(18), sanctionDate: daysAgo(10), disbursementDate: daysAgo(3),
      documents: { kycDone: true, itrDone: true, bankStatementDone: true, salarySlipDone: true },
      paymentReceived: [
        { amount: rupees(8000), mode: 'UPI', date: daysAgo(2), reference: 'pooja@upi', note: 'Full consulting fee paid', gstStatus: 'Received', gstAmount: rupees(1440) },
      ],
      frankingNotary: { frankingActual: rupees(800), notaryActual: rupees(200), amountTakenFromCustomer: rupees(1200), notes: 'Taken at sanction time' },
      loanExpenses: { processingFee: rupees(4000), franking: rupees(800), insurancePremium: rupees(12000) },
    },
    // 7. Query stage
    {
      customerName: 'Manish Trivedi', phone: '9898980007',
      profession: 'Businessman', product: 'ML',
      fileNumber: 'ZL-2025-007',
      loanAmount: lakh(15), bankName: 'IDFC', channelName: 'MMK',
      currentStatus: 'Query',
      referenceName: 'Jayesh Modi', referencePhone: '9876543213',
      followUps: [
        { date: daysAgo(0), details: 'Asked about ML eligibility, GST returns required', nextFollowUpDate: daysFromNow(3), nextFollowUpDetails: 'Collect GST returns', followUpType: 'FollowUp' },
      ],
    },
    // 8. On hold
    {
      customerName: 'Smita Rao', phone: '9898980008',
      profession: 'Salaried', product: 'HL', propertyType: 'Row House',
      fileNumber: 'ZL-2025-008',
      loanAmount: lakh(50), bankName: 'Bank of Baroda', channelName: 'Zatpat',
      currentStatus: 'Hold',
      referenceName: 'Mahesh Trivedi', referencePhone: '9876543210',
      followUps: [
        { date: daysAgo(8), details: 'On hold - customer changed job, needs 3 month payslips', nextFollowUpDate: daysFromNow(20), nextFollowUpDetails: 'Re-check after probation', followUpType: 'FollowUp' },
      ],
    },
    // 9. Disbursed Part - for Part Payments view
    {
      customerName: 'Dinesh Kapoor', phone: '9898980009', email: 'dinesh.k@example.com',
      profession: 'Businessman', product: 'LAP', propertyType: 'Commercial Office',
      fileNumber: 'ZL-2025-009',
      loanAmount: lakh(120), sanctionedAmount: lakh(110), disbursedAmount: lakh(75),
      roi: 9.0, tenure: 180, bankName: 'Axis', channelName: 'Zatpat',
      currentStatus: 'Disbursed', disbursementType: 'Part',
      postDisbursementStage: 'BankConfirmationPending',
      referenceName: 'Atul Sharma', referencePhone: '9876543211',
      insuranceCompany: 'LIC', insuranceAmount: rupees(65000), insurancePolicyNumber: 'LIC-LAP-009', insuranceStatus: 'Pending',
      loginDate: daysAgo(45), sanctionDate: daysAgo(30), disbursementDate: daysAgo(15),
      documents: { kycDone: true, itrDone: true, bankStatementDone: true, propertyDocsDone: true, gstReturnDone: true },
      paymentReceived: [
        { amount: rupees(40000), mode: 'Bank', date: daysAgo(12), reference: 'NEFT/112233', disbursementNumber: '1st Disb', note: 'Consulting fee for 1st disbursement', gstStatus: 'Received', gstAmount: rupees(7200) },
        { amount: rupees(20000), mode: 'Cheque', date: daysAgo(3), reference: 'CHQ/445566', disbursementNumber: '2nd Disb', note: 'Partial fee - balance pending', gstStatus: 'Pending', gstAmount: rupees(3600), shortfall: rupees(5000), shortfallReason: 'Customer requested adjustment' },
      ],
      partDisbursements: [
        { date: daysAgo(15), amount: lakh(50), bankRef: 'AXIS/DISB/101', disbursementNumber: '1st' },
        { date: daysAgo(5), amount: lakh(25), bankRef: 'AXIS/DISB/102', disbursementNumber: '2nd' },
      ],
      frankingNotary: { frankingActual: rupees(5000), notaryActual: rupees(1000), otherChargesLabel: 'Stamp Duty', otherChargesActual: rupees(3000), amountTakenFromCustomer: rupees(12000), notes: 'Excess collected, to refund Rs 3000' },
      loanExpenses: { processingFee: rupees(55000), franking: rupees(5000), notary: rupees(1000), stampDuty: rupees(3000), legalCharge: rupees(3500), technicalCharge: rupees(2500), insurancePremium: rupees(65000) },
      followUps: [
        { date: daysAgo(30), details: 'Sanction received from Axis', followUpType: 'FollowUp' },
        { date: daysAgo(15), details: '1st disbursement Rs 50L released', followUpType: 'Disbursement' },
        { date: daysAgo(5), details: '2nd disbursement Rs 25L released, remaining Rs 35L pending construction', nextFollowUpDate: daysFromNow(30), nextFollowUpDetails: '3rd disbursement on construction milestone', followUpType: 'Disbursement' },
      ],
    },
    // 10. Bank Finalized
    {
      customerName: 'Reena Deshmukh', phone: '9898980010',
      profession: 'Salaried', product: 'HL', propertyType: 'Flat',
      fileNumber: 'ZL-2025-010',
      loanAmount: lakh(32), bankName: 'HDFC', channelName: 'Urban Money',
      currentStatus: 'BankFinalized',
      referenceName: 'Atul Sharma', referencePhone: '9876543211',
      provisionalBanks: ['HDFC', 'ICICI'],
      bankUserId: 'REENA_HDFC_2025', bankPassword: 'H3dfc@2025',
      loginDate: daysAgo(15),
      documents: { kycDone: true, itrDone: true, bankStatementDone: true, salarySlipDone: true, form16Done: true },
      followUps: [
        { date: daysAgo(3), details: 'HDFC finalized, better rate than ICICI. Proceeding with HDFC.', nextFollowUpDate: daysFromNow(2), nextFollowUpDetails: 'Submit additional docs', followUpType: 'FollowUp' },
      ],
    },
    // 11. Rejected
    {
      customerName: 'Rajiv Kumar', phone: '9898980011',
      profession: 'Businessman', product: 'ML',
      loanAmount: lakh(20), bankName: 'Yes Bank', channelName: 'Zatpat',
      currentStatus: 'Rejected',
      referenceName: 'Nitin Bhatt', referencePhone: '9876543214',
      followUps: [
        { date: daysAgo(10), details: 'Rejected due to low CIBIL score (620)', followUpType: 'FollowUp' },
      ],
    },
    // 12. Not Interested
    {
      customerName: 'Seema Jain', phone: '9898980012',
      profession: 'Professional', product: 'HL', propertyType: 'Plot',
      loanAmount: lakh(25), bankName: 'Kotak', channelName: '4B Network',
      currentStatus: 'NotInterested',
      referenceName: 'Nitin Bhatt', referencePhone: '9876543214',
      followUps: [
        { date: daysAgo(5), details: 'Customer found direct deal with bank, not interested in our services', followUpType: 'FollowUp' },
      ],
    },
  ];

  const out = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    let c = await LoanCase.findOne({ phone: d.phone, customerName: d.customerName });
    if (!c) {
      c = await LoanCase.create({ ...d, handledBy: pick(i)._id });
      console.log(`  + case #${c.srNo} ${d.customerName}`);
    }
    out.push(c);
  }
  return out;
}

async function ensureInvoices(cases, partners) {
  const disbursed = cases.filter((c) => c.currentStatus === 'Disbursed');
  const partnerArr = Object.values(partners);

  for (let i = 0; i < disbursed.length; i++) {
    const c = disbursed[i];
    const partner = partnerArr[i % partnerArr.length];
    const exists = await Invoice.findOne({ loanCase: c._id });
    if (exists) continue;

    const base = c.disbursedAmount || c.sanctionedAmount || 0;
    const amount = Math.round((base * (partner.commissionPercent || 1)) / 100);

    const inv = await Invoice.create({
      partner: partner._id,
      loanCase: c._id,
      date: new Date(c.disbursementDate || Date.now()),
      amount,
      gstRate: 18,
      status: i === 0 ? 'Paid' : 'Pending',
      payment: i === 0
        ? { paidDate: daysAgo(2), mode: 'Bank', reference: 'NEFT/553311', amount }
        : undefined,
      snapshot: {
        customerName: c.customerName,
        bankName: c.bankName,
        product: c.product,
        loanAmount: c.loanAmount,
        disbursedAmount: c.disbursedAmount,
        partnerName: partner.name,
        partnerGST: partner.gstNumber,
      },
    });
    console.log(`  + invoice ${inv.invoiceNo} for ${c.customerName}`);
  }
}

async function ensureExpenses(creator) {
  const defs = [
    { date: daysAgo(1),  category: 'Petrol',     amount: rupees(800),  description: 'Bike fuel for client visits', paymentType: 'Cash' },
    { date: daysAgo(2),  category: 'Tea',        amount: rupees(150),  description: 'Office tea & snacks', paymentType: 'Cash' },
    { date: daysAgo(3),  category: 'Stationary', amount: rupees(620),  description: 'A4 sheets, files, pens', paymentType: 'UPI' },
    { date: daysAgo(5),  category: 'Franking',   amount: rupees(1200), description: 'Franking - Rakesh Shah HL', paymentType: 'Bank' },
    { date: daysAgo(8),  category: 'Notary',     amount: rupees(500),  description: 'Notary stamps', paymentType: 'Cash' },
    { date: daysAgo(10), category: 'Travel',     amount: rupees(2400), description: 'Cab to ICICI RO', paymentType: 'UPI' },
    { date: daysAgo(12), category: 'Marketing',  amount: rupees(5000), description: 'Pamphlet printing', paymentType: 'Bank' },
    { date: daysAgo(15), category: 'Franking',   amount: rupees(5000), description: 'Franking - Dinesh Kapoor LAP', paymentType: 'Bank' },
    { date: daysAgo(16), category: 'Notary',     amount: rupees(1000), description: 'Notary - Dinesh Kapoor LAP', paymentType: 'Cash' },
  ];
  for (const d of defs) {
    const exists = await Expense.findOne({ date: d.date, category: d.category, amount: d.amount });
    if (exists) continue;
    await Expense.create({ ...d, paidBy: creator?._id, createdBy: creator?._id });
    console.log(`  + expense ${d.category} ${d.amount/100}`);
  }
}

async function ensureSalaries(users) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const defs = [
    { who: 'anjali@zatpat.test', basicSalary: rupees(25000), allowances: rupees(3000), incentiveAmount: rupees(5000), incentiveDetails: '5 disbursed cases' },
    { who: 'vikram@zatpat.test', basicSalary: rupees(22000), allowances: rupees(2500), incentiveAmount: rupees(1000), incentiveDetails: '1 disbursed case' },
    { who: 'priya@zatpat.test',  basicSalary: rupees(20000), allowances: rupees(2000), incentiveAmount: 0,            incentiveDetails: '' },
  ];
  for (const d of defs) {
    const u = users[d.who];
    if (!u) continue;
    const exists = await Salary.findOne({ employee: u._id, month, year });
    if (exists) continue;
    await Salary.create({
      employee: u._id, month, year,
      basicSalary: d.basicSalary, allowances: d.allowances,
      deductions: 0, incentiveAmount: d.incentiveAmount, incentiveDetails: d.incentiveDetails,
      paymentMode: 'Bank',
    });
    console.log(`  + salary ${u.name} ${month}/${year}`);
  }
}

async function ensureInsurance(creator) {
  const defs = [
    { customerName: 'Rakesh Shah',  phone: '9898980001', type: 'Term',     insurer: 'HDFC Life',  policyNumber: 'HL-TERM-001', sumAssured: lakh(100), premium: rupees(18000), commission: rupees(4500), startDate: daysAgo(15), renewalDate: daysFromNow(350), status: 'Active' },
    { customerName: 'Pooja Sharma', phone: '9898980006', type: 'Health',   insurer: 'Star Health', policyNumber: 'SH-HLT-022',  sumAssured: lakh(10),  premium: rupees(12000), commission: rupees(2400), startDate: daysAgo(60), renewalDate: daysFromNow(20),  status: 'Active' },
    { customerName: 'Kavita Iyer',  phone: '9898980004', type: 'Life',     insurer: 'LIC',         policyNumber: '',            sumAssured: lakh(25),  premium: rupees(15000), commission: 0,            status: 'Quoted' },
    { customerName: 'Amit Gupta',   phone: '9898980005', type: 'Vehicle',  insurer: 'Bajaj Allianz', policyNumber: 'BA-VEH-09', sumAssured: lakh(8),   premium: rupees(7800),  commission: rupees(1200), startDate: daysAgo(180), renewalDate: daysFromNow(180), status: 'Active' },
  ];
  for (const d of defs) {
    const exists = await Insurance.findOne({ customerName: d.customerName, type: d.type });
    if (exists) continue;
    await Insurance.create({ ...d, createdBy: creator?._id });
    console.log(`  + policy ${d.customerName} (${d.type})`);
  }
}

async function ensureContests(users, creator) {
  const exists = await Contest.findOne({ name: 'Q4 Sprint - Disbursed Cases' });
  if (exists) return;
  const participants = ['anjali@zatpat.test', 'vikram@zatpat.test', 'priya@zatpat.test']
    .map((e) => users[e]?._id)
    .filter(Boolean);

  await Contest.create({
    name: 'Q4 Sprint - Disbursed Cases',
    description: 'Top closer for the quarter wins!',
    startDate: daysAgo(60),
    endDate: daysFromNow(30),
    metric: 'DisbursedCount',
    target: 15,
    participants,
    prizes: [
      { rank: 1, title: 'Champion',    rewardAmount: rupees(15000) },
      { rank: 2, title: 'Runner-up',   rewardAmount: rupees(7500) },
      { rank: 3, title: 'Third Place', rewardAmount: rupees(3000) },
    ],
    status: 'Active',
    createdBy: creator?._id,
  });
  console.log('  + contest Q4 Sprint');
}

async function run() {
  await connectDB();
  console.log('[seed:sample] starting...');

  const superAdmin = await User.findOne({ role: 'SuperAdmin' });
  if (!superAdmin) {
    console.error('[seed:sample] no SuperAdmin found - run `npm run seed` first.');
    process.exit(1);
  }

  console.log('[seed:sample] users...');
  const users = await ensureUsers();

  console.log('[seed:sample] partners...');
  const partners = await ensurePartners(superAdmin);

  console.log('[seed:sample] cases...');
  const cases = await ensureCases(users);

  console.log('[seed:sample] invoices...');
  await ensureInvoices(cases, partners);

  console.log('[seed:sample] expenses...');
  await ensureExpenses(superAdmin);

  console.log('[seed:sample] salaries...');
  await ensureSalaries(users);

  console.log('[seed:sample] insurance...');
  await ensureInsurance(superAdmin);

  console.log('[seed:sample] contests...');
  await ensureContests(users, superAdmin);

  console.log('[seed:sample] done.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed:sample] failed:', err);
  process.exit(1);
});
