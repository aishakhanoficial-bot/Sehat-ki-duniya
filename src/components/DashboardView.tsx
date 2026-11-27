import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  Download,
  FilePlus2,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import type { ActiveTab, AppSettings, Expense, Transaction } from '../types.ts';
import {
  formatConvertedReference,
  formatCurrency,
  formatDateDisplay,
  getTodayIso,
  summarizePeriod,
} from '../utils/calculations.ts';
import { KPI_LABELS, tLabel } from '../utils/i18n.ts';

interface DashboardViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  settings: AppSettings;
  onNavigate: (tab: ActiveTab) => void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenInvoice: (tx: Transaction) => void;
  onQuickBackup: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  expenses,
  settings,
  onNavigate,
  onEditTransaction,
  onOpenInvoice,
  onQuickBackup,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [reminderDismissed, setReminderDismissed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayIso = getTodayIso();
  const currentMonthPrefix = todayIso.slice(0, 7);

  const metrics = useMemo(() => {
    const todayTxs = transactions.filter((t) => t.date === todayIso);
    const todayExps = expenses.filter((e) => e.date === todayIso);
    const monthTxs = transactions.filter((t) => t.date.startsWith(currentMonthPrefix));
    const monthExps = expenses.filter((e) => e.date.startsWith(currentMonthPrefix));

    const daily = summarizePeriod(todayTxs, todayExps);
    const monthly = summarizePeriod(monthTxs, monthExps);
    const overall = summarizePeriod(transactions, expenses);

    return { daily, monthly, overall };
  }, [transactions, expenses, todayIso, currentMonthPrefix]);

  const needsBackupReminder = useMemo(() => {
    if (reminderDismissed) return false;
    if (transactions.length === 0 && expenses.length === 0) return false;
    if (!settings.lastBackupAt) return true;
    const daysSince =
      (Date.now() - new Date(settings.lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 7;
  }, [reminderDismissed, settings.lastBackupAt, transactions.length, expenses.length]);

  const lang = settings.language;
  const c = settings.currency;

  const kpiCards: Array<{
    key: string;
    label: string;
    value: string;
    converted?: string | null;
    subtext: string;
    tone: 'neutral' | 'emerald' | 'amber' | 'rose';
  }> = [
    {
      key: 'dailySales',
      label: tLabel(KPI_LABELS.dailySales, lang),
      value: formatCurrency(metrics.daily.invoiceAmount, c),
      converted: formatConvertedReference(metrics.daily.invoiceAmount, settings),
      subtext: `${metrics.daily.entryCount} entries today`,
      tone: 'emerald',
    },
    {
      key: 'monthlySales',
      label: tLabel(KPI_LABELS.monthlySales, lang),
      value: formatCurrency(metrics.monthly.invoiceAmount, c),
      converted: formatConvertedReference(metrics.monthly.invoiceAmount, settings),
      subtext: `${metrics.monthly.entryCount} entries this month`,
      tone: 'emerald',
    },
    {
      key: 'totalInvoice',
      label: tLabel(KPI_LABELS.totalInvoice, lang),
      value: formatCurrency(metrics.overall.invoiceAmount, c),
      converted: formatConvertedReference(metrics.overall.invoiceAmount, settings),
      subtext: 'All-time billed invoices',
      tone: 'neutral',
    },
    {
      key: 'totalReal',
      label: tLabel(KPI_LABELS.totalReal, lang),
      value: formatCurrency(metrics.overall.realAmount, c),
      converted: formatConvertedReference(metrics.overall.realAmount, settings),
      subtext: 'Actual cost basis',
      tone: 'neutral',
    },
    {
      key: 'totalParcel',
      label: tLabel(KPI_LABELS.totalParcel, lang),
      value: formatCurrency(metrics.overall.parcelCharges, c),
      converted: formatConvertedReference(metrics.overall.parcelCharges, settings),
      subtext: 'Total parcel charges',
      tone: 'neutral',
    },
    {
      key: 'totalCollected',
      label: tLabel(KPI_LABELS.totalCollected, lang),
      value: formatCurrency(metrics.overall.vasool, c),
      converted: formatConvertedReference(metrics.overall.vasool, settings),
      subtext: `Naffa Vasool: ${formatCurrency(metrics.overall.collectedProfit, c)}`,
      tone: 'emerald',
    },
    {
      key: 'totalOutstanding',
      label: tLabel(KPI_LABELS.totalOutstanding, lang),
      value: formatCurrency(metrics.overall.remainingAmount, c),
      converted: formatConvertedReference(metrics.overall.remainingAmount, settings),
      subtext: 'Pending customer receivables',
      tone: metrics.overall.remainingAmount > 0 ? 'amber' : 'neutral',
    },
    {
      key: 'dailyProfit',
      label: tLabel(KPI_LABELS.dailyProfit, lang),
      value: formatCurrency(metrics.daily.grossProfit, c),
      converted: formatConvertedReference(metrics.daily.grossProfit, settings),
      subtext: `Daily Net: ${formatCurrency(metrics.daily.netProfit, c)}`,
      tone: 'emerald',
    },
    {
      key: 'monthlyProfit',
      label: tLabel(KPI_LABELS.monthlyProfit, lang),
      value: formatCurrency(metrics.monthly.grossProfit, c),
      converted: formatConvertedReference(metrics.monthly.grossProfit, settings),
      subtext: `Monthly Net: ${formatCurrency(metrics.monthly.netProfit, c)}`,
      tone: 'emerald',
    },
    {
      key: 'totalExpenses',
      label: tLabel(KPI_LABELS.totalExpenses, lang),
      value: formatCurrency(metrics.overall.expenses, c),
      converted: formatConvertedReference(metrics.overall.expenses, settings),
      subtext: `${expenses.length} recorded expense entries`,
      tone: metrics.overall.expenses > 0 ? 'rose' : 'neutral',
    },
    {
      key: 'netProfit',
      label: tLabel(KPI_LABELS.netProfit, lang),
      value: formatCurrency(metrics.overall.netProfit, c),
      converted: formatConvertedReference(metrics.overall.netProfit, settings),
      subtext: 'Gross Profit minus Business Expenses',
      tone: metrics.overall.netProfit >= 0 ? 'emerald' : 'rose',
    },
    {
      key: 'totalEntries',
      label: tLabel(KPI_LABELS.totalEntries, lang),
      value: String(metrics.overall.entryCount),
      converted: null,
      subtext: `${metrics.monthly.entryCount} this month · ${metrics.daily.entryCount} today`,
      tone: 'neutral',
    },
  ];

  const recentTransactions = transactions.slice(0, 8);
  const liveTimeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const liveDateStr = formatDateDisplay(todayIso, settings.dateFormat);

  return (
    <div className="space-y-6">
      {/* Executive Header Strip with Live Clock */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-emerald-800">{settings.businessName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-urdu">{settings.businessUrduName}</span>
            <span aria-hidden="true">·</span>
            <span>Currency: {settings.currency}</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900 text-balance">
            Financial Overview & Live Ledger Summary
          </h2>
          <p className="text-xs text-slate-500 font-urdu mt-0.5">
            صحت کی دنیا – مکمل روزانہ اور ماہانہ حساب کتاب سسٹم
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <span className="inline-flex items-center gap-1.5 font-mono-num">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              {liveDateStr}
            </span>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <span className="inline-flex items-center gap-1.5 font-mono-num font-semibold text-slate-900">
              <Clock className="w-3.5 h-3.5 text-emerald-700" />
              {liveTimeStr}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('entries')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>New Entry</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui whitespace-nowrap shrink-0"
          >
            <Receipt className="w-4 h-4 text-slate-600" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Backup Reminder Banner */}
      {needsBackupReminder && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Backup Recommended · ڈیٹا بیک اپ یاددہانی
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {settings.lastBackupAt
                  ? `Last backup was created on ${settings.lastBackupAt.slice(0, 10)}. Export a fresh JSON backup to keep your records safe.`
                  : 'You have not created a backup yet. Create a JSON backup to protect your accounting records.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onQuickBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-ui whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup Now</span>
            </button>
            <button
              type="button"
              onClick={() => setReminderDismissed(true)}
              className="px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 rounded-lg transition-ui whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 12 Real-Time KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const valColor =
            card.tone === 'emerald'
              ? 'text-emerald-800'
              : card.tone === 'amber'
                ? 'text-amber-700'
                : card.tone === 'rose'
                  ? 'text-rose-700'
                  : 'text-slate-900';

          return (
            <div
              key={card.key}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between"
            >
              <div className="text-xs font-medium text-slate-600 leading-snug">
                {card.label}
              </div>
              <div className={`mt-2 text-2xl font-bold font-mono-num ${valColor}`}>
                {card.value}
              </div>
              {card.converted && (
                <div className="mt-0.5 text-xs font-mono-num text-slate-500">
                  ≈ {card.converted}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                {card.subtext}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Recent Business Entries · حالیہ اندراجات
            </h3>
            <p className="text-xs text-slate-500">
              Latest saved transactions synchronized with customer ledgers and reports
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('entries')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 whitespace-nowrap shrink-0"
          >
            <span>View All Entries</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No transactions recorded yet · ابھی تک کوئی اندراج موجود نہیں
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Add your first daily entry to populate dashboard totals, reports, and charts.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('entries')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>Log First Entry</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Serial</th>
                  <th className="py-2.5 px-4">Date · Time</th>
                  <th className="py-2.5 px-4">VPL No</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4 text-right">Invoice</th>
                  <th className="py-2.5 px-4 text-right">Parcel</th>
                  <th className="py-2.5 px-4 text-right">Vasool</th>
                  <th className="py-2.5 px-4 text-right">Remaining</th>
                  <th className="py-2.5 px-4 text-right">Profit</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-num font-semibold text-slate-800">
                      #{tx.serialNumber}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 font-mono-num whitespace-nowrap">
                      {formatDateDisplay(tx.date, settings.dateFormat)} · {tx.time}
                    </td>
                    <td className="py-2.5 px-4 font-mono-num font-medium text-emerald-800">
                      {tx.vplNumber}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{tx.customerName}</div>
                      {tx.mobileNumber && (
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          {tx.mobileNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-900">
                      {formatCurrency(tx.invoiceAmount, c)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-slate-600">
                      {formatCurrency(tx.parcelCharges, c)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-medium text-emerald-700">
                      {formatCurrency(tx.vasool, c)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono-num font-medium ${
                        tx.remainingAmount > 0 ? 'text-amber-700' : 'text-slate-600'
                      }`}
                    >
                      {formatCurrency(tx.remainingAmount, c)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-emerald-800">
                      {formatCurrency(tx.profit, c)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(tx)}
                        className="text-emerald-700 hover:text-emerald-900 font-medium mr-3"
                      >
                        Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
