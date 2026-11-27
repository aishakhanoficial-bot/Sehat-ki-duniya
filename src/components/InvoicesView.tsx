import React, { useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import type { AppSettings, Transaction } from '../types.ts';
import { formatCurrency, formatDateDisplay } from '../utils/calculations.ts';
import { downloadInvoicePdf } from '../utils/exports.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface InvoicesViewProps {
  transactions: Transaction[];
  settings: AppSettings;
  selectedTransactionId: string | null;
  onSelectTransaction: (id: string) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  transactions,
  settings,
  selectedTransactionId,
  onSelectTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [showRealAmount, setShowRealAmount] = useState(true);

  const c = settings.currency;

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (tx) =>
        tx.vplNumber.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q) ||
        tx.mobileNumber.toLowerCase().includes(q) ||
        String(tx.serialNumber) === q,
    );
  }, [transactions, search]);

  const activeTx = useMemo(() => {
    return (
      transactions.find((t) => t.id === selectedTransactionId) ||
      filteredList[0] ||
      null
    );
  }, [transactions, filteredList, selectedTransactionId]);

  const totalAmount = activeTx ? activeTx.invoiceAmount + activeTx.parcelCharges : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Selector List */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col max-h-[780px] no-print">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Invoice Generator · انوائس جنریٹر
            </h2>
            <p className="text-xs text-slate-500">
              Select an entry to preview, print, or download PDF invoice
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Serial #, VPL, Customer..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No transactions available to generate an invoice.
            </div>
          ) : (
            filteredList.map((tx) => {
              const isSelected = activeTx?.id === tx.id;
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onSelectTransaction(tx.id)}
                  className={`w-full text-left p-3.5 transition-ui ${
                    isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-num font-bold text-slate-900">
                      INV-{String(tx.serialNumber).padStart(4, '0')}
                    </span>
                    <span className="font-mono-num text-emerald-800">{tx.vplNumber}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate">{tx.customerName}</span>
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatCurrency(tx.invoiceAmount + tx.parcelCharges, c)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Invoice Document Preview */}
      <div className="lg:col-span-8 space-y-4">
        {activeTx && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 no-print">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showRealAmount}
                onChange={(e) => setShowRealAmount(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>Include Real Amount on Invoice</span>
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => downloadInvoicePdf(activeTx, settings, showRealAmount)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        )}

        {!activeTx ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
            Save a transaction in Daily Entries to generate printable invoices.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print-container">
            {/* Invoice Top Banner */}
            <div className="bg-emerald-950 text-white p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <BrandLogo logoUrl={settings.businessLogo} size="lg" light />
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    {settings.businessName}
                  </h3>
                  <p className="text-lg font-urdu text-emerald-200">
                    {settings.businessUrduName}
                  </p>
                  <div className="mt-1 text-xs text-emerald-100/80 space-x-2">
                    {settings.businessPhone && <span>{settings.businessPhone}</span>}
                    {settings.businessEmail && <span>· {settings.businessEmail}</span>}
                    {settings.businessAddress && <span>· {settings.businessAddress}</span>}
                  </div>
                </div>
              </div>

              <div className="sm:text-right">
                <div className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                  Official Invoice
                </div>
                <div className="text-xl font-bold font-mono-num mt-0.5">
                  INV-{String(activeTx.serialNumber).padStart(4, '0')}
                </div>
                <div className="text-xs font-mono-num text-emerald-200 mt-1">
                  VPL: {activeTx.vplNumber}
                </div>
              </div>
            </div>

            {/* Metadata & Customer */}
            <div className="p-7 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-1.5">
                    Customer Details · کسٹمر کی تفصیل
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {activeTx.customerName}
                  </div>
                  {activeTx.mobileNumber && (
                    <div className="text-xs font-mono-num text-slate-600 mt-1">
                      Mobile: {activeTx.mobileNumber}
                    </div>
                  )}
                  {activeTx.address && (
                    <div className="text-xs text-slate-600 mt-1">
                      Address: {activeTx.address}
                    </div>
                  )}
                </div>

                <div className="sm:text-right space-y-1 text-xs">
                  <div className="text-slate-500">
                    Date · تاریخ:{' '}
                    <span className="font-mono-num font-semibold text-slate-900">
                      {formatDateDisplay(activeTx.date, settings.dateFormat)}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    Time · وقت:{' '}
                    <span className="font-mono-num font-semibold text-slate-900">
                      {activeTx.time}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    Serial Number · نمبر شمار:{' '}
                    <span className="font-mono-num font-semibold text-slate-900">
                      #{activeTx.serialNumber}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    VPL Tracking:{' '}
                    <span className="font-mono-num font-semibold text-emerald-800">
                      {activeTx.vplNumber}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Description · تفصیل</th>
                    <th className="py-3 px-4 text-right">Amount ({c}) · رقم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {showRealAmount && (
                    <tr>
                      <td className="py-3 px-4 text-slate-600">Real Amount · اصل رقم</td>
                      <td className="py-3 px-4 text-right font-mono-num text-slate-700">
                        {formatCurrency(activeTx.realAmount, c)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      Invoice Amount · انوائس رقم
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {formatCurrency(activeTx.invoiceAmount, c)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      Parcel Charges · پارسل چارجز
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-900">
                      {formatCurrency(activeTx.parcelCharges, c)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="py-3 px-4 text-slate-900">
                      Total Amount · کل رقم
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-950">
                      {formatCurrency(totalAmount, c)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-emerald-800">
                      Paid Amount (Vasool) · وصول شدہ رقم
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-emerald-700">
                      {formatCurrency(activeTx.vasool, c)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/60 font-bold">
                    <td className="py-3.5 px-4 text-slate-900">
                      Remaining Balance · بقایا رقم
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono-num text-base ${
                        activeTx.remainingAmount > 0 ? 'text-amber-700' : 'text-emerald-800'
                      }`}
                    >
                      {formatCurrency(activeTx.remainingAmount, c)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {activeTx.remarks && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-700">
                  <span className="font-semibold">Remarks · ریمارکس: </span>
                  {activeTx.remarks}
                </div>
              )}

              <div className="pt-10 grid grid-cols-2 gap-8 text-xs text-slate-500">
                <div className="border-t border-slate-300 pt-2">
                  Authorized Signature · دستخط مجاز
                </div>
                <div className="border-t border-slate-300 pt-2 text-right">
                  Customer Signature · دستخط کسٹمر
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
