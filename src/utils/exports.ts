import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  AppSettings,
  BackupPayload,
  Customer,
  Expense,
  Transaction,
} from '../types.ts';
import {
  formatCurrency,
  formatDateDisplay,
  summarizePeriod,
} from './calculations.ts';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportTransactionsCsv(
  transactions: Transaction[],
  settings: AppSettings,
  filename = 'sehat-ki-duniya-transactions.csv',
): void {
  const headers = [
    'Serial No',
    'Date',
    'Time',
    'VPL Number',
    'Customer Name',
    'Mobile Number',
    'Address',
    `Real Amount (${settings.currency})`,
    `Invoice Amount (${settings.currency})`,
    `Profit (${settings.currency})`,
    `Parcel (${settings.currency})`,
    `Vasool (${settings.currency})`,
    `Naffa Vasool (${settings.currency})`,
    `Remaining Amount (${settings.currency})`,
    'Remarks',
  ];
  const rows = transactions.map((tx) =>
    [
      tx.serialNumber,
      tx.date,
      tx.time,
      tx.vplNumber,
      tx.customerName,
      tx.mobileNumber,
      tx.address,
      tx.realAmount,
      tx.invoiceAmount,
      tx.profit,
      tx.parcelCharges,
      tx.vasool,
      tx.naffaVasool,
      tx.remainingAmount,
      tx.remarks,
    ]
      .map(escapeCsv)
      .join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportExpensesCsv(
  expenses: Expense[],
  settings: AppSettings,
  filename = 'sehat-ki-duniya-expenses.csv',
): void {
  const headers = [
    'Expense No',
    'Date',
    'Time',
    'Category',
    'Description',
    `Amount (${settings.currency})`,
    'Payment Method',
  ];
  const rows = expenses.map((e) =>
    [e.expenseNumber, e.date, e.time, e.category, e.description, e.amount, e.paymentMethod]
      .map(escapeCsv)
      .join(','),
  );
  const csv = [headers.join(','), ...rows].join('\n');
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportDailyReportExcel(
  date: string,
  transactions: Transaction[],
  expenses: Expense[],
  settings: AppSettings,
): void {
  const summary = summarizePeriod(transactions, expenses);
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metric: 'Report Date', Value: formatDateDisplay(date, settings.dateFormat) },
    { Metric: 'Total Daily Entries', Value: summary.entryCount },
    { Metric: 'Daily Invoice Amount', Value: summary.invoiceAmount },
    { Metric: 'Daily Real Amount', Value: summary.realAmount },
    { Metric: 'Daily Parcel Charges', Value: summary.parcelCharges },
    { Metric: 'Daily Collected Amount (Vasool)', Value: summary.vasool },
    { Metric: 'Daily Outstanding Amount', Value: summary.remainingAmount },
    { Metric: 'Daily Total Profit', Value: summary.grossProfit },
    { Metric: 'Daily Collected Profit (Naffa Vasool)', Value: summary.collectedProfit },
    { Metric: 'Daily Expenses', Value: summary.expenses },
    { Metric: 'Daily Net Profit', Value: summary.netProfit },
    { Metric: 'Currency', Value: settings.currency },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Daily Summary');

  const txSheet = XLSX.utils.json_to_sheet(
    transactions.map((tx) => ({
      'Serial No': tx.serialNumber,
      Date: tx.date,
      Time: tx.time,
      'VPL No': tx.vplNumber,
      Customer: tx.customerName,
      Mobile: tx.mobileNumber,
      Address: tx.address,
      'Real Amount': tx.realAmount,
      'Invoice Amount': tx.invoiceAmount,
      Profit: tx.profit,
      Parcel: tx.parcelCharges,
      Vasool: tx.vasool,
      'Naffa Vasool': tx.naffaVasool,
      Remaining: tx.remainingAmount,
      Remarks: tx.remarks,
    })),
  );
  XLSX.utils.book_append_sheet(wb, txSheet, 'Transactions');

  const expSheet = XLSX.utils.json_to_sheet(
    expenses.map((e) => ({
      'Expense No': e.expenseNumber,
      Date: e.date,
      Time: e.time,
      Category: e.category,
      Description: e.description,
      Amount: e.amount,
      'Payment Method': e.paymentMethod,
    })),
  );
  XLSX.utils.book_append_sheet(wb, expSheet, 'Expenses');

  XLSX.writeFile(wb, `SehatKiDuniya-Daily-Report-${date}.xlsx`);
}

export function exportMonthlyReportExcel(
  monthLabel: string,
  transactions: Transaction[],
  expenses: Expense[],
  settings: AppSettings,
): void {
  const summary = summarizePeriod(transactions, expenses);
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metric: 'Period', Value: monthLabel },
    { Metric: 'Total Monthly Entries', Value: summary.entryCount },
    { Metric: 'Monthly Invoice Amount', Value: summary.invoiceAmount },
    { Metric: 'Monthly Real Amount', Value: summary.realAmount },
    { Metric: 'Monthly Parcel Charges', Value: summary.parcelCharges },
    { Metric: 'Monthly Collection (Vasool)', Value: summary.vasool },
    { Metric: 'Monthly Remaining Balance', Value: summary.remainingAmount },
    { Metric: 'Monthly Gross Profit', Value: summary.grossProfit },
    { Metric: 'Monthly Collected Profit', Value: summary.collectedProfit },
    { Metric: 'Monthly Expenses', Value: summary.expenses },
    { Metric: 'Monthly Net Profit', Value: summary.netProfit },
    { Metric: 'Currency', Value: settings.currency },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Monthly Summary');

  const txSheet = XLSX.utils.json_to_sheet(
    transactions.map((tx) => ({
      'Serial No': tx.serialNumber,
      Date: tx.date,
      Time: tx.time,
      'VPL No': tx.vplNumber,
      Customer: tx.customerName,
      Mobile: tx.mobileNumber,
      'Real Amount': tx.realAmount,
      'Invoice Amount': tx.invoiceAmount,
      Profit: tx.profit,
      Parcel: tx.parcelCharges,
      Vasool: tx.vasool,
      'Naffa Vasool': tx.naffaVasool,
      Remaining: tx.remainingAmount,
      Remarks: tx.remarks,
    })),
  );
  XLSX.utils.book_append_sheet(wb, txSheet, 'Monthly Transactions');

  const expSheet = XLSX.utils.json_to_sheet(
    expenses.map((e) => ({
      'Expense No': e.expenseNumber,
      Date: e.date,
      Category: e.category,
      Description: e.description,
      Amount: e.amount,
      'Payment Method': e.paymentMethod,
    })),
  );
  XLSX.utils.book_append_sheet(wb, expSheet, 'Monthly Expenses');

  XLSX.writeFile(wb, `SehatKiDuniya-Monthly-Report-${monthLabel.replace(/\s+/g, '-')}.xlsx`);
}

export function exportCustomerLedgerExcel(
  customer: Customer,
  transactions: Transaction[],
  settings: AppSettings,
): void {
  const summary = summarizePeriod(transactions, []);
  const wb = XLSX.utils.book_new();

  const infoSheet = XLSX.utils.json_to_sheet([
    { Field: 'Customer Name', Value: customer.name },
    { Field: 'Mobile Number', Value: customer.mobileNumber },
    { Field: 'Address', Value: customer.address },
    { Field: 'Total Orders', Value: summary.entryCount },
    { Field: 'Total Invoice Amount', Value: summary.invoiceAmount },
    { Field: 'Total Parcel Charges', Value: summary.parcelCharges },
    { Field: 'Total Collected (Vasool)', Value: summary.vasool },
    { Field: 'Total Outstanding Balance', Value: summary.remainingAmount },
    { Field: 'Total Profit', Value: summary.grossProfit },
    { Field: 'Currency', Value: settings.currency },
  ]);
  XLSX.utils.book_append_sheet(wb, infoSheet, 'Customer Summary');

  const txSheet = XLSX.utils.json_to_sheet(
    transactions.map((tx) => ({
      'Serial No': tx.serialNumber,
      Date: tx.date,
      Time: tx.time,
      'VPL No': tx.vplNumber,
      'Real Amount': tx.realAmount,
      'Invoice Amount': tx.invoiceAmount,
      Parcel: tx.parcelCharges,
      Vasool: tx.vasool,
      Remaining: tx.remainingAmount,
      Profit: tx.profit,
      Remarks: tx.remarks,
    })),
  );
  XLSX.utils.book_append_sheet(wb, txSheet, 'Ledger History');

  XLSX.writeFile(wb, `SehatKiDuniya-Ledger-${customer.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`);
}

export function downloadPeriodReportPdf(
  title: string,
  subtitle: string,
  transactions: Transaction[],
  expenses: Expense[],
  settings: AppSettings,
  filename: string,
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const summary = summarizePeriod(transactions, expenses);
  const c = settings.currency;

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(`${settings.businessName} — ${title}`, 32, 30);
  doc.setFontSize(10);
  doc.text(`${subtitle}  |  Currency: ${c}`, 32, 48);

  doc.setTextColor(15, 23, 42);
  autoTable(doc, {
    startY: 80,
    head: [['Entries', 'Invoice', 'Real', 'Parcel', 'Collected (Vasool)', 'Remaining', 'Gross Profit', 'Expenses', 'Net Profit']],
    body: [[
      String(summary.entryCount),
      formatCurrency(summary.invoiceAmount, c),
      formatCurrency(summary.realAmount, c),
      formatCurrency(summary.parcelCharges, c),
      formatCurrency(summary.vasool, c),
      formatCurrency(summary.remainingAmount, c),
      formatCurrency(summary.grossProfit, c),
      formatCurrency(summary.expenses, c),
      formatCurrency(summary.netProfit, c),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], fontSize: 8.5 },
    bodyStyles: { fontSize: 9, fontStyle: 'bold' },
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 140;

  autoTable(doc, {
    startY: afterSummaryY + 16,
    head: [['#', 'Date', 'VPL No', 'Customer', 'Mobile', 'Real', 'Invoice', 'Parcel', 'Vasool', 'Remaining', 'Profit']],
    body: transactions.map((tx) => [
      String(tx.serialNumber),
      formatDateDisplay(tx.date, settings.dateFormat),
      tx.vplNumber,
      tx.customerName,
      tx.mobileNumber || '-',
      formatCurrency(tx.realAmount, c),
      formatCurrency(tx.invoiceAmount, c),
      formatCurrency(tx.parcelCharges, c),
      formatCurrency(tx.vasool, c),
      formatCurrency(tx.remainingAmount, c),
      formatCurrency(tx.profit, c),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [6, 78, 59], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  doc.save(filename);
}

export function downloadCustomerStatementPdf(
  customer: Customer,
  transactions: Transaction[],
  settings: AppSettings,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const summary = summarizePeriod(transactions, []);
  const c = settings.currency;

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(`${settings.businessName} — Customer Statement`, 32, 32);
  doc.setFontSize(10);
  doc.text(
    `Customer: ${customer.name}  |  Mobile: ${customer.mobileNumber || 'N/A'}`,
    32,
    52,
  );

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`Address: ${customer.address || 'N/A'}`, 32, 94);

  autoTable(doc, {
    startY: 110,
    head: [['Orders', 'Total Invoices', 'Total Parcel', 'Total Collected', 'Outstanding Balance', 'Profit']],
    body: [[
      String(summary.entryCount),
      formatCurrency(summary.invoiceAmount, c),
      formatCurrency(summary.parcelCharges, c),
      formatCurrency(summary.vasool, c),
      formatCurrency(summary.remainingAmount, c),
      formatCurrency(summary.grossProfit, c),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], fontSize: 8.5 },
    bodyStyles: { fontSize: 9, fontStyle: 'bold' },
  });

  const afterY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 170;
  autoTable(doc, {
    startY: afterY + 14,
    head: [['Serial', 'Date', 'VPL No', 'Invoice', 'Parcel', 'Vasool', 'Remaining', 'Remarks']],
    body: transactions.map((tx) => [
      `#${tx.serialNumber}`,
      formatDateDisplay(tx.date, settings.dateFormat),
      tx.vplNumber,
      formatCurrency(tx.invoiceAmount, c),
      formatCurrency(tx.parcelCharges, c),
      formatCurrency(tx.vasool, c),
      formatCurrency(tx.remainingAmount, c),
      tx.remarks || '-',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [6, 78, 59], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  doc.save(`Customer-Statement-${customer.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}

export function downloadInvoicePdf(
  tx: Transaction,
  settings: AppSettings,
  includeRealAmount: boolean,
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const c = settings.currency;
  const totalAmount = tx.invoiceAmount + tx.parcelCharges;

  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, 88, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(settings.businessName, 36, 38);
  doc.setFontSize(10);
  const contactLine = [settings.businessPhone, settings.businessEmail, settings.businessAddress]
    .filter(Boolean)
    .join('  ·  ');
  doc.text(contactLine || 'Smart Business Accounting & Invoice', 36, 58);

  doc.setFontSize(14);
  doc.text(`INVOICE #${String(tx.serialNumber).padStart(4, '0')}`, pageWidth - 36, 38, {
    align: 'right',
  });
  doc.setFontSize(10);
  doc.text(`VPL: ${tx.vplNumber}`, pageWidth - 36, 58, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Date: ${formatDateDisplay(tx.date, settings.dateFormat)}   Time: ${tx.time}`, 36, 114);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 36, 144);
  doc.setFont('helvetica', 'normal');
  doc.text(tx.customerName, 36, 162);
  if (tx.mobileNumber) doc.text(`Mobile: ${tx.mobileNumber}`, 36, 178);
  if (tx.address) doc.text(`Address: ${tx.address}`, 36, 194, { maxWidth: pageWidth - 72 });

  const lineItems: Array<[string, string]> = [];
  if (includeRealAmount) {
    lineItems.push(['Real Amount (Cost Reference)', formatCurrency(tx.realAmount, c)]);
  }
  lineItems.push(['Invoice Amount', formatCurrency(tx.invoiceAmount, c)]);
  lineItems.push(['Parcel Charges', formatCurrency(tx.parcelCharges, c)]);
  lineItems.push(['Total Amount (Invoice + Parcel)', formatCurrency(totalAmount, c)]);
  lineItems.push(['Paid Amount (Vasool)', formatCurrency(tx.vasool, c)]);
  lineItems.push(['Remaining Balance', formatCurrency(tx.remainingAmount, c)]);

  autoTable(doc, {
    startY: 225,
    head: [['Description', `Amount (${c})`]],
    body: lineItems,
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105], fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 400;
  if (tx.remarks) {
    doc.setFontSize(10);
    doc.text(`Remarks: ${tx.remarks}`, 36, finalY + 26, { maxWidth: pageWidth - 72 });
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(36, finalY + 90, 200, finalY + 90);
  doc.line(pageWidth - 200, finalY + 90, pageWidth - 36, finalY + 90);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signature', 36, finalY + 105);
  doc.text('Customer Signature', pageWidth - 200, finalY + 105);

  doc.save(`Invoice-${tx.serialNumber}-${tx.vplNumber}.pdf`);
}

export function downloadJsonBackup(payload: BackupPayload): void {
  const datePart = payload.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `SehatKiDuniya-Backup-${datePart}.json`);
}
