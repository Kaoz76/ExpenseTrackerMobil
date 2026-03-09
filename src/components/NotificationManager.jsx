import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const NotificationManager = () => {
  const { user } = useAuth();
  const [reminderSettings, setReminderSettings] = useState(null);

  // Kullanıcının ayarlarını dinle (Gerçek zamanlı)
  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setReminderSettings({
            enabled: data.reminderEnabled,
            time: data.reminderTime
          });
        }
      });
      return () => unsub();
    }
  }, [user]);

  // Her dakika saati kontrol et
  useEffect(() => {
    if (!reminderSettings?.enabled || !reminderSettings?.time) return;

    const checkTime = () => {
      const now = new Date();
      // Şu anki saati "HH:MM" formatına çevir (Örn: "20:00")
      const currentTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      
      // Bildirimin bugün gösterilip gösterilmediğini kontrol et (Tekrarı önlemek için)
      const lastNotifiedDate = localStorage.getItem('last_reminder_date');
      const todayDate = now.toDateString(); // "Tue Feb 10 2026"

      if (currentTime === reminderSettings.time && lastNotifiedDate !== todayDate) {
        
        // BİLDİRİMİ GÖNDER
        if (Notification.permission === "granted") {
          new Notification("Expense Tracker Reminder", {
            body: `It's ${reminderSettings.time}! Don't forget to enter your daily expenses.`,
            icon: "/pwa-192x192.png",
            tag: "daily-reminder" // Bildirimleri gruplamak için
          });

          // Bugün gönderildi olarak işaretle
          localStorage.setItem('last_reminder_date', todayDate);
        }
      }
    };

    // Her 30 saniyede bir kontrol et (Dakikayı kaçırmamak için)
    const interval = setInterval(checkTime, 30000);

    return () => clearInterval(interval);
  }, [reminderSettings]);

  return null;
};

export default NotificationManager;