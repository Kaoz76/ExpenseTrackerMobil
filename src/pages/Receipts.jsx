import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaCloudUploadAlt, FaListAlt, FaCheck, FaTimes, FaTrash, FaPlus } from 'react-icons/fa';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, getDoc, Timestamp } from "firebase/firestore";
import ImageModal from '../components/ImageModal';
import { Link } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@carviz/capacitor-ocr';
import { formatDateTime } from '../utils/dateFormatter';

function Receipts() {
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // DOĞRULAMA MODALI STATE'LERİ
  const [processedScans, setProcessedScans] = useState([]); // Yeni: Sıradaki taranan fişler
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
          // Changed: We no longer require imageUrl since we disabled cloud storage uploads.
          // We only filter out manual text entries if they have isManual === true.
          if (!doc.data().isManual) {
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

    // Normalize newlines and basic spaces (Handle Turkish chars better)
    const normalizedText = text.replace(/\r/g, '\n').toLocaleLowerCase('tr-TR');
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Look for total/sum related keywords (added 'topla' in case OCR misses 'm')
    const keywordRegex = /(toplam|topla|total|tutar|amount|odenecek|grand|bakiye|genel|sum|nakit|kredi|k\.karti|kart)/i;

    // Keywords to EXCLUDE (like KDV, VAT, Tax, Indirim, Change, Para ustu, %, KG x, Bank names)
    // DİKKAT: "%" işaretini kaldırdık çünkü birçok fişte ürün isminin yanında %1, %8 gibi KDV oranı yazar!
    const excludeRegex = /(kdv|vat|tax|indirim|ndirim|iskonto|para ustu|para üstü|change|kg x|vakif|ziraat|garanti|is bank|iş bank|yapi kredi|yapı kredi|mastercard|visa|maestro)/i;

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
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    if (!user) {
      setError("You must be logged in to upload a receipt.");
      return;
    }

    const filesToProcess = acceptedFiles.slice(0, 10);

    setIsUploading(true);
    setError('');
    
    let results = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setUploadProgress(0);
      setStatusText(`Analyzing receipt ${i + 1} of ${filesToProcess.length}...`);

      let extractedData = { total: 0, items: [] };

      // 1. OCR İŞLEMİ
      try {
        if (Capacitor.isNativePlatform()) {
          // CAPACITOR NATIVE OCR (OFFLINE ML KIT)
          const reader = new FileReader();
          reader.readAsDataURL(file);

          const base64Text = await new Promise((resolve, reject) => {
            reader.onload = async () => {
              try {
                const base64DataWithPrefix = reader.result;
                const base64Raw = base64DataWithPrefix.split(',')[1];

                if (!base64Raw) throw new Error("Could not extract raw base64 from image.");

                const result = await Ocr.detectText({ base64: base64Raw });
                if (result && result.textDetections && result.textDetections.length > 0) {
                  const detections = result.textDetections;

                  if (!detections[0] || !detections[0].topLeft || typeof detections[0].topLeft[1] === 'undefined') {
                    resolve(detections.map(item => item.text).join('\n'));
                    return;
                  }

                  let lineGroups = [];
                  detections.sort((a, b) => {
                    let aY = a.topLeft ? a.topLeft[1] : 0;
                    let bY = b.topLeft ? b.topLeft[1] : 0;
                    return bY - aY;
                  });

                  detections.forEach(item => {
                    let top = item.topLeft ? item.topLeft[1] : 0;
                    let bottom = (item.bottomLeft && typeof item.bottomLeft[1] !== 'undefined') ? item.bottomLeft[1] : top + 0.02;

                    if (top > bottom) { let temp = top; top = bottom; bottom = temp; }
                    let height = bottom - top;
                    if (height < 0.001) { bottom = top + 0.02; height = 0.02; }

                    let added = false;
                    for (let group of lineGroups) {
                      let overlapTop = Math.max(group.top, top);
                      let overlapBottom = Math.min(group.bottom, bottom);
                      let overlapHeight = overlapBottom - overlapTop;

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

                  lineGroups.sort((a, b) => b.top - a.top);
                  const fullText = lineGroups.map(group => {
                    group.items.sort((a, b) => a.topLeft[0] - b.topLeft[0]);
                    return group.items.map(i => i.text).join('   ');
                  }).join('\n');

                  resolve(fullText);
                } else {
                  resolve("");
                }
              } catch (e) {
                reject(e);
              }
            };
            reader.onerror = (error) => reject(error);
          });

          extractedData = extractDataFromText(base64Text);
        } else {
          // WEB FALLBACK (TESSERACT)
          const fileUrl = URL.createObjectURL(file);
          const result = await Tesseract.recognize(
            fileUrl,
            'tur+eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setUploadProgress(parseInt(m.progress * 50));
                }
              }
            }
          );
          extractedData = extractDataFromText(result.data.text);
          URL.revokeObjectURL(fileUrl);
        }
      } catch (ocrError) {
        console.error("OCR Failed Details:", ocrError);
        setError("Could not read text for some files, uploading anyway...");
      }

      const baseNumber = receipts.length;

      results.push({
        userId: user.uid,
        imageUrl: null, 
        fileName: `Receipt ${baseNumber + i + 1}`,
        originalFileName: file.name,
        createdAt: Timestamp.now(),
        title: `Receipt ${baseNumber + i + 1}`,
        date: new Date().toLocaleDateString(),
        isManual: false,
        items: extractedData.items || [],
        totalPrice: extractedData.total || 0
      });
    }

    setUploadProgress(100);
    setStatusText('Preparing verification queue...');

    setTimeout(() => {
      setProcessedScans(results);
      if (results.length > 0) {
        setShowItems(false);
        setVerifyData(results[0]);
        setVerifiedPrice(results[0].totalPrice);
        setShowVerifyModal(true);
      }
      setIsUploading(false);
      setUploadProgress(0);
      setStatusText('');
    }, 500);

  }, [user]);

  const moveToNextOrClose = (currentQueue) => {
    const updatedQueue = [...currentQueue];
    updatedQueue.shift(); // İlk sıradakini kaldır
    
    setProcessedScans(updatedQueue);
    
    if (updatedQueue.length > 0) {
      setVerifyData(updatedQueue[0]);
      setVerifiedPrice(updatedQueue[0].totalPrice);
      setShowItems(false);
    } else {
      setShowVerifyModal(false);
      setVerifyData(null);
      setVerifiedPrice('');
    }
  };

  const handleItemChange = (index, field, value) => {
    if (!verifyData) return;
    const updatedItems = [...verifyData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setVerifyData({ ...verifyData, items: updatedItems });
  };

  const handleRemoveItem = (index) => {
    if (!verifyData) return;
    const updatedItems = verifyData.items.filter((_, i) => i !== index);
    setVerifyData({ ...verifyData, items: updatedItems });
  };

  const handleAddItem = () => {
    if (!verifyData) return;
    const newItem = { name: '', price: 0, type: '', brand: '', size: '' };
    const updatedItems = [...(verifyData.items || []), newItem];
    setVerifyData({ ...verifyData, items: updatedItems });
    if (!showItems) setShowItems(true); // Open accordion if closed
  };


  // KAYDI ONAYLA VE VERİTABANINA YAZ
  const handleConfirmSave = async () => {
    if (!verifyData) return;

    try {
      const itemsToSave = (verifyData.items || []).map(item => ({
        ...item,
        price: parseFloat(item.price) || 0
      }));

      const newReceiptData = {
        userId: verifyData.userId,
        imageUrl: null,
        fileName: verifyData.fileName,
        createdAt: verifyData.createdAt,
        title: verifyData.title,
        date: verifyData.date,
        isManual: verifyData.isManual,
        items: itemsToSave,
        price: parseFloat(verifiedPrice) || 0
      };

      const docRef = await addDoc(collection(db, "receipts"), newReceiptData);
      setReceipts(prev => [{ id: docRef.id, ...newReceiptData }, ...prev]);

      moveToNextOrClose(processedScans);

    } catch (e) {
      console.error("Error saving document: ", e);
      setError("Failed to save receipt data.");
    }
  };

  // İPTAL ET (SADECE O ANKİ FİŞİ ATLA)
  const handleCancelSave = () => {
    moveToNextOrClose(processedScans);
  };

  // MODALI TAMAMEN KAPAT (TÜM SIRAYI İPTAL ET)
  const handleCloseAll = () => {
    setProcessedScans([]);
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
      setReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
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
              <p className="text-muted small">PNG, JPG or PDF (MAX. 10MB) - Up to 10 files</p>
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
                    <div style={{ flex: 2, minWidth: 0 }} className="d-flex align-items-center pe-2">
                      <img
                        src={receipt.imageUrl || 'https://placehold.co/60x60?text=Receipt'}
                        alt={receipt.fileName}
                        className="receipt-list-thumbnail me-3 flex-shrink-0"
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
                  <h5 className="modal-title fw-bold">
                    Verify Receipt ({processedScans.length} remaining)
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={handleCloseAll} title="Cancel All"></button>
                </div>

                <div className="modal-body p-4">
                  <p className="text-muted mb-4">
                    OCR detected the following total price. Please verify if it's correct or edit it manually.
                  </p>

                  <div className="text-center mb-4">
                    <div className="p-4 bg-light rounded border shadow-sm mx-auto" style={{ maxWidth: '250px' }}>
                      <FaCheck className="text-success mb-2" size={40} />
                      <input
                        type="text"
                        className="form-control text-center fw-bold mt-2"
                        value={verifyData?.fileName || ''}
                        onChange={(e) => setVerifyData({...verifyData, fileName: e.target.value})}
                      />
                      <small className="text-muted mt-1 d-block">Tap to rename receipt</small>
                    </div>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label fw-bold">Total Price</label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text">{currency?.symbol || '$'}</span>
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
                  {verifyData && (
                    <div className="border rounded mb-3 overflow-hidden">
                      <button
                        className="btn btn-light w-100 d-flex justify-content-between align-items-center p-3 text-secondary"
                        onClick={() => setShowItems(!showItems)}
                        style={{ borderRadius: 0, border: 'none', borderBottom: showItems ? '1px solid #dee2e6' : 'none' }}
                      >
                        <span className="fw-bold text-dark">
                          Parsed Items <span className="badge bg-secondary ms-2">{(verifyData.items || []).length}</span>
                        </span>
                        <span>{showItems ? <FaTimes size={14} className="text-secondary" /> : <FaListAlt size={14} className="text-secondary" />}</span>
                      </button>

                      {showItems && (
                        <div className="bg-white" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          <ul className="list-group list-group-flush">
                            {(verifyData.items || []).map((item, idx) => (
                              <li key={idx} className="list-group-item d-flex justify-content-between align-items-center py-2 px-3">
                                <button 
                                  className="btn btn-sm btn-outline-danger me-2 border-0" 
                                  onClick={() => handleRemoveItem(idx)}
                                  title="Remove Item"
                                >
                                  <FaTrash size={12} />
                                </button>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm me-2 text-secondary" 
                                  style={{ fontWeight: '500' }}
                                  value={item.name} 
                                  onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                  placeholder="Item Name"
                                />
                                <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                  <span className="input-group-text bg-light text-primary fw-bold border-end-0">{currency?.symbol || '$'}</span>
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    className="form-control form-control-sm text-end text-primary fw-bold border-start-0 ps-0" 
                                    value={item.price} 
                                    onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                    placeholder="Price"
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                          <div className="p-2 border-top bg-light">
                            <button 
                              className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-center align-items-center"
                              onClick={handleAddItem}
                            >
                              <FaPlus className="me-2" /> Add Item
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary" onClick={handleCancelSave}>
                    <FaTimes className="me-2" /> Discard & Next
                  </button>
                  <button type="button" className="btn btn-success px-4" onClick={handleConfirmSave}>
                    <FaCheck className="me-2" /> Save & Next
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