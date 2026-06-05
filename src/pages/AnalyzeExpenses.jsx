import React, { useState, useEffect, useMemo } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { getCategoryInfo } from '../utils/categoryMap';

import { useExpenseAnalysis } from '../hooks/useExpenseAnalysis';
import SpendingChart from '../components/charts/SpendingChart';
import CategoryChart from '../components/charts/CategoryChart';
import StoreChart from '../components/charts/StoreChart';
import BrandChart from '../components/charts/BrandChart';

function AnalyzeExpenses() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  const [timeRange, setTimeRange] = useState('this_year');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Custom hook extracts all Firebase queries and data formatting logic
  const { loading, chartData, categoryData, storeData, brandData, totalSpent } = useExpenseAnalysis(user, timeRange);

  // Detect dark mode for chart theming
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const check = () => setIsDark(el.getAttribute('data-bs-theme') === 'dark');
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ['data-bs-theme'] });
    return () => observer.disconnect();
  }, []);

  // Theme-aware chart styles
  const chartTheme = useMemo(() => ({
    tooltipBg: isDark ? '#1e293b' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    tooltipColor: isDark ? 'rgba(255,255,255,0.9)' : '#334155',
    axisColor: isDark ? 'rgba(255,255,255,0.45)' : '#6c757d',
    gridOpacity: isDark ? 0.06 : 0.1,
    lineColor: isDark ? '#818cf8' : '#4f46e5', // More saturated indigo for light mode
    areaStop1: isDark ? '#818cf8' : '#4f46e5',
    areaStop2: isDark ? '#c084fc' : '#9333ea',
    areaOpacity: isDark ? 0.4 : 0.6, // Higher opacity for light mode visibility
  }), [isDark]);

  const getRangeLabel = () => {
    switch (timeRange) {
      case 'this_week': return t('common.this_week');
      case 'this_month': return t('common.this_month');
      case 'last_3_months': return t('common.last_3_months');
      case 'this_year': return t('common.this_year');
      case 'all_time': return t('common.all_time');
      default: return t('common.this_year');
    }
  };

  return (
    <div className="dashboard-page-wrapper p-0 p-md-4 py-3">
      <div className="container-fluid px-3">

        {/* HEADER & FİLTRELER */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5">
          <div className="mb-3 mb-md-0">
            <h1 className="display-6 fw-bold">{t('common.expense_analysis')}</h1>
            <p className="text-muted">{t('common.real_time_insights')}</p>
          </div>

          <div className="position-relative">
            <button
              className="btn btn-outline-secondary d-flex align-items-center"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={!user}
            >
              {getRangeLabel()} <FaChevronDown className="ms-2 small" />
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="position-fixed top-0 start-0 w-100 h-100"
                  style={{ zIndex: 999 }}
                  onClick={() => setIsDropdownOpen(false)}
                ></div>

                <div className="card position-absolute end-0 mt-2 shadow-sm border-0" style={{ zIndex: 1000, minWidth: '150px' }}>
                  <div className="list-group list-group-flush">
                    <button className="list-group-item list-group-item-action" onClick={() => { setTimeRange('this_week'); setIsDropdownOpen(false); }}>{t('common.this_week')}</button>
                    <button className="list-group-item list-group-item-action" onClick={() => { setTimeRange('this_month'); setIsDropdownOpen(false); }}>{t('common.this_month')}</button>
                    <button className="list-group-item list-group-item-action" onClick={() => { setTimeRange('last_3_months'); setIsDropdownOpen(false); }}>{t('common.last_3_months')}</button>
                    <button className="list-group-item list-group-item-action" onClick={() => { setTimeRange('this_year'); setIsDropdownOpen(false); }}>{t('common.this_year')}</button>
                    <button className="list-group-item list-group-item-action" onClick={() => { setTimeRange('all_time'); setIsDropdownOpen(false); }}>{t('common.all_time')}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* YÜKLENİYORSA */}
        {loading && (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status"></div>
          </div>
        )}

        {/* KULLANICI GİRİŞ YAPMAMIŞSA */}
        {!user && !loading && (
          <div className="alert alert-info text-center p-5">
            <h4 className="alert-heading fw-bold">{t('common.login_required')}</h4>
            <p className="mb-3">{t('common.please_log_in_analysis')}</p>
            <Link to="/login" className="btn btn-primary">{t('common.log_in')}</Link>
          </div>
        )}

        {/* KULLANICI VARSA AMA VERİ YOKSA */}
        {user && !loading && chartData.length === 0 && (
          <div className="alert alert-light text-center p-5 border border-dashed">
            <h5 className="text-muted">{t('common.no_data_period')}</h5>
            <p className="mb-0 text-muted">{t('common.try_changing_filter')}</p>
          </div>
        )}

        {/* VERİ VARSA GRAFİKLERİ GÖSTER */}
        {user && !loading && chartData.length > 0 && (
          <>
            <div className="row mb-5">
              <div className="col-12">
                <SpendingChart 
                  data={chartData} 
                  totalSpent={totalSpent} 
                  timeRangeLabel={getRangeLabel()} 
                  chartTheme={chartTheme} 
                  isDark={isDark} 
                />
              </div>
            </div>

            <div className="row mb-5">
              {/* Category Section */}
              <div className="col-lg-4 mb-5 mb-lg-0">
                <div className="mb-4">
                  <CategoryChart 
                    data={categoryData} 
                    chartTheme={chartTheme} 
                    isDark={isDark} 
                  />
                </div>
                <h3 className="h5 fw-bold mb-3">{t('common.category_breakdown')}</h3>
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="table table-hover mb-0 align-middle">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                          <th scope="col" className="ps-3 py-3 text-muted fw-normal small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.category')}</th>
                          <th scope="col" className="py-3 text-muted fw-normal text-end small text-uppercase" style={{ letterSpacing: '0.05em' }}>%</th>
                          <th scope="col" className="py-3 text-muted fw-normal text-end pe-3 small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.total_amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryData.map((item, index) => {
                          const pct = totalSpent > 0 ? ((item.amount / totalSpent) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={index}>
                              <td className="ps-3">
                                <div className="d-flex align-items-center gap-2">
                                  <span style={{
                                    width: 32, height: 32, borderRadius: '8px',
                                    backgroundColor: `${getCategoryInfo(item.name).color}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    fontSize: '1rem'
                                  }}>
                                    {getCategoryInfo(item.name).icon}
                                  </span>
                                  <span className="fw-bold text-truncate" style={{ maxWidth: '160px' }} title={item.name}>{item.name}</span>
                                </div>
                              </td>
                              <td className="text-end text-muted">{pct}%</td>
                              <td className="text-end pe-4 fw-medium">
                                {formatPrice(item.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Store Section */}
              <div className="col-lg-4 mb-5 mb-lg-0">
                <div className="mb-4">
                  <StoreChart 
                    data={storeData} 
                    chartTheme={chartTheme} 
                    isDark={isDark} 
                  />
                </div>
                <h3 className="h5 fw-bold mb-3">{t('common.store_breakdown')}</h3>
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="table table-hover mb-0 align-middle">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                          <th scope="col" className="ps-3 py-3 text-muted fw-normal small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.store')}</th>
                          <th scope="col" className="py-3 text-muted fw-normal text-end small text-uppercase" style={{ letterSpacing: '0.05em' }}>%</th>
                          <th scope="col" className="py-3 text-muted fw-normal text-end pe-3 small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.total_amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeData.map((item, index) => {
                          const pct = totalSpent > 0 ? ((item.amount / totalSpent) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={index}>
                              <td className="ps-3">
                                <div className="d-flex align-items-center gap-2">
                                  <span style={{
                                    width: 32, height: 32, borderRadius: '8px',
                                    backgroundColor: `${getCategoryInfo(item.name).color}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    fontSize: '1rem'
                                  }}>
                                    🏪
                                  </span>
                                  <span className="fw-bold text-truncate" style={{ maxWidth: '160px' }} title={item.name}>{item.name}</span>
                                </div>
                              </td>
                              <td className="text-end text-muted">{pct}%</td>
                              <td className="text-end pe-3 fw-medium">
                                {formatPrice(item.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Brand Section */}
              <div className="col-lg-4">
                <div className="mb-4">
                  <BrandChart 
                    data={brandData} 
                    chartTheme={chartTheme} 
                    isDark={isDark} 
                  />
                </div>
                <h3 className="h5 fw-bold mb-3">{t('common.brand_breakdown')}</h3>
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="table table-hover mb-0 align-middle">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                          <th scope="col" className="ps-3 py-3 text-muted fw-normal small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.brand')}</th>
                          <th scope="col" className="py-3 text-muted fw-normal text-end small text-uppercase" style={{ letterSpacing: '0.05em' }}>%</th>
                          <th scope="col" className="py-3 text-muted fw-normal text-end pe-3 small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.total_amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {brandData.map((item, index) => {
                          const pct = totalSpent > 0 ? ((item.amount / totalSpent) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={index}>
                              <td className="ps-3">
                                <div className="d-flex align-items-center gap-2">
                                  <span style={{
                                    width: 32, height: 32, borderRadius: '8px',
                                    backgroundColor: `${getCategoryInfo(item.name).color}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    fontSize: '1rem'
                                  }}>
                                    🏷️
                                  </span>
                                  <span className="fw-bold text-truncate" style={{ maxWidth: '160px' }} title={item.name}>{item.name}</span>
                                </div>
                              </td>
                              <td className="text-end text-muted">{pct}%</td>
                              <td className="text-end pe-3 fw-medium">
                                {formatPrice(item.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default AnalyzeExpenses;