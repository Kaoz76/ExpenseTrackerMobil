import React from 'react';
import { useCurrency } from '../context/CurrencyContext';

const ReceiptDetailModal = ({ show, onClose, receipt }) => {
  const { formatPrice } = useCurrency();
  
  if (!show || !receipt) return null;

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1040, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      ></div>

      <div 
        className="modal fade show d-block" 
        tabIndex="-1" 
        style={{ zIndex: 1050 }}
        onClick={onClose}
      >
        <div 
          className="modal-dialog modal-dialog-centered modal-lg" 
          onClick={e => e.stopPropagation()}
        >
          <div className="modal-content shadow">
            
            {/* DÜZELTME 1: Header Arka Planı */}
            <div className="modal-header bg-body-tertiary">
              <div>
                <h5 className="modal-title fw-bold text-body">{receipt.fileName}</h5>
                <small className="text-body-secondary">{receipt.date}</small>
              </div>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            
            <div className="modal-body p-4">
              <h6 className="fw-bold mb-3 text-body">Items Purchased</h6>
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle">
                  
                  {/* DÜZELTME 2: Tablo Başlığı */}
                  <thead className="table-secondary">
                    <tr>
                      <th>Type</th>
                      <th>Brand</th>
                      <th>Name</th>
                      <th>Size</th>
                      <th className="text-end">Price</th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {receipt.items && receipt.items.map((item, index) => (
                      <tr key={index}>
                        <td>{item.type}</td>
                        <td>{item.brand}</td>
                        <td>{item.name || '-'}</td>
                        <td>{item.size || '-'}</td>
                        <td className="text-end fw-bold text-primary">
                          {formatPrice(item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* DÜZELTME 3: Tablo Altı (Footer) */}
                  <tfoot className="table-secondary">
                    <tr>
                      <td colSpan="4" className="text-end fw-bold">Total</td>
                      <td className="text-end fw-bold fs-5 text-primary">
                        {formatPrice(receipt.price)}
                      </td>
                    </tr>
                  </tfoot>
                  
                </table>
              </div>
            </div>

            <div className="modal-footer border-0 bg-body-tertiary rounded-bottom">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReceiptDetailModal;