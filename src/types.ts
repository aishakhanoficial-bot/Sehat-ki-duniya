export type CurrencyCode = 'PKR' | 'USD' | 'SAR' | 'AED' | 'INR' | 'GBP' | 'EUR';

export type LanguageMode = 'bilingual' | 'en' | 'ur';

export type DateFormatType = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD MMM YYYY';

export type ProfitFormula = 'invoice_minus_real' | 'invoice_minus_real_minus_parcel';

export type RemainingFormula = 'invoice_plus_parcel_minus_vasool' | 'invoice_minus_vasool';

export type NaffaFormula =
  | 'proportional_invoice_capped'
  | 'proportional_invoice_uncapped'
  | 'proportional_total'
  | 'vasool_after_real';

export type ExpenseCategory =
  | 'Rent'
  | 'Electricity'
  | 'Staff Salary'
  | 'Transport'
  | 'Parcel'
  | 'Office Expenses'
  | 'Other';

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'JazzCash / Easypaisa'
  | 'Card'
  | 'Cheque'
  | 'Other';

export type ActiveTab =
  | 'dashboard'
  | 'entries'
  | 'daily-report'
  | 'monthly-report'
  | 'charts'
  | 'expenses'
  | 'customers'
  | 'invoices'
  | 'settings';

export type DateFilterPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'previous-month'
  | 'custom';

export interface Transaction {
  id: string;
  serialNumber: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  vplNumber: string;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  address: string;
  realAmount: number;
  invoiceAmount: number;
  profit: number;
  parcelCharges: number;
  vasool: number;
  naffaVasool: number;
  remainingAmount: number;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionInput {
  id?: string;
  serialNumber?: number;
  date: string;
  time: string;
  vplNumber: string;
  customerName: string;
  mobileNumber: string;
  address: string;
  realAmount: number;
  invoiceAmount: number;
  parcelCharges: number;
  vasool: number;
  remarks: string;
}

export interface Customer {
  id: string;
  name: string;
  mobileNumber: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  expenseNumber: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  id?: string;
  expenseNumber?: number;
  date: string;
  time: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export interface AppSettings {
  businessName: string;
  businessUrduName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessLogo: string;
  currency: CurrencyCode;
  enableExchangeRate: boolean;
  exchangeRate: number;
  targetCurrency: CurrencyCode;
  dateFormat: DateFormatType;
  language: LanguageMode;
  profitFormula: ProfitFormula;
  remainingFormula: RemainingFormula;
  naffaFormula: NaffaFormula;
  passwordEnabled: boolean;
  lastBackupAt: string | null;
  updatedAt: string;
}

export interface BackupMetadata {
  id: string;
  label: string;
  createdAt: string;
  transactionCount: number;
  customerCount: number;
  expenseCount: number;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  appName: string;
  transactions: Transaction[];
  customers: Customer[];
  expenses: Expense[];
  settings: Partial<AppSettings>;
}

export interface AuthStatus {
  passwordEnabled: boolean;
  authenticated: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}
