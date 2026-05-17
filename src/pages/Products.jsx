import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaBoxOpen, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getCategoryInfo } from '../utils/categoryMap';

import { trToLower } from '../utils/stringUtils';

function Products() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // TEMİZLEME FONKSİYONU
  const handleReset = () => {
    setSearchTerm('');
  };

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
                  type: item.type || 'Other',
                  latestPrice: Number(item.price) || 0,
                  latestDate: data.date,
                  createdAt: data.createdAt,
                  historyCount: 1
                };
              } else {
                if (data.createdAt > productMap[uniqueKey].createdAt) {
                  productMap[uniqueKey].latestPrice = Number(item.price) || 0;
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
  }, [user]);

  // 🔥 DÜZELTME 2 & 3: useMemo ile performans artışı, çökme koruması ve historyCount'a göre sıralama
  const filteredAndSortedProducts = useMemo(() => {
    let result = products.filter(product => {
      const search = trToLower(searchTerm);
      return (
        trToLower(product.name || '').includes(search) ||
        trToLower(product.brand || '').includes(search) ||
        trToLower(product.type || '').includes(search)
      );
    });

    // En çok satın alınan (historyCount) ürünleri en üste koy!
    return result.sort((a, b) => b.historyCount - a.historyCount);
  }, [products, searchTerm]);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

        {/* Breadcrumb Navigasyonu */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item active" aria-current="page">{t('common.products')}</li>
          </ol>
        </nav>

        {/* Başlık ve Animasyonlu Arama Çubuğu */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
          <h1 className="display-6 fw-bold mb-3 mb-md-0">{t('common.products')}</h1>

          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
            <button type="button">
              <svg width="17" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="search">
                <path d="M7.667 12.667A5.333 5.333 0 107.667 2a5.333 5.333 0 000 10.667zM14.334 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </button>

            <input
              className="search-input"
              placeholder={t('common.search_products')}
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
            const displayType = product.type === 'Other' ? t('common.category_other') : product.type;
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
                      <span className="fs-5 fw-bold text-primary">{formatPrice(product.latestPrice)}</span>
                    </div>

                    {/* URL Güvenliği İçin Marka'yı da encode ederek gönderiyoruz */}
                    <Link
                      to={`/products/${encodeURIComponent(product.name)}?brand=${encodeURIComponent(product.brand !== 'Unknown Brand' ? product.brand : '')}`}
                      className="btn btn-sm btn-outline-primary rounded-pill px-3"
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