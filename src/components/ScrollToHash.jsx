import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    let timeoutId; // Timeout'u takip etmek için değişken oluşturduk

    if (hash) {
      // setTimeout içine aldık: Bekledikten SONRA elementi ara
      timeoutId = setTimeout(() => {
        const element = document.getElementById(hash.replace("#", ""));
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
      // Not: Eğer Firebase verisi geç geliyorsa bu süreyi 300-500 yapabilirsin.

    } else {
      window.scrollTo(0, 0);
    }

    // CLEANUP (TEMİZLİK) FONKSİYONU:
    // URL değişirse veya bileşen kapanırsa, bekleyen kaydırma işlemini iptal et.
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [pathname, hash, key]);

  return null;
}