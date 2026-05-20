import React, { useState, useEffect, useMemo } from 'react';
import { FaChevronDown, FaArrowUp, FaChartPie, FaCalendarAlt } from 'react-icons/fa';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { getCategoryInfo } from '../utils/categoryMap';

function AnalyzeExpenses() {
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t, language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);

  const [timeRange, setTimeRange] = useState('this_year');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  useEffect(() => {
    if (user) {
      setLoading(true);

      const now = new Date();
      let startDate = null;

      if (timeRange === 'this_week') {
        startDate = new Date(now);
        const dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon...
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Start from Monday
        startDate.setDate(startDate.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
      } else if (timeRange === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (timeRange === 'last_3_months') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      } else if (timeRange === 'this_year') {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      // Use daily grouping for short ranges, monthly for longer ones
      const useDailyGrouping = (timeRange === 'this_week' || timeRange === 'this_month');

      // --- 1) Receipts query (no composite index needed — client-side date filtering)
      const receiptsQuery = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      // --- 2) Subscriptions query ---
      const subsQuery = query(
        collection(db, "subscriptions"),
        where("userId", "==", user.uid)
      );

      // Listen to both collections
      let receiptsData = null;
      let subsData = null;
      let receiptsLoaded = false;
      let subsLoaded = false;

      const mergeAndUpdate = () => {
        if (!receiptsLoaded || !subsLoaded) return;

        const monthlyMap = {};
        const categoryMap = {};
        let total = 0;

        // Pre-fill the map with zeros to guarantee continuous charts
        if (timeRange === 'this_week') {
          const start = new Date(startDate);
          for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            if (d > now) break; // Stop zero-filling after today
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        } else if (timeRange === 'this_month') {
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          for (let i = 1; i <= daysInMonth; i++) {
            if (i > now.getDate()) break; // Stop zero-filling after today
            const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        } else if (timeRange === 'last_3_months') {
          for (let i = 2; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        } else if (timeRange === 'this_year') {
          for (let i = 1; i <= 12; i++) {
            if (i > now.getMonth() + 1) break; // Stop zero-filling after current month
            const key = `${now.getFullYear()}-${String(i).padStart(2, '0')}`;
            monthlyMap[key] = 0;
          }
        }

        let minYear = now.getFullYear();
        let maxYear = now.getFullYear();

        // Process receipts
        if (receiptsData) {
          receiptsData.forEach((doc) => {
            const data = doc.data();
            const rawPrice = Number(data.price) || 0;
            const price = convertPrice(rawPrice, data.currency || currency.code || 'USD', currency.code);

            // Client-side date filtering (avoids composite index requirement)
            if (startDate && data.createdAt && typeof data.createdAt.toDate === 'function') {
              const docDate = data.createdAt.toDate();
              if (docDate < startDate) return; // Skip records outside selected range
            }

            total += price;

            // Smart grouping key: daily for short ranges, monthly for longer, yearly for all_time
            let groupKey = "Unknown";
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
              const date = data.createdAt.toDate();
              const y = date.getFullYear();
              
              if (y < minYear) minYear = y;
              if (y > maxYear) maxYear = y;

              if (timeRange === 'all_time') {
                groupKey = `${y}`;
              } else if (useDailyGrouping) {
                // Group by day: "2026-05-10"
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                groupKey = `${y}-${month}-${day}`;
              } else {
                // Group by month: "2026-05"
                const month = String(date.getMonth() + 1).padStart(2, '0');
                groupKey = `${y}-${month}`;
              }
            }

            if (!monthlyMap[groupKey]) monthlyMap[groupKey] = 0;
            monthlyMap[groupKey] += price;

            // Improved category detection: check items for type, regardless of isManual
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              let hasTypedItems = false;
              data.items.forEach(item => {
                const type = item.type || "";
                const rawItemPrice = Number(item.price) || 0;
                const itemPrice = convertPrice(rawItemPrice, data.currency || currency.code || 'USD', currency.code);
                if (type.trim()) {
                  hasTypedItems = true;
                  if (!categoryMap[type]) categoryMap[type] = 0;
                  categoryMap[type] += itemPrice;
                }
              });
              // If no items had a type, categorize by source
              if (!hasTypedItems) {
                const catName = data.isManual ? "Manual Entry" : "Scanned";
                if (!categoryMap[catName]) categoryMap[catName] = 0;
                categoryMap[catName] += price;
              }
            } else {
              const catName = data.isManual ? "Manual Entry" : "Scanned";
              if (!categoryMap[catName]) categoryMap[catName] = 0;
              categoryMap[catName] += price;
            }
          });
        }

        // Fill missing years for 'all_time'
        if (timeRange === 'all_time') {
          for (let y = minYear; y <= maxYear; y++) {
            if (monthlyMap[`${y}`] === undefined) {
              monthlyMap[`${y}`] = 0;
            }
          }
        }

        // Process subscriptions — add to the correct target based on time range
        if (subsData && subsData.length > 0) {
          let subsKey = "Unknown";
          if (timeRange === 'all_time') {
            subsKey = `${now.getFullYear()}`;
          } else if (useDailyGrouping) {
            subsKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          } else {
            subsKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          }

          let subsTotal = 0;

          subsData.forEach(sub => {
            const rawSubPrice = Number(sub.price) || 0;
            const subPrice = convertPrice(rawSubPrice, sub.currency || currency.code || 'USD', currency.code);
            subsTotal += subPrice;
          });

          if (subsTotal > 0) {
            // Add subscriptions to the total & chart
            total += subsTotal;
            if (!monthlyMap[subsKey]) monthlyMap[subsKey] = 0;
            monthlyMap[subsKey] += subsTotal;

            // Add as a category
            const subsLabel = t('nav.subscriptions') || "Subscriptions";
            if (!categoryMap[subsLabel]) categoryMap[subsLabel] = 0;
            categoryMap[subsLabel] += subsTotal;
          }
        }

        // Format chart data with smart labels
        const formattedChartData = Object.keys(monthlyMap)
          .sort()
          .map(key => {
            if (key === "Unknown") return { name: "Unknown", amount: monthlyMap[key] };

            if (timeRange === 'all_time') {
              return { name: key, amount: monthlyMap[key] };
            } else if (useDailyGrouping) {
              // "2026-05-10" → "10 May" or "May 10"
              const [y, m, d] = key.split('-');
              const dateObj = new Date(y, m - 1, d);
              const displayDay = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' });
              return { name: displayDay, amount: monthlyMap[key] };
            } else {
              // "2026-05" → "May 2026"
              const [y, m] = key.split('-');
              const dateObj = new Date(y, m - 1);
              const displayMonth = dateObj.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', year: 'numeric' });
              return { name: displayMonth, amount: monthlyMap[key] };
            }
          });

        const formattedCategoryData = Object.keys(categoryMap)
          .map(key => ({ name: key, amount: categoryMap[key] }))
          .sort((a, b) => b.amount - a.amount);

        setChartData(formattedChartData);
        setCategoryData(formattedCategoryData);
        setTotalSpent(total);
        setLoading(false);
      };

      const unsubReceipts = onSnapshot(receiptsQuery, (snapshot) => {
        receiptsData = snapshot;
        receiptsLoaded = true;
        mergeAndUpdate();
      }, (error) => {
        console.error("Error analyzing expenses:", error);
        receiptsLoaded = true;
        mergeAndUpdate();
      });

      const unsubSubs = onSnapshot(subsQuery, (snapshot) => {
        subsData = snapshot.docs.map(doc => doc.data());
        subsLoaded = true;
        mergeAndUpdate();
      }, (error) => {
        console.error("Error fetching subscriptions:", error);
        subsLoaded = true;
        mergeAndUpdate();
      });

      return () => {
        unsubReceipts();
        unsubSubs();
      };
    } else {
      setChartData([]);
      setCategoryData([]);
      setTotalSpent(0);
      setLoading(false);
    }
  }, [user, timeRange, currency?.code, convertPrice]);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

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
                {/* GELİŞTİRME 2: Tıklanınca kapanması için görünmez arka plan */}
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
            {/* GRAFİKLER */}
            <div className="row mb-5">

              {/* Spending Over Time */}
              <div className="col-lg-8 mb-4 mb-lg-0">
                <div className="card border-0 shadow-sm h-100 card-accent">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <div>
                        <h5 className="card-title fw-bold mb-1">{t('common.spending_over_time')}</h5>
                        <p className="text-muted small mb-0">{t('common.breakdown_for')} <strong>{getRangeLabel()}</strong></p>
                      </div>
                      <div className="bg-primary-subtle p-2 rounded text-primary">
                        <FaCalendarAlt />
                      </div>
                    </div>

                    <div className="d-flex align-items-baseline mb-4">
                      <h2 className="fw-bold me-3 mb-0">
                        {formatPrice(totalSpent)}
                      </h2>
                      <span className="text-success fw-medium d-flex align-items-center">
                        <FaArrowUp className="me-1 small" /> {t('common.total_selected')}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chartTheme.areaStop1} stopOpacity={chartTheme.areaOpacity} />
                              <stop offset="50%" stopColor={chartTheme.areaStop2} stopOpacity={chartTheme.areaOpacity * 0.4} />
                              <stop offset="95%" stopColor={chartTheme.areaStop1} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.axisColor, fontSize: 12 }} />
                          <YAxis hide={true} />
                          <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={chartTheme.gridOpacity} />

                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartTheme.tooltipBg,
                              borderRadius: '12px',
                              border: `1px solid ${chartTheme.tooltipBorder}`,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                              color: chartTheme.tooltipColor,
                              padding: '10px 14px',
                            }}
                            itemStyle={{ color: chartTheme.tooltipColor }}
                            labelStyle={{ color: chartTheme.axisColor, marginBottom: 4, fontWeight: 600 }}
                            formatter={(value) => [formatPrice(value), t('common.amount')]}
                          />

                          <Area 
                            type="monotone" 
                            dataKey="amount" 
                            stroke={chartTheme.lineColor} 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorAmount)"
                            dot={{ r: 3, fill: chartTheme.lineColor, strokeWidth: 2, stroke: isDark ? '#1e293b' : '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spending by Category */}
              <div className="col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <div>
                        <h5 className="card-title fw-bold mb-1">{t('common.by_category')}</h5>
                        <p className="text-muted small mb-0">{t('common.where_money_goes')}</p>
                      </div>
                      <div className="bg-info-subtle p-2 rounded text-info-emphasis">
                        <FaChartPie />
                      </div>
                    </div>

                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                          <XAxis type="number" hide={true} />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 12, fill: chartTheme.axisColor }} />

                          <Tooltip
                            cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                            contentStyle={{
                              backgroundColor: chartTheme.tooltipBg,
                              borderRadius: '12px',
                              border: `1px solid ${chartTheme.tooltipBorder}`,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                              color: chartTheme.tooltipColor,
                              padding: '10px 14px',
                            }}
                            itemStyle={{ color: chartTheme.tooltipColor }}
                            labelStyle={{ color: chartTheme.axisColor, fontWeight: 600 }}
                            formatter={(value) => [formatPrice(value), t('common.amount')]}
                          />

                          <Bar dataKey="amount" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22}>
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getCategoryInfo(entry.name).color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BASİT ANALİZ TABLOSU */}
            <div className="mb-5">
              <h3 className="h4 fw-bold mb-4">{t('common.category_breakdown')}</h3>
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--bs-border-color)' }}>
                        <th scope="col" className="ps-4 py-3 text-muted fw-normal small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.category')}</th>
                        <th scope="col" className="py-3 text-muted fw-normal text-end small text-uppercase" style={{ letterSpacing: '0.05em' }}>%</th>
                        <th scope="col" className="py-3 text-muted fw-normal text-end pe-4 small text-uppercase" style={{ letterSpacing: '0.05em' }}>{t('common.total_amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryData.map((item, index) => {
                        const pct = totalSpent > 0 ? ((item.amount / totalSpent) * 100).toFixed(1) : '0.0';
                        return (
                          <tr key={index}>
                            <td className="ps-4">
                              <div className="d-flex align-items-center gap-2">
                                <span style={{
                                  width: 32, height: 32, borderRadius: '8px',
                                  backgroundColor: `${getCategoryInfo(item.name).color}15`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                  fontSize: '1rem'
                                }}>
                                  {getCategoryInfo(item.name).icon}
                                </span>
                                <span className="fw-bold">{item.name}</span>
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
          </>
        )}

      </div>
    </div>
  );
}

export default AnalyzeExpenses;