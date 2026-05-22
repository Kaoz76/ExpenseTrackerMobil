import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaStore } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useStores } from '../hooks/useStores';
import StoreFilters from '../components/stores/StoreFilters';

// Removed cleanStoreName export

function Stores() {
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { stores, loading } = useStores(user, currency, convertPrice);

  const handleReset = () => {
    setSearchTerm('');
  };

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('recentStoreSearches') || '[]');
    setRecentSearches(history);
  }, []);

  const saveSearchTerm = (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const history = JSON.parse(localStorage.getItem('recentStoreSearches') || '[]');
    const filtered = history.filter(h => h !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, 5);
    localStorage.setItem('recentStoreSearches', JSON.stringify(updated));
    setRecentSearches(updated);
  };

  const handleSelectSuggestion = (store) => {
    saveSearchTerm(searchTerm);
    navigate(`/stores/${encodeURIComponent(store.name)}`);
  };

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const search = searchTerm.toLocaleLowerCase('tr-TR');
    return stores.filter(store =>
      store.name.toLocaleLowerCase('tr-TR').includes(search)
    ).slice(0, 5);
  }, [stores, searchTerm]);

  // 🔥 YENİ: Performanslı (useMemo) ve Türkçe Uyumlu Arama Filtresi
  const filteredStores = useMemo(() => {
    if (!searchTerm) return stores;
    return stores.filter(store =>
      store.name.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))
    );
  }, [stores, searchTerm]);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item active" aria-current="page">{t('common.stores')}</li>
          </ol>
        </nav>

        <StoreFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          suggestions={suggestions}
          recentSearches={recentSearches}
          saveSearchTerm={saveSearchTerm}
          handleSelectSuggestion={handleSelectSuggestion}
          handleReset={handleReset}
        />

        {loading && <div className="text-center p-5"><div className="spinner-border text-primary" role="status"></div></div>}

        {!loading && stores.length === 0 && (
          <div className="alert alert-info text-center p-4 border border-dashed">
            <h5 className="mb-2">{t('common.no_store_data')}</h5>
            <p className="mb-0 text-muted">
              <Link to="/receipts" className="alert-link fw-bold">{t('nav.receipts')}</Link> / <Link to="/texts" className="alert-link fw-bold">{t('nav.manual_entry')}</Link>
            </p>
          </div>
        )}

        <div className="row">
          {/* 🔥 Eski stores.map yerine filteredStores.map kullanıyoruz */}
          {filteredStores.map((store, index) => (
            <div key={index} className="col-md-6 col-lg-4 mb-4">
              {/* Premium Card Class eklendi */}
              <div className="card shadow-sm h-100 card-hover-effect border-0">
                <div className="card-body d-flex flex-column p-4">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-primary-subtle rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                      <FaStore className="text-primary fs-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="card-title mb-1 fw-bold text-truncate" title={store.name}>{store.name}</h5>
                      <p className="card-text text-muted small mb-0">
                        {store.visitCount} {t('common.visit_recorded')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                    <div>
                      <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>{t('common.total_spent')}</small>
                      <span className="fw-bold fs-5 text-primary">{formatPrice(store.totalSpent)}</span>
                    </div>

                    <Link
                      to={`/stores/${encodeURIComponent(store.name)}`}
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
                      onClick={() => saveSearchTerm(searchTerm)}
                    >
                      {t('common.view_details')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 🔥 Arama Sonucu Bulunamazsa Kullanıcıyı Bilgilendir */}
          {!loading && stores.length > 0 && filteredStores.length === 0 && (
            <div className="col-12 text-center p-5">
              <h5 className="text-muted">{t('common.no_stores_matched', { search: searchTerm })}</h5>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Stores;