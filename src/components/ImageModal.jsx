import React, { useEffect } from 'react';

const ImageModal = ({ isShowing, onClose, imageUrl, imageAlt = 'Enlarged view' }) => {

  // ESC tuşu dinleyicisi ve arka plan kaymasını kilitleme
  useEffect(() => {
    if (isShowing) {
      // 1. Arka planın kaymasını engelle (body scroll lock)
      document.body.style.overflow = 'hidden';

      // 2. ESC tuşu dinleyicisi
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);

      // Temizlik (Cleanup) aşaması
      return () => {
        document.body.style.overflow = 'auto'; // Kaydırmayı geri aç
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isShowing, onClose]);

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
          backgroundColor: 'rgba(0,0,0,0.6)', // Karartmayı bir tık artırdık (%60)
          zIndex: 1040
        }}
        onClick={onClose}
      ></div>

      {/* Modal içeriği */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        onClick={onClose}
        aria-modal="true" // 3. Erişilebilirlik
        role="dialog"     // 3. Erişilebilirlik
      >
        <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-content bg-transparent border-0"> {/* Arka planı transparan yaptık ki resim odakta kalsın */}
            <div className="modal-header border-0 pb-0 justify-content-end">
              <button
                type="button"
                className="btn-close btn-close-white bg-dark p-2 rounded-circle" // Çarpı butonunu daha belirgin yaptık
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body text-center pt-2">
              <img
                src={imageUrl}
                alt={imageAlt}
                className="img-fluid rounded shadow-lg" // Gölgelendirme (shadow-lg) ile derinlik kattık
                style={{ maxHeight: 'calc(100vh - 120px)', maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageModal;