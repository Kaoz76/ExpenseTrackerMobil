import React from 'react';

const ImageModal = ({ isShowing, onClose, imageUrl, imageAlt }) => {
  
  if (!isShowing) return null; 

  return (
    <> 
      {/* Backdrop (arka plan karartma) */}
      <div 
        className="modal-backdrop fade show" 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          zIndex: 1040 
        }}
        onClick={onClose}
      ></div>

      {/* Modal içeriği */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ display: 'block', zIndex: 1050 }}
        onClick={onClose}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <button 
                type="button" 
                className="btn-close" 
                aria-label="Close" 
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body text-center pt-0">
              <img 
                src={imageUrl} 
                alt={imageAlt} 
                className="img-fluid rounded"
                style={{ maxHeight: 'calc(100vh - 200px)', maxWidth: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageModal;