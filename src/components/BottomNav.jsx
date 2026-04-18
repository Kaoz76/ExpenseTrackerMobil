import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaCamera, FaPlusCircle, FaCog } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

function BottomNav() {
  const { theme } = useTheme();

  return (
    <div className={`bottom-nav-container d-md-none ${theme === 'dark' ? 'bg-dark border-secondary' : 'bg-white'}`}>
      <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FaHome />
        <span>Home</span>
      </NavLink>
      <NavLink to="/receipts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FaCamera />
        <span>Scan</span>
      </NavLink>
      <NavLink to="/texts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FaPlusCircle />
        <span>Add</span>
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FaCog />
        <span>Settings</span>
      </NavLink>
    </div>
  );
}

export default BottomNav;
