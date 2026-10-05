import { useState, useEffect } from 'react';
import { CATEGORIES, TYPES, toInputDate, getErrorMessage } from '../utils/helpers';

const defaultForm = {
  type: 'expense',
  amount: '',
  category: 'Food',
  description: '',
  date: toInputDate(new Date()),
};

const TransactionForm = ({ initialData, onSubmit, onCancel, loading }) => {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setForm({
        type: initialData.type || 'expense',
        amount: initialData.amount ?? '',
        category: initialData.category || 'Food',
        description: initialData.description || '',
        date: toInputDate(initialData.date) || toInputDate(new Date()),
      });
    } else {
      setForm(defaultForm);
    }
    setErrors({});
  }, [initialData]);

  const validate = () => {
    const e = {};
    if (!form.type) e.type = 'Type is required.';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      e.amount = 'Amount must be a positive number.';
    if (!form.category) e.category = 'Category is required.';
    if (!form.date) e.date = 'Date is required.';
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    try {
      await onSubmit({
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description,
        date: form.date,
      });
    } catch (err) {
      setErrors({ submit: getErrorMessage(err) });
    }
  };

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      {errors.submit && <div className="form-error-banner">{errors.submit}</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" value={form.type} onChange={handleChange}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          {errors.type && <span className="field-error">{errors.type}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (₹)</label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 500"
            value={form.amount}
            onChange={handleChange}
          />
          {errors.amount && <span className="field-error">{errors.amount}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.category && <span className="field-error">{errors.category}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            id="date"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
          />
          {errors.date && <span className="field-error">{errors.date}</span>}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description (optional)</label>
        <input
          id="description"
          name="description"
          type="text"
          placeholder="e.g. Monthly grocery run"
          value={form.description}
          onChange={handleChange}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Saving...' : initialData ? 'Update Transaction' : 'Add Transaction'}
        </button>
      </div>
    </form>
  );
};

export default TransactionForm;
