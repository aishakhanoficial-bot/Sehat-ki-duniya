import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit3,
  FileText,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  AppSettings,
  Customer,
  DateFilterPreset,
  Transaction,
  TransactionInput,
} from '../types.ts';
import {
  calculateTransactionMetrics,
  formatCurrency,
  formatDateDisplay,
  getDateRangeForPreset,
  getNowTimeHm,
  getTodayIso,
  summarizePeriod,
} from '../utils/calculations.ts';
import { exportTransactionsCsv } from '../utils/exports.ts';
import { FIELD_LABELS, tLabel } from '../utils/i18n.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface TransactionsViewProps {
  transactions: Transaction[];
  customers: Customer[];
  nextSerialNumber: number;
  settings: AppSettings;
  editingTransaction: Transaction | null;
  onEditTransaction: (tx: Transaction) => void;
  onClearEditing: () => void;
  onSaveTransaction: (
    input: TransactionInput & { allowDuplicateVpl?: boolean },
    editingId?: string,
  ) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onOpenInvoice: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  customers,
  nextSerialNumber,
  settings,
  editingTransaction,
  onEditTransaction,
  onClearEditing,
  onSaveTransaction,
  onDeleteTransaction,
  onOpenInvoice,
}) => {
  const [date, setDate] = useState(getTodayIso());
  const [time, setTime] = useState(getNowTimeHm());
  const [vplNumber, setVplNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [realAmount, setRealAmount] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [parcelCharges, setParcelCharges] = useState('');
  const [vasool, setVasool] = useState('');
  const [remarks, setRemarks] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [customStart, setCustomStart] = useState(getTodayIso());
  const [customEnd, setCustomEnd] = useState(getTodayIso());

  const lang = settings.language;
  const c = settings.currency;

  const resetForm = () => {
    setDate(getTodayIso());
    setTime(getNowTimeHm());
    setVplNumber('');
    setCustomerName('');
    setMobileNumber('');
    setAddress('');
    setRealAmount('');
    setInvoiceAmount('');
    setParcelCharges('');
    setVasool('');
    setRemarks('');
    setFormError('');
    onClearEditing();
  };

  useEffect(() => {
    if (editingTransaction) {
      setDate(editingTransaction.date);
      setTime(editingTransaction.time);
      setVplNumber(editingTransaction.vplNumber);
      setCustomerName(editingTransaction.customerName);
      setMobileNumber(editingTransaction.mobileNumber);
      setAddress(editingTransaction.address);
      setRealAmount(String(editingTransaction.realAmount));
      setInvoiceAmount(String(editingTransaction.invoiceAmount));
      setParcelCharges(String(editingTransaction.parcelCharges));
      setVasool(String(editingTransaction.vasool));
      setRemarks(editingTransaction.remarks);
      setFormError('');
    }
  }, [editingTransaction]);

  // Live automatic calculation
  const liveCalc = useMemo(() => {
    return calculateTransactionMetrics(
      {
        realAmount: Number(realAmount) || 0,
        invoiceAmount: Number(invoiceAmount) || 0,
        parcelCharges: Number(parcelCharges) || 0,
        vasool: Number(vasool) || 0,
      },
      {
        profitFormula: settings.profitFormula,
        remainingFormula: settings.remainingFormula,
        naffaFormula: settings.naffaFormula,
      },
    );
  }, [
    realAmount,
    invoiceAmount,
    parcelCharges,
    vasool,
    settings.profitFormula,
    settings.remainingFormula,
    settings.naffaFormula,
  ]);

  // Live duplicate VPL check
  const duplicateVplMatch = useMemo(() => {
    const cleaned = vplNumber.trim().toLowerCase();
    if (!cleaned) return null;
    return (
      transactions.find(
        (tx) =>
          tx.vplNumber.trim().toLowerCase() === cleaned &&
          tx.id !== editingTransaction?.id,
      ) || null
    );
  }, [vplNumber, transactions, editingTransaction?.id]);

  // Customer autofill helper by mobile or name
  const handleSelectCustomerAutofill = (cust: Customer) => {
    setCustomerName(cust.name);
    setMobileNumber(cust.mobileNumber);
    setAddress(cust.address);
  };

  const matchingCustomerSuggestions = useMemo(() => {
    const qName = customerName.trim().toLowerCase();
    const qMob = mobileNumber.trim();
    if (!qName && !qMob) return [];
    return customers
      .filter(
        (cust) =>
          (qName && cust.name.toLowerCase().includes(qName) && cust.name.toLowerCase() !== qName) ||
          (qMob && cust.mobileNumber.includes(qMob) && cust.mobileNumber !== qMob),
      )
      .slice(0, 4);
  }, [customers, customerName, mobileNumber]);

  const executeSave = async (allowDuplicateVpl: boolean) => {
    setFormError('');
    const numReal = Number(realAmount || 0);
    const numInvoice = Number(invoiceAmount || 0);
    const numParcel = Number(parcelCharges || 0);
    const numVasool = Number(vasool || 0);

    if (!vplNumber.trim()) {
      setFormError('VPL Number is required.');
      return;
    }
    if (!customerName.trim()) {
      setFormError('Customer Name is required.');
      return;
    }
    if ([numReal, numInvoice, numParcel, numVasool].some((n) => !Number.isFinite(n) || n < 0)) {
      setFormError('Amounts must be valid non-negative numbers.');
      return;
    }

    setSaving(true);
    try {
      await onSaveTransaction(
        {
          date,
          time,
          vplNumber: vplNumber.trim(),
          customerName: customerName.trim(),
          mobileNumber: mobileNumber.trim(),
          address: address.trim(),
          realAmount: numReal,
          invoiceAmount: numInvoice,
          parcelCharges: numParcel,
          vasool: numVasool,
          remarks: remarks.trim(),
          allowDuplicateVpl,
        },
        editingTransaction?.id,
      );
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save transaction.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (duplicateVplMatch) {
      setConfirmDuplicateOpen(true);
      return;
    }
    await executeSave(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteTransaction(deleteTarget.id);
      if (editingTransaction?.id === deleteTarget.id) {
        resetForm();
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Filtered table records
  const filteredTransactions = useMemo(() => {
    const { start, end } = getDateRangeForPreset(datePreset, customStart, customEnd);
    const q = searchQuery.trim().toLowerCase();

    return transactions.filter((tx) => {
      if (start && tx.date < start) return false;
      if (end && tx.date > end) return false;
      if (!q) return true;
      return (
        tx.vplNumber.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.mobileNumber.toLowerCase().includes(q) ||
        tx.date.includes(q) ||
        String(tx.serialNumber) === q ||
        `#${tx.serialNumber}` === q
      );
    });
  }, [transactions, datePreset, customStart, customEnd, searchQuery]);

  const filteredSummary = useMemo(
    () => summarizePeriod(filteredTransactions, []),
    [filteredTransactions],
  );

  const activeSerial = editingTransaction
    ? editingTransaction.serialNumber
    : nextSerialNumber;

  return (
    <div className="space-y-6">
      {/* Data-Entry Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingTransaction
                ? `Edit Entry #${editingTransaction.serialNumber} · اندراج میں ترمیم`
                : 'New Daily Business Entry · نیا روزانہ اندراج'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatic serial numbering, duplicate VPL detection, and real-time profit calculations
            </p>
          </div>
          <div className="text-xs font-mono-num font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
            {tLabel(FIELD_LABELS.serialNumber, lang)}: #{activeSerial}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Serial, Date, Time, VPL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.serialNumber, lang)}
              </label>
              <input
                type="text"
                readOnly
                value={`#${activeSerial}`}
                className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 text-slate-600 border border-slate-200 rounded-lg cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.date, lang)} *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.time, lang)} *
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.vplNumber, lang)} *
              </label>
              <input
                type="text"
                required
                value={vplNumber}
                onChange={(e) => setVplNumber(e.target.value)}
                placeholder="e.g. VPL-10452"
                className={`w-full px-3 py-2 text-sm font-mono-num border rounded-lg focus:outline-none focus:ring-2 ${
                  duplicateVplMatch
                    ? 'border-amber-500 focus:ring-amber-500 bg-amber-50/40'
                    : 'border-slate-300 focus:ring-emerald-600'
                }`}
              />
            </div>
          </div>

          {/* Duplicate VPL Warning */}
          {duplicateVplMatch && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Duplicate VPL Warning: <strong>{duplicateVplMatch.vplNumber}</strong> is already
                  used in Serial <strong>#{duplicateVplMatch.serialNumber}</strong> (
                  {duplicateVplMatch.customerName}).
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDate(duplicateVplMatch.date);
                  setSearchQuery(duplicateVplMatch.vplNumber);
                }}
                className="text-amber-900 underline font-semibold whitespace-nowrap"
              >
                Show Existing in Table
              </button>
            </div>
          )}

          {/* Row 2: Customer Name, Mobile, Address */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.customerName, lang)} *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer full name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.mobileNumber, lang)}
              </label>
              <input
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.address, lang)}
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Complete delivery address"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {matchingCustomerSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">Existing customer match:</span>
              {matchingCustomerSuggestions.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => handleSelectCustomerAutofill(cust)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-md text-slate-800 transition-ui"
                >
                  {cust.name} {cust.mobileNumber ? `· ${cust.mobileNumber}` : ''}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: Financial Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.realAmount, lang)} ({c})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={realAmount}
                onChange={(e) => setRealAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.invoiceAmount, lang)} ({c})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.parcelCharges, lang)} ({c})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={parcelCharges}
                onChange={(e) => setParcelCharges(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {tLabel(FIELD_LABELS.vasool, lang)} ({c})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={vasool}
                onChange={(e) => setVasool(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Live Automatic Calculated Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div>
              <div className="text-[11px] font-medium text-slate-500">
                {tLabel(FIELD_LABELS.profit, lang)} (Auto)
              </div>
              <div
                className={`mt-1 text-lg font-bold font-mono-num ${
                  liveCalc.profit >= 0 ? 'text-emerald-800' : 'text-rose-700'
                }`}
              >
                {formatCurrency(liveCalc.profit, c)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-500">
                {tLabel(FIELD_LABELS.naffaVasool, lang)} (Auto)
              </div>
              <div className="mt-1 text-lg font-bold font-mono-num text-emerald-700">
                {formatCurrency(liveCalc.naffaVasool, c)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-500">
                {tLabel(FIELD_LABELS.remainingAmount, lang)} (Auto)
              </div>
              <div
                className={`mt-1 text-lg font-bold font-mono-num ${
                  liveCalc.remainingAmount > 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {formatCurrency(liveCalc.remainingAmount, c)}
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {tLabel(FIELD_LABELS.remarks, lang)}
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional order notes, courier name, or payment details"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {formError && (
            <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {formError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>
                {saving
                  ? 'Saving...'
                  : editingTransaction
                    ? 'Update Entry · محفوظ کریں'
                    : 'Save Entry · محفوظ کریں'}
              </span>
            </button>

            {editingTransaction && (
              <button
                type="button"
                onClick={() => setDeleteTarget(editingTransaction)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-ui whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Entry</span>
              </button>
            )}

            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-ui whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear Form</span>
            </button>
          </div>
        </form>
      </div>

      {/* Search & Filter Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print-container">
        <div className="p-5 border-b border-slate-200 space-y-4 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Transaction Ledger & Instant Search · تمام اندراجات
              </h3>
              <p className="text-xs text-slate-500">
                Search instantly by VPL number, customer name, mobile number, date, or serial number
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportTransactionsCsv(filteredTransactions, settings)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search VPL number, customer name, mobile, YYYY-MM-DD, or serial #..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  ['all', 'All'],
                  ['today', 'Today'],
                  ['yesterday', 'Yesterday'],
                  ['this-week', 'This Week'],
                  ['this-month', 'This Month'],
                  ['previous-month', 'Prev Month'],
                  ['custom', 'Custom'],
                ] as Array<[DateFilterPreset, string]>
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDatePreset(preset)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-ui whitespace-nowrap ${
                    datePreset === preset
                      ? 'bg-white text-emerald-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600">From:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600">To:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            </div>
          )}

          {/* Filtered totals bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 pt-1">
            <span>
              Matching Entries: <strong className="font-mono-num text-slate-900">{filteredSummary.entryCount}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Invoice: <strong className="font-mono-num text-slate-900">{formatCurrency(filteredSummary.invoiceAmount, c)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Collected: <strong className="font-mono-num text-emerald-700">{formatCurrency(filteredSummary.vasool, c)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Remaining: <strong className="font-mono-num text-amber-700">{formatCurrency(filteredSummary.remainingAmount, c)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Profit: <strong className="font-mono-num text-emerald-800">{formatCurrency(filteredSummary.grossProfit, c)}</strong>
            </span>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No entries match the current search or date filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Date · Time</th>
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
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono-num font-semibold text-slate-800">
                      #{tx.serialNumber}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num text-slate-600 whitespace-nowrap">
                      {formatDateDisplay(tx.date, settings.dateFormat)} · {tx.time}
                    </td>
                    <td className="py-2.5 px-3 font-mono-num font-medium text-emerald-800 whitespace-nowrap">
                      {tx.vplNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{tx.customerName}</div>
                      {tx.mobileNumber && (
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          {tx.mobileNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-600">
                      {formatCurrency(tx.realAmount, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-900 font-medium">
                      {formatCurrency(tx.invoiceAmount, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-slate-600">
                      {formatCurrency(tx.parcelCharges, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700 font-medium">
                      {formatCurrency(tx.vasool, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700">
                      {formatCurrency(tx.naffaVasool, c)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-num font-medium ${
                        tx.remainingAmount > 0 ? 'text-amber-700' : 'text-slate-600'
                      }`}
                    >
                      {formatCurrency(tx.remainingAmount, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-emerald-800">
                      {formatCurrency(tx.profit, c)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap no-print">
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(tx)}
                        title="Generate Invoice"
                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-ui inline-flex items-center"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onEditTransaction(tx);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        title="Edit Entry"
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-ui inline-flex items-center ml-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tx)}
                        title="Delete Entry"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-ui inline-flex items-center ml-1"
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

      {/* Confirm Duplicate VPL */}
      <ConfirmModal
        open={confirmDuplicateOpen}
        title="Duplicate VPL Number Detected"
        description={`VPL Number "${vplNumber}" already exists on Serial #${duplicateVplMatch?.serialNumber} (${duplicateVplMatch?.customerName}). Do you still want to save this entry?`}
        confirmLabel="Save Anyway"
        danger={false}
        onConfirm={() => {
          setConfirmDuplicateOpen(false);
          executeSave(true);
        }}
        onCancel={() => setConfirmDuplicateOpen(false)}
      />

      {/* Confirm Delete Transaction */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Transaction Entry"
        description={`Are you sure you want to permanently delete Serial #${deleteTarget?.serialNumber} (VPL: ${deleteTarget?.vplNumber})? Reports and charts will update immediately.`}
        confirmLabel="Delete Entry"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
