import { useState, useEffect, useCallback } from 'react';
import { analyticsService } from '../services';
import { formatCurrency, getErrorMessage, CATEGORY_COLORS } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const formatTooltip = (value) => formatCurrency(value);

const Analytics = () => {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, monthlyRes, catRes] = await Promise.all([
        analyticsService.getSummary(),
        analyticsService.getMonthly(),
        analyticsService.getCategories({ type: 'expense' }),
      ]);
      setSummary(summaryRes.data.data);
      setMonthly(monthlyRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner message="Loading analytics..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  // Build monthly trend chart data
  const trendMap = {};
  (monthly?.spendingTrend || []).forEach((item) => {
    const key = `${item.month.slice(0, 3)} ${item.year}`;
    if (!trendMap[key]) trendMap[key] = { name: key, income: 0, expense: 0 };
    trendMap[key][item.type] = item.total;
  });
  const trendData = Object.values(trendMap);

  // Build pie chart data from categories
  const pieData = Object.entries(categories || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="page">
      <div className="page-top-row">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">{monthly?.month}</p>
      </div>

      {/* Summary cards */}
      <div className="stats-grid">
        <div className="stat-card card-income">
          <div className="stat-card-header">
            <p className="stat-label">Total Income</p>
            <TrendingUp size={20} />
          </div>
          <p className="stat-value">{formatCurrency(summary?.totalIncome)}</p>
        </div>
        <div className="stat-card card-expense">
          <div className="stat-card-header">
            <p className="stat-label">Total Expenses</p>
            <TrendingDown size={20} />
          </div>
          <p className="stat-value">{formatCurrency(summary?.totalExpenses)}</p>
        </div>
        <div className="stat-card card-balance-pos">
          <div className="stat-card-header">
            <p className="stat-label">Balance</p>
            <Wallet size={20} />
          </div>
          <p className="stat-value">{formatCurrency(summary?.balance)}</p>
        </div>
        <div className="stat-card card-count">
          <div className="stat-card-header">
            <p className="stat-label">This Month</p>
          </div>
          <p className="stat-value">{formatCurrency(monthly?.expenses)}</p>
          <p className="stat-subtitle">expenses</p>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Monthly trend */}
        <div className="card chart-card">
          <h2 className="card-title">6-Month Income vs Expenses</h2>
          {trendData.length === 0 ? (
            <p className="empty-state">Not enough data for a trend chart yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={formatTooltip}
                  contentStyle={{
                    background: '#1e2a3a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category breakdown */}
        <div className="card chart-card">
          <h2 className="card-title">Expense by Category</h2>
          {pieData.length === 0 ? (
            <p className="empty-state">No expense data available yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={CATEGORY_COLORS[entry.name] || '#6b7280'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={formatTooltip}
                    contentStyle={{
                      background: '#1e2a3a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend-list">
                {pieData.map((entry) => (
                  <div key={entry.name} className="legend-item">
                    <span
                      className="legend-dot"
                      style={{ background: CATEGORY_COLORS[entry.name] || '#6b7280' }}
                    />
                    <span className="legend-label">{entry.name}</span>
                    <span className="legend-value">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monthly detail */}
      {monthly && (
        <div className="card">
          <h2 className="card-title">Monthly Summary — {monthly.month}</h2>
          <div className="monthly-summary-row">
            <div className="monthly-item">
              <p className="monthly-label">Income</p>
              <p className="monthly-val text-income">{formatCurrency(monthly.income)}</p>
            </div>
            <div className="monthly-item">
              <p className="monthly-label">Expenses</p>
              <p className="monthly-val text-expense">{formatCurrency(monthly.expenses)}</p>
            </div>
            <div className="monthly-item">
              <p className="monthly-label">Balance</p>
              <p className={`monthly-val ${monthly.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(monthly.balance)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
