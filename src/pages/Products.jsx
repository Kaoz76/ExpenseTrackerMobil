import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBoxOpen, FaChevronRight } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

function Products() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
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
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("isManual", "==", true)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const productMap = {};

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              const uniqueKey = `${item.brand}-${item.name}`.toLowerCase();
              
              if (!productMap[uniqueKey]) {
                productMap[uniqueKey] = {
                  id: uniqueKey,
                  name: item.name || 'Unnamed Product',
                  brand: item.brand,
                  type: item.type,
                  latestPrice: Number(item.price),
                  latestDate: data.date,
                  createdAt: data.createdAt,
                  historyCount: 1
                };
              } else {
                if (data.createdAt > productMap[uniqueKey].createdAt) {
                   productMap[uniqueKey].latestPrice = Number(item.price);
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

  const filteredProducts = products.filter(product => {
    const search = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(search) ||
      product.brand.toLowerCase().includes(search) ||
      (product.type && product.type.toLowerCase().includes(search))
    );
  });

  return (
    <div className="dashboard-page-wrapper p-4">
      <div className="container-fluid">
        
        {/* Breadcrumb Navigasyonu */}
        <nav aria-label="breadcrumb" className="mb-3">
          <ol className="breadcrumb">
            <li className="breadcrumb-item active" aria-current="page">Products</li>
          </ol>
        </nav>

        {/* Başlık ve Animasyonlu Arama Çubuğu */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4">
          <h1 className="display-6 fw-bold mb-3 mb-md-0">Products</h1>
          
          {/* YENİ ANİMASYONLU ARAMA ÇUBUĞU */}
          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
              <button type="button"> {/* Arama ikonu */}
                  <svg width="17" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="search">
                      <path d="M7.667 12.667A5.333 5.333 0 107.667 2a5.333 5.333 0 000 10.667zM14.334 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
              </button>
              
              <input 
                className="search-input" 
                placeholder="Search products..." 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <button className="search-reset" type="button" onClick={handleReset}> {/* Temizleme butonu */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
              </button>
          </form>
        </div>
        
        {loading && <div className="text-center p-5"><div className="spinner-border" role="status"></div></div>}

        {!loading && products.length === 0 && (
          <div className="alert alert-info text-center">
            No product data found. Use <Link to="/texts" className="alert-link fw-bold">Texts</Link> to add products.
          </div>
        )}

        <div className="row">
          {filteredProducts.map((product) => (
            <div key={product.id} className="col-md-6 col-lg-4 col-xl-3 mb-4">
              <div className="card shadow-sm h-100 border-0 card-hover-effect">
                <div className="card-body d-flex flex-column">
                  
                  <div className="d-flex align-items-start mb-3">
                    <div className="bg-primary-subtle rounded p-3 me-3 text-primary">
                      <FaBoxOpen className="fs-3" />
                    </div>
                    <div>
                      <h6 className="card-title fw-bold mb-1 text-truncate" style={{maxWidth: '150px'}} title={product.name}>
                        {product.name}
                      </h6>
                      <small className="text-muted d-block">{product.brand}</small>
                      <span className="badge bg-secondary mt-1">{product.type}</span>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-end">
                    <div>
                      <small className="text-muted d-block" style={{fontSize: '0.75rem'}}>Last Price</small>
                      <span className="fs-5 fw-bold text-primary">{formatPrice(product.latestPrice)}</span>
                    </div>
                    
                    <Link 
                      to={`/products/${encodeURIComponent(product.name)}?brand=${encodeURIComponent(product.brand)}`} 
                      className="btn btn-sm btn-outline-primary rounded-pill px-3"
                    >
                      Details <FaChevronRight className="ms-1" style={{fontSize: '0.7rem'}} />
                    </Link>
                  </div>
                  
                  <div className="text-end mt-2">
                     <small className="text-muted" style={{fontSize: '0.7rem'}}>
                        {product.historyCount} purchase(s) recorded
                     </small>
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

export default Products;