import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import type { AppSettings, Expense, Transaction } from '../types.ts';
import {
  formatCurrency,
  formatDateDisplay,
  getTodayIso,
  summarizePeriod,
} from '../utils/calculations.ts';
import {
  downloadPeriodReportPdf,
  exportDailyReportExcel,
  exportTransactionsCsv,
} from '../utils/exports.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface DailyReportViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  settings: AppSettings;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onOpenInvoice: (tx: Transaction) => void;
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  transactions,
  expenses,
  settings,
  onEditTransaction,
  onDeleteTransaction,
  onOpenInvoice,
}) => {
  const [selectedDate, setSelectedDate] = useState(getTodayIso());
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const c = settings.currency;

  const dailyTransactions = useMemo(
    () => transactions.filter((t) => t.date === selectedDate),
    [transactions, selectedDate],
  );

  const dailyExpenses = useMemo(
    () => expenses.filter((e) => e.date === selectedDate),
    [expenses, selectedDate],
  );

  const summary = useMemo(
    () => summarizePeriod(dailyTransactions, dailyExpenses),
    [dailyTransactions, dailyExpenses],
  );

  const filteredTable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dailyTransactions.filter((tx) => {
      if (balanceFilter === 'paid' && tx.remainingAmount > 0) return false;
      if (balanceFilter === 'pending' && tx.remainingAmount <= 0) return false;
      if (!q) return true;
      return (
        tx.vplNumber.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.mobileNumber.toLowerCase().includes(q) ||
        String(tx.serialNumber) === q
      );
    });
  }, [dailyTransactions, search, balanceFilter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const summaryItems = [
    { label: 'Total Daily Entries · روزانہ اندراجات', val: String(summary.entryCount) },
    { label: 'Daily Invoice Amount · کل انوائس', val: formatCurrency(summary.invoiceAmount, c) },
    { label: 'Daily Real Amount · اصل رقم', val: formatCurrency(summary.realAmount, c) },
    { label: 'Daily Parcel Charges · پارسل چارجز', val: formatCurrency(summary.parcelCharges, c) },
    { label: 'Daily Collected (Vasool) · وصولی', val: formatCurrency(summary.vasool, c), tone: 'emerald' },
    { label: 'Daily Outstanding · بقایا رقم', val: formatCurrency(summary.remainingAmount, c), tone: summary.remainingAmount > 0 ? 'amber' : undefined },
    { label: 'Daily Total Profit · کل منافع', val: formatCurrency(summary.grossProfit, c), tone: 'emerald' },
    { label: 'Daily Collected Profit · منافع وصول', val: formatCurrency(summary.collectedProfit, c), tone: 'emerald' },
    { label: 'Daily Expenses · روزانہ اخراجات', val: formatCurrency(summary.expenses, c), tone: summary.expenses > 0 ? 'rose' : undefined },
    { label: 'Daily Net Profit · خالص منافع', val: formatCurrency(summary.netProfit, c), tone: summary.netProfit >= 0 ? 'emerald' : 'rose' },
  ];

  return (
    <div className="space-y-6 print-container">
      {/* Header Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Daily Account Report · روزانہ حساب کتاب رپورٹ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Selected Date: <span className="font-mono-num font-semibold text-slate-800">{formatDateDisplay(selectedDate, settings.dateFormat)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm font-mono-num bg-transparent focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => exportDailyReportExcel(selectedDate, dailyTransactions, dailyExpenses, settings)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-ui whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadPeriodReportPdf(
                'Daily Account Report',
                `Date: ${formatDateDisplay(selectedDate, settings.dateFormat)}`,
                dailyTransactions,
                dailyExpenses,
                settings,
                `SehatKiDuniya-Daily-Report-${selectedDate}.pdf`,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportTransactionsCsv(
                dailyTransactions,
                settings,
                `SehatKiDuniya-Daily-${selectedDate}.csv`,
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
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

      {/* 10 Daily Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
            <div
              className={`mt-1.5 text-lg font-bold font-mono-num ${
                item.tone === 'emerald'
                  ? 'text-emerald-800'
                  : item.tone === 'amber'
                    ? 'text-amber-700'
                    : item.tone === 'rose'
                      ? 'text-rose-700'
                      : 'text-slate-900'
              }`}
            >
              {item.val}
            </div>
          </div>
        ))}
      </div>

      {/* Daily Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search daily entries by VPL, customer, mobile, serial..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                ['all', 'All'],
                ['paid', 'Fully Paid'],
                ['pending', 'Balance Due'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setBalanceFilter(val)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-ui whitespace-nowrap ${
                  balanceFilter === val
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {filteredTable.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No transactions found for {formatDateDisplay(selectedDate, settings.dateFormat)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Serial</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">VPL No</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Real</th>
                  <th className="py-2.5 px-3 text-right">Invoice</th>
                  <th className="py-2.5 px-3 text-right">Parcel</th>
                  <th className="py-2.5 px-3 text-right">Vasool</th>
                  <th className="py-2.5 px-3 text-right">Naffa Vasool</th>
                  <th className="py-2.5 px-3 text-right">Remaining</th>
                  <th className="py-2.5 px-3 text-right">Profit</th>
                  <th className="py-2.5 px-3 text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTable.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono-num font-semibold">#{tx.serialNumber}</td>
                    <td className="py-2.5 px-3 font-mono-num text-slate-600">{tx.time}</td>
                    <td className="py-2.5 px-3 font-mono-num font-medium text-emerald-800">{tx.vplNumber}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{tx.customerName}</div>
                      {tx.mobileNumber && (
                        <div className="text-[11px] text-slate-500 font-mono-num">{tx.mobileNumber}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num">{formatCurrency(tx.realAmount, c)}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-medium">{formatCurrency(tx.invoiceAmount, c)}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num">{formatCurrency(tx.parcelCharges, c)}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700 font-medium">{formatCurrency(tx.vasool, c)}</td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700">{formatCurrency(tx.naffaVasool, c)}</td>
                    <td className={`py-2.5 px-3 text-right font-mono-num font-medium ${tx.remainingAmount > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                      {formatCurrency(tx.remainingAmount, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-emerald-800">
                      {formatCurrency(tx.profit, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap no-print">
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(tx)}
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md"
                        title="Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md ml-1"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md ml-1"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Expenses Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Daily Business Expenses · روزانہ اخراجات ({dailyExpenses.length})
          </h3>
          <span className="text-xs font-mono-num font-semibold text-rose-700">
            Total: {formatCurrency(summary.expenses, c)}
          </span>
        </div>
        {dailyExpenses.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No business expenses recorded for this date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2 px-4">Exp #</th>
                  <th className="py-2 px-4">Time</th>
                  <th className="py-2 px-4">Category</th>
                  <th className="py-2 px-4">Description</th>
                  <th className="py-2 px-4">Payment Method</th>
                  <th className="py-2 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyExpenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 px-4 font-mono-num font-semibold">EXP-{e.expenseNumber}</td>
                    <td className="py-2 px-4 font-mono-num text-slate-600">{e.time}</td>
                    <td className="py-2 px-4 font-medium text-slate-800">{e.category}</td>
                    <td className="py-2 px-4 text-slate-600">{e.description || '-'}</td>
                    <td className="py-2 px-4 text-slate-600">{e.paymentMethod}</td>
                    <td className="py-2 px-4 text-right font-mono-num font-semibold text-rose-700">
                      {formatCurrency(e.amount, c)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Daily Entry"
        description={`Delete Serial #${deleteTarget?.serialNumber} (VPL: ${deleteTarget?.vplNumber})? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
