import type {
  AppSettings,
  CurrencyCode,
  DateFilterPreset,
  DateFormatType,
  Expense,
  NaffaFormula,
  ProfitFormula,
  RemainingFormula,
  Transaction,
} from '../types.ts';

export interface CurrencyMeta {
  code: CurrencyCode;
  name: string;
  urduName: string;
  symbol: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  PKR: { code: 'PKR', name: 'Pakistani Rupee', urduName: 'پاکستانی روپیہ', symbol: 'Rs ' },
  USD: { code: 'USD', name: 'US Dollar', urduName: 'امریکی ڈالر', symbol: '$' },
  SAR: { code: 'SAR', name: 'Saudi Riyal', urduName: 'سعودی ریال', symbol: 'SAR ' },
  AED: { code: 'AED', name: 'UAE Dirham', urduName: 'اماراتی درہم', symbol: 'AED ' },
  INR: { code: 'INR', name: 'Indian Rupee', urduName: 'بھارتی روپیہ', symbol: '₹' },
  GBP: { code: 'GBP', name: 'British Pound', urduName: 'برطانوی پاؤنڈ', symbol: '£' },
  EUR: { code: 'EUR', name: 'Euro', urduName: 'یورو', symbol: '€' },
};

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sanitizeAmount(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return roundMoney(num);
}

export interface CalculationConfig {
  profitFormula: ProfitFormula;
  remainingFormula: RemainingFormula;
  naffaFormula: NaffaFormula;
}

