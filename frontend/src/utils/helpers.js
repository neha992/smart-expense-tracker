/**
 * Format a number as Indian currency string (₹)
 * e.g. 1234567.89 => ₹12,34,567.89
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a date string/Date object to DD Mon YYYY
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format date for <input type="date"> value (YYYY-MM-DD)
 */
export const toInputDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Get a human-readable error message from an Axios error
 */
export const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'An unexpected error occurred.'
  );
};

/**
 * Categories allowed by the backend
 */
export const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Bills', 'Education', 'Salary', 'Other'];
export const TYPES = ['income', 'expense'];

/**
 * Category color map for charts & badges
 */
export const CATEGORY_COLORS = {
  Food: '#f97316',
  Travel: '#3b82f6',
  Shopping: '#a855f7',
  Bills: '#ef4444',
  Education: '#14b8a6',
  Salary: '#22c55e',
  Other: '#6b7280',
};
