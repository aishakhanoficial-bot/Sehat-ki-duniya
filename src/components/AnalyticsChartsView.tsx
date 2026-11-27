import React, { useMemo, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { AppSettings, Expense, Transaction } from '../types.ts';
import { formatCurrency } from '../utils/calculations.ts';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface AnalyticsChartsViewProps {
  transactions: Transaction[];
  expenses: Expense[];
  settings: AppSettings;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const AnalyticsChartsView: React.FC<AnalyticsChartsViewProps> = ({
  transactions,
  expenses,
  settings,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 0 = All Year, 1..12 = Month
  const [selectedDay, setSelectedDay] = useState<string>(''); // optional YYYY-MM-DD day filter

  const c = settings.currency;

  const yearOptions = useMemo(() => {
    const yrs = new Set<number>([now.getFullYear(), now.getFullYear() - 1]);
    transactions.forEach((t) => {
      const y = Number(t.date.slice(0, 4));
      if (y) yrs.add(y);
    });
    expenses.forEach((e) => {
      const y = Number(e.date.slice(0, 4));
      if (y) yrs.add(y);
    });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [transactions, expenses, now]);

  const activeMonthForDaily = selectedMonth === 0 ? now.getMonth() + 1 : selectedMonth;
  const activeMonthPrefix = `${selectedYear}-${String(activeMonthForDaily).padStart(2, '0')}`;

  // Filtered datasets for Day / Month / Year
  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedDay) return t.date === selectedDay;
      if (selectedMonth > 0) return t.date.startsWith(activeMonthPrefix);
      return t.date.startsWith(`${selectedYear}-`);
    });
  }, [transactions, selectedYear, selectedMonth, selectedDay, activeMonthPrefix]);

  const filteredExp = useMemo(() => {
    return expenses.filter((e) => {
      if (selectedDay) return e.date === selectedDay;
      if (selectedMonth > 0) return e.date.startsWith(activeMonthPrefix);
      return e.date.startsWith(`${selectedYear}-`);
    });
  }, [expenses, selectedYear, selectedMonth, selectedDay, activeMonthPrefix]);

  // 1 & 7: Daily Sales Bar & Daily Collection Trend for selected month (or selected day)
  const dailyData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, activeMonthForDaily, 0).getDate();
    const labels: string[] = [];
    const sales: number[] = [];
    const collections: number[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${activeMonthPrefix}-${String(d).padStart(2, '0')}`;
      if (selectedDay && iso !== selectedDay) continue;
      labels.push(String(d).padStart(2, '0'));
      const dayTxs = transactions.filter((t) => t.date === iso);
      sales.push(dayTxs.reduce((acc, t) => acc + t.invoiceAmount, 0));
      collections.push(dayTxs.reduce((acc, t) => acc + t.vasool, 0));
    }

    return { labels, sales, collections };
  }, [transactions, selectedYear, activeMonthForDaily, activeMonthPrefix, selectedDay]);

  // 2, 3, 4, 6: Monthly metrics across 12 months of selectedYear
  const monthlySeries = useMemo(() => {
    const sales = Array(12).fill(0) as number[];
    const real = Array(12).fill(0) as number[];
    const grossProfit = Array(12).fill(0) as number[];
    const expTotals = Array(12).fill(0) as number[];
    const netProfit = Array(12).fill(0) as number[];

    for (const tx of transactions) {
      if (!tx.date.startsWith(`${selectedYear}-`)) continue;
      const mIdx = Number(tx.date.slice(5, 7)) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        sales[mIdx] += tx.invoiceAmount;
        real[mIdx] += tx.realAmount;
        grossProfit[mIdx] += tx.profit;
      }
    }
    for (const exp of expenses) {
      if (!exp.date.startsWith(`${selectedYear}-`)) continue;
      const mIdx = Number(exp.date.slice(5, 7)) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        expTotals[mIdx] += exp.amount;
      }
    }
    for (let i = 0; i < 12; i++) {
      netProfit[i] = grossProfit[i] - expTotals[i];
    }
    return { sales, real, grossProfit, expTotals, netProfit };
  }, [transactions, expenses, selectedYear]);

  // 5: Collected vs Outstanding Pie
  const collectionSplit = useMemo(() => {
    const collected = filteredTx.reduce((sum, t) => sum + t.vasool, 0);
    const outstanding = Math.max(
      0,
      filteredTx.reduce((sum, t) => sum + t.remainingAmount, 0),
    );
    return { collected, outstanding };
  }, [filteredTx]);

  // 8: Yearly Profit Comparison
  const yearlyComparison = useMemo(() => {
    const sortedYears = [...yearOptions].sort((a, b) => a - b);
    const grossByYear = sortedYears.map((yr) =>
      transactions
        .filter((t) => t.date.startsWith(`${yr}-`))
        .reduce((sum, t) => sum + t.profit, 0),
    );
    const netByYear = sortedYears.map((yr, idx) => {
      const yrExp = expenses
        .filter((e) => e.date.startsWith(`${yr}-`))
        .reduce((sum, e) => sum + e.amount, 0);
      return grossByYear[idx] - yrExp;
    });
    return { years: sortedYears.map(String), grossByYear, netByYear };
  }, [yearOptions, transactions, expenses]);

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, font: { size: 11 } },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Advanced Financial Analytics & Charts · چارٹس اور گراف
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live visualizations generated strictly from your saved transactions and expenses ({filteredTx.length} entries · {filteredExp.length} expenses in scope)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
            aria-label="Filter Year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                Year: {y}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value));
              setSelectedDay('');
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            aria-label="Filter Month"
          >
            <option value={0}>All Months ({selectedYear})</option>
            {MONTH_SHORT.map((m, idx) => (
              <option key={m} value={idx + 1}>
                Month: {m}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono-num border border-slate-300 rounded-lg bg-white"
              aria-label="Filter Specific Day"
            />
            {selectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDay('')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Clear Day
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 8 Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Daily Sales Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              1. Daily Sales Bar Chart ({activeMonthPrefix})
            </h3>
            <span className="text-xs font-mono-num text-slate-500">{c}</span>
          </div>
          <div className="h-64">
            <Bar
              options={baseOptions}
              data={{
                labels: dailyData.labels,
                datasets: [
                  {
                    label: `Daily Sales (${c})`,
                    data: dailyData.sales,
                    backgroundColor: '#059669',
                    borderRadius: 4,
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* 2. Monthly Sales Graph */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              2. Monthly Sales Graph ({selectedYear})
            </h3>
            <span className="text-xs font-mono-num text-slate-500">{c}</span>
          </div>
          <div className="h-64">
            <Line
              options={baseOptions}
              data={{
                labels: MONTH_SHORT,
                datasets: [
                  {
                    label: `Monthly Invoice Sales (${c})`,
                    data: monthlySeries.sales,
                    borderColor: '#064e3b',
                    backgroundColor: 'rgba(5, 150, 105, 0.12)',
                    fill: true,
                    tension: 0.3,
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* 3. Monthly Profit Graph */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              3. Monthly Profit Graph ({selectedYear})
            </h3>
            <span className="text-xs font-mono-num text-slate-500">Gross vs Net</span>
          </div>
          <div className="h-64">
            <Line
              options={baseOptions}
              data={{
                labels: MONTH_SHORT,
                datasets: [
                  {
                    label: `Gross Profit (${c})`,
                    data: monthlySeries.grossProfit,
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    tension: 0.3,
                  },
                  {
                    label: `Net Profit (${c})`,
                    data: monthlySeries.netProfit,
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    tension: 0.3,
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* 4. Real Amount vs Invoice Amount Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              4. Real Amount vs Invoice Amount ({selectedYear})
            </h3>
            <span className="text-xs font-mono-num text-slate-500">{c}</span>
          </div>
          <div className="h-64">
            <Bar
              options={baseOptions}
              data={{
                labels: MONTH_SHORT,
                datasets: [
                  {
                    label: `Real Amount (${c})`,
                    data: monthlySeries.real,
                    backgroundColor: '#64748b',
                    borderRadius: 4,
                  },
                  {
                    label: `Invoice Amount (${c})`,
                    data: monthlySeries.sales,
                    backgroundColor: '#059669',
                    borderRadius: 4,
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* 5. Collected vs Outstanding Amount Pie Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              5. Collected vs Outstanding Amount
            </h3>
            <span className="text-xs font-mono-num text-slate-500">
              {formatCurrency(collectionSplit.collected + collectionSplit.outstanding, c)}
            </span>
          </div>
          <div className="h-64 flex items-center justify-center">
            {collectionSplit.collected === 0 && collectionSplit.outstanding === 0 ? (
              <p className="text-xs text-slate-400">No transaction amounts in selected period</p>
            ) : (
              <Doughnut
                options={{
                  ...baseOptions,
                  cutout: '58%',
                }}
                data={{
                  labels: [
                    `Collected (${formatCurrency(collectionSplit.collected, c)})`,
                    `Outstanding (${formatCurrency(collectionSplit.outstanding, c)})`,
                  ],
                  datasets: [
                    {
                      data: [collectionSplit.collected, collectionSplit.outstanding],
                      backgroundColor: ['#059669', '#d97706'],
                      borderWidth: 2,
                      borderColor: '#ffffff',
                    },
                  ],
                }}
              />
            )}
          </div>
        </div>

        {/* 6. Monthly Expense Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              6. Monthly Expense Chart ({selectedYear})
            </h3>
            <span className="text-xs font-mono-num text-slate-500">{c}</span>
          </div>
          <div className="h-64">
            <Bar
              options={baseOptions}
              data={{
                labels: MONTH_SHORT,
                datasets: [
                  {
                    label: `Business Expenses (${c})`,
                    data: monthlySeries.expTotals,
                    backgroundColor: '#dc2626',
                    borderRadius: 4,
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* 7. Daily Collection Trend */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              7. Daily Collection Trend ({activeMonthPrefix})
            </h3>
            <span className="text-xs font-mono-num text-slate-500">Vasool</span>
          </div>
          <div className="h-64">
            <Line
              options={baseOptions}
              data={{
                labels: dailyData.labels,
                datasets: [
                  {
                    label: `Daily Vasool (${c})`,
                    data: dailyData.collections,
                    borderColor: '#047857',
                    backgroundColor: 'rgba(4, 120, 87, 0.14)',
                    fill: true,
                    tension: 0.35,
                  },
                ],
              }}
            />
          </div>
        </div>

        {/* 8. Yearly Profit Comparison */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              8. Yearly Profit Comparison
            </h3>
            <span className="text-xs font-mono-num text-slate-500">{c}</span>
          </div>
          <div className="h-64">
            <Bar
              options={baseOptions}
              data={{
                labels: yearlyComparison.years,
                datasets: [
                  {
                    label: `Yearly Gross Profit (${c})`,
                    data: yearlyComparison.grossByYear,
                    backgroundColor: '#059669',
                    borderRadius: 4,
                  },
                  {
                    label: `Yearly Net Profit (${c})`,
                    data: yearlyComparison.netByYear,
                    backgroundColor: '#064e3b',
                    borderRadius: 4,
                  },
                ],
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
