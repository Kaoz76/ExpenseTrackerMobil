import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { FaHistory, FaTag, FaChartLine, FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

function ProductDetails() {
  const { productId } = useParams(); // URL'den gelen ham ürün adı
  const [searchParams] = useSearchParams();
  const brandName = searchParams.get('brand');
  
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productType, setProductType] = useState(''); // Ürün türü için yeni state

  // İsim Temizleme Fonksiyonu
  const cleanName = (name) => {
    if (!name) return "";
    let cleaned = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
    cleaned = cleaned
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return cleaned.trim();
  };

  const rawProductName = decodeURIComponent(productId || '');
  const productName = cleanName(rawProductName); 

  useEffect(() => {
    if (user && productName) {
      setLoading(true);
      
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("isManual", "==", true),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let foundItems = [];
        let typeFound = ''; // Döngü içinde türü yakalamak için

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              if (cleanName(item.name) === productName && item.brand === brandName) {
                // Tür bilgisini ilk bulduğumuz kayıttan alalım
                if (!typeFound && item.type) {
                  typeFound = item.type;
                }

                foundItems.push({
                  id: doc.id + item.name,
                  price: Number(item.price),
                  market: data.fileName,
                  date: data.date,
                  createdAt: data.createdAt,
                  size: item.size
                });
              }
            });
          }
        });

        setHistory(foundItems);
        setProductType(typeFound);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user, productName, brandName]);

  // İstatistik Hesaplama
  const avgPrice = history.length > 0 
    ? (history.reduce((a, b) => a + b.price, 0) / history.length) 
    : 0;

  let minRecord = null;
  let maxRecord = null;

  if (history.length > 0) {
    minRecord = history.reduce((prev, curr) => (prev.price < curr.price ? prev : curr));
    maxRecord = history.reduce((prev, curr) => (prev.price > curr.price ? prev : curr));
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
              <Link to="/products" className="text-decoration-none">Products</Link>
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
                       <h6 className="mb-0 fw-bold">Average Price</h6>
                       <FaChartLine />
                    </div>
                    <h3 className="fw-bold mb-0">{formatPrice(avgPrice)}</h3>
                    <small className="text-primary-emphasis opacity-75">Based on {history.length} purchases</small>
                 </div>
              </div>

              {/* Lowest Price */}
              <div className="col-md-4">
                 <div className="card border-0 shadow-sm h-100 p-3 bg-success-subtle text-success">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                       <h6 className="mb-0 fw-bold">Lowest Price</h6>
                       <FaTag />
                    </div>
                    <h3 className="fw-bold mb-1">
                        {minRecord ? formatPrice(minRecord.price) : formatPrice(0)}
                    </h3>
                    {minRecord && (
                        <div className="mt-1">
                            <div className="fw-bold text-success-emphasis">{minRecord.market}</div>
                            <div className="badge bg-success text-white mt-2 d-inline-flex align-items-center">
                                <FaThumbsUp className="me-1" /> Öneriliyor
                            </div>
                        </div>
                    )}
                 </div>
              </div>

              {/* Highest Price */}
              <div className="col-md-4">
                 <div className="card border-0 shadow-sm h-100 p-3 bg-danger-subtle text-danger">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                       <h6 className="mb-0 fw-bold">Highest Price</h6>
                       <FaTag />
                    </div>
                    <h3 className="fw-bold mb-1">
                        {maxRecord ? formatPrice(maxRecord.price) : formatPrice(0)}
                    </h3>
                    {maxRecord && (
                        <div className="mt-1">
                            <div className="fw-bold text-danger-emphasis">{maxRecord.market}</div>
                            <div className="badge bg-danger text-white mt-2 d-inline-flex align-items-center">
                                <FaThumbsDown className="me-1" /> Önerilmiyor
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
                  <FaHistory className="me-2 text-body-secondary" /> Purchase History
                </h5>
              </div>

              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="table-secondary">
                    <tr>
                      <th className="py-3 ps-4">Date</th>
                      <th className="py-3">Market</th>
                      <th className="py-3">Size</th>
                      <th className="py-3 text-end pe-4">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, idx) => (
                      <tr key={idx}>
                        <td className="ps-4 text-body-secondary fw-medium">{record.date}</td>
                        <td className="fw-bold">{record.market}</td>
                        <td>{record.size || '-'}</td>
                        <td className="text-end pe-4 fw-bold text-primary">{formatPrice(record.price)}</td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                       <tr>
                         <td colSpan="4" className="text-center py-5 text-body-secondary">No history found.</td>
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