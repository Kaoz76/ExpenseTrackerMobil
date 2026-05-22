import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { FaHistory, FaTag, FaChartLine, FaThumbsUp, FaThumbsDown, FaExternalLinkAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { trTitleCase } from '../utils/stringUtils';

function ProductDetails() {
  const { productId } = useParams(); // URL'den gelen ham ürün adı
  const [searchParams] = useSearchParams();
  const brandName = searchParams.get('brand');

  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productType, setProductType] = useState(''); // Ürün türü için yeni state

  // İsim Temizleme Fonksiyonu
  const cleanName = (name) => {
    if (!name) return "";
    let cleaned = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
    // Decode any URI-encoded characters (e.g. literal %20 from OCR)
    try { cleaned = decodeURIComponent(cleaned); } catch { /* ignore */ }
    // Collapse multiple whitespace into single space
    cleaned = cleaned.replace(/\s+/g, ' ');
    return trTitleCase(cleaned).trim();
  };

  let rawProductName = productId || '';
  try {
    rawProductName = decodeURIComponent(rawProductName);
  } catch (e) {
    // If decoding fails (malformed URI), use the raw value as-is
    console.warn('Failed to decode productId, using raw value:', e);
  }
  const productName = cleanName(rawProductName);

  useEffect(() => {
    if (user && productName) {
      setLoading(true);

      // Query all receipts (not just manual) — consistent with Products page
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let foundItems = [];
        let typeFound = ''; // Döngü içinde türü yakalamak için

        console.log('=== ProductDetails Debug ===');
        console.log('Looking for productName:', JSON.stringify(productName));
        console.log('Looking for brandName:', JSON.stringify(brandName));

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              const itemPrice = Number(item.price);
              // Skip items with negative prices (discounts/sales)
              if (itemPrice < 0) return;

              // Normalize brand comparison: treat null/undefined/empty as equivalent
              const itemBrand = item.brand || '';
              const matchBrand = brandName || '';
              const cleanedItemName = cleanName(item.name);

              console.log(`  Item: ${JSON.stringify(item.name)} -> cleaned: ${JSON.stringify(cleanedItemName)} | brand: ${JSON.stringify(itemBrand)} | nameMatch: ${cleanedItemName === productName} | brandMatch: ${itemBrand === matchBrand}`);

              if (cleanedItemName === productName && itemBrand === matchBrand) {
                // Tür bilgisini ilk bulduğumuz kayıttan alalım
                if (!typeFound && item.type) {
                  typeFound = item.type;
                }

                foundItems.push({
                  id: doc.id,
                  receiptId: doc.id,
                  price: itemPrice,
                  currency: data.currency || currency?.code || 'USD',
                  store: data.fileName,
                  date: data.date,
                  createdAt: data.createdAt,
                  size: item.size
                });
              }
            });
          }
        });

        console.log('Found items count:', foundItems.length);
        console.log('=== End Debug ===');

        // Sort client-side by createdAt descending
        foundItems.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setHistory(foundItems);
        setProductType(typeFound);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, productName, brandName, currency?.code, convertPrice]);

  const convertedHistoryPrices = history.map(h => 
    convertPrice(h.price, h.currency || currency.code || 'USD', currency.code)
  );

  const avgPrice = convertedHistoryPrices.length > 0
    ? (convertedHistoryPrices.reduce((a, b) => a + b, 0) / convertedHistoryPrices.length)
    : 0;

  let minRecord = null;
  let maxRecord = null;

  if (history.length > 0) {
    let minPriceVal = Infinity;
    let maxPriceVal = -Infinity;
    history.forEach((h, idx) => {
      const convertedVal = convertedHistoryPrices[idx];
      if (convertedVal < minPriceVal) {
        minPriceVal = convertedVal;
        minRecord = h;
      }
      if (convertedVal > maxPriceVal) {
        maxPriceVal = convertedVal;
        maxRecord = h;
      }
    });
  }

  // Başlık Formatı Oluşturma
  // Örn: "Sütaş Tam Yağlı Süt"
  const fullName = `${brandName ? brandName + ' ' : ''}${productName}`;

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

        {/* BREADCRUMB */}
        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/products" className="text-decoration-none">{t('common.products')}</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {/* Format: Marka + İsim + (Tür) */}
              {fullName} {productType && <span className="text-muted">({productType})</span>}
            </li>
          </ol>
        </nav>

        {/* SAYFA BAŞLIĞI (H1) */}
        <div className="d-flex flex-column flex-md-row align-items-md-center mb-4 gap-3">
          <h1 className="display-6 fw-bold mb-0">
            {fullName}
          </h1>

          {/* Tür Bilgisi Rozeti */}
          {productType && (
            <span className="badge bg-secondary fs-6 align-self-start align-self-md-center">
              {productType}
            </span>
          )}
        </div>

        {loading && <div className="text-center p-5"><div className="spinner-border" role="status"></div></div>}

        {!loading && (
          <>
            {/* İstatistik Kartları */}
            <div className="row mb-5 g-3">
              {/* Average Price */}
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 p-3 bg-primary-subtle text-primary">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 fw-bold">{t('common.average_price')}</h6>
                    <FaChartLine />
                  </div>
                  <h3 className="fw-bold mb-0">{formatPrice(avgPrice)}</h3>
                  <small className="text-primary-emphasis opacity-75">{t('common.based_on')} {history.length} {t('common.purchases_lower')}</small>
                </div>
              </div>

              {/* Lowest Price */}
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 p-3 bg-success-subtle text-success">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 fw-bold">{t('common.lowest_price')}</h6>
                    <FaTag />
                  </div>
                  <h3 className="fw-bold mb-1">
                    {minRecord ? formatPrice(minRecord.price, minRecord.currency) : formatPrice(0)}
                  </h3>
                  {minRecord && (
                    <div className="mt-1">
                      <div className="fw-bold text-success-emphasis">{minRecord.store}</div>
                      <div className="badge bg-success text-white mt-2 d-inline-flex align-items-center">
                        <FaThumbsUp className="me-1" /> {t('common.recommended')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Highest Price */}
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 p-3 bg-danger-subtle text-danger">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 fw-bold">{t('common.highest_price')}</h6>
                    <FaTag />
                  </div>
                  <h3 className="fw-bold mb-1">
                    {maxRecord ? formatPrice(maxRecord.price, maxRecord.currency) : formatPrice(0)}
                  </h3>
                  {maxRecord && (
                    <div className="mt-1">
                      <div className="fw-bold text-danger-emphasis">{maxRecord.store}</div>
                      <div className="badge bg-danger text-white mt-2 d-inline-flex align-items-center">
                        <FaThumbsDown className="me-1" /> {t('common.not_recommended')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Geçmiş Tablosu */}
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-body-tertiary py-3">
                <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
                  <FaHistory className="me-2 text-body-secondary" /> {t('common.purchase_history')}
                </h5>
              </div>

              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-secondary">
                    <tr>
                      <th className="py-3 ps-4">{t('common.date')}</th>
                      <th className="py-3">{t('common.store')}</th>
                      <th className="py-3">{t('common.size')}</th>
                      <th className="py-3 text-end">{t('common.price')}</th>
                      <th className="py-3 text-center pe-4">{t('common.receipt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, idx) => (
                      <tr key={idx}>
                        <td className="ps-4 text-body-secondary fw-medium">{record.date}</td>
                        <td className="fw-bold">{record.store}</td>
                        <td>{record.size || '-'}</td>
                        <td className="text-end fw-bold text-primary">{formatPrice(record.price, record.currency)}</td>
                        <td className="text-center pe-4">
                          <Link
                            to={`/receipts/${record.receiptId}`}
                            className="btn btn-sm btn-outline-secondary rounded-pill px-2"
                            title={t('common.view_receipt')}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FaExternalLinkAlt style={{ fontSize: '0.75rem' }} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-5 text-body-secondary">{t('common.no_history_found')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default ProductDetails;