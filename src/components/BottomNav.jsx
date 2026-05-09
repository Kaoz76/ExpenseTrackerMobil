import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaCamera, FaPlusCircle, FaCog } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

function BottomNav() {
  const { t } = useLanguage();

  return (

    <nav
      className="bottom-nav-container d-md-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)', // Modern telefonlar için alt boşluk
        zIndex: 1050 // Diğer elemanların altında kalmaması için
      }}
    >
      <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaHome className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.dashboard')}</span>
      </NavLink>

      <NavLink to="/receipts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaCamera className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.receipts')}</span>
      </NavLink>

      <NavLink to="/texts" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaPlusCircle className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.manual_entry')}</span>
      </NavLink>

      <NavLink to="/settings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaCog className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.settings')}</span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;