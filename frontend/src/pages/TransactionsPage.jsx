import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiRequest } from '../api';
import { currentMonth, currentDate, formatInr } from '../utils/format';

const emptyForm = () => ({
  amount: '',
  type: 'expense',
  category: '',
  date: currentDate(),
  note: '',
});

export default function TransactionsPage() {
  const [filters, setFilters] = useState({
    month: currentMonth(),
    type: '',
    category: '',
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ transactions: [], pagination: null });
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    const query = new URLSearchParams({ month: filters.month, page: String(page), limit: '10' });
    if (filters.type) query.set('type', filters.type);
    if (filters.category.trim()) query.set('category', filters.category.trim());

    try {
      const data = await apiRequest(`/transactions?${query.toString()}`);
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  function updateFilter(field, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function startEditing(transaction) {
    setEditingId(transaction.id);
    setForm({
      amount: String(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      note: transaction.note || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function saveTransaction(event) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    const body = {
      ...form,
      amount: Number(form.amount),
      note: form.note.trim() || undefined,
    };

    try {
      await apiRequest(
        editingId ? `/transactions/${editingId}` : '/transactions',
        { method: editingId ? 'PUT' : 'POST', body },
      );
      cancelEditing();
      await loadTransactions();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    setError('');
    try {
      await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
      await loadTransactions();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const pagination = result.pagination;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <p className="eyebrow">KEEP IT UP TO DATE</p>
        <h1>Transactions</h1>
        <p className="muted">Add, review, and organize your income and expenses.</p>
      </div>

      {error && <p className="error-banner" role="alert">{error}</p>}

      <section className="panel transaction-form-panel">
        <div className="section-heading">
          <div className="form-title">
            <span className="section-icon">{editingId ? <Pencil size={17} /> : <Plus size={18} />}</span>
            <div>
              <h2>{editingId ? 'Edit transaction' : 'Add a transaction'}</h2>
              <p className="muted">Amounts are recorded in Indian rupees (INR).</p>
            </div>
          </div>
          {editingId && (
            <button className="button button-quiet" type="button" onClick={cancelEditing}>
              <X size={16} /> Cancel edit
            </button>
          )}
        </div>
        <form className="transaction-form" onSubmit={saveTransaction}>
          <label>
            Amount (INR)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              required
            />
          </label>
          <label>
            Type
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            Category
            <input
              type="text"
              maxLength="50"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="e.g. Food, Salary"
              required
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </label>
          <label className="note-field">
            Note <span className="muted">(optional)</span>
            <input
              type="text"
              maxLength="500"
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Add a short note"
            />
          </label>
          <button className="button submit-transaction" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Add transaction'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading list-heading">
          <div>
            <h2>Your transactions</h2>
            <p className="muted">{pagination ? `${pagination.total} found` : 'Filter by month, type, or category.'}</p>
          </div>
          <div className="filters">
            <label>
              <span className="sr-only">Filter by month</span>
              <input type="month" value={filters.month} onChange={(event) => updateFilter('month', event.target.value)} />
            </label>
            <label>
              <span className="sr-only">Filter by type</span>
              <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
                <option value="">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by category</span>
              <input
                type="text"
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
                placeholder="Category"
              />
            </label>
          </div>
        </div>

        {isLoading ? (
          <p className="loading-card">Loading transactions…</p>
        ) : result.transactions.length === 0 ? (
          <p className="empty-message">No transactions match these filters.</p>
        ) : (
          <div className="table-scroll">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>Type</th>
                  <th className="align-right">Amount</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.date}</td>
                    <td className="category-cell">{transaction.category}</td>
                    <td className="note-cell">{transaction.note || '—'}</td>
                    <td>
                      <span className={`type-pill ${transaction.type}`}>{transaction.type}</span>
                    </td>
                    <td className={`align-right amount-cell ${transaction.type}`}>
                      {transaction.type === 'expense' ? '-' : '+'}{formatInr(transaction.amount)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button small-icon"
                          type="button"
                          onClick={() => startEditing(transaction)}
                          aria-label={`Edit ${transaction.category} transaction`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button small-icon danger-icon"
                          type="button"
                          onClick={() => deleteTransaction(transaction.id)}
                          aria-label={`Delete ${transaction.category} transaction`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <div>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                disabled={page >= pagination.totalPages || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
