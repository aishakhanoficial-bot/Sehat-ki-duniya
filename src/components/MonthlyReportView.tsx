import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  Minus,
  Printer,
} from 'lucide-react';
import type { AppSettings, Expense, Transaction } from '../types.ts';
import {
  calculatePercentChange,
  formatCurrency,
  formatDateDisplay,
  summarizePeriod,
} from '../utils/calculations.ts';
import {
  downloadPeriodReportPdf,
  exportMonthlyReportExcel,
} from '../utils/exports.ts';

interface MonthlyReportViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  settings: AppSettings;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  transactions,
  expenses,
  settings,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1..12

  const c = settings.currency;

  const yearOptions = useMemo(() => {
    const years = new Set<number>([now.getFullYear(), now.getFullYear() - 1]);
    for (const tx of transactions) {
      const y = Number(tx.date.slice(0, 4));
      if (y) years.add(y);
    }
    for (const exp of expenses) {
      const y = Number(exp.date.slice(0, 4));
      if (y) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, expenses, now]);

  const currentPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const prevDate = new Date(selectedYear, selectedMonth - 2, 1);
  const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
  const prevMonthLabel = `${MONTHS[prevDate.getMonth()]} ${prevDate.getFullYear()}`;

  const { currentSummary, prevSummary, monthTransactions, monthExpenses, expenseByCategory } =
    useMemo(() => {
      const curTx = transactions.filter((t) => t.date.startsWith(currentPrefix));
      const curExp = expenses.filter((e) => e.date.startsWith(currentPrefix));
      const prvTx = transactions.filter((t) => t.date.startsWith(prevPrefix));
      const prvExp = expenses.filter((e) => e.date.startsWith(prevPrefix));

      const catTotals: Record<string, number> = {};
      for (const e of curExp) {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
      }

      return {
        currentSummary: summarizePeriod(curTx, curExp),
        prevSummary: summarizePeriod(prvTx, prvExp),
        monthTransactions: curTx,
        monthExpenses: curExp,
        expenseByCategory: Object.entries(catTotals).sort((a, b) => b[1] - a[1]),
      };
    }, [transactions, expenses, currentPrefix, prevPrefix]);

  const metricCards = [
    {
      label: 'Total Monthly Entries · ماہانہ اندراجات',
      cur: currentSummary.entryCount,
      prev: prevSummary.entryCount,
      isCount: true,
    },
    {
      label: 'Monthly Invoice Amount · ماہانہ انوائس',
      cur: currentSummary.invoiceAmount,
      prev: prevSummary.invoiceAmount,
    },
    {
      label: 'Monthly Real Amount · ماہانہ اصل رقم',
      cur: currentSummary.realAmount,
      prev: prevSummary.realAmount,
    },
    {
      label: 'Monthly Parcel Charges · ماہانہ پارسل',
      cur: currentSummary.parcelCharges,
      prev: prevSummary.parcelCharges,
    },
    {
      label: 'Monthly Collection (Vasool) · ماہانہ وصولی',
      cur: currentSummary.vasool,
      prev: prevSummary.vasool,
    },
    {
      label: 'Monthly Remaining Balance · ماہانہ بقایا',
      cur: currentSummary.remainingAmount,
      prev: prevSummary.remainingAmount,
      invertDelta: true,
    },
    {
      label: 'Monthly Gross Profit · مجموعی منافع',
      cur: currentSummary.grossProfit,
      prev: prevSummary.grossProfit,
    },
    {
      label: 'Monthly Collected Profit · وصول شدہ منافع',
      cur: currentSummary.collectedProfit,
      prev: prevSummary.collectedProfit,
    },
    {
      label: 'Monthly Expenses · ماہانہ اخراجات',
      cur: currentSummary.expenses,
      prev: prevSummary.expenses,
      invertDelta: true,
    },
    {
      label: 'Monthly Net Profit · خالص منافع',
      cur: currentSummary.netProfit,
      prev: prevSummary.netProfit,
    },
  ];

  return (
    <div className="space-y-6 print-container">
      {/* Header & Month/Year Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Monthly Account Report · ماہانہ مالیاتی رپورٹ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {monthLabel} compared against {prevMonthLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {MONTHS.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              exportMonthlyReportExcel(monthLabel, monthTransactions, monthExpenses, settings)
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-ui whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadPeriodReportPdf(
                `Monthly Report — ${monthLabel}`,
                `Compared vs ${prevMonthLabel}`,
                monthTransactions,
                monthExpenses,
                settings,
                `SehatKiDuniya-Monthly-${currentPrefix}.pdf`,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 10 Monthly KPIs with MoM Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {metricCards.map((item) => {
          const pct = calculatePercentChange(item.cur, item.prev);
          const isPositive = pct !== null && pct > 0;
          const isNegative = pct !== null && pct < 0;
          const good = item.invertDelta ? isNegative : isPositive;
          const bad = item.invertDelta ? isPositive : isNegative;

          return (
            <div
              key={item.label}
              className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between"
            >
              <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
              <div className="mt-1.5 text-lg font-bold font-mono-num text-slate-900">
                {item.isCount ? item.cur : formatCurrency(item.cur, c)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono-num">
                  Prev: {item.isCount ? item.prev : formatCurrency(item.prev, c)}
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 font-mono-num font-semibold ${
                    good
                      ? 'text-emerald-700'
                      : bad
                        ? 'text-rose-700'
                        : 'text-slate-500'
                  }`}
                >
                  {pct === null ? (
                    item.cur > 0 ? 'New' : '0%'
                  ) : (
                    <>
                      {isPositive && <ArrowUpRight className="w-3 h-3" />}
                      {isNegative && <ArrowDownRight className="w-3 h-3" />}
                      {pct === 0 && <Minus className="w-3 h-3" />}
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expense Breakdown & Monthly Comparison Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Monthly Expenses by Category · اخراجات کی تفصیل
          </h3>
          {expenseByCategory.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No business expenses recorded for {monthLabel}.
            </p>
          ) : (
            <div className="space-y-3">
              {expenseByCategory.map(([cat, amount]) => {
                const share =
                  currentSummary.expenses > 0
                    ? Math.round((amount / currentSummary.expenses) * 100)
                    : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{cat}</span>
                      <span className="font-mono-num text-slate-900 font-semibold">
                        {formatCurrency(amount, c)} ({share}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Month-over-Month Financial Comparison
            </h3>
            <span className="text-xs text-slate-500">
              {monthLabel} vs {prevMonthLabel}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Metric</th>
                  <th className="py-2.5 px-4 text-right">{prevMonthLabel}</th>
                  <th className="py-2.5 px-4 text-right">{monthLabel}</th>
                  <th className="py-2.5 px-4 text-right">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metricCards.map((m) => {
                  const pct = calculatePercentChange(m.cur, m.prev);
                  return (
                    <tr key={m.label}>
                      <td className="py-2 px-4 font-medium text-slate-800">{m.label}</td>
                      <td className="py-2 px-4 text-right font-mono-num text-slate-600">
                        {m.isCount ? m.prev : formatCurrency(m.prev, c)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num font-semibold text-slate-900">
                        {m.isCount ? m.cur : formatCurrency(m.cur, c)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num font-semibold">
                        {pct === null ? (m.cur > 0 ? '+100%+' : '0%') : `${pct > 0 ? '+' : ''}${pct}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly Transactions List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Transactions in {monthLabel} ({monthTransactions.length})
          </h3>
        </div>
        {monthTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No transactions recorded in {monthLabel}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">VPL No</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3 text-right">Real</th>
                  <th className="py-2 px-3 text-right">Invoice</th>
                  <th className="py-2 px-3 text-right">Parcel</th>
                  <th className="py-2 px-3 text-right">Vasool</th>
                  <th className="py-2 px-3 text-right">Remaining</th>
                  <th className="py-2 px-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2 px-3 font-mono-num font-semibold">#{tx.serialNumber}</td>
                    <td className="py-2 px-3 font-mono-num text-slate-600">
                      {formatDateDisplay(tx.date, settings.dateFormat)}
                    </td>
                    <td className="py-2 px-3 font-mono-num text-emerald-800">{tx.vplNumber}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{tx.customerName}</td>
                    <td className="py-2 px-3 text-right font-mono-num">{formatCurrency(tx.realAmount, c)}</td>
                    <td className="py-2 px-3 text-right font-mono-num">{formatCurrency(tx.invoiceAmount, c)}</td>
                    <td className="py-2 px-3 text-right font-mono-num">{formatCurrency(tx.parcelCharges, c)}</td>
                    <td className="py-2 px-3 text-right font-mono-num text-emerald-700">{formatCurrency(tx.vasool, c)}</td>
                    <td className="py-2 px-3 text-right font-mono-num text-amber-700">{formatCurrency(tx.remainingAmount, c)}</td>
                    <td className="py-2 px-3 text-right font-mono-num font-semibold text-emerald-800">{formatCurrency(tx.profit, c)}</td>
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
