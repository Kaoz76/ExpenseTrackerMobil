import React, { useState, useRef, useEffect, useCallback } from 'react';
import { perspectiveWarp } from '../../utils/perspectiveTransform';
import { getSmartCropBox, rotateImage90Deg } from '../../utils/imageUtils';
import { useLanguage } from '../../context/LanguageContext';
import { FaSyncAlt } from 'react-icons/fa';

const PerspectiveCropModal = ({ visible, onClose, imageSrc, onCropComplete, title }) => {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [corners, setCorners] = useState([]); // TL, TR, BR, BL in visual pixels
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentImageSrc(imageSrc);
    }
  }, [visible, imageSrc]);

  // Cleanup rotated images on unmount or change
  useEffect(() => {
    return () => {
      if (currentImageSrc && currentImageSrc.startsWith('blob:') && currentImageSrc !== imageSrc) {
        URL.revokeObjectURL(currentImageSrc);
      }
    };
  }, [currentImageSrc, imageSrc]);

  useEffect(() => {
    if (visible && imageRef.current && currentImageSrc) {
      const handleLoad = () => {
        const { width, height } = imageRef.current.getBoundingClientRect();
        setImageSize({ width, height });
        
        const smartCrop = getSmartCropBox(imageRef.current);
        
        const pxX = (smartCrop.x / 100) * width;
        const pxY = (smartCrop.y / 100) * height;
        const pxW = (smartCrop.width / 100) * width;
        const pxH = (smartCrop.height / 100) * height;

        setCorners([
          { x: pxX, y: pxY }, // TL
          { x: pxX + pxW, y: pxY }, // TR
          { x: pxX + pxW, y: pxY + pxH }, // BR
          { x: pxX, y: pxY + pxH } // BL
        ]);
      };
      
      if (imageRef.current.complete) {
        handleLoad();
      } else {
        imageRef.current.onload = handleLoad;
      }
    }
  }, [visible, currentImageSrc]);

  const handlePointerDown = (e, idx) => {
    setDraggingIdx(idx);
  };

  const handlePointerMove = useCallback((e) => {
    if (draggingIdx === null || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    // Calculate new position bounded by container
    let clientX = e.clientX;
    let clientY = e.clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    }

    if (clientX === undefined || clientY === undefined) return;

    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    x = Math.max(0, Math.min(x, imageSize.width));
    y = Math.max(0, Math.min(y, imageSize.height));
    
    setCorners(prev => {
      const next = [...prev];
      const gap = 20; // Minimum distance between corners to prevent collapse

      // Restrict dragging so corners cannot cross each other (Anti-Crazy User Protection)
      if (draggingIdx === 0) { // Top-Left
        x = Math.min(x, prev[1].x - gap, prev[2].x - gap);
        y = Math.min(y, prev[3].y - gap, prev[2].y - gap);
      } else if (draggingIdx === 1) { // Top-Right
        x = Math.max(x, prev[0].x + gap, prev[3].x + gap);
        y = Math.min(y, prev[2].y - gap, prev[3].y - gap);
      } else if (draggingIdx === 2) { // Bottom-Right
        x = Math.max(x, prev[3].x + gap, prev[0].x + gap);
        y = Math.max(y, prev[1].y + gap, prev[0].y + gap);
      } else if (draggingIdx === 3) { // Bottom-Left
        x = Math.min(x, prev[2].x - gap, prev[1].x - gap);
        y = Math.max(y, prev[0].y + gap, prev[1].y + gap);
      }

      next[draggingIdx] = { x, y };
      return next;
    });
  }, [draggingIdx, imageSize]);

  const handlePointerUp = useCallback(() => {
    setDraggingIdx(null);
  }, []);

  useEffect(() => {
    if (draggingIdx !== null) {
      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false }); // iOS Safari fallback
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [draggingIdx, handlePointerMove, handlePointerUp]);

  const handleCrop = async () => {
    if (corners.length !== 4) return;
    setIsProcessing(true);
    
    try {
      // Calculate scale ratio between visual size and natural size
      const img = imageRef.current;
      const scaleX = img.naturalWidth / imageSize.width;
      const scaleY = img.naturalHeight / imageSize.height;
      
      // Convert visual corners to natural image coordinates
      const naturalCorners = corners.map(c => ({
        x: c.x * scaleX,
        y: c.y * scaleY
      }));
      
      // Perform the perspective warp off the main thread (although JS is single threaded, we yield)
      await new Promise(resolve => setTimeout(resolve, 10)); // Yield to UI
      const canvas = perspectiveWarp(img, naturalCorners);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'cropped_receipt.jpg', { type: 'image/jpeg' });
          onCropComplete(file);
        }
        setIsProcessing(false);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error("Crop failed:", err);
      setIsProcessing(false);
      onClose(); // Fallback if error occurs
    }
  };

  const handleRotate = async () => {
    setIsProcessing(true);
    try {
      const newSrc = await rotateImage90Deg(currentImageSrc);
      setCurrentImageSrc(newSrc);
    } catch (e) {
      console.error("Rotation failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible) return null;

  const polygonPoints = corners.length === 4 
    ? `${corners[0].x},${corners[0].y} ${corners[1].x},${corners[1].y} ${corners[2].x},${corners[2].y} ${corners[3].x},${corners[3].y}`
    : "";

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content bg-dark text-white border-secondary">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">{title || t('common.perspective_crop_title')}</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body text-center p-0 position-relative" style={{ overflow: 'hidden' }}>
            
            <p className="p-3 mb-0 text-white-50">{t('common.perspective_crop_desc')}</p>
            
            <div 
              className="d-inline-block position-relative" 
              ref={containerRef}
              style={{ touchAction: 'none' }} // Prevent scrolling while dragging on mobile
            >
              <img
                ref={imageRef}
                src={currentImageSrc}
                alt="Original"
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  display: 'block',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
                draggable={false}
              />
              
              {/* Overlay SVG for drawing the crop polygon */}
              {corners.length === 4 && (
                <svg
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none' // Let events pass through to handles
                  }}
                >
                  <polygon
                    points={polygonPoints}
                    fill="rgba(13, 110, 253, 0.2)"
                    stroke="#0d6efd"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                </svg>
              )}
              
              {/* Draggable handles */}
              {corners.map((corner, idx) => (
                <div
                  key={idx}
                  onPointerDown={(e) => handlePointerDown(e, idx)}
                  onTouchStart={(e) => handlePointerDown(e, idx)} // Fallback for some mobile browsers
                  style={{
                    position: 'absolute',
                    left: corner.x,
                    top: corner.y,
                    width: '40px',
                    height: '40px',
                    marginLeft: '-20px',
                    marginTop: '-20px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    border: '3px solid #0d6efd',
                    borderRadius: '50%',
                    cursor: 'grab',
                    touchAction: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    zIndex: 10
                  }}
                >
                  <div style={{ width: '10px', height: '10px', backgroundColor: '#0d6efd', borderRadius: '50%' }}></div>
                </div>
              ))}
            </div>
            
          </div>
          <div className="modal-footer border-secondary d-flex justify-content-between flex-wrap" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button type="button" className="btn btn-outline-light" onClick={handleRotate} disabled={isProcessing}>
              <FaSyncAlt className="me-2" /> {t('common.perspective_crop_rotate')}
            </button>
            <div>
              <button type="button" className="btn btn-secondary me-2" onClick={onClose} disabled={isProcessing}>{t('common.perspective_crop_cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={handleCrop} disabled={isProcessing || corners.length !== 4}>
                {isProcessing ? t('common.perspective_crop_processing') : t('common.perspective_crop_confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerspectiveCropModal;
