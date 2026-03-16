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

  // OCR PRICE EXTRACTION ALGORITHM
  const extractPriceFromText = (text) => {
    if (!text) return 0;

    // Normalize newlines and basic spaces
    const normalizedText = text.replace(/\r/g, '\n').toLowerCase();
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Look for total/sum related keywords
    const keywordRegex = /(toplam|total|tutar|amount|odenecek|grand|bakiye|genel|sum|nakit|kredi|k.karti|kart)/i;
    
    // Keywords to EXCLUDE (like KDV, VAT, Tax, Indirim, Change, Para ustu)
    const excludeRegex = /(kdv|vat|tax|indirim|iskonto|para ustu|para üstü|change)/i;

    // Match numbers with dots or commas as decimal separators (e.g. 776,67 or 776.67 or 1.234,56)
    // Removed space parsing to prevent breaking native matches, just standard floats
    const priceRegex = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;

    let possiblePrices = [];

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

    // Strategy 1: Look for numbers on the same line or next line of a keyword
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // If line contains a keyword AND does NOT contain an excluded word (like KDV)
        if (keywordRegex.test(line) && !excludeRegex.test(line)) {
            // Check current line
            let matches = line.match(priceRegex);
            if (matches) {
            matches.forEach(m => {
                const parsed = cleanAndParseNumber(m);
                if (parsed) possiblePrices.push(parsed);
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
                            if (parsed) possiblePrices.push(parsed);
                        });
                    }
                }
            }
        }
    }

    // Return the max of keyword-associated prices
    if (possiblePrices.length > 0) return Math.max(...possiblePrices);

    // Strategy 2: If no keywords found, just find the absolute largest valid price format in the whole text
    // (Receipts usually have the total at the bottom, which is often the largest number)
    const allMatches = normalizedText.match(priceRegex);
    if (allMatches) {
      const allNumbers = allMatches.map(cleanAndParseNumber).filter(num => num !== null && num < 10000);
      if (allNumbers.length > 0) {
        return Math.max(...allNumbers);
      }
    }

    return 0; // Default fallback if absolutely nothing is found
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

    let extractedPrice = 0;

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
              // Plugin returns { textDetections: [{ text: "...", ... }] }
              if (result && result.textDetections && result.textDetections.length > 0) {
                 const fullText = result.textDetections.map(item => item.text).join('\n');
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

        extractedPrice = extractPriceFromText(base64Text);
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
        
        extractedPrice = extractPriceFromText(result.data.text);
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
        isManual: false
      };

      // State'leri güncelle ve modalı aç
      setVerifyData(tempData);
      setVerifiedPrice(extractedPrice); // OCR fiyatını kutuya koy
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

                  <div className="form-group">
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