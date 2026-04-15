import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaCloudUploadAlt, FaListAlt, FaCheck, FaTimes } from 'react-icons/fa';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, getDoc } from "firebase/firestore";
import ImageModal from '../components/ImageModal';
import { Link } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@carviz/capacitor-ocr';
import { formatDateTime } from '../utils/dateFormatter';

function Receipts() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // DOĞRULAMA MODALI STATE'LERİ
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyData, setVerifyData] = useState(null); // Kaydedilmeyi bekleyen veri
  const [verifiedPrice, setVerifiedPrice] = useState(''); // Kullanıcının düzenleyeceği fiyat
  const [showItems, setShowItems] = useState(false); // Akordeon durumu

  // VERİ ÇEKME
  useEffect(() => {
    setLoadingReceipts(true);
    if (user) {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const receiptsData = [];
        querySnapshot.forEach((doc) => {
          if (doc.data().imageUrl) {
            receiptsData.push({ id: doc.id, ...doc.data() });
          }
        });
        setReceipts(receiptsData);
        setLoadingReceipts(false);
      }, (error) => {
        console.error("Error fetching receipts: ", error);
        setLoadingReceipts(false);
      });

      return () => unsubscribe();
    } else {
      setReceipts([]);
      setLoadingReceipts(false);
    }
  }, [user]);

  // OCR PRICE EXTRACTCTION ALGORITHM
  const extractDataFromText = (text) => {
    if (!text) return { total: 0, items: [] };

    // Normalize newlines and basic spaces
    const normalizedText = text.replace(/\r/g, '\n').toLowerCase();
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Look for total/sum related keywords (added 'topla' in case OCR misses 'm')
    const keywordRegex = /(toplam|topla|total|tutar|amount|odenecek|grand|bakiye|genel|sum|nakit|kredi|k\.karti|kart)/i;

    // Keywords to EXCLUDE (like KDV, VAT, Tax, Indirim, Change, Para ustu, %, KG x, Bank names)
    // DİKKAT: "%" işaretini kaldırdık çünkü birçok fişte ürün isminin yanında %1, %8 gibi KDV oranı yazar!
    const excludeRegex = /(kdv|vat|tax|indirim|iskonto|para ustu|para üstü|change|kg x|vakif|ziraat|garanti|is bank|iş bank|yapi kredi|yapı kredi|mastercard|visa|maestro)/i;

    // Match numbers with dots or commas as decimal separators (e.g. 776,67 or 776.67 or 1.234,56)
    // Removed space parsing to prevent breaking native matches, just standard floats
    const priceRegex = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;

    let possibleTotals = [];
    let extractedItems = [];

    const cleanAndParseNumber = (valStr) => {
      let cleanStr = valStr.replace(/[^0-9.,]/g, '');
      // Handle European format: 1.234,56 -> 1234.56
      if (cleanStr.includes(',') && cleanStr.includes('.')) {
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      }
      // Handle just comma: 123,45 -> 123.45
      else if (cleanStr.includes(',')) {
        cleanStr = cleanStr.replace(',', '.');
      }
      const num = parseFloat(cleanStr);
      return (!isNaN(num) && num > 0 && num < 50000) ? num : null;
    };

    // Parse lines one by one
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1) Is it a Total Line?
      if (keywordRegex.test(line) && !excludeRegex.test(line)) {
        let matches = line.match(priceRegex);
        if (matches) {
          matches.forEach(m => {
            const parsed = cleanAndParseNumber(m);
            if (parsed) possibleTotals.push(parsed);
          });
        }

        // Check next line just in case the total amount wrapped, but only if next line isn't also a KDV line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (!excludeRegex.test(nextLine)) {
            let nextLineMatches = nextLine.match(priceRegex);
            if (nextLineMatches) {
              nextLineMatches.forEach(m => {
                const parsed = cleanAndParseNumber(m);
                if (parsed) possibleTotals.push(parsed);
              });
            }
          }
        }
      }
      // 2) Is it an Item Line?
      else if (!keywordRegex.test(line) && !excludeRegex.test(line)) {
        let matches = line.match(priceRegex);
        if (matches && matches.length > 0) {
          // Usually the price is the last number on the line
          const lastMatch = matches[matches.length - 1];
          const parsedPrice = cleanAndParseNumber(lastMatch);

          if (parsedPrice) {
            // Find whatever text is before this price match
            let namePart = line.substring(0, line.lastIndexOf(lastMatch)).replace(/[*_]/g, '').trim();

            // Sadece 2 karakterden büyükse VE içinde en az BİR HARF barındırıyorsa ürün say
            // (Bu sayede sadece "%1 27,00" gibi harfsiz satırları süzmüş oluyoruz)
            if (namePart.length > 2 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(namePart)) {
              // Capitalize words for nice display
              let formattedName = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              extractedItems.push({
                name: formattedName,
                price: parsedPrice
              });
            }
          }
        }
      }
    }

    let finalTotal = 0;
    // Return the max of keyword-associated prices
    if (possibleTotals.length > 0) {
      finalTotal = Math.max(...possibleTotals);
    } else {
      // Strategy 2: If no keywords found, find the absolute largest valid price format in the whole text
      const allMatches = normalizedText.match(priceRegex);
      if (allMatches) {
        const allNumbers = allMatches.map(cleanAndParseNumber).filter(num => num !== null && num < 10000);
        if (allNumbers.length > 0) {
          finalTotal = Math.max(...allNumbers);
        }
      }
    }

    return { total: finalTotal, items: extractedItems };
  };

  // DOSYA YÜKLEME VE OCR
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!user) {
      setError("You must be logged in to upload a receipt.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');
    setStatusText('Analyzing receipt image...');

    let extractedData = { total: 0, items: [] };

    // 1. OCR İŞLEMİ
    try {
      if (Capacitor.isNativePlatform()) {
        // CAPACITOR NATIVE OCR (OFFLINE ML KIT)
        setStatusText('Using Native ML Kit OCR...');

        const reader = new FileReader();
        reader.readAsDataURL(file);

        const base64Text = await new Promise((resolve, reject) => {
          reader.onload = async () => {
            try {
              const base64DataWithPrefix = reader.result;
              // Plugin expects raw base64 without data:image/jpeg;base64,
              const base64Raw = base64DataWithPrefix.split(',')[1];

              if (!base64Raw) {
                throw new Error("Could not extract raw base64 from image.");
              }

              const result = await Ocr.detectText({ base64: base64Raw });
              // Plugin returns { textDetections: [{ text: "...", topLeft: [x,y], ... }] }
              if (result && result.textDetections && result.textDetections.length > 0) {
                const detections = result.textDetections;

                // Fallback guard
                if (!detections[0] || !detections[0].topLeft || typeof detections[0].topLeft[1] === 'undefined') {
                  resolve(detections.map(item => item.text).join('\n'));
                  return;
                }

                let lineGroups = [];

                // Y ekseninde (yukarıdan aşağıya) sırala. DİKKAT: normalize edilmiş `y` koordinatları Android'te genellikle
                // bottom-to-top veya top-to-bottom olabilir. Native dönüşlerinde "1.0 en üst" veya "0.0 en üst" olabiliyor.
                // Plugin'den dönen kodda: y coord = (height - y) / height. Bu nedenle 1.0 EN ÜSTTÜR.
                // Büyükten küçüğe sıralamak (b-a) en üstten en aşağıya (Top-to-Bottom) sıralar.
                detections.sort((a, b) => {
                  let aY = a.topLeft ? a.topLeft[1] : 0;
                  let bY = b.topLeft ? b.topLeft[1] : 0;
                  return bY - aY;
                });

                detections.forEach(item => {
                  let top = item.topLeft ? item.topLeft[1] : 0;
                  let bottom = (item.bottomLeft && typeof item.bottomLeft[1] !== 'undefined') ? item.bottomLeft[1] : top + 0.02;

                  // Güvenlik: Terslik varsa düzelt (origin altta veya üstte olabilir)
                  if (top > bottom) { let temp = top; top = bottom; bottom = temp; }
                  let height = bottom - top;
                  // DİKKAT: Plugin koordinatları [0.0, 1.0] arasında normalize ediyor!
                  if (height < 0.001) { bottom = top + 0.02; height = 0.02; }

                  let added = false;
                  // Her bir grup için "Overlap" (Örtüşme) kontrolü yap (Zincirlemeyi engeller)
                  for (let group of lineGroups) {
                    let overlapTop = Math.max(group.top, top);
                    let overlapBottom = Math.min(group.bottom, bottom);
                    let overlapHeight = overlapBottom - overlapTop;

                    // Kutuların Y eksenindeki örtüşmesi %30'dan fazlaysa AYNI SATIRDIR
                    if (overlapHeight > Math.min(height, group.height) * 0.3) {
                      group.items.push(item);
                      added = true;
                      break;
                    }
                  }

                  if (!added) {
                    lineGroups.push({ top: top, bottom: bottom, height: height, items: [item] });
                  }
                });

                // Satırları tekrar güvenli şekilde yukarıdan aşağı sırala
                lineGroups.sort((a, b) => b.top - a.top);

                // Her yatay grup için, öğeleri soldan sağa sırala ve birleştir
                const fullText = lineGroups.map(group => {
                  group.items.sort((a, b) => a.topLeft[0] - b.topLeft[0]);
                  return group.items.map(i => i.text).join('   ');
                }).join('\n');

                // HATA AYIKLAMA (Artık görünmesine gerek yok, ama yorum olarak kalsın)
                // console.log("LINE GROUPS COUNT: " + lineGroups.length);
                // alert("OCR SATIRLARI (Yeni Örtüşme Algoritması):\n\n" + fullText.substring(0, 300) + "...\n\n(Satır Sayısı: " + lineGroups.length + ")");

                resolve(fullText);
              } else {
                resolve(""); // No text found
              }
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = (error) => reject(error);
        });

        // HATA AYIKLAMA İÇİN EKRANA YAZDIR
        console.log("=== RAW OCR TEXT NATIVE ===");
        console.log(base64Text);
        // alert("RAW OCR READ:\n" + base64Text);

        extractedData = extractDataFromText(base64Text);
      } else {
        // WEB FALLBACK (TESSERACT)
        const result = await Tesseract.recognize(
          file,
          'tur+eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                setUploadProgress(parseInt(m.progress * 50));
                setStatusText(`Reading text: ${parseInt(m.progress * 100)}%`);
              }
            }
          }
        );

        console.log("=== RAW OCR TEXT WEB ===");
        console.log(result.data.text);
        // alert("RAW OCR READ:\n" + result.data.text);

        extractedData = extractDataFromText(result.data.text);
      }
    } catch (ocrError) {
      console.error("OCR Failed Details:", ocrError);
      alert("OCR PLUGIN ERROR: " + (ocrError.message || JSON.stringify(ocrError)));
      setError("Could not read text, uploading anyway...");
    }

    // 2. FIREBASE STORAGE YÜKLEME (İPTAL EDİLDİ - SADECE YEREL OCR KULLANILIYOR)
    setStatusText('Preparing data...');

    // Yükleme barını hızlıca doldur ve bitir
    setUploadProgress(100);

    setTimeout(() => {
      // Geçici veriyi hazırla (Resim URL'si yok, sadece bir ikon göstereceğiz)
      const tempData = {
        userId: user.uid,
        imageUrl: null, // Sunucuya resim yüklenmiyor
        fileName: file.name,
        createdAt: new Date(),
        title: file.name,
        date: new Date().toLocaleDateString(),
        isManual: false,
        items: extractedData.items || [] // Ekrana öğeleri koyalım
      };

      // State'leri güncelle ve modalı aç
      setShowItems(false); // Yeni açılanın detayları ilk başta kapalı olsun
      setVerifyData(tempData);
      setVerifiedPrice(extractedData.total); // OCR fiyatını kutuya koy
      setShowVerifyModal(true);

      setIsUploading(false);
      setUploadProgress(0);
      setStatusText('');
    }, 500); // Yarım saniye bekleme efekti

  }, [user]);

  // KAYDI ONAYLA VE VERİTABANINA YAZ
  const handleConfirmSave = async () => {
    if (!verifyData) return;

    try {
      await addDoc(collection(db, "receipts"), {
        ...verifyData,
        price: parseFloat(verifiedPrice) || 0 // Kullanıcının girdiği fiyatı al
      });

      // Temizlik
      setShowVerifyModal(false);
      setVerifyData(null);
      setVerifiedPrice('');

    } catch (e) {
      console.error("Error saving document: ", e);
      setError("Failed to save receipt data.");
    }
  };

  // İPTAL ET
  const handleCancelSave = async () => {
    // Resim yüklenmediği için silinecek bir şey yok
    setShowVerifyModal(false);
    setShowItems(false);
    setVerifyData(null);
    setVerifiedPrice('');
  };

  // SİLME FONKSİYONU
  const handleDeleteReceipt = async (e, receiptId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this receipt? This action cannot be undone.")) {
      return;
    }
    try {
      const docRef = doc(db, "receipts", receiptId);
      await deleteDoc(docRef); // Sadece veritabanı kaydını sil
    } catch (err) {
      console.error("Error deleting document: ", err);
      alert("Failed to delete receipt.");
    }
  };

  // MODAL
  const [isModalShowing, setIsModalShowing] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });

  const openModal = (imageUrl, imageAlt) => {
    setSelectedImage({ url: imageUrl, alt: imageAlt });
    setIsModalShowing(true);
  };

  const closeModal = () => {
    setIsModalShowing(false);
    setSelectedImage({ url: '', alt: '' });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'application/pdf': [] },
    maxSize: 10485760
  });

  return (
    <div className="receipts-page-wrapper p-4">
      {/* Arka plan bulanıklığı: Herhangi bir modal açıksa */}
      <div
        className={isModalShowing || showVerifyModal ? 'content-blurred' : ''}
        style={{ transition: 'filter 0.3s ease-in-out' }}
      >
        <div className="container-fluid">

          <div className="mb-5">
            <h1 className="display-6 fw-bold">Scan New Receipt</h1>
            <p className="text-muted">Upload an image of your receipt. (Auto-detects Total Price via OCR)</p>
            {error && <div className="alert alert-danger">{error}</div>}

            <div
              {...getRootProps()}
              className={`dropzone-container ${isDragActive ? 'dropzone-active' : ''}`}
            >
              <input {...getInputProps()} />
              <FaCloudUploadAlt className="dropzone-icon mb-3" />
              <p className="mb-1">
                <span className="dropzone-link-text">Click to upload</span> or drag and drop
              </p>
              <p className="text-muted small">PNG, JPG or PDF (MAX. 10MB)</p>
            </div>
          </div>

          {isUploading && (
            <div className="mb-5">
              <h3 className="h5 mb-3">Processing...</h3>
              <div className="progress" style={{ height: '20px' }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  style={{ width: `${uploadProgress}%` }}
                  aria-valuenow={uploadProgress}
                >
                  {uploadProgress.toFixed(0)}%
                </div>
              </div>
              <p className="mt-2 text-muted">{statusText}</p>
            </div>
          )}

          <div className="mt-5 mb-5">
            <h3 id="scanned-section" className="h5 mb-3 fw-bold d-flex align-items-center">
              <FaListAlt className="me-2 text-muted" /> All Scanned Receipts
            </h3>

            <div className="card shadow-sm border-0">
              <div className="list-group list-group-flush">
                <div className="list-group-item bg-body-tertiary text-body-secondary fw-bold small text-uppercase d-flex align-items-center">
                  <div style={{ flex: 2 }}>File Name</div>
                  <div style={{ flex: 1 }}>Date & Time</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>Total Price (OCR)</div>
                  <div style={{ width: '40px' }}></div>
                </div>

                {loadingReceipts && <div className="p-4 text-center text-muted">Loading receipts...</div>}
                {!user && !loadingReceipts && <div className="p-5 text-center text-muted">Please <Link to="/login">log in</Link> to view your receipts.</div>}
                {user && !loadingReceipts && receipts.length === 0 && <div className="p-5 text-center text-muted">You haven't uploaded any receipts yet.</div>}

                {user && !loadingReceipts && receipts.map(receipt => (
                  <div
                    key={receipt.id}
                    className="list-group-item list-group-item-action d-flex align-items-center p-3"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openModal(receipt.imageUrl, receipt.fileName)}
                  >
                    <div style={{ flex: 2 }} className="d-flex align-items-center">
                      <img
                        src={receipt.imageUrl || 'https://placehold.co/60x60?text=Receipt'}
                        alt={receipt.fileName}
                        className="receipt-list-thumbnail me-3"
                        onError={(e) => { e.target.src = 'https://placehold.co/60x60?text=Error'; }}
                        style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <span className="fw-bold text-truncate">{receipt.fileName}</span>
                    </div>
                    <div style={{ flex: 1 }} className="text-muted small">{formatDateTime(receipt.createdAt)}</div>
                    <div style={{ flex: 1, textAlign: 'right' }} className="fw-bold text-primary">{formatPrice(receipt.price)}</div>
                    <div style={{ width: '50px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="delete-entry-btn"
                        onClick={(e) => handleDeleteReceipt(e, receipt.id)}
                        title="Delete Receipt"
                      >
                        <svg viewBox="0 0 448 512" className="delete-entry-svgIcon">
                          <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GÖRÜNTÜLEME MODALI */}
      <ImageModal
        isShowing={isModalShowing}
        onClose={closeModal}
        imageUrl={selectedImage.url}
        imageAlt={selectedImage.alt}
      />

      {/* DOĞRULAMA (VERIFICATION) MODALI */}
      {showVerifyModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
          <div className="modal fade show d-block" style={{ zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0">

                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title fw-bold">Verify Receipt Details</h5>
                  <button type="button" className="btn-close btn-close-white" onClick={handleCancelSave}></button>
                </div>

                <div className="modal-body p-4">
                  <p className="text-muted mb-4">
                    OCR detected the following total price. Please verify if it's correct or edit it manually.
                  </p>

                  <div className="text-center mb-4">
                    {/* Önizleme Resmi (Kaldırıldı veya İkon Gösterilecek) */}
                    <div className="p-4 bg-light rounded border shadow-sm mx-auto" style={{ maxWidth: '200px' }}>
                      <FaCheck className="text-success mb-2" size={40} />
                      <p className="mb-0 fw-bold">Cloud Image Upload Disabled</p>
                      <small className="text-muted">OCR completed successfully</small>
                    </div>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label fw-bold">Total Price</label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        className="form-control"
                        value={verifiedPrice}
                        onChange={(e) => setVerifiedPrice(e.target.value)}
                        step="0.01"
                      />
                    </div>
                    <div className="form-text">Detected from OCR analysis.</div>
                  </div>

                  {/* Kalem Detayları - Expandable Area */}
                  {verifyData && verifyData.items && verifyData.items.length > 0 && (
                    <div className="border rounded mb-3 overflow-hidden">
                      <button
                        className="btn btn-light w-100 d-flex justify-content-between align-items-center p-3 text-secondary"
                        onClick={() => setShowItems(!showItems)}
                        style={{ borderRadius: 0, border: 'none', borderBottom: showItems ? '1px solid #dee2e6' : 'none' }}
                      >
                        <span className="fw-bold text-dark">
                          Parsed Items <span className="badge bg-secondary ms-2">{verifyData.items.length}</span>
                        </span>
                        <span>{showItems ? <FaTimes size={14} className="text-secondary" /> : <FaListAlt size={14} className="text-secondary" />}</span>
                      </button>

                      {showItems && (
                        <div className="bg-white" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          <ul className="list-group list-group-flush">
                            {verifyData.items.map((item, idx) => (
                              <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                <span className="text-truncate me-3 small text-secondary" style={{ maxWidth: '70%', fontWeight: '500' }}>
                                  {item.name}
                                </span>
                                <span className="fw-bold small text-primary">{formatPrice(item.price)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCancelSave}>
                    <FaTimes className="me-2" /> Cancel
                  </button>
                  <button type="button" className="btn btn-success px-4" onClick={handleConfirmSave}>
                    <FaCheck className="me-2" /> Confirm & Save
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export default Receipts;