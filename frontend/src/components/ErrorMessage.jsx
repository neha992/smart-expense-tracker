const ErrorMessage = ({ message, onRetry }) => (
  <div className="error-box">
    <p className="error-text">⚠️ {message}</p>
    {onRetry && (
      <button className="btn btn-outline" onClick={onRetry}>
        Try Again
      </button>
    )}
  </div>
);

export default ErrorMessage;
