const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="loading-container">
    <div className="spinner" />
    <p className="loading-text">{message}</p>
  </div>
);

export default LoadingSpinner;
