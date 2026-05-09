import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaCamera, FaPlusCircle, FaLayerGroup, FaStore, FaBox, FaSync } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

function BottomNav() {
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav
      className="bottom-nav-container d-md-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)', // Modern telefonlar için alt boşluk
        zIndex: 1050 // Diğer elemanların altında kalmaması için
      }}
    >
      <NavLink to="/dashboard" onClick={() => setShowMenu(false)} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaHome className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.dashboard')}</span>
      </NavLink>

      <NavLink to="/receipts" onClick={() => setShowMenu(false)} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaCamera className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.receipts')}</span>
      </NavLink>

      <NavLink to="/texts" onClick={() => setShowMenu(false)} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active text-primary' : 'text-secondary'}`}>
        <FaPlusCircle className="fs-4 mb-1" />
        <span style={{ fontSize: '0.75rem' }}>{t('nav.manual_entry')}</span>
      </NavLink>

      {/* Menü (Products, Stores, Subscriptions) */}
      <div className="position-relative d-flex align-items-center justify-content-center" ref={menuRef}>
        <button 
          className={`bottom-nav-item btn p-0 border-0 ${showMenu ? 'text-primary' : 'text-secondary'}`}
          onClick={() => setShowMenu(!showMenu)}
          style={{ background: 'transparent', boxShadow: 'none' }}
        >
          <FaLayerGroup className="fs-4 mb-1" />
          <span style={{ fontSize: '0.75rem' }}>{t('common.nav_menu')}</span>
        </button>

        {showMenu && (
          <div 
            className="position-absolute shadow-lg rounded-3 p-2" 
            style={{ 
              bottom: '100%', 
              right: '-10px', 
              marginBottom: '15px',
              backgroundColor: 'var(--bs-tertiary-bg)',
              border: '1px solid var(--bs-border-color)',
              minWidth: '160px',
              zIndex: 1060,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <NavLink to="/products" className="btn btn-sm btn-light text-start d-flex align-items-center" onClick={() => setShowMenu(false)}>
              <FaBox className="me-2 text-primary" /> {t('nav.products')}
            </NavLink>
            <NavLink to="/stores" className="btn btn-sm btn-light text-start d-flex align-items-center" onClick={() => setShowMenu(false)}>
              <FaStore className="me-2 text-primary" /> {t('nav.stores')}
            </NavLink>
            <NavLink to="/subscriptions" className="btn btn-sm btn-light text-start d-flex align-items-center" onClick={() => setShowMenu(false)}>
              <FaSync className="me-2 text-primary" /> {t('nav.subscriptions')}
            </NavLink>
            
            {/* Küçük ok işareti (pointer) */}
            <div 
              style={{
                position: 'absolute',
                bottom: '-6px',
                right: '25px',
                width: '10px',
                height: '10px',
                backgroundColor: 'var(--bs-tertiary-bg)',
                borderBottom: '1px solid var(--bs-border-color)',
                borderRight: '1px solid var(--bs-border-color)',
                transform: 'rotate(45deg)',
                zIndex: -1
              }}
            />
          </div>
        )}
      </div>
    </nav>
  );
}

export default BottomNav;