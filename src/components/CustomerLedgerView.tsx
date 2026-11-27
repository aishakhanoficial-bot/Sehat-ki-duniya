import React, { useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  User,
} from 'lucide-react';
import type { AppSettings, Customer, Transaction } from '../types.ts';
import {
  formatCurrency,
  formatDateDisplay,
  summarizePeriod,
} from '../utils/calculations.ts';
import {
  downloadCustomerStatementPdf,
  exportCustomerLedgerExcel,
} from '../utils/exports.ts';

interface CustomerLedgerViewProps {
  customers: Customer[];
  transactions: Transaction[];
  settings: AppSettings;
  onOpenInvoice: (tx: Transaction) => void;
}

export const CustomerLedgerView: React.FC<CustomerLedgerViewProps> = ({
  customers,
  transactions,
  settings,
  onOpenInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id || '',
  );

  const c = settings.currency;

  const customerSummaries = useMemo(() => {
    return customers.map((cust) => {
      const custTxs = transactions.filter(
        (t) =>
          t.customerId === cust.id ||
          (cust.mobileNumber && t.mobileNumber === cust.mobileNumber) ||
          t.customerName.toLowerCase() === cust.name.toLowerCase(),
      );
      const summary = summarizePeriod(custTxs, []);
      return { customer: cust, transactions: custTxs, summary };
    });
  }, [customers, transactions]);

  const filteredDirectory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customerSummaries;
    return customerSummaries.filter(
      ({ customer }) =>
        customer.name.toLowerCase().includes(q) ||
        customer.mobileNumber.toLowerCase().includes(q) ||
        customer.address.toLowerCase().includes(q),
    );
  }, [customerSummaries, search]);

  const activeLedger = useMemo(() => {
    return (
      customerSummaries.find((s) => s.customer.id === selectedCustomerId) ||
      filteredDirectory[0] ||
      null
    );
  }, [customerSummaries, filteredDirectory, selectedCustomerId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Directory */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col max-h-[760px] no-print">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Customers · کسٹمر کھاتہ ({customers.length})
            </h2>
            <p className="text-xs text-slate-500">
              Select a customer to inspect ledger and print statement
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, mobile, address..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
          {filteredDirectory.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No customers found. Customers are automatically added when you save transactions.
            </div>
          ) : (
            filteredDirectory.map(({ customer, summary }) => {
              const isActive = activeLedger?.customer.id === customer.id;
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`w-full text-left p-4 transition-ui ${
                    isActive ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {customer.name}
                    </div>
                    <span className="text-xs font-mono-num text-slate-500 shrink-0">
                      {summary.entryCount} orders
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono-num">
                      {customer.mobileNumber || 'No mobile'}
                    </span>
                    <span
                      className={`font-mono-num font-semibold ${
                        summary.remainingAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      Bal: {formatCurrency(summary.remainingAmount, c)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Customer Statement */}
      <div className="lg:col-span-8 space-y-5 print-container">
        {!activeLedger ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">
              No Customer Selected
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Record a transaction first or choose a customer from the left directory.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-emerald-800">
                  Individual Customer Ledger · کسٹمر اسٹیٹمنٹ
                </div>
                <h3 className="mt-1 text-xl font-bold text-slate-900">
                  {activeLedger.customer.name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-mono-num">
                    {activeLedger.customer.mobileNumber || 'No mobile number'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeLedger.customer.address || 'No address saved'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() =>
                    exportCustomerLedgerExcel(
                      activeLedger.customer,
                      activeLedger.transactions,
                      settings,
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadCustomerStatementPdf(
                      activeLedger.customer,
                      activeLedger.transactions,
                      settings,
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-[11px] font-medium text-slate-500">Total Invoices</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-slate-900">
                  {formatCurrency(activeLedger.summary.invoiceAmount, c)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-[11px] font-medium text-slate-500">Total Collected</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-emerald-700">
                  {formatCurrency(activeLedger.summary.vasool, c)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-[11px] font-medium text-slate-500">Outstanding Balance</div>
                <div
                  className={`mt-1 text-lg font-bold font-mono-num ${
                    activeLedger.summary.remainingAmount > 0
                      ? 'text-amber-700'
                      : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(activeLedger.summary.remainingAmount, c)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-[11px] font-medium text-slate-500">Total Profit</div>
                <div className="mt-1 text-lg font-bold font-mono-num text-emerald-800">
                  {formatCurrency(activeLedger.summary.grossProfit, c)}
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">
                  Transaction History ({activeLedger.transactions.length})
                </h4>
              </div>
              {activeLedger.transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No transactions found for this customer.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Serial</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">VPL No</th>
                        <th className="py-2.5 px-3 text-right">Invoice</th>
                        <th className="py-2.5 px-3 text-right">Parcel</th>
                        <th className="py-2.5 px-3 text-right">Vasool</th>
                        <th className="py-2.5 px-3 text-right">Remaining</th>
                        <th className="py-2.5 px-3 text-right">Profit</th>
                        <th className="py-2.5 px-3 text-right no-print">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeLedger.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2.5 px-3 font-mono-num font-semibold">
                            #{tx.serialNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-slate-600">
                            {formatDateDisplay(tx.date, settings.dateFormat)}
                          </td>
                          <td className="py-2.5 px-3 font-mono-num text-emerald-800">
                            {tx.vplNumber}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num">
                            {formatCurrency(tx.invoiceAmount, c)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num">
                            {formatCurrency(tx.parcelCharges, c)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num text-emerald-700 font-medium">
                            {formatCurrency(tx.vasool, c)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num text-amber-700 font-medium">
                            {formatCurrency(tx.remainingAmount, c)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num font-semibold text-emerald-800">
                            {formatCurrency(tx.profit, c)}
                          </td>
                          <td className="py-2.5 px-3 text-right no-print">
                            <button
                              type="button"
                              onClick={() => onOpenInvoice(tx)}
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
