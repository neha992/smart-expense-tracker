const StatCard = ({ title, value, subtitle, icon, colorClass }) => {
  return (
    <div className={`stat-card ${colorClass || ''}`}>
      <div className="stat-card-header">
        <p className="stat-label">{title}</p>
        {icon && <div className="stat-icon">{icon}</div>}
      </div>
      <p className="stat-value">{value}</p>
      {subtitle && <p className="stat-subtitle">{subtitle}</p>}
    </div>
  );
};

export default StatCard;
