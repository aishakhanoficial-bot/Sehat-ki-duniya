import type { ExpenseCategory, LanguageMode, PaymentMethod } from '../types.ts';

export interface BilingualLabel {
  en: string;
  ur: string;
}

export function tLabel(label: BilingualLabel, mode: LanguageMode): string {
  if (mode === 'en') return label.en;
  if (mode === 'ur') return label.ur;
  return `${label.en} · ${label.ur}`;
}

export const NAV_LABELS = {
  dashboard: { en: 'Dashboard', ur: 'ڈیش بورڈ' },
  entries: { en: 'Daily Entries', ur: 'روزانہ اندراج' },
  dailyReport: { en: 'Daily Report', ur: 'روزانہ رپورٹ' },
  monthlyReport: { en: 'Monthly Report', ur: 'ماہانہ رپورٹ' },
  charts: { en: 'Analytics & Charts', ur: 'چارٹس اور گراف' },
  expenses: { en: 'Expenses', ur: 'اخراجات' },
  customers: { en: 'Customer Ledger', ur: 'کسٹمر کھاتہ' },
  invoices: { en: 'Invoices', ur: 'انوائسز' },
  settings: { en: 'Settings', ur: 'سیٹنگز' },
};

export const FIELD_LABELS = {
  serialNumber: { en: 'Serial No', ur: 'نمبر شمار' },
  date: { en: 'Date', ur: 'تاریخ' },
  time: { en: 'Time', ur: 'وقت' },
  vplNumber: { en: 'VPL Number', ur: 'VPL نمبر' },
  customerName: { en: 'Customer Name', ur: 'نام' },
  mobileNumber: { en: 'Mobile Number', ur: 'موبائل نمبر' },
  address: { en: 'Address', ur: 'ایڈریس' },
  realAmount: { en: 'Real Amount', ur: 'اصل رقم' },
  invoiceAmount: { en: 'Invoice Amount', ur: 'انوائس رقم' },
  profit: { en: 'Profit', ur: 'منافع' },
  parcelCharges: { en: 'Parcel', ur: 'پارسل چارجز' },
  vasool: { en: 'Vasool', ur: 'وصولی' },
  naffaVasool: { en: 'Naffa Vasool', ur: 'منافع وصول' },
  remainingAmount: { en: 'Remaining Amount', ur: 'بقایا رقم' },
  remarks: { en: 'Remarks', ur: 'ریمارکس' },
};

export const KPI_LABELS = {
  dailySales: { en: 'Total Daily Sales', ur: 'آج کی کل فروخت' },
  monthlySales: { en: 'Total Monthly Sales', ur: 'ماہانہ کل فروخت' },
  totalInvoice: { en: 'Total Invoice Amount', ur: 'کل انوائس رقم' },
  totalReal: { en: 'Total Real Amount', ur: 'کل اصل رقم' },
  totalParcel: { en: 'Total Parcel Amount', ur: 'کل پارسل چارجز' },
  totalCollected: { en: 'Total Amount Collected (Vasool)', ur: 'کل وصول شدہ رقم' },
  totalOutstanding: { en: 'Total Outstanding Amount', ur: 'کل بقایا رقم' },
  dailyProfit: { en: 'Total Daily Profit', ur: 'آج کا منافع' },
  monthlyProfit: { en: 'Total Monthly Profit', ur: 'ماہانہ منافع' },
  totalExpenses: { en: 'Total Expenses', ur: 'کل اخراجات' },
  netProfit: { en: 'Net Profit', ur: 'خالص منافع' },
  totalEntries: { en: 'Total Number of Entries', ur: 'کل اندراجات' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, BilingualLabel> = {
  Rent: { en: 'Rent', ur: 'کرایہ' },
  Electricity: { en: 'Electricity', ur: 'بجلی بل' },
  'Staff Salary': { en: 'Staff Salary', ur: 'عملہ تنخواہ' },
  Transport: { en: 'Transport', ur: 'ٹرانسپورٹ' },
  Parcel: { en: 'Parcel', ur: 'پارسل' },
  'Office Expenses': { en: 'Office Expenses', ur: 'دفتری اخراجات' },
  Other: { en: 'Other', ur: 'دیگر' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, BilingualLabel> = {
  Cash: { en: 'Cash', ur: 'نقد' },
  'Bank Transfer': { en: 'Bank Transfer', ur: 'بینک ٹرانسفر' },
  'JazzCash / Easypaisa': { en: 'JazzCash / Easypaisa', ur: 'جاز کیش / ایزی پیسہ' },
  Card: { en: 'Card', ur: 'کارڈ' },
  Cheque: { en: 'Cheque', ur: 'چیک' },
  Other: { en: 'Other', ur: 'دیگر' },
};
