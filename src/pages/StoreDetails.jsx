import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaHistory, FaArrowLeft, FaStore, FaChartPie, FaMoneyBillWave, FaShoppingBasket, FaReceipt, FaFileAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import ImageModal from '../components/ImageModal';
import ReceiptDetailModal from '../components/ReceiptDetailModal';

function StoreDetails() {
  const { storeId } = useParams();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSpent: 0,
    avgSpend: 0,
    visitCount: 0,
    mostFrequentItem: null // Artık obje olacak (null başlangıç)
  });

  // Modal State'leri
  const [isImageModalShowing, setIsImageModalShowing] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const targetStoreName = decodeURIComponent(storeId || '');

  const cleanStoreName = (name) => {
    if (!name) return "Unknown Store";
    let cleanName = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
    cleanName = cleanName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return cleanName.trim();
  };

  useEffect(() => {
    if (user && targetStoreName) {
      setLoading(true);
      
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let receiptsData = [];
        let total = 0;
        
        // Ürün Sayacı için Map: { "Marka-İsim": { count: 5, details: {...} } }
        const itemFrequency = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          const rawName = data.fileName || data.title || "";
          
          if (cleanStoreName(rawName) === targetStoreName) {
            
            receiptsData.push({
              id: doc.id,
              ...data
            });

            total += Number(data.price) || 0;

            if (data.isManual && data.items && Array.isArray(data.items)) {
              data.items.forEach(item => {
                // Benzersiz anahtar oluştur (Marka + İsim)
                // "Sütaş Süt" ile "Pınar Süt" karışmasın diye
                const key = `${item.brand}-${item.name}`.toLowerCase();
                
                if (!itemFrequency[key]) {
                  itemFrequency[key] = {
                    count: 0,
                    details: { // Detayları sakla
                      name: item.name || 'Unnamed',
                      brand: item.brand || 'Unknown',
                      type: item.type || 'General'
                    }
                  };
                }
                itemFrequency[key].count += 1;
              });
            }
          }
        });

        // En sık alınan ürünü bul
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
          mostFrequentItem: mostFrequent // Obje veya null
        });
        
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, targetStoreName]);

  const handleRowClick = (record) => {
    if (record.isManual) {
      setSelectedReceipt(record);
      setShowDetailModal(true);
    } else if (record.imageUrl) {
      setSelectedImage({ url: record.imageUrl, alt: record.fileName });
      setIsImageModalShowing(true);
    }
  };

  const closeImageModal = () => {
    setIsImageModalShowing(false);
    setSelectedImage({ url: '', alt: '' });
  };

  return (
    <div className="dashboard-page-wrapper p-4">
      <div 
        className={isImageModalShowing || showDetailModal ? 'content-blurred' : ''}
        style={{ transition: 'filter 0.3s ease-in-out' }}
      >
        <div className="container-fluid">
          
          <nav aria-label="breadcrumb" className="mb-4">
            <ol className="breadcrumb">
              <li className="breadcrumb-item">
                <Link to="/stores" className="text-decoration-none">Stores</Link>
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
               <span className="text-muted">Store Analytics</span>
             </div>
          </div>

          {loading && <div className="text-center p-5"><div className="spinner-border" role="status"></div></div>}

          {!loading && (
            <>
              <div className="row mb-5 g-3">
                <div className="col-md-4">
                   <div className="card border-0 shadow-sm h-100 p-3 bg-primary-subtle text-primary">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                         <h6 className="mb-0 fw-bold">Total Spent</h6>
                         <FaMoneyBillWave />
                      </div>
                      <h3 className="fw-bold mb-0">{formatPrice(stats.totalSpent)}</h3>
                   </div>
                </div>
                <div className="col-md-4">
                   <div className="card border-0 shadow-sm h-100 p-3 bg-info-subtle text-info-emphasis">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                         <h6 className="mb-0 fw-bold">Average Spend</h6>
                         <FaChartPie />
                      </div>
                      <h3 className="fw-bold mb-0">{formatPrice(stats.avgSpend)}</h3>
                   </div>
                </div>
                
                {/* FAVORITE ITEM KARTI */}
                <div className="col-md-4">
                   <div className="card border-0 shadow-sm h-100 p-3 bg-warning-subtle text-warning-emphasis">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                         <h6 className="mb-0 fw-bold">Favorite Item</h6>
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
                        <h4 className="fw-bold mb-0">-</h4>
                      )}
                      
                   </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-header bg-body-tertiary py-3">
                  <h5 className="mb-0 fw-bold d-flex align-items-center text-body">
                    <FaHistory className="me-2 text-body-secondary" /> Visit History
                  </h5>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-secondary">
                      <tr>
                        <th className="py-3 ps-4">Date</th>
                        <th className="py-3">Entry Type</th>
                        <th className="py-3 text-center">Details</th>
                        <th className="py-3 text-end pe-4">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((record) => (
                        <tr 
                          key={record.id} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleRowClick(record)}
                        >
                          <td className="ps-4 text-body-secondary fw-medium">
                              {record.createdAt?.toDate ? record.createdAt.toDate().toLocaleDateString('tr-TR') : record.date}
                          </td>
                          
                          <td>
                              {record.isManual ? (
                                  <span className="badge bg-secondary d-inline-flex align-items-center">
                                    <FaFileAlt className="me-1" /> Manual Entry
                                  </span>
                              ) : (
                                  <span className="badge bg-info text-dark d-inline-flex align-items-center">
                                    <FaReceipt className="me-1" /> Scanned Receipt
                                  </span>
                              )}
                          </td>
                          
                          <td className="text-center text-muted small">
                              {record.isManual 
                                ? `${record.items ? record.items.length : 0} items logged` 
                                : 'View Image'
                              }
                          </td>
                          
                          <td className="text-end pe-4 fw-bold text-primary">
                              {formatPrice(record.price)}
                          </td>
                        </tr>
                      ))}
                      
                      {history.length === 0 && (
                         <tr>
                           <td colSpan="4" className="text-center py-5 text-body-secondary">
                              No visits found for this store.
                           </td>
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

      <ImageModal
        isShowing={isImageModalShowing}
        onClose={closeImageModal}
        imageUrl={selectedImage.url}
        imageAlt={selectedImage.alt}
      />

      <ReceiptDetailModal 
        show={showDetailModal} 
        onClose={() => setShowDetailModal(false)} 
        receipt={selectedReceipt} 
      />

    </div>
  );
}

export default StoreDetails;