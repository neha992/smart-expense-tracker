import { useState, useEffect, useCallback } from 'react';
import { insightService } from '../services';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { AlertTriangle, TrendingUp, Lightbulb, Info } from 'lucide-react';

const AnomalyCard = ({ anomaly }) => {
  const isReal = anomaly.historicalAverage > 0;

  let statusClass = 'status-normal';
  let statusLabel = 'Normal';
  if (anomaly.isAnomaly && isReal) {
    statusClass = 'status-anomaly';
    statusLabel = 'Spike Detected';
  } else if (anomaly.isAnomaly && !isReal) {
    statusClass = 'status-alert';
    statusLabel = 'Initial Alert';
  }

  return (
    <div className={`anomaly-card ${anomaly.isAnomaly ? 'anomaly-highlighted' : ''}`}>
      <div className="anomaly-header">
        <div>
          <p className="anomaly-category">{anomaly.category}</p>
          <span className={`anomaly-status ${statusClass}`}>{statusLabel}</span>
        </div>
        <div className="anomaly-amounts">
          <p className="anomaly-current">{formatCurrency(anomaly.currentSpending)}</p>
          <p className="anomaly-avg-label">current</p>
        </div>
      </div>

      {isReal && (
        <div className="anomaly-detail-row">
          <div className="anomaly-metric">
            <p className="metric-label">Historical Avg</p>
            <p className="metric-val">{formatCurrency(anomaly.historicalAverage)}</p>
          </div>
          <div className="anomaly-metric">
            <p className="metric-label">Change</p>
            <p className={`metric-val ${anomaly.increasePercentage > 0 ? 'text-expense' : 'text-income'}`}>
              {anomaly.increasePercentage > 0 ? '+' : ''}
              {anomaly.increasePercentage}%
            </p>
          </div>
        </div>
      )}

      <p className="anomaly-message">
        {anomaly.isAnomaly ? (
          <AlertTriangle size={14} className="icon-warn" />
        ) : (
          <Info size={14} className="icon-info" />
        )}{' '}
        {anomaly.message}
      </p>
    </div>
  );
};

const SmartInsights = () => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await insightService.getAll();
      setInsights(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingSpinner message="Loading smart insights..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  const { anomalies = [], forecast, recommendations = [] } = insights || {};

  return (
    <div className="page">
      <div className="page-top-row">
        <h1 className="page-title">
          <Lightbulb size={24} className="icon-accent" /> Smart Insights
        </h1>
        <p className="page-subtitle">AI-powered analysis of your spending patterns</p>
      </div>

      {/* Forecast */}
      <div className="card insight-forecast-card">
        <div className="card-header">
          <h2 className="card-title">
            <TrendingUp size={18} className="icon-accent" /> Monthly Spending Forecast
          </h2>
        </div>
        {forecast ? (
          <div className="forecast-grid">
            <div className="forecast-metric">
              <p className="forecast-metric-label">Current Spending</p>
              <p className="forecast-metric-val text-expense">
                {formatCurrency(forecast.currentSpending)}
              </p>
            </div>
            <div className="forecast-metric">
              <p className="forecast-metric-label">Days Elapsed / Total</p>
              <p className="forecast-metric-val">
                {forecast.daysElapsed} / {forecast.daysInMonth} days
              </p>
            </div>
            <div className="forecast-metric">
              <p className="forecast-metric-label">Daily Average</p>
              <p className="forecast-metric-val">{formatCurrency(forecast.dailyAverage)}</p>
            </div>
            <div className="forecast-metric">
              <p className="forecast-metric-label">Projected Monthly</p>
              <p className="forecast-metric-val forecast-projected">
                {formatCurrency(forecast.projectedMonthlySpending)}
              </p>
            </div>
          </div>
        ) : (
          <p className="empty-state">No forecast data available.</p>
        )}
        {forecast?.message && (
          <p className="forecast-message">{forecast.message}</p>
        )}
      </div>

      {/* Anomalies */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <AlertTriangle size={18} className="icon-warn" /> Spending Anomalies
          </h2>
          <span className="badge badge-category">
            {anomalies.filter((a) => a.isAnomaly).length} alert
            {anomalies.filter((a) => a.isAnomaly).length !== 1 ? 's' : ''}
          </span>
        </div>
        {anomalies.length === 0 ? (
          <p className="empty-state">
            No spending data this month. Add expenses to see anomaly detection.
          </p>
        ) : (
          <div className="anomalies-grid">
            {anomalies.map((anomaly) => (
              <AnomalyCard key={anomaly.category} anomaly={anomaly} />
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Lightbulb size={18} className="icon-accent" /> Smart Recommendations
          </h2>
        </div>
        {recommendations.length === 0 ? (
          <p className="empty-state">
            Add more transactions to unlock personalized recommendations.
          </p>
        ) : (
          <ul className="recommendations-full-list">
            {recommendations.map((rec, i) => (
              <li key={i} className="recommendation-full-item">
                <div className="rec-number">{i + 1}</div>
                <p>{rec}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SmartInsights;
