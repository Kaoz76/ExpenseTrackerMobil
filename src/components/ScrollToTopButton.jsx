import React, { useState, useEffect } from 'react';
import { FaArrowUp } from 'react-icons/fa';

const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // 1 & 2: pageYOffset yerine scrollY kullanıldı ve if/else kısaltıldı
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', toggleVisibility);

    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // 3: Gereksiz <></> sarmalayıcı kaldırıldı, daha temiz bir return yazıldı
  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="scroll-to-top-btn"
      title="Back to Top"
      aria-label="Scroll to top" // Erişilebilirlik için eklendi
    >
      <FaArrowUp />
    </button>
  );
};

export default ScrollToTopButton;