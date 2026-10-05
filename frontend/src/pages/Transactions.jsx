import { useState, useEffect, useCallback } from 'react';
import { transactionService } from '../services';
import { formatCurrency, formatDate, getErrorMessage, CATEGORIES, TYPES } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [filters, setFilters] = useState({ category: '', type: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTx, setDeleteTx] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (filters.category) params.category = filters.category;
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await transactionService.getAll(params);
      setTransactions(res.data.data || []);
      setPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ category: '', type: '', startDate: '', endDate: '' });
    setPage(1);
  };

  const handleAdd = async (data) => {
    setFormLoading(true);
    try {
      await transactionService.create(data);
      setShowAddModal(false);
      showToast('Transaction added successfully!');
      fetchTransactions();
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data) => {
    setFormLoading(true);
    try {
      await transactionService.update(editTx._id, data);
      setEditTx(null);
      showToast('Transaction updated successfully!');
      fetchTransactions();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTx) return;
    setFormLoading(true);
    try {
      await transactionService.remove(deleteTx._id);
      setDeleteTx(null);
      showToast('Transaction deleted.');
      fetchTransactions();
    } finally {
      setFormLoading(false);
    }
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="page">
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      <div className="page-top-row">
        <h1 className="page-title">Transactions</h1>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="card filter-card">
        <div className="filter-header">
          <Filter size={16} />
          <span>Filters</span>
          {hasActiveFilters && (
            <button className="btn-text" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="filter-category">Category</label>
            <select
              id="filter-category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filter-type">Type</label>
            <select
              id="filter-type"
              name="type"
              value={filters.type}
              onChange={handleFilterChange}
            >
              <option value="">All Types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="filter-start">Start Date</label>
            <input
              id="filter-start"
              name="startDate"
              type="date"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="filter-end">End Date</label>
            <input
              id="filter-end"
              name="endDate"
              type="date"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading transactions..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchTransactions} />
      ) : transactions.length === 0 ? (
        <div className="card">
          <p className="empty-state">
            {hasActiveFilters
              ? 'No transactions match your filters. Try adjusting the filters.'
              : 'No transactions yet. Add your first income or expense to get started.'}
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-meta">
            <span>
              Showing {transactions.length} of {pagination.totalItems} transactions
            </span>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx._id}>
                    <td>{formatDate(tx.date)}</td>
                    <td>
                      <span className={`badge badge-type badge-${tx.type}`}>{tx.type}</span>
                    </td>
                    <td>
                      <span className="badge badge-category">{tx.category}</span>
                    </td>
                    <td className="td-desc">{tx.description || '—'}</td>
                    <td
                      className={`amount-cell ${
                        tx.type === 'income' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="icon-btn icon-btn-edit"
                          onClick={() => setEditTx(tx)}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-btn icon-btn-delete"
                          onClick={() => setDeleteTx(tx)}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-outline btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <span className="page-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                className="btn btn-outline btn-sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Add Transaction" onClose={() => setShowAddModal(false)}>
          <TransactionForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddModal(false)}
            loading={formLoading}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      {editTx && (
        <Modal title="Edit Transaction" onClose={() => setEditTx(null)}>
          <TransactionForm
            initialData={editTx}
            onSubmit={handleEdit}
            onCancel={() => setEditTx(null)}
            loading={formLoading}
          />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteTx && (
        <Modal title="Delete Transaction" onClose={() => setDeleteTx(null)}>
          <div className="confirm-dialog">
            <p>
              Are you sure you want to delete this{' '}
              <strong>{deleteTx.type}</strong> of{' '}
              <strong>{formatCurrency(deleteTx.amount)}</strong>?
            </p>
            <p className="confirm-sub">This action cannot be undone.</p>
            <div className="form-actions">
              <button
                className="btn btn-outline"
                onClick={() => setDeleteTx(null)}
                disabled={formLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={formLoading}
              >
                {formLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Transactions;