export function calculateTransactionMetrics(
  amounts: {
    realAmount: number;
    invoiceAmount: number;
    parcelCharges: number;
    vasool: number;
  },
  config: CalculationConfig,
): {
  profit: number;
  remainingAmount: number;
  naffaVasool: number;
} {
  const real = sanitizeAmount(amounts.realAmount);
  const invoice = sanitizeAmount(amounts.invoiceAmount);
  const parcel = sanitizeAmount(amounts.parcelCharges);
  const vasool = sanitizeAmount(amounts.vasool);

  // 1. Profit calculation
  let profit = 0;
  if (config.profitFormula === 'invoice_minus_real_minus_parcel') {
    profit = invoice - real - parcel;
  } else {
    profit = invoice - real;
  }

  // 2. Remaining Amount calculation
  let remainingAmount = 0;
  if (config.remainingFormula === 'invoice_minus_vasool') {
    remainingAmount = invoice - vasool;
  } else {
    remainingAmount = invoice + parcel - vasool;
  }

  // 3. Naffa Vasool (Collected Profit) with division-by-zero protection
  // Never count unpaid profit as collected profit
  let naffaVasool = 0;
  if (vasool > 0) {
    if (config.naffaFormula === 'proportional_invoice_uncapped') {
      naffaVasool = invoice > 0 ? profit * (vasool / invoice) : 0;
    } else if (config.naffaFormula === 'proportional_total') {
      const total = invoice + parcel;
      const ratio = total > 0 ? Math.min(1, Math.max(0, vasool / total)) : 0;
      naffaVasool = profit * ratio;
    } else if (config.naffaFormula === 'vasool_after_real') {
      if (profit >= 0) {
        naffaVasool = vasool > real ? Math.min(profit, vasool - real) : 0;
      } else {
        naffaVasool = invoice > 0 ? profit * Math.min(1, vasool / invoice) : 0;
      }
    } else {
      // Default: proportional_invoice_capped -> Profit * (Vasool / Invoice Amount), capped at full invoice ratio so parcel payment doesn't inflate profit
      const ratio = invoice > 0 ? Math.min(1, Math.max(0, vasool / invoice)) : 0;
      naffaVasool = profit * ratio;
    }
  }

  return {
    profit: roundMoney(profit),
    remainingAmount: roundMoney(remainingAmount),
    naffaVasool: roundMoney(naffaVasool),
  };
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  options?: { compact?: boolean },
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const meta = CURRENCIES[currency] || CURRENCIES.PKR;
  const isNegative = safe < 0;
  const abs = Math.abs(safe);

  let formattedNum: string;
  if (options?.compact && abs >= 1_000_000) {
    formattedNum = `${(abs / 1_000_000).toFixed(2)}M`;
  } else {
    formattedNum = abs.toLocaleString('en-US', {
      minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  }

  return `${isNegative ? '-' : ''}${meta.symbol}${formattedNum}`;
}

export function formatConvertedReference(amount: number, settings: AppSettings): string | null {
  if (!settings.enableExchangeRate || !settings.exchangeRate || settings.exchangeRate <= 0) {
    return null;
  }
  if (settings.currency === settings.targetCurrency) return null;
  const converted = roundMoney(amount * settings.exchangeRate);
  return formatCurrency(converted, settings.targetCurrency);
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNowTimeHm(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDateDisplay(isoDate: string, format: DateFormatType): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '';
  const [y, m, d] = isoDate.split('-');
  if (format === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
  if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  if (format === 'DD MMM YYYY') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = Math.max(0, Math.min(11, Number(m) - 1));
    return `${d} ${months[monthIdx]} ${y}`;
  }
  return isoDate;
}

export function getDateRangeForPreset(
  preset: DateFilterPreset,
  customStart?: string,
  customEnd?: string,
): { start: string | null; end: string | null } {
  const now = new Date();
  const toIso = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  if (preset === 'all') return { start: null, end: null };
  if (preset === 'today') {
    const t = toIso(now);
    return { start: t, end: t };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const iso = toIso(y);
    return { start: iso, end: iso };
  }
  if (preset === 'this-week') {
    const day = now.getDay(); // 0=Sun..6=Sat
    const diffToMon = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMon);
    return { start: toIso(start), end: toIso(now) };
  }
  if (preset === 'this-month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toIso(start), end: toIso(end) };
  }
  if (preset === 'previous-month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toIso(start), end: toIso(end) };
  }
  return {
    start: customStart || null,
    end: customEnd || null,
  };
}

export interface PeriodSummary {
  entryCount: number;
  invoiceAmount: number;
  realAmount: number;
  parcelCharges: number;
  vasool: number;
  remainingAmount: number;
  grossProfit: number;
  collectedProfit: number;
  expenses: number;
  netProfit: number;
}

export function summarizePeriod(transactions: Transaction[], expenses: Expense[]): PeriodSummary {
  let invoiceAmount = 0;
  let realAmount = 0;
  let parcelCharges = 0;
  let vasool = 0;
  let remainingAmount = 0;
  let grossProfit = 0;
  let collectedProfit = 0;

  for (const tx of transactions) {
    invoiceAmount += tx.invoiceAmount || 0;
    realAmount += tx.realAmount || 0;
    parcelCharges += tx.parcelCharges || 0;
    vasool += tx.vasool || 0;
    remainingAmount += tx.remainingAmount || 0;
    grossProfit += tx.profit || 0;
    collectedProfit += tx.naffaVasool || 0;
  }

  let totalExpenses = 0;
  for (const exp of expenses) {
    totalExpenses += exp.amount || 0;
  }

  // Net Profit = Gross Profit - Business Expenses (never double counting transaction parcel charges)
  const netProfit = grossProfit - totalExpenses;

  return {
    entryCount: transactions.length,
    invoiceAmount: roundMoney(invoiceAmount),
    realAmount: roundMoney(realAmount),
    parcelCharges: roundMoney(parcelCharges),
    vasool: roundMoney(vasool),
    remainingAmount: roundMoney(remainingAmount),
    grossProfit: roundMoney(grossProfit),
    collectedProfit: roundMoney(collectedProfit),
    expenses: roundMoney(totalExpenses),
    netProfit: roundMoney(netProfit),
  };
}

export function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}
