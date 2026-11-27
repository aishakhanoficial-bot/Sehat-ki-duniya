import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Lock,
  Menu,
  Receipt,
  Settings as SettingsIcon,
  Users,
  X,
  AlertCircle,
} from 'lucide-react';
import { api, setStoredToken } from './api.ts';
import type {
  ActiveTab,
  AppSettings,
  BackupMetadata,
  BackupPayload,
  Customer,
  Expense,
  ExpenseInput,
  ToastMessage,
  Transaction,
  TransactionInput,
} from './types.ts';
import { downloadJsonBackup } from './utils/exports.ts';
import { NAV_LABELS, tLabel } from './utils/i18n.ts';
import { AnalyticsChartsView } from './components/AnalyticsChartsView.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { CustomerLedgerView } from './components/CustomerLedgerView.tsx';
import { DailyReportView } from './components/DailyReportView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ExpensesView } from './components/ExpensesView.tsx';
import { InvoicesView } from './components/InvoicesView.tsx';
import { MonthlyReportView } from './components/MonthlyReportView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { TransactionsView } from './components/TransactionsView.tsx';

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'Sehat Ki Duniya',
  businessUrduName: 'صحت کی دنیا',
  businessPhone: '',
  businessEmail: '',
  businessAddress: '',
  businessLogo: '',
  currency: 'PKR',
  enableExchangeRate: false,
  exchangeRate: 1,
  targetCurrency: 'USD',
  dateFormat: 'YYYY-MM-DD',
  language: 'bilingual',
  profitFormula: 'invoice_minus_real_minus_parcel',
  remainingFormula: 'invoice_minus_vasool',
  naffaFormula: 'proportional_invoice_capped',
  passwordEnabled: false,
  lastBackupAt: null,
  updatedAt: '',
};

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [nextSerialNumber, setNextSerialNumber] = useState(1);
  const [nextExpenseNumber, setNextExpenseNumber] = useState(1);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedInvoiceTxId, setSelectedInvoiceTxId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (type: ToastMessage['type'], text: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const fetchBootstrap = useCallback(async () => {
    setLoadingData(true);
    setLoadError('');
    try {
      const data = await api.bootstrap();
      setTransactions(data.transactions);
      setCustomers(data.customers);
      setExpenses(data.expenses);
      setSettings(data.settings);
      setBackups(data.backups);
      setNextSerialNumber(data.nextSerialNumber);
      setNextExpenseNumber(data.nextExpenseNumber);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setAuthenticated(false);
      } else {
        setLoadError(e.message || 'Failed to connect to accounting database.');
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const status = await api.getAuthStatus();
        if (!mounted) return;
        setAuthenticated(status.authenticated);
        setAuthChecked(true);
        if (status.authenticated) {
          await fetchBootstrap();
        } else {
          setLoadingData(false);
        }
      } catch (err) {
        if (!mounted) return;
        setAuthChecked(true);
        setLoadingData(false);
        setLoadError(err instanceof Error ? err.message : 'Server connection error.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchBootstrap]);

  const handleSaveTransaction = async (
    input: TransactionInput & { allowDuplicateVpl?: boolean },
    editingId?: string,
  ) => {
    if (editingId) {
      await api.updateTransaction(editingId, input);
      notify('success', 'Transaction updated successfully.');
    } else {
      await api.createTransaction(input);
      notify('success', 'Transaction saved permanently.');
    }
    setEditingTransaction(null);
    await fetchBootstrap();
  };

  const handleDeleteTransaction = async (id: string) => {
    await api.deleteTransaction(id);
    notify('success', 'Transaction deleted.');
    await fetchBootstrap();
  };

  const handleSaveExpense = async (input: ExpenseInput, editingId?: string) => {
    if (editingId) {
      await api.updateExpense(editingId, input);
      notify('success', 'Expense updated successfully.');
    } else {
      await api.createExpense(input);
      notify('success', 'Expense recorded.');
    }
    await fetchBootstrap();
  };

  const handleDeleteExpense = async (id: string) => {
    await api.deleteExpense(id);
    notify('success', 'Expense deleted.');
    await fetchBootstrap();
  };

  const handleSaveSettings = async (updates: Partial<AppSettings>) => {
    const updated = await api.updateSettings(updates);
    setSettings(updated);
    notify('success', 'Settings saved.');
  };

  const handleRecalculateAll = async () => {
    const res = await api.recalculateTransactions();
    await fetchBootstrap();
    notify('success', `Recalculated ${res.recalculatedCount} transactions.`);
  };

  const handleCreateBackup = async (label?: string) => {
    const res = await api.createBackup(label);
    downloadJsonBackup(res.payload);
    await fetchBootstrap();
    notify('success', 'Backup created and downloaded as JSON.');
  };

  const handleRestoreBackup = async (input: {
    backupId?: string;
    payload?: BackupPayload;
  }) => {
    const res = await api.restoreBackup(input);
    await fetchBootstrap();
    notify(
      'success',
      `Restored ${res.restored.transactions} transactions and ${res.restored.expenses} expenses.`,
    );
  };

  const handleDeleteBackup = async (id: string) => {
    await api.deleteBackup(id);
    await fetchBootstrap();
    notify('info', 'Backup snapshot removed.');
  };

  const handleLockWorkspace = async () => {
    try {
      await api.logout();
    } catch {
      // ignore logout error
    }
    setStoredToken(null);
    setAuthenticated(false);
  };

  const handleEditFromAnyView = (tx: Transaction) => {
    setEditingTransaction(tx);
    setActiveTab('entries');
  };

  const handleOpenInvoice = (tx: Transaction) => {
    setSelectedInvoiceTxId(tx.id);
    setActiveTab('invoices');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">
          Loading Sehat Ki Duniya Accounting System...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AuthGate
        onUnlocked={async () => {
          setAuthenticated(true);
          await fetchBootstrap();
        }}
      />
    );
  }

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dashboard', label: tLabel(NAV_LABELS.dashboard, settings.language), icon: LayoutDashboard },
    { id: 'entries', label: tLabel(NAV_LABELS.entries, settings.language), icon: FilePlus2 },
    { id: 'daily-report', label: tLabel(NAV_LABELS.dailyReport, settings.language), icon: CalendarDays },
    { id: 'monthly-report', label: tLabel(NAV_LABELS.monthlyReport, settings.language), icon: CalendarRange },
    { id: 'charts', label: tLabel(NAV_LABELS.charts, settings.language), icon: BarChart3 },
    { id: 'expenses', label: tLabel(NAV_LABELS.expenses, settings.language), icon: Receipt },
    { id: 'customers', label: tLabel(NAV_LABELS.customers, settings.language), icon: Users },
    { id: 'invoices', label: tLabel(NAV_LABELS.invoices, settings.language), icon: FileText },
    { id: 'settings', label: tLabel(NAV_LABELS.settings, settings.language), icon: SettingsIcon },
  ];

  const activeNavMeta = navItems.find((n) => n.id === activeTab) || navItems[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-emerald-950 text-emerald-50 border-r border-emerald-900 no-print">
        <div className="px-5 py-5 border-b border-emerald-900/80 flex items-center gap-3">
          <BrandLogo logoUrl={settings.businessLogo} size="md" light />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {settings.businessName}
            </div>
            <div className="text-sm font-urdu text-emerald-300 truncate">
              {settings.businessUrduName}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-ui text-left ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-emerald-100/80 hover:bg-emerald-900/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-900/80 space-y-2">
          <div className="text-[11px] text-emerald-300/80">
            {settings.currency} · {transactions.length} entries · {customers.length} customers
          </div>
          {settings.passwordEnabled && (
            <button
              type="button"
              onClick={handleLockWorkspace}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100 bg-emerald-900 hover:bg-emerald-800 rounded-lg transition-ui"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock System</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-20 lg:pb-8">
        {/* Top Bar Contract: Breadcrumb | Language quick selector | 1 Primary CTA */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sm:gap-8 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden">
              <BrandLogo logoUrl={settings.businessLogo} size="sm" />
            </div>
            <div className="text-sm font-bold text-slate-900 whitespace-nowrap truncate">
              {settings.businessName} <span className="text-slate-300 mx-1.5">/</span>{' '}
              <span className="font-medium text-emerald-800">{activeNavMeta.label}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(['bilingual', 'en', 'ur'] as const).map((langOpt) => (
              <button
                key={langOpt}
                type="button"
                onClick={() => handleSaveSettings({ language: langOpt })}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-ui whitespace-nowrap ${
                  settings.language === langOpt
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {langOpt === 'bilingual' ? 'EN · اردو' : langOpt === 'en' ? 'English' : 'اردو'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingTransaction(null);
                setActiveTab('entries');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>New Entry</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {loadError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-sm font-semibold text-red-900">{loadError}</p>
              <button
                type="button"
                onClick={fetchBootstrap}
                className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
              >
                Retry Connection
              </button>
            </div>
          ) : loadingData ? (
            <div className="space-y-4">
              <div className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  transactions={transactions}
                  expenses={expenses}
                  settings={settings}
                  onNavigate={setActiveTab}
                  onEditTransaction={handleEditFromAnyView}
                  onOpenInvoice={handleOpenInvoice}
                  onQuickBackup={() => handleCreateBackup()}
                />
              )}

              {activeTab === 'entries' && (
                <TransactionsView
                  transactions={transactions}
                  customers={customers}
                  nextSerialNumber={nextSerialNumber}
                  settings={settings}
                  editingTransaction={editingTransaction}
                  onEditTransaction={setEditingTransaction}
                  onClearEditing={() => setEditingTransaction(null)}
                  onSaveTransaction={handleSaveTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenInvoice={handleOpenInvoice}
                />
              )}

              {activeTab === 'daily-report' && (
                <DailyReportView
                  transactions={transactions}
                  expenses={expenses}
                  settings={settings}
                  onEditTransaction={handleEditFromAnyView}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenInvoice={handleOpenInvoice}
                />
              )}

              {activeTab === 'monthly-report' && (
                <MonthlyReportView
                  transactions={transactions}
                  expenses={expenses}
                  settings={settings}
                />
              )}

              {activeTab === 'charts' && (
                <AnalyticsChartsView
                  transactions={transactions}
                  expenses={expenses}
                  settings={settings}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpensesView
                  expenses={expenses}
                  nextExpenseNumber={nextExpenseNumber}
                  settings={settings}
                  onSaveExpense={handleSaveExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {activeTab === 'customers' && (
                <CustomerLedgerView
                  customers={customers}
                  transactions={transactions}
                  settings={settings}
                  onOpenInvoice={handleOpenInvoice}
                />
              )}

              {activeTab === 'invoices' && (
                <InvoicesView
                  transactions={transactions}
                  settings={settings}
                  selectedTransactionId={selectedInvoiceTxId}
                  onSelectTransaction={setSelectedInvoiceTxId}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  settings={settings}
                  backups={backups}
                  onSaveSettings={handleSaveSettings}
                  onRecalculateAll={handleRecalculateAll}
                  onCreateBackup={handleCreateBackup}
                  onRestoreBackup={handleRestoreBackup}
                  onDeleteBackup={handleDeleteBackup}
                  onPasswordUpdated={(enabled, token) => {
                    setStoredToken(token);
                    setSettings((prev) => ({ ...prev, passwordEnabled: enabled }));
                  }}
                  onLockNow={handleLockWorkspace}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white px-4 sm:px-6 py-4 no-print">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              {settings.businessName} · <span className="font-urdu">{settings.businessUrduName}</span>
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 text-center">
              <span>
                Designed and developed by <strong className="font-semibold text-slate-900">Ayesha Khan</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <a
                href="https://wa.me/923470256011"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono-num font-medium text-emerald-800 hover:text-emerald-950 hover:underline"
              >
                WhatsApp +923470256011
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-5 h-16 no-print"
        aria-label="Mobile Bottom Navigation"
      >
        {(
          [
            { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
            { id: 'entries', label: 'Entries', icon: FilePlus2 },
            { id: 'daily-report', label: 'Daily', icon: CalendarDays },
            { id: 'expenses', label: 'Expenses', icon: Receipt },
          ] as Array<{
            id: ActiveTab;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }>
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium ${
                isActive ? 'text-emerald-800 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium ${
            mobileMenuOpen ? 'text-emerald-800 font-semibold' : 'text-slate-500'
          }`}
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 bottom-16 z-40 bg-white border-t border-slate-200 shadow-xl p-3 grid grid-cols-2 gap-2 no-print">
          {navItems
            .filter(
              (n) =>
                !['dashboard', 'entries', 'daily-report', 'expenses'].includes(n.id),
            )
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium min-h-[44px] ${
                    activeTab === item.id
                      ? 'bg-emerald-50 text-emerald-900 font-semibold'
                      : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-20 lg:bottom-5 right-5 z-50 space-y-2 max-w-sm no-print">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : toast.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-900 border-emerald-800 text-white'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
