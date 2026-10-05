import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart2,
  Lightbulb,
  LogOut,
  TrendingUp,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', Icon: ArrowLeftRight },
  { to: '/analytics', label: 'Analytics', Icon: BarChart2 },
  { to: '/insights', label: 'Smart Insights', Icon: Lightbulb },
];

const Sidebar = ({ onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <TrendingUp size={24} className="brand-icon" />
        <span>ExpenseIQ</span>
      </div>

      <div className="sidebar-user">
        <div className="avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
        <div className="user-info">
          <p className="user-name">{user?.name || 'User'}</p>
          <p className="user-email">{user?.email || ''}</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="logout-btn" onClick={handleLogout}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </aside>
  );
};

export default Sidebar;
