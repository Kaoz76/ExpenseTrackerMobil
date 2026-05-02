import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaCamera, FaPlusCircle, FaCog } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

function BottomNav() {
  const { theme } = useTheme();

  return (

    <nav
      className={`bottom-nav-container d-md-none ${theme === 'dark' ? 'bg-dark border-top border-secondary' : 'bg-white border-top'}`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)', // Modern telefonlar için alt boşluk
        zIndex: 1050 // Diğer elemanların altında kalmaması için
      }}
    >
      <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaHome className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>Home</span>
      </NavLink>

      <NavLink to="/receipts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaCamera className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>Scan</span>
      </NavLink>

      <NavLink to="/texts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaPlusCircle className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>Add</span>
      </NavLink>

      <NavLink to="/settings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaCog className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>Settings</span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;