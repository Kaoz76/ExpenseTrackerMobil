import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBoxOpen, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getCategoryInfo, localizeCategory } from '../utils/categoryMap';

import { trToLower } from '../utils/stringUtils';

function Products() {
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortOption, setSortOption] = useState('most_purchased');

  // TEMİZLEME FONKSİYONU
  const handleReset = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('recentProductSearches') || '[]');
    setRecentSearches(history);
  }, []);

  const saveSearchTerm = (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const history = JSON.parse(localStorage.getItem('recentProductSearches') || '[]');
    const filtered = history.filter(h => h !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, 5);
    localStorage.setItem('recentProductSearches', JSON.stringify(updated));
    setRecentSearches(updated);
  };

  const handleSelectSuggestion = (product) => {
    saveSearchTerm(searchTerm);
    navigate(`/products/${encodeURIComponent(product.name)}?brand=${encodeURIComponent(product.brand !== 'Unknown Brand' ? product.brand : '')}`);
  };

  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    products.forEach(p => {
      if (p.type) {
        categories.add(p.type);
      }
    });
    return ['all', ...Array.from(categories)];
  }, [products]);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const search = trToLower(searchTerm);
    return products.filter(product =>
      trToLower(product.name || '').includes(search) ||
      trToLower(product.brand || '').includes(search) ||
      trToLower(product.type || '').includes(search)
    ).slice(0, 5);
  }, [products, searchTerm]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      // 🔥 DÜZELTME 1: isManual filtresi kaldırıldı! Tüm fişlerdeki ürünler toplanacak.
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const productMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              // Skip items with negative prices (discounts/sales)
              const itemPrice = Number(item.price) || 0;
              if (itemPrice < 0) return;

              // Marka veya isim yoksa undefined olmasını engelle
              const safeBrand = item.brand || 'Unknown Brand';
              const safeName = item.name || 'Unnamed Product';
              const uniqueKey = trToLower(`${safeBrand}-${safeName}`);

              if (!productMap[uniqueKey]) {
                productMap[uniqueKey] = {
                  id: uniqueKey,
                  name: safeName,
                  brand: safeBrand,
                  type: localizeCategory(item.type || 'Other', language),
                  latestPrice: Number(item.price) || 0,
                  latestPriceCurrency: data.currency || currency?.code || 'USD',
                  latestDate: data.date,
                  createdAt: data.createdAt,
                  historyCount: 1
                };
              } else {
                if (data.createdAt > productMap[uniqueKey].createdAt) {
                  productMap[uniqueKey].latestPrice = Number(item.price) || 0;
                  productMap[uniqueKey].latestPriceCurrency = data.currency || currency?.code || 'USD';
                  productMap[uniqueKey].latestDate = data.date;
                  productMap[uniqueKey].createdAt = data.createdAt;
                }
                productMap[uniqueKey].historyCount += 1;
              }
            });
          }
        });

        setProducts(Object.values(productMap));
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setProducts([]);
      setLoading(false);
    }
  }, [user, currency?.code, language]);

  // 🔥 DÜZELTME 2 & 3: useMemo ile performans artışı, çökme koruması ve historyCount'a göre sıralama
  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(product => {
      // 1. Kategori Filtresi
      if (selectedCategory !== 'all' && product.type !== selectedCategory) {
        return false;
      }

      // 2. Arama Filtresi
      const search = trToLower(searchTerm);
      if (searchTerm.trim() !== '') {
        return (
          trToLower(product.name || '').includes(search) ||
          trToLower(product.brand || '').includes(search) ||
          trToLower(product.type || '').includes(search)
        );
      }
      return true;
    });

    // 3. Sıralama
    return result.sort((a, b) => {
      if (sortOption === 'most_purchased') {
        return b.historyCount - a.historyCount;
      }
      if (sortOption === 'price_low_high') {
        return a.latestPrice - b.latestPrice;
      }
      if (sortOption === 'price_high_low') {
        return b.latestPrice - a.latestPrice;
      }
      if (sortOption === 'az') {
        return (a.name || '').localeCompare(b.name || '', 'tr');
      }
      if (sortOption === 'recent') {
        const getMillis = (dateStr) => {
          if (!dateStr) return 0;
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
          }
          return new Date(dateStr).getTime() || 0;
        };
        return getMillis(b.latestDate) - getMillis(a.latestDate);
      }
      return 0;
    });
  }, [products, searchTerm, selectedCategory, sortOption]);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

        {/* Breadcrumb Navigasyonu */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item active" aria-current="page">{t('common.products')}</li>
          </ol>
        </nav>

        {/* Başlık ve Arama / Filtreleme Çubuğu */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
          <h1 className="display-6 fw-bold mb-3 mb-md-0">{t('common.products')}</h1>

          <div className="search-controls-wrapper d-flex flex-column flex-md-row gap-2">
            <div className="search-wrapper">
              <form className="search-form" onSubmit={(e) => { e.preventDefault(); saveSearchTerm(searchTerm); }}>
                <button type="submit">
                  <svg width="17" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="search">
                    <path d="M7.667 12.667A5.333 5.333 0 107.667 2a5.333 5.333 0 000 10.667zM14.334 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>

                <input
                  className="search-input"
                  placeholder={t('common.search_products')}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />

                {(searchTerm || selectedCategory !== 'all') && (
                  <button className="search-reset" type="button" onClick={handleReset}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                )}
              </form>

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions-dropdown">
                  {suggestions.map((p) => {
                    const displayType = p.type === 'Other' || p.type === 'Diğer' ? t('common.category_other') : p.type;
                    const catInfo = getCategoryInfo(displayType);
                    return (
                      <div
                        key={p.id}
                        className="suggestion-item"
                        onMouseDown={() => handleSelectSuggestion(p)}
                      >
                        <div className="suggestion-item-icon" style={{ color: catInfo.color }}>
                          {catInfo.icon}
                        </div>
                        <div className="suggestion-item-details">
                          <span className="suggestion-item-name">{p.name}</span>
                          <span className="suggestion-item-sub">{p.brand} • {displayType}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sorting control */}
            <select
              className="sort-select"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              aria-label={t('common.sort_by')}
            >
              <option value="most_purchased">{t('common.sort_most_purchased')}</option>
              <option value="price_low_high">{t('common.sort_price_low_to_high')}</option>
              <option value="price_high_low">{t('common.sort_price_high_to_low')}</option>
              <option value="az">{t('common.sort_az')}</option>
              <option value="recent">{t('common.sort_recent')}</option>
            </select>
          </div>
        </div>

        {/* Recent searches history tags */}
        {showSuggestions && !searchTerm.trim() && recentSearches.length > 0 && (
          <div className="recent-searches-container mb-3">
            <span className="recent-searches-title">{t('common.recent_searches')}:</span>
            {recentSearches.map((term, idx) => (
              <button
                key={idx}
                className="recent-search-pill"
                onMouseDown={() => {
                  setSearchTerm(term);
                  setShowSuggestions(false);
                }}
              >
                {term}
              </button>
            ))}
          </div>
        )}

        {/* Horizontal Category Badges Scrollable List */}
        {uniqueCategories.length > 1 && (
          <div className="category-scroll-container mb-3">
            {uniqueCategories.map((cat) => {
              const isActive = selectedCategory === cat;
              const displayLabel = cat === 'all' ? t('common.category_all') : cat;
              return (
                <button
                  key={cat}
                  className={`category-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        )}

        {loading && <div className="text-center p-5"><div className="spinner-border text-primary" role="status"></div></div>}

        {!loading && products.length === 0 && (
          <div className="alert alert-info text-center p-4 border border-dashed">
            <h5 className="mb-2">{t('common.no_products_found')}</h5>
            <p className="mb-0 text-muted">
              {t('common.use_manual_entry_or_scan')}
            </p>
          </div>
        )}

        <div className="row">
          {/* 🔥 DÜZELTME: filteredProducts yerine optimize ettiğimiz filteredAndSortedProducts kullanıyoruz */}
          {filteredAndSortedProducts.map((product) => {
            const displayType = product.type === 'Other' || product.type === 'Diğer'
              ? t('common.category_other')
              : localizeCategory(product.type, language);
            const catInfo = getCategoryInfo(displayType);
            return (
            <div key={product.id} className="col-md-6 col-lg-4 col-xl-3 mb-4">
              <div className="card shadow-sm h-100 border-0 card-hover-effect">
                <div className="card-body d-flex flex-column">

                  <div className="d-flex align-items-start mb-3">
                    <div 
                      className="rounded p-3 me-3 d-flex align-items-center justify-content-center" 
                      style={{ backgroundColor: `${catInfo.color}15`, fontSize: '1.5rem', width: '54px', height: '54px' }}
                    >
                      {catInfo.icon}
                    </div>
                    <div>
                      <h6 className="card-title fw-bold mb-1 text-truncate" style={{ maxWidth: '150px' }} title={product.name === 'Unnamed Product' ? t('common.unnamed_product') : product.name}>
                        {product.name === 'Unnamed Product' ? t('common.unnamed_product') : product.name}
                      </h6>
                      <small className="text-muted d-block">
                        {product.brand === 'Unknown Brand' ? t('common.unknown_brand') : product.brand}
                      </small>
                      <span className="badge mt-1" style={{ backgroundColor: `${catInfo.color}20`, color: catInfo.color }}>
                        {displayType}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-end">
                    <div>
                      <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>{t('common.last_price')}</small>
                      <span className="fs-5 fw-bold text-primary">{formatPrice(product.latestPrice, product.latestPriceCurrency)}</span>
                    </div>

                    {/* URL Güvenliği İçin Marka'yı da encode ederek gönderiyoruz */}
                    <Link
                      to={`/products/${encodeURIComponent(product.name)}?brand=${encodeURIComponent(product.brand !== 'Unknown Brand' ? product.brand : '')}`}
                      className="btn btn-sm btn-outline-primary rounded-pill px-3"
                      onClick={() => saveSearchTerm(searchTerm)}
                    >
                      {t('common.details')} <FaChevronRight className="ms-1" style={{ fontSize: '0.7rem' }} />
                    </Link>
                  </div>

                  <div className="text-end mt-2">
                    <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {product.historyCount} {t('common.purchase_recorded')}
                    </small>
                  </div>

                </div>
              </div>
            </div>
          )})}

          {/* Arama Sonucu Bulunamazsa */}
          {!loading && products.length > 0 && filteredAndSortedProducts.length === 0 && (
            <div className="col-12 text-center p-5">
              <h5 className="text-muted">{t('common.no_products_matched')}</h5>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Products;