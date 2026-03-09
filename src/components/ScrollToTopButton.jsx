import React, { useState, useEffect } from 'react';
import { FaArrowUp } from 'react-icons/fa';

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Kaydırma (Scroll) durumunu izle
  useEffect(() => {
    const toggleVisibility = () => {
      // 300px'den fazla aşağı inildiyse butonu göster
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);

    // Temizlik (Cleanup)
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  // Yukarı çıkma fonksiyonu
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <>
      {isVisible && (
        <button 
          onClick={scrollToTop} 
          className="scroll-to-top-btn"
          title="Back to Top"
        >
          <FaArrowUp />
        </button>
      )}
    </>
  );
};

export default ScrollToTopButton;