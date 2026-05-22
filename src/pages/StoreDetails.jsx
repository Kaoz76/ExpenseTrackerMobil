import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaHistory, FaStore, FaChartPie, FaMoneyBillWave, FaShoppingBasket, FaReceipt, FaFileAlt, FaPlus } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { trToLower, cleanStoreName } from '../utils/stringUtils';

function StoreDetails() {
  const { storeId } = useParams();
  const { user } = useAuth();
  const { formatPrice, currency, convertPrice } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(20);

  const [stats, setStats] = useState({
    totalSpent: 0,
    avgSpend: 0,
    visitCount: 0,
    mostFrequentItem: null
  });

  const targetStoreName = decodeURIComponent(storeId || '');

  useEffect(() => {
    if (user && targetStoreName) {
      setLoading(true);

      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("storeNameCleaned", "==", targetStoreName),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let receiptsData = [];
        let total = 0;
        const itemFrequency = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          receiptsData.push({
            id: doc.id,
            ...data
          });

          const rawPrice = Number(data.price) || 0;
          total += convertPrice(rawPrice, data.currency || currency.code || 'USD', currency.code);

          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              if (item.name && item.name.length > 1) {
                const key = trToLower(`${item.brand || 'Unknown'}-${item.name}`);

                if (!itemFrequency[key]) {
                  itemFrequency[key] = {
                    count: 0,
                    details: {
                      name: item.name,
                      brand: item.brand || 'Unknown',
                      type: item.type || 'General'
                    }
                  };
                }
                itemFrequency[key].count += 1;
              }
            });
          }
        });

        let mostFrequent = null;
        let maxCount = 0;

        Object.values(itemFrequency).forEach(entry => {
          if (entry.count > maxCount) {
            maxCount = entry.count;
            mostFrequent = entry.details;
          }
        });

        setHistory(receiptsData);
        setStats({
          totalSpent: total,
          visitCount: receiptsData.length,
          avgSpend: receiptsData.length > 0 ? total / receiptsData.length : 0,
          mostFrequentItem: mostFrequent
        });

        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, targetStoreName, currency?.code, convertPrice]);

  // 🔥 Tıklayınca Çökmeyi Engelleyen Akıllı Yönlendirme
  const handleRowClick = (record) => {
    if (record.isManual) {
      navigate(`/texts`, { state: { receiptId: record.id } });
    } else {
      navigate(`/receipts/${record.id}`);
    }
  };

  const displayedHistory = history.slice(0, displayLimit);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">

        <nav aria-label="breadcrumb" className="mb-4">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/stores" className="text-decoration-none">{t('common.stores')}</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {targetStoreName}
            </li>
          </ol>
        </nav>

        <div className="d-flex align-items-center mb-4">
          <div className="bg-primary-subtle rounded-circle p-3 me-3 text-primary d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
            <FaStore className="fs-3" />
          </div>
          <div>
            <h1 className="display-6 fw-bold mb-0">{targetStoreName}</h1>
            <span className="text-muted">{t('common.store_analytics')}</span>
          </div>
        </div>

        {loading && <div className="text-center p-5"><div className="spinner-border text-primary" role="status"></div></div>}

        {!loading && (
          <>
            <div className="row mb-5 g-3">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 p-3 bg-primary-subtle text-primary">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 fw-bold">{t('common.total_spent')}</h6>
                    <FaMoneyBillWave />
                  </div>
                  <h3 className="fw-bold mb-0">{formatPrice(stats.totalSpent)}</h3>
                  <small className="opacity-75">{t('common.based_on')} {stats.visitCount} {t('common.purchases_lower')}</small>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 p-3 bg-info-subtle text-info-emphasis">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 fw-bold">{t('common.average_spend')}</h6>
                    <FaChartPie />
                  </div>
                  <h3 className="fw-bold mb-0">{formatPrice(stats.avgSpend)}</h3>
                  <small className="opacity-75">{t('common.based_on')} 1 {t('common.receipt').toLowerCase()}</small>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 p-3 bg-warning-subtle text-warning-emphasis">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0 fw-bold">{t('common.favorite_item')}</h6>
                    <FaShoppingBasket />
                  </div>

                  {stats.mostFrequentItem ? (
                    <div>
                      <h4 className="fw-bold mb-0 text-truncate" title={stats.mostFrequentItem.name}>
                        {stats.mostFrequentItem.name}
                      </h4>
                      <div className="d-flex align-items-center mt-1">
                        <small className="fw-semibold me-2">{stats.mostFrequentItem.brand}</small>
                        <span className="badge bg-warning text-dark bg-opacity-50 border border-warning border-opacity-25">
                          {stats.mostFrequentItem.type}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <h4 className="fw-bold mb-0 opacity-50">-</h4>
                      <small className="opacity-75">{t('common.not_enough_data')}</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header bg-body-tertiary py-3">
                <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
                  <FaHistory className="me-2 text-body-secondary" /> {t('common.visit_history')}
                </h5>
              </div>

              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-secondary">
                    <tr>
                      <th className="py-3 ps-4">{t('common.date')}</th>
                      <th className="py-3">{t('common.entry_type')}</th>
                      <th className="py-3 text-center">{t('common.details_col')}</th>
                      <th className="py-3 text-end pe-4">{t('common.total_col')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedHistory.map((record) => (
                      <tr
                        key={record.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRowClick(record)}
                        className="card-hover-effect"
                      >
                        <td className="ps-4 text-body-secondary fw-medium">
                          {record.createdAt?.toDate ? record.createdAt.toDate().toLocaleDateString(navigator.language || 'tr-TR') : record.date}
                        </td>

                        <td>
                          {record.isManual ? (
                            <span className="badge bg-secondary d-inline-flex align-items-center">
                              <FaFileAlt className="me-1" /> {t('common.manual_entry_badge')}
                            </span>
                          ) : (
                            <span className="badge bg-info text-dark d-inline-flex align-items-center">
                              <FaReceipt className="me-1" /> {t('common.scanned_receipt_badge')}
                            </span>
                          )}
                        </td>

                        <td className="text-center text-muted small">
                          {record.isManual
                            ? `${record.items ? record.items.length : 0} ${t('common.items_logged')}`
                            : `${record.items ? record.items.length : 0} ${t('common.items_scanned')}`
                          }
                        </td>

                        <td className="text-end pe-4 fw-bold text-primary">
                          {formatPrice(record.price, record.currency)}
                        </td>
                      </tr>
                    ))}

                    {history.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-5 text-body-secondary">
                          {t('common.no_visits_found')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Performans için Load More */}
              {!loading && history.length > displayLimit && (
                <div className="text-center p-3 bg-light border-top">
                  <button
                    className="btn btn-outline-primary rounded-pill px-4 btn-sm fw-bold shadow-sm"
                    onClick={() => setDisplayLimit(prev => prev + 20)}
                  >
                    <FaPlus className="me-2 small" /> {t('common.load_older_visits')}
                  </button>
                </div>
              )}

            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default StoreDetails;