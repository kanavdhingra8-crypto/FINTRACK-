import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../api';
import { formatInr, currentMonth } from '../utils/format';

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError('');
    setSummary(null);
    apiRequest(`/transactions/summary?month=${encodeURIComponent(month)}`)
      .then((data) => {
        if (isCurrent) setSummary(data);
      })
      .catch((requestError) => {
        if (isCurrent) setError(requestError.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [month]);

  return (
    <div className="page-stack">
      <div className="page-heading heading-with-control">
        <div>
          <p className="eyebrow">YOUR OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="muted">A simple snapshot of your monthly finances.</p>
        </div>
        <label className="month-picker">
          <span>Choose month</span>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      {error && <p className="error-banner" role="alert">{error}</p>}
      {isLoading ? (
        <p className="loading-card">Loading your monthly summary…</p>
      ) : summary && (
        <>
          <section className="summary-grid" aria-label="Monthly totals">
            <article className="summary-card income-card">
              <span>Total income</span>
              <strong>{formatInr(summary.totalIncome)}</strong>
              <small>Money received this month</small>
            </article>
            <article className="summary-card expense-card">
              <span>Total expenses</span>
              <strong>{formatInr(summary.totalExpense)}</strong>
              <small>Money spent this month</small>
            </article>
            <article className="summary-card balance-card">
              <span>Balance</span>
              <strong>{formatInr(summary.balance)}</strong>
              <small>Income minus expenses</small>
            </article>
          </section>

          <section className="panel chart-panel">
            <div className="section-heading">
              <div>
                <h2>By category</h2>
                <p className="muted">Income and expenses for {month}</p>
              </div>
            </div>
            {summary.categories.length === 0 ? (
              <p className="empty-message chart-empty">No transactions recorded for this month.</p>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.categories} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="#edf0f5" vertical={false} />
                    <XAxis dataKey="category" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => `₹${value}`} tickLine={false} axisLine={false} width={78} />
                    <Tooltip formatter={(value) => formatInr(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="#22a982" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#ef6b68" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
