# 💰 Expense Tracker (Harcama Takip Uygulaması)

Kullanıcıların harcamalarını takip edebilecekleri, fişlerini dijital ortamda saklayabilecekleri ve harcama alışkanlıklarını grafiklerle analiz edebilecekleri modern bir "Full-Stack" web uygulaması.

[Expense Tracker](https://expense-tracckker.netlify.app/ "Expense Tracker")

## 🛠️ Kullanılan Teknolojiler ve Mimari

Bu proje, performans, güvenlik ve ölçeklenebilirlik gözetilerek aşağıdaki modern teknoloji yığını (Tech Stack) ile geliştirilmiştir.

### 🚀 Hosting & Altyapı

**Netlify:** Projenin CI/CD süreçleri ve barındırma (hosting) hizmeti için kullanılmıştır. GitHub ile entegre çalışarak her güncellemede otomatik dağıtım sağlar.

**Google Cloud Platform (GCP):** Firebase servislerinin üzerinde çalıştığı temel bulut altyapısıdır.

### ⚛️ Frontend (Ön Yüz)

**React:** Kullanıcı arayüzü oluşturmak için kullanılan JavaScript kütüphanesi.

**Vite:** Hızlı ve modern frontend geliştirme aracı (Build tool).

**React Router DOM:** Sayfalar arası geçiş ve yönlendirme (SPA) yönetimi.

### 🔥 Backend & Bulut Hizmetleri (Firebase)

**Authentication:** Kullanıcı kayıt, giriş ve güvenli oturum yönetimi.

**Cloud Firestore:** NoSQL tabanlı, gerçek zamanlı veritabanı (Fiş ve harcama verileri için).

**Cloud Storage:** Kullanıcıların yüklediği fiş görsellerinin güvenli depolanması.

### 🎨 Tasarım & UI

**Bootstrap 5:** Responsive (mobil uyumlu) ve modern arayüz tasarımı (Grid sistemi, Kartlar).

**Uiverse.io:** Projedeki özel buton animasyonları (Pulse, Logout, Add, Save butonları) için CSS kaynakları.

**React Icons:** Uygulama genelinde kullanılan vektörel ikonlar.

**CSS3 & Custom Styles:** Karanlık mod (Dark Mode) entegrasyonu.

### 📊 Veri & İşlevsellik

**Recharts:** Harcama analizleri için dinamik grafikler (Area Chart, Bar Chart).

**React Dropzone:** Fiş yükleme alanında sürükle-bırak (drag & drop) desteği.

**Tesseract.js:** Tarayıcı tabanlı OCR (Optik Karakter Tanıma) ile resimden otomatik fiyat okuma.

**jsPDF:** Aylık harcama raporlarını otomatik PDF olarak oluşturma.

### ⚙️ Mimari Yaklaşım

**Context API:** Global durum yönetimi (AuthContext, ThemeContext, ReportContext).

**Hooks:** useState, useEffect gibi React kancalarının etkin kullanımı.

**Hibrit Veri Yapısı:** Hem dosya tabanlı (resim) hem metin tabanlı (manuel) veri girişini destekler.

### 📱 PWA (Progressive Web App) Desteği

**Mobil Uygulama Gibi Yükleme:** Tarayıcı üzerinden "Ana Ekrana Ekle" diyerek uygulamayı telefonlarına veya masaüstü bilgisayarlarına yükleyebilirler.



## Önemli Özellikler

### 1. 🏗️ Teknolojik Altyapı ve Mimari

* **Modern Frontend:** **React** ve **Vite** kullanılarak ışık hızında çalışan, modüler bir yapı kuruldu.
* **Backend-as-a-Service (BaaS):** Sunucu kurulumuyla uğraşmadan **Google Firebase** ekosistemi (Auth, Firestore, Storage) kullanıldı.
* **Hosting:** Proje **Netlify** üzerinde canlıya alındı.
* **Global State Management:** `AuthContext`, `CurrencyContext`, `ThemeContext` ve `ReportContext` ile veriler uygulamanın her yerinden yönetilebilir hale getirildi.

### 2. 🔐 Kullanıcı ve Güvenlik

* **Kimlik Doğrulama (Auth):** Kullanıcılar e-posta ve şifre ile güvenli bir şekilde **Kayıt Olup (Sign Up)**, **Giriş Yapabiliyor (Log In)**.
* **Şifre Sıfırlama:** "Forgot Password" özelliği ile kullanıcılar e-postalarına gelen linkle şifrelerini yenileyebiliyor.
* **Güvenlik Kuralları:** Firestore ve Storage kuralları (`allow read, write: if request.auth != null;`) ile sadece giriş yapmış kullanıcıların kendi verilerine erişmesi sağlandı.

### 3. 💸 Veri Girişi ve İşleme (Core Features)

* **Akıllı Fiş Tarama (OCR):**
  Kullanıcı fiş resmini sürükleyip bıraktığında **Tesseract.js** (tarayıcı tabanlı yapay zeka) devreye giriyor.
  Resimdeki metinleri okuyup "Toplam Tutar"ı otomatik olarak tespit ediyor.
  Kullanıcıya doğrulama ekranı (Modal) sunarak fiyatı onaylatıyor veya düzelttiriyor.
  Resim **Firebase Storage**'a, veriler **Firestore**'a kaydediliyor.

* **Gelişmiş Manuel Giriş (Texts):**
  Kullanıcı fişi olmayan harcamalarını elle girebiliyor.
  Dinamik form yapısı sayesinde tek seferde birden fazla ürün satırı eklenebiliyor.
  Girilen veriler tarih, market adı ve detaylarıyla birlikte **Firestore**'a kaydediliyor.

* **Aylık Abonelik (Subscriptions):**
  Kullanıcı aylık aboneliklerini elle girebiliyor. Her ay, "Monthly Budget" bölümüne toplam tutar otomatik olarak ekleniyor.
  Girilen veriler **Firestore**'a kaydediliyor. Artan tarih sırasına göre sırasıyla sitede gösteriliyor.

### 4. 📊 Dashboard ve Analiz

* **Canlı İstatistikler:** Kullanıcının **Bu Ay** ne kadar harcadığı, ortalama fiş tutarı ve toplam fiş sayısı anlık hesaplanıyor.
* **Bütçe Takibi (Budget Goal):** Kullanıcı ayarlardan bir bütçe belirleyebiliyor. Harcamalar bu limite yaklaştıkça Dashboard'daki ilerleme çubuğu renk değiştiriyor (Yeşil -> Sarı -> Kırmızı).
* **Grafikler:** `Recharts` kütüphanesi ile harcamaların zamana ve kategorilere göre dağılımı görselleştiriliyor.
* **Akıllı Listeleme:** "Recent Scans" bölümünde resimli fişler ve metin tabanlı girişler ayırt edici ikonlarla listeleniyor. Tıklanınca türüne göre (Resim veya Tablo) farklı Modallar açılıyor.

### 5. 📄 Raporlama ve Çıktı

* **PDF İndirme:** Kullanıcılar aylık harcama raporlarını tek tıkla **PDF** olarak indirebiliyor.
* **Türkçe Karakter Desteği:** `jspdf-autotable` ve özel font yükleme (Roboto) sayesinde PDF'lerde "ş, ı, ğ" gibi karakterler bozulmadan çıkıyor.
* **Otomatik Bildirim:** Her ayın 1'inde, yeni bir rapor hazır olduğunda Navbar'daki zil ikonunda kırmızı bir nokta beliriyor ve kullanıcıya raporu indirmesi hatırlatılıyor.
* **CSV İndirme:** Kullanıcılar tüm harcama verilerini tek tıkla **CSV** olarak indirebiliyor.

### 6. 🎨 Tasarım ve UX (Kullanıcı Deneyimi)

* **Karanlık Mod (Dark Mode):** Kullanıcının tercihine göre tüm site (tablolar, kartlar, formlar) koyu temaya geçiyor ve bu tercih hafızada tutuluyor.
* **Para Birimi Seçimi:** Kullanıcı Dolar ($), Euro (€) veya Türk Lirası (₺) seçebiliyor ve tüm rakamlar buna göre formatlanıyor.
* **Özel Animasyonlar:**
* **Magic Cards:** Dashboard kartlarına üzerine gelince parlayan çerçeve efekti.
* **Pulse Buttons:** "New Scan" ve "New Text" butonlarında dikkat çekici nabız animasyonu.
* **Animated Inputs:** Arama çubuklarında şık genişleme efektleri.

### 7. 📱 Mobil ve PWA (Progressive Web App)

* **Yüklenebilirlik:** Site, hem telefona hem de bilgisayara bir uygulama gibi yüklenebiliyor (ikonuyla birlikte).
* **Responsive:** Bootstrap 5 sayesinde site mobilde, tablette ve masaüstünde kusursuz görünüyor (Menüler, tablolar ve kartlar otomatik uyum sağlıyor).
* **Hatırlatıcı:** Kullanıcı isterse her akşam belirlediği saatte tarayıcı bildirimi ile harcama girmesi hatırlatılıyor.
