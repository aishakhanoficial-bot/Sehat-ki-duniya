import React, { useState } from 'react';
import {
  Calculator,
  Database,
  Download,
  Lock,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '../api.ts';
import type {
  AppSettings,
  BackupMetadata,
  BackupPayload,
  CurrencyCode,
  DateFormatType,
  LanguageMode,
  NaffaFormula,
  ProfitFormula,
  RemainingFormula,
} from '../types.ts';
import { CURRENCIES } from '../utils/calculations.ts';
import { downloadJsonBackup } from '../utils/exports.ts';
import { BrandLogo } from './BrandLogo.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';

interface SettingsViewProps {
  settings: AppSettings;
  backups: BackupMetadata[];
  onSaveSettings: (updates: Partial<AppSettings>) => Promise<void>;
  onRecalculateAll: () => Promise<void>;
  onCreateBackup: (label?: string) => Promise<void>;
  onRestoreBackup: (input: { backupId?: string; payload?: BackupPayload }) => Promise<void>;
  onDeleteBackup: (id: string) => Promise<void>;
  onPasswordUpdated: (enabled: boolean, token: string | null) => void;
  onLockNow: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', text: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  backups,
  onSaveSettings,
  onRecalculateAll,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
  onPasswordUpdated,
  onLockNow,
  onNotify,
}) => {
  const [businessName, setBusinessName] = useState(settings.businessName);
  const [businessUrduName, setBusinessUrduName] = useState(settings.businessUrduName);
  const [businessPhone, setBusinessPhone] = useState(settings.businessPhone);
  const [businessEmail, setBusinessEmail] = useState(settings.businessEmail);
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress);
  const [businessLogo, setBusinessLogo] = useState(settings.businessLogo);

  const [currency, setCurrency] = useState<CurrencyCode>(settings.currency);
  const [enableExchangeRate, setEnableExchangeRate] = useState(settings.enableExchangeRate);
  const [exchangeRate, setExchangeRate] = useState(String(settings.exchangeRate || 1));
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>(settings.targetCurrency);

  const [dateFormat, setDateFormat] = useState<DateFormatType>(settings.dateFormat);
  const [language, setLanguage] = useState<LanguageMode>(settings.language);
  const [profitFormula, setProfitFormula] = useState<ProfitFormula>(settings.profitFormula);
  const [remainingFormula, setRemainingFormula] = useState<RemainingFormula>(
    settings.remainingFormula,
  );
  const [naffaFormula, setNaffaFormula] = useState<NaffaFormula>(settings.naffaFormula);

  const [saving, setSaving] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Backups & modals
  const [backupLabel, setBackupLabel] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [confirmRecalcOpen, setConfirmRecalcOpen] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<{
    backupId?: string;
    payload?: BackupPayload;
    label: string;
  } | null>(null);
  const [deleteBackupTarget, setDeleteBackupTarget] = useState<BackupMetadata | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      onNotify('error', 'Logo file must be under 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBusinessLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        businessName: businessName.trim() || 'Sehat Ki Duniya',
        businessUrduName: businessUrduName.trim() || 'صحت کی دنیا',
        businessPhone: businessPhone.trim(),
        businessEmail: businessEmail.trim(),
        businessAddress: businessAddress.trim(),
        businessLogo,
        currency,
        enableExchangeRate,
        exchangeRate: Number(exchangeRate) > 0 ? Number(exchangeRate) : 1,
        targetCurrency,
        dateFormat,
        language,
        profitFormula,
        remainingFormula,
        naffaFormula,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEnableOrUpdatePassword = async (enable: boolean) => {
    setPwdLoading(true);
    try {
      const res = await api.updatePassword({
        enable,
        currentPassword,
        newPassword,
      });
      onPasswordUpdated(res.passwordEnabled, res.token);
      setCurrentPassword('');
      setNewPassword('');
      onNotify(
        'success',
        enable
          ? 'Password protection enabled successfully.'
          : 'Password protection disabled.',
      );
    } catch (err) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleUploadRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as BackupPayload;
        if (
          !parsed ||
          !Array.isArray(parsed.transactions) ||
          !Array.isArray(parsed.customers) ||
          !Array.isArray(parsed.expenses)
        ) {
          onNotify('error', 'Invalid backup JSON structure.');
          return;
        }
        setRestoreConfirm({
          payload: parsed,
          label: `${file.name} (${parsed.transactions.length} transactions, ${parsed.expenses.length} expenses)`,
        });
      } catch {
        onNotify('error', 'Could not parse JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveGeneral} className="space-y-6">
        {/* 1. Business Profile & Logo */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-900">
              Business Settings & Configuration · سیٹنگز
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize business contact details, logo, currency, language, and accounting rules
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <BrandLogo logoUrl={businessLogo} size="lg" />
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700">
                Business Logo (shown on sidebar and printable invoices)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {businessLogo && (
                  <button
                    type="button"
                    onClick={() => setBusinessLogo('')}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Name (English)
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Urdu Title · کاروبار کا اردو نام
              </label>
              <input
                type="text"
                value={businessUrduName}
                onChange={(e) => setBusinessUrduName(e.target.value)}
                className="w-full px-3 py-2 text-sm font-urdu border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+92 300 0000000"
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="accounts@sehatkiduniya.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Address
              </label>
              <input
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                placeholder="Shop / Office address shown on printed invoices"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* 2. Currency, Date Format & Language */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-900">
            Currency, Date Format & Language · کرنسی اور زبان
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Default Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                  <option key={code} value={code}>
                    {code} – {CURRENCIES[code].name} ({CURRENCIES[code].symbol.trim()})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Updates currency symbol display without silently altering saved numbers.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatType)}
                className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg bg-white"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-26)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (26/11/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (11/26/2026)</option>
                <option value="DD MMM YYYY">DD MMM YYYY (26 Nov 2026)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Interface Language · زبان
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageMode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="bilingual">Bilingual (English · اردو)</option>
                <option value="en">English Only</option>
                <option value="ur">Urdu Focus (اردو)</option>
              </select>
            </div>
          </div>

          {/* Optional Separate Converted Display */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={enableExchangeRate}
                onChange={(e) => setEnableExchangeRate(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700"
              />
              <span>Show separate converted currency reference on Dashboard (using manual exchange rate)</span>
            </label>

            {enableExchangeRate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Reference Currency
                  </label>
                  <select
                    value={targetCurrency}
                    onChange={(e) => setTargetCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                      <option key={code} value={code}>
                        {code} – {CURRENCIES[code].name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Exchange Rate (1 {currency} = ? {targetCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Configurable Calculation Rules */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Accounting Calculation Formulas · حساب کتاب کے فارمولے
              </h3>
              <p className="text-xs text-slate-500">
                Configure automatic calculation rules for Profit, Remaining Amount, and Naffa Vasool
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmRecalcOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg whitespace-nowrap self-start"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Recalculate All Existing Entries</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Profit Formula
              </label>
              <select
                value={profitFormula}
                onChange={(e) => setProfitFormula(e.target.value as ProfitFormula)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="invoice_minus_real_minus_parcel">
                  Invoice − Real − Parcel Charges (Default)
                </option>
                <option value="invoice_minus_real">
                  Invoice Amount − Real Amount
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Remaining Balance Formula
              </label>
              <select
                value={remainingFormula}
                onChange={(e) => setRemainingFormula(e.target.value as RemainingFormula)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="invoice_minus_vasool">
                  Invoice − Vasool (Default)
                </option>
                <option value="invoice_plus_parcel_minus_vasool">
                  Invoice + Parcel − Vasool
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Naffa Vasool (Collected Profit) Formula
              </label>
              <select
                value={naffaFormula}
                onChange={(e) => setNaffaFormula(e.target.value as NaffaFormula)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="proportional_invoice_capped">
                  Profit × (Vasool / Invoice), capped at 100% (Default)
                </option>
                <option value="proportional_invoice_uncapped">
                  Profit × (Vasool / Invoice)
                </option>
                <option value="proportional_total">
                  Profit × (Vasool / (Invoice + Parcel))
                </option>
                <option value="vasool_after_real">
                  Vasool − Real Amount (Profit after Cost Recovery)
                </option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Settings...' : 'Save All Settings · سیٹنگز محفوظ کریں'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* 4. Password Protection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Password Protection · پاس ورڈ سیکیورٹی
              </h3>
              <p className="text-xs text-slate-500">
                Status: {settings.passwordEnabled ? 'Enabled (Locked on sign-out or new browser)' : 'Disabled'}
              </p>
            </div>
          </div>
          {settings.passwordEnabled && (
            <button
              type="button"
              onClick={onLockNow}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Lock Workspace Now
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {settings.passwordEnabled && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {settings.passwordEnabled ? 'New Password (min 4 chars)' : 'Set Password (min 4 chars)'}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pwdLoading || newPassword.length < 4}
            onClick={() => handleEnableOrUpdatePassword(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50"
          >
            {settings.passwordEnabled ? 'Update Password' : 'Enable Password Lock'}
          </button>

          {settings.passwordEnabled && (
            <button
              type="button"
              disabled={pwdLoading || !currentPassword}
              onClick={() => handleEnableOrUpdatePassword(false)}
              className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg disabled:opacity-50"
            >
              Disable Password Lock
            </button>
          )}
        </div>
      </div>

      {/* 5. Data Backup & Restore */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Data Backup & Restore · ڈیٹا بیک اپ اور بحالی
              </h3>
              <p className="text-xs text-slate-500">
                Create permanent server snapshots, download full JSON backups, or restore from a JSON file
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={backupLabel}
            onChange={(e) => setBackupLabel(e.target.value)}
            placeholder="Optional backup label (e.g. Month-End Nov 2026)"
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <button
            type="button"
            disabled={creatingBackup}
            onClick={async () => {
              setCreatingBackup(true);
              try {
                await onCreateBackup(backupLabel.trim() || undefined);
                setBackupLabel('');
              } finally {
                setCreatingBackup(false);
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{creatingBackup ? 'Creating...' : 'Create & Download JSON Backup'}</span>
          </button>

          <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            <span>Restore from JSON File</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleUploadRestoreFile}
              className="hidden"
            />
          </label>
        </div>

        {backups.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2 px-3">Backup Label</th>
                  <th className="py-2 px-3">Created At</th>
                  <th className="py-2 px-3 text-right">Transactions</th>
                  <th className="py-2 px-3 text-right">Customers</th>
                  <th className="py-2 px-3 text-right">Expenses</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 px-3 font-medium text-slate-900">{b.label}</td>
                    <td className="py-2 px-3 font-mono-num text-slate-600">
                      {b.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-num">{b.transactionCount}</td>
                    <td className="py-2 px-3 text-right font-mono-num">{b.customerCount}</td>
                    <td className="py-2 px-3 text-right font-mono-num">{b.expenseCount}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={async () => {
                          const payload = await api.downloadBackup(b.id);
                          downloadJsonBackup(payload);
                        }}
                        className="text-emerald-700 hover:text-emerald-900 font-medium mr-3"
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRestoreConfirm({ backupId: b.id, label: b.label })
                        }
                        className="text-amber-700 hover:text-amber-900 font-medium mr-3"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteBackupTarget(b)}
                        className="text-red-600 hover:text-red-800 inline-flex items-center"
                        title="Delete Snapshot"
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

      {/* Confirm Recalculate */}
      <ConfirmModal
        open={confirmRecalcOpen}
        title="Recalculate All Transactions"
        description="Save current formula settings first if you changed them. Recalculating will recompute Profit, Naffa Vasool, and Remaining Amount for every saved transaction."
        confirmLabel="Recalculate Now"
        danger={false}
        onConfirm={async () => {
          setConfirmRecalcOpen(false);
          await onRecalculateAll();
        }}
        onCancel={() => setConfirmRecalcOpen(false)}
      />

      {/* Confirm Restore */}
      <ConfirmModal
        open={Boolean(restoreConfirm)}
        title="Restore Backup Data"
        description={`Restoring "${restoreConfirm?.label}" will replace all current transactions, customers, and expenses with the backup contents. Continue?`}
        confirmLabel="Restore Data"
        onConfirm={async () => {
          if (!restoreConfirm) return;
          const target = restoreConfirm;
          setRestoreConfirm(null);
          await onRestoreBackup({
            backupId: target.backupId,
            payload: target.payload,
          });
        }}
        onCancel={() => setRestoreConfirm(null)}
      />

      {/* Confirm Delete Backup */}
      <ConfirmModal
        open={Boolean(deleteBackupTarget)}
        title="Delete Backup Snapshot"
        description={`Delete saved backup "${deleteBackupTarget?.label}"? Your active live records will not be affected.`}
        confirmLabel="Delete Backup"
        onConfirm={async () => {
          if (!deleteBackupTarget) return;
          const id = deleteBackupTarget.id;
          setDeleteBackupTarget(null);
          await onDeleteBackup(id);
        }}
        onCancel={() => setDeleteBackupTarget(null)}
      />
    </div>
  );
};
