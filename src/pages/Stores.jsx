import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaStore, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { useStores } from '../hooks/useStores';
import StoreFilters from '../components/stores/StoreFilters';

// cleanStoreName dışa aktarımı kaldırıldı

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
    <div className="dashboard-page-wrapper p-4 enlarge-web-8">
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
            <div key={index} className="col-4 col-sm-6 col-md-6 col-lg-4 mb-3 mb-md-4">
              {/* Premium Card Class eklendi */}
              <div className="card shadow-sm h-100 card-hover-effect border-0">
                <div className="card-body p-2 p-sm-4 d-flex flex-column">

                  <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start mb-2 mb-sm-3 text-center text-sm-start">
                    <div className="bg-primary-subtle rounded-circle p-2 p-sm-3 me-0 me-sm-3 mb-1 mb-sm-0 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '40px', height: '40px' }}>
                      <FaStore className="text-primary" style={{ fontSize: '1.2rem' }} />
                    </div>
                    <div className="w-100 overflow-hidden">
                      <h6 className="card-title mb-1 fw-bold text-truncate w-100" style={{ fontSize: '0.8rem' }} title={store.name}>{store.name}</h6>
                      <small className="card-text text-muted d-block text-truncate w-100" style={{ fontSize: '0.65rem' }}>
                        <span className="d-none d-sm-inline">{store.visitCount} {t('common.visit_recorded')}</span>
                        <span className="d-sm-none">{store.visitCount}x</span>
                      </small>
                    </div>
                  </div>

                  <div className="mt-auto pt-2 border-top d-flex flex-column flex-sm-row justify-content-between align-items-center align-items-sm-end text-center text-sm-start">
                    <div className="mb-2 mb-sm-0 w-100 overflow-hidden">
                      <small className="text-muted d-none d-sm-block" style={{ fontSize: '0.75rem' }}>{t('common.total_spent')}</small>
                      <span className="fw-bold text-primary text-truncate d-block" style={{ fontSize: '0.85rem' }}>{formatPrice(store.totalSpent)}</span>
                    </div>

                    <div className="text-center text-sm-end w-100">
                      <Link
                        to={`/stores/${encodeURIComponent(store.name)}`}
                        className="btn btn-sm btn-outline-primary rounded-pill px-0 px-sm-3 w-100 fw-bold"
                        onClick={() => saveSearchTerm(searchTerm)}
                        style={{ padding: '0.2rem' }}
                      >
                        <span className="d-none d-sm-inline" style={{ fontSize: '0.75rem' }}>{t('common.view_details')} <FaChevronRight className="ms-1" style={{ fontSize: '0.6rem' }} /></span>
                        <FaChevronRight className="d-sm-none" style={{ fontSize: '0.8rem' }} />
                      </Link>
                    </div>
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