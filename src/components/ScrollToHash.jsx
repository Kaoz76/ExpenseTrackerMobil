import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    // Eğer URL'de hash (#) varsa (örn: #scanned-section)
    if (hash) {
      // O ID'ye sahip elementi bul
      const element = document.getElementById(hash.replace("#", ""));
      if (element) {
        // Oraya yumuşakça kaydır
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100); // Sayfa yüklenmesi için çok kısa bir gecikme
      }
    } else {
      // Hash yoksa sayfanın en tepesine çık (Normal sayfa geçişi)
      window.scrollTo(0, 0);
    }
  }, [pathname, hash, key]); // Sayfa veya hash değiştiğinde çalış

  return null;
}