import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaStore, FaMapMarkerAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

function Stores() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // YARDIMCI FONKSİYON: İsim Temizleme
  const cleanStoreName = (name) => {
    if (!name) return "Unknown Store";
    
    // Dosya uzantılarını kaldır (.jpg, .png, .jpeg vb.)
    // Regex: Nokta ile başlayan ve 3-4 harfli uzantıları bulup sil
    let cleanName = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
    
    // Baş harfleri büyüt, kalanı küçük yap (Standartlaştırma)
    // Örn: "a101" -> "A101", "migros jet" -> "Migros Jet"
    // (Basitçe 'Title Case' yapıyoruz)
    cleanName = cleanName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return cleanName.trim();
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
          
          // Ham veriyi al (fileName veya title)
          const rawName = data.fileName || data.title || "Unknown Store";
          
          // Temizlenmiş ismi oluştur
          const storeName = cleanStoreName(rawName);
          
          // Gruplama (Temiz isim üzerinden)
          if (!storeMap[storeName]) {
            storeMap[storeName] = {
              id: storeName, // ID olarak temiz ismi kullanıyoruz
              name: storeName,
              address: "Address not available", 
              totalSpent: 0,
              visitCount: 0
            };
          }

          storeMap[storeName].totalSpent += Number(data.price) || 0;
          storeMap[storeName].visitCount += 1;
        });

        // Objeyi diziye çevirip A-Z sırala
        const storesArray = Object.values(storeMap).sort((a, b) => a.name.localeCompare(b.name));
        
        setStores(storesArray);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setStores([]);
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item active" aria-current="page">Stores</li>
          </ol>
        </nav>

        <h1 className="display-6 fw-bold mb-4">Stores</h1>

        {loading && <div className="text-center p-5"><div className="spinner-border" role="status"></div></div>}

        {!loading && stores.length === 0 && (
          <div className="alert alert-info text-center">
            No store data found. Use <Link to="/receipts" className="alert-link fw-bold">Scans</Link> or <Link to="/texts" className="alert-link fw-bold">Texts</Link> to add stores.
          </div>
        )}

        <div className="row">
          {stores.map((store, index) => (
            <div key={index} className="col-md-6 col-lg-4 mb-4">
              <div className="card shadow-sm h-100 card-accent">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-light rounded-circle p-3 me-3 d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                      <FaStore className="text-primary fs-4" />
                    </div>
                    <div>
                      <h5 className="card-title mb-1">{store.name}</h5>
                      <p className="card-text text-muted small">
                        {store.visitCount} visit(s) recorded
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-auto d-flex justify-content-between align-items-center">
                     <div>
                        <small className="text-muted d-block">Total Spent</small>
                        <span className="fw-bold fs-5">{formatPrice(store.totalSpent)}</span>
                     </div>
                     
                     <Link to={`/stores/${encodeURIComponent(store.name)}`} className="btn btn-outline-primary btn-sm">
                        View Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default Stores;