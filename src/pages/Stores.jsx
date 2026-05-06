import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaStore } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { trTitleCase } from '../utils/stringUtils';

// YARDIMCI FONKSİYON: İsim Temizleme (Dışarı aktarılabilir Pure Function)
export const cleanStoreName = (name) => {
  if (!name) return "Unknown Store";
  let cleanName = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
  cleanName = trTitleCase(cleanName);
  return cleanName.trim();
};

function Stores() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 YENİ: Arama çubuğu için state
  const [searchTerm, setSearchTerm] = useState('');

  const handleReset = () => {
    setSearchTerm('');
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const storeMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();

          // 🔥 OPTİMİZASYON: Veritabanında hazır storeNameCleaned varsa onu kullan, yoksa anlık temizle
          const rawName = data.fileName || data.title || "Unknown Store";
          const storeName = data.storeNameCleaned || cleanStoreName(rawName);

          if (!storeMap[storeName]) {
            storeMap[storeName] = {
              id: storeName,
              name: storeName,
              totalSpent: 0,
              visitCount: 0
            };
          }

          storeMap[storeName].totalSpent += Number(data.price) || 0;
          storeMap[storeName].visitCount += 1;
        });

        // 🔥 UX GELİŞTİRMESİ: A-Z yerine En Çok Para Harcanan Mağazayı en üste koy! (Premium His)
        const storesArray = Object.values(storeMap).sort((a, b) => b.totalSpent - a.totalSpent);

        setStores(storesArray);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setStores([]);
      setLoading(false);
    }
  }, [user]);

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

        {/* 🔥 BAŞLIK VE YENİ ARAMA ÇUBUĞU */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
          <h1 className="display-6 fw-bold mb-3 mb-md-0">{t('common.stores')}</h1>

          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
            <button type="button">
              <svg width="17" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="search">
                <path d="M7.667 12.667A5.333 5.333 0 107.667 2a5.333 5.333 0 000 10.667zM14.334 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>

            <input
              className="search-input"
              placeholder={t('common.search_stores_placeholder')}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <button className="search-reset" type="button" onClick={handleReset}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </form>
        </div>

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

                    <Link to={`/stores/${encodeURIComponent(store.name)}`} className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold">
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