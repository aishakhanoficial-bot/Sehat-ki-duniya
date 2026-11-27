import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  AppSettings,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  PaymentMethod,
} from '../types.ts';
import {
  formatCurrency,
  formatDateDisplay,
  getNowTimeHm,
  getTodayIso,
} from '../utils/calculations.ts';
import { exportExpensesCsv } from '../utils/exports.ts';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, tLabel } from '../utils/i18n.ts';
import { ConfirmModal } from './ConfirmModal.tsx';

interface ExpensesViewProps {
  expenses: Expense[];
  nextExpenseNumber: number;
  settings: AppSettings;
  onSaveExpense: (input: ExpenseInput, editingId?: string) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

const CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Electricity',
  'Staff Salary',
  'Transport',
  'Parcel',
  'Office Expenses',
  'Other',
];

const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Bank Transfer',
  'JazzCash / Easypaisa',
  'Card',
  'Cheque',
  'Other',
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  nextExpenseNumber,
  settings,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [date, setDate] = useState(getTodayIso());
  const [time, setTime] = useState(getNowTimeHm());
  const [category, setCategory] = useState<ExpenseCategory>('Office Expenses');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const lang = settings.language;
  const c = settings.currency;

  const resetForm = () => {
    setEditingExpense(null);
    setDate(getTodayIso());
    setTime(getNowTimeHm());
    setCategory('Office Expenses');
    setDescription('');
    setAmount('');
    setPaymentMethod('Cash');
    setFormError('');
  };

  const handleEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setDate(exp.date);
    setTime(exp.time);
    setCategory(exp.category);
    setDescription(exp.description);
    setAmount(String(exp.amount));
    setPaymentMethod(exp.paymentMethod);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setFormError('Expense amount must be greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await onSaveExpense(
        {
          date,
          time,
          category,
          description: description.trim(),
          amount: numAmount,
          paymentMethod,
        },
        editingExpense?.id,
      );
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteExpense(deleteTarget.id);
      if (editingExpense?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (catFilter !== 'ALL' && e.category !== catFilter) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.paymentMethod.toLowerCase().includes(q) ||
        e.date.includes(q) ||
        String(e.expenseNumber) === q
      );
    });
  }, [expenses, search, catFilter]);

  const totalFiltered = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses],
  );

  return (
    <div className="space-y-6">
      {/* Expense Entry Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingExpense
                ? `Edit Expense #EXP-${editingExpense.expenseNumber}`
                : 'Business Expense Management · کاروباری اخراجات'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Expenses automatically deduct from Daily and Monthly Net Profit (Gross Profit − Business Expenses)
            </p>
          </div>
          <div className="text-xs font-mono-num font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
            EXP-#{editingExpense ? editingExpense.expenseNumber : nextExpenseNumber}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expense Number
              </label>
              <input
                type="text"
                readOnly
                value={`EXP-${editingExpense ? editingExpense.expenseNumber : nextExpenseNumber}`}
                className="w-full px-3 py-2 text-sm font-mono-num bg-slate-50 text-slate-600 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date · تاریخ *
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
                Time · وقت *
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
                Expense Category · قسم *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {tLabel(EXPENSE_CATEGORY_LABELS[cat], lang)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {category === 'Parcel' && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2">
              Note: Transaction parcel charges are already tracked per invoice. Only log separate unbilled courier or packaging expenses here to avoid counting parcel costs twice.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount ({c}) · رقم *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Method · ادائیگی کا طریقہ
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {tLabel(PAYMENT_METHOD_LABELS[pm], lang)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description · تفصیل
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Shop rent for November"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {formError && (
            <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2">
              {formError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}</span>
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-ui"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </form>
      </div>

      {/* Expense Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search expenses by description, category, date..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono-num font-semibold text-rose-700">
              Total: {formatCurrency(totalFiltered, c)}
            </span>
            <button
              type="button"
              onClick={() => exportExpensesCsv(filteredExpenses, settings)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No expenses found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Exp #</th>
                  <th className="py-2.5 px-4">Date · Time</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono-num font-semibold text-slate-800">
                      EXP-{exp.expenseNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono-num text-slate-600 whitespace-nowrap">
                      {formatDateDisplay(exp.date, settings.dateFormat)} · {exp.time}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{exp.category}</td>
                    <td className="py-2.5 px-4 text-slate-600">{exp.description || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{exp.paymentMethod}</td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-rose-700">
                      {formatCurrency(exp.amount, c)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEdit(exp)}
                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                        title="Edit Expense"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(exp)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md ml-1"
                        title="Delete Expense"
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

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Expense Record"
        description={`Delete Expense EXP-${deleteTarget?.expenseNumber} (${deleteTarget?.category}: ${deleteTarget ? formatCurrency(deleteTarget.amount, c) : ''})?`}
        confirmLabel="Delete Expense"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
