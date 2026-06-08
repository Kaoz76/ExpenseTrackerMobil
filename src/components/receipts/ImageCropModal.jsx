import React, { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FaCrop, FaTimes, FaCheck } from 'react-icons/fa';
import { getCroppedImg, getSmartCropBox } from '../../utils/imageUtils';
import { useLanguage } from '../../context/LanguageContext';

function ImageCropModal({ show, file, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef(null);

  React.useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setImgSrc(url);
      setCrop(null);
      setCompletedCrop(null);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const onImageLoad = (e) => {
    imgRef.current = e.currentTarget;
    
    // Automatically detect the receipt bounds and set the initial crop box
    const smartCrop = getSmartCropBox(e.currentTarget);
    setCrop(smartCrop);
  };

  const handleConfirm = async () => {
    if (!completedCrop || !completedCrop.width || !completedCrop.height) {
      // If no crop was made, return original
      onConfirm(file);
      return;
    }

    try {
      const croppedFile = await getCroppedImg(imgRef.current, completedCrop, file.name);
      onConfirm(croppedFile);
    } catch (e) {
      console.error('Error cropping image:', e);
      onConfirm(file);
    }
  };

  if (!show || !file) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
          <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            
            {/* HEADER */}
            <div className="modal-header border-bottom-0 bg-primary text-white p-4">
              <h5 className="modal-title fw-bold d-flex align-items-center">
                <FaCrop className="me-2" />
                {t('common.crop_title')}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onCancel}
              ></button>
            </div>

            {/* BODY */}
            <div className="modal-body p-4 bg-light text-center">
              <p className="text-muted small mb-3">
                {t('common.crop_desc')}
              </p>
              
              <div 
                className="d-flex justify-content-center align-items-center rounded bg-white border border-dashed p-3" 
                style={{ minHeight: '300px', maxHeight: '50vh', overflowY: 'auto' }}
              >
                {imgSrc && (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                  >
                    <img
                      ref={imgRef}
                      alt="Crop me"
                      src={imgSrc}
                      onLoad={onImageLoad}
                      style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain' }}
                    />
                  </ReactCrop>
                )}
              </div>
            </div>

            {/* FOOTER */}
            <div className="modal-footer border-top-0 bg-light p-4 pt-0 flex-wrap" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <button 
                type="button" 
                className="btn btn-outline-secondary rounded-pill px-4" 
                onClick={onCancel}
              >
                <FaTimes className="me-2" />
                {t('common.cancel')}
              </button>
              <button 
                type="button" 
                className="btn btn-primary rounded-pill px-4 shadow-sm" 
                onClick={handleConfirm}
              >
                <FaCheck className="me-2" />
                {completedCrop && completedCrop.width ? t('common.crop_and_continue') : t('common.continue_directly')}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default ImageCropModal;
