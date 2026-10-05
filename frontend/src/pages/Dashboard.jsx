import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { analyticsService, transactionService, healthService, insightService } from '../services';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [insights, setInsights] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, txRes, insightRes] = await Promise.all([
        analyticsService.getSummary(),
        transactionService.getAll({ limit: 5 }),
        insightService.getAll(),
      ]);
      setSummary(summaryRes.data.data);
      setTransactions(txRes.data.data || []);
      setInsights(insightRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Health check
    healthService
      .check()
      .then((res) => setBackendStatus(res.data.database === 'connected' ? 'connected' : 'degraded'))
      .catch(() => setBackendStatus('offline'));
  }, [fetchData]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const recommendations = insights?.recommendations || [];
  const forecast = insights?.forecast;

  return (
    <div className="page">
      {/* Backend status badge */}
      <div className="page-top-row">
        <h1 className="page-title">Dashboard</h1>
        <div className={`status-badge ${backendStatus === 'connected' ? 'status-ok' : 'status-bad'}`}>
          {backendStatus === 'connected' ? (
            <><CheckCircle size={14} /> Backend: Connected</>
          ) : backendStatus === 'offline' ? (
            <><XCircle size={14} /> Backend: Offline</>
          ) : (
            <span>Checking...</span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Income"
          value={formatCurrency(summary?.totalIncome)}
          colorClass="card-income"
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(summary?.totalExpenses)}
          colorClass="card-expense"
          icon={<TrendingDown size={20} />}
        />
        <StatCard
          title="Current Balance"
          value={formatCurrency(summary?.balance)}
          colorClass={summary?.balance >= 0 ? 'card-balance-pos' : 'card-balance-neg'}
          icon={<Wallet size={20} />}
        />
        <StatCard
          title="Transactions"
          value={transactions.length >= 5 ? '5+ recent' : `${transactions.length} recent`}
          colorClass="card-count"
          icon={<ArrowLeftRight size={20} />}
        />
      </div>

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Recent transactions */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Transactions</h2>
            <Link to="/transactions" className="card-link">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {transactions.length === 0 ? (
            <p className="empty-state">
              No transactions yet. Add your first income or expense to get started.
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>
                        <span className="badge badge-category">{tx.category}</span>
                      </td>
                      <td className="td-desc">{tx.description || '—'}</td>
                      <td>
                        <span className={`badge badge-type badge-${tx.type}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={`amount-cell ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Smart Insights preview */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Lightbulb size={18} className="icon-accent" /> Smart Insights
            </h2>
            <Link to="/insights" className="card-link">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {forecast && (
            <div className="forecast-mini">
              <p className="forecast-label">Monthly Forecast</p>
              <p className="forecast-value">{formatCurrency(forecast.projectedMonthlySpending)}</p>
              <p className="forecast-sub">{forecast.message}</p>
            </div>
          )}

          {recommendations.length > 0 ? (
            <ul className="recommendations-list">
              {recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="recommendation-item">
                  <span className="rec-bullet">💡</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Add transactions to see smart recommendations.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
