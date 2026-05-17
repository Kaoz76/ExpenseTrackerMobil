import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { FaCloudUploadAlt, FaListAlt, FaCheck, FaTimes, FaTrash, FaPlus, FaEdit } from 'react-icons/fa';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, query, where, onSnapshot, orderBy, deleteDoc, doc, Timestamp, limit, getDocs } from "firebase/firestore";
import ImageModal from '../components/ImageModal';
import { Link, useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@carviz/capacitor-ocr';
import { formatDateTime, formatDate } from '../utils/dateFormatter';
import { trTitleCase, trToLower, cleanItemName, findBestProductMatch, brandAutoCorrect } from '../utils/stringUtils';

// 🔥 Client-side image resizing to speed up OCR and reduce memory/storage footprint
const resizeImage = (file, maxWidth = 1500, maxHeight = 2000) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else {
        resolve(file);
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const resizedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(resizedFile);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

// 🔥 StoreDetails için mağaza ismini standardize eden fonksiyon
const cleanStoreName = (name) => {
  if (!name) return ""; // Boş dönerse bileşen tarafında t('common.unknown_store') basılır
  let cleanName = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
  return trTitleCase(brandAutoCorrect(cleanName)).trim();
};

// YAZIM HATALARINA KARŞI: Levenshtein Distance (Bulanık Eşleştirme) Algoritması
const levenshteinDistance = (s, t) => {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
      );
    }
  }
  return arr[t.length][s.length];
};

const isFuzzyMatch = (line, targetWords, maxDist = 2) => {
  const words = line.replace(/[^a-z0-9ğüşöçığ]/gi, ' ').split(/\s+/).filter(w => w.length > 3);
  for (let word of words) {
    for (let target of targetWords) {
      const allowedDist = target.length <= 5 ? 1 : maxDist;
      if (levenshteinDistance(word, target) <= allowedDist) {
        return true;
      }
    }
  }
  return false;
};

function Receipts() {
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [existingProductNames, setExistingProductNames] = useState([]);

  const [receipts, setReceipts] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // 🔥 Yükleme limiti (Load More için)
  const [displayLimit, setDisplayLimit] = useState(20);

  // DOĞRULAMA MODALI STATE'LERİ
  const [processedScans, setProcessedScans] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const [verifiedPrice, setVerifiedPrice] = useState('');
  const [showItems, setShowItems] = useState(false);

  // VERİ ÇEKME
  useEffect(() => {
    if (user) {
      setLoadingReceipts(true);
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("isManual", "==", false)
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const receiptsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        receiptsData.sort((a, b) => {
          const getMillis = (t) => {
            if (!t) return Date.now();
            if (typeof t.toMillis === 'function') return t.toMillis();
            if (t.seconds) return t.seconds * 1000;
            if (t instanceof Date) return t.getTime();
            if (typeof t === 'number') return t;
            return 0;
          };
          return getMillis(b.createdAt) - getMillis(a.createdAt);
        });

        setReceipts(receiptsData.slice(0, displayLimit));
        setLoadingReceipts(false);
      }, (err) => {
        console.error("Error fetching receipts: ", err);
        setLoadingReceipts(false);
      });

      return () => unsubscribe();
    } else {
      setReceipts([]);
      setLoadingReceipts(false);
    }
  }, [user, displayLimit]);

  // 🔥 Mevcut ürün isimlerini çek (Fuzzy Match için)
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );
      getDocs(q).then((snapshot) => {
        const names = new Set();
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              if (item.name && item.name.trim().length > 2) {
                names.add(item.name.trim());
              }
            });
          }
        });
        setExistingProductNames([...names]);
      }).catch(err => console.warn("Could not fetch existing products for fuzzy match:", err));
    }
  }, [user]);

  // OCR PRICE EXTRACTCTION ALGORITHM
  const extractDataFromText = (text) => {
    if (!text) return { total: 0, items: [] };

    const normalizedText = trToLower(text.replace(/\r/g, '\n'));
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const keywordRegex = /(toplam|topla|total|tutar|amount|odenecek|grand|bakiye|genel|sum|nakit|kredi|k\.karti|kart)/i;
    // Bulanık eşleştirme için aranacak anahtar kelimeler
    const fuzzyKeywords = ['toplam', 'topla', 'total', 'tutar', 'amount', 'odenecek', 'grand', 'bakiye', 'genel', 'nakit', 'kredi'];
    // Puan/Kazanç gibi sadakat programı değerlerini yanlışlıkla fiş tutarı saymamak için exclude listesi genişletildi
    const excludeRegex = /(kdv|vat|tax|para ustu|para üstü|change|kg x|vakif|ziraat|garanti|is bank|iş bank|yapi kredi|yapı kredi|mastercard|visa|maestro|puan|point|kazanc|kazanç)/i;
    const priceRegex = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;

    let possibleTotals = [];
    let extractedItems = [];

    const cleanAndParseNumber = (valStr) => {
      let cleanStr = valStr.replace(/[^0-9.,]/g, '');
      if (cleanStr.includes(',') && cleanStr.includes('.')) {
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      } else if (cleanStr.includes(',')) {
        cleanStr = cleanStr.replace(',', '.');
      }
      const num = parseFloat(cleanStr);
      // Sabit Limit (Hardcode) < 50000 kısıtlaması kaldırıldı
      return (!isNaN(num) && num > 0) ? num : null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Yazım hatalarına (T0PLAM vb.) karşı Fuzzy Match kontrolü eklendi
      const hasKeyword = keywordRegex.test(line) || isFuzzyMatch(line, fuzzyKeywords);

      if (hasKeyword && !excludeRegex.test(line)) {
        let matches = line.match(priceRegex);
        if (matches) {
          matches.forEach(m => {
            const parsed = cleanAndParseNumber(m);
            if (parsed) possibleTotals.push(parsed);
          });
        }

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
      else if (!hasKeyword && !excludeRegex.test(line)) {
        let matches = line.match(priceRegex);
        if (matches && matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          let parsedPrice = cleanAndParseNumber(lastMatch);

          if (parsedPrice) {
            let namePart = line.substring(0, line.lastIndexOf(lastMatch)).replace(/[*_-]/g, '').trim();

            if (namePart.length > 2 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(namePart)) {
              // 🔥 Önce marka düzeltme sözlüğüne bak, sonra genel temizlik yap
              let correctedName = brandAutoCorrect(namePart);
              let cleanedName = cleanItemName(correctedName);
              let formattedName = trTitleCase(cleanedName);

              if (/(indirim|ndirim|iskonto)/i.test(line)) {
                parsedPrice = -Math.abs(parsedPrice);
              }

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
    const itemsSum = extractedItems.reduce((acc, item) => acc + item.price, 0);

    if (possibleTotals.length > 0) {
      if (itemsSum > 0) {
        // Math.max() tuzağını önlemek için, ürünlerin toplamına en yakın olan sayıyı seçiyoruz
        let closest = possibleTotals[0];
        let minDiff = Math.abs(possibleTotals[0] - itemsSum);
        for (let i = 1; i < possibleTotals.length; i++) {
          const diff = Math.abs(possibleTotals[i] - itemsSum);
          if (diff < minDiff) {
            minDiff = diff;
            closest = possibleTotals[i];
          }
        }
        finalTotal = closest;
      } else {
        // Ürün okunamadıysa elimizdeki "Toplam" adaylarının en büyüğünü alıyoruz (puanlar dışlandığı için nispeten güvenli)
        finalTotal = Math.max(...possibleTotals);
      }
    } else {
      // Fallback Senaryosu (Anahtar kelime hiç bulunamazsa)
      if (itemsSum > 0) {
        // Ürün listesi varsa doğrudan toplamını al (Math.max tuzağından kaçınılır)
        finalTotal = itemsSum;
      } else {
        const allMatches = normalizedText.match(priceRegex);
        if (allMatches) {
          // < 10000 fallback limiti kaldırıldı
          const allNumbers = allMatches.map(cleanAndParseNumber).filter(num => num !== null);
          if (allNumbers.length > 0) {
            finalTotal = Math.max(...allNumbers);
          }
        }
      }
    }

    return { total: finalTotal, items: extractedItems };
  };

  // DOSYA YÜKLEME VE OCR
  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    if (!user) {
      setError(t('common.msg_must_login_upload'));
      return;
    }

    const filesToProcess = acceptedFiles.slice(0, 10);

    setIsUploading(true);
    setError('');
    setUploadProgress(0);
    setStatusText(t('common.msg_analyzing_receipt').replace('{{current}}', '1').replace('{{total}}', filesToProcess.length));

    const processFile = async (originalFile) => {
      // 0. Resize Image to reduce memory footprint and speed up OCR
      const file = await resizeImage(originalFile, 1500, 2000);

      // 1. Background Firebase Upload
      let uploadPromise = Promise.resolve({ storagePath: null, imageUrl: null });
      if (!privacyMode) {
        uploadPromise = (async () => {
          try {
            const timestamp = Date.now();
            const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `receipts/${user.uid}/${timestamp}_${safeFileName}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytesResumable(storageRef, file);
            const imageUrl = await getDownloadURL(storageRef);
            return { storagePath, imageUrl };
          } catch (err) {
            console.error("Storage upload failed:", err);
            return { storagePath: null, imageUrl: null };
          }
        })();
      }

      // 2. OCR Analysis
      let extractedData = { total: 0, items: [] };
      try {
        if (Capacitor.isNativePlatform()) {
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

                  const getCenter = (item) => {
                    const tl = item.topLeft || [0,0];
                    const br = item.bottomRight || [0,0];
                    return { x: (tl[0] + br[0]) / 2, y: (tl[1] + br[1]) / 2 };
                  };

                  const getHeight = (item) => {
                    const tl = item.topLeft || [0,0];
                    const bl = item.bottomLeft || [0,0];
                    return Math.abs(bl[1] - tl[1]);
                  };

                  // Calculate median slope to correctly sort items top-to-bottom despite skew
                  let slopes = [];
                  detections.forEach(item => {
                    if (item.topLeft && item.topRight) {
                      let dx = item.topRight[0] - item.topLeft[0];
                      let dy = item.topRight[1] - item.topLeft[1];
                      if (Math.abs(dx) > 0.0001) slopes.push(dy / dx);
                    }
                  });
                  slopes.sort((a, b) => a - b);
                  let medianSlope = slopes.length > 0 ? slopes[Math.floor(slopes.length / 2)] : 0;

                  // Sort items by their projected Y-intercept (where X=0) to ensure strict top-to-bottom order
                  detections.sort((a, b) => {
                    let cA = getCenter(a);
                    let cB = getCenter(b);
                    return (cA.y - medianSlope * cA.x) - (cB.y - medianSlope * cB.x);
                  });

                  let lineGroups = [];

                  detections.forEach(item => {
                    let center = getCenter(item);
                    let height = getHeight(item);
                    if (height < 0.001) height = 0.02;

                    let added = false;
                    for (let group of lineGroups) {
                      // Project expected Y using the group's initial vector slope
                      let projectedY = group.startY + group.slope * (center.x - group.startX);
                      
                      // If the item's center is close to the projected line vector, add it!
                      if (Math.abs(center.y - projectedY) < height * 0.6) {
                        group.items.push(item);
                        // Optional: Could update group.startX/Y to gracefully curve along the receipt, 
                        // but sticking to the origin slope is mathematically cleaner for most receipts.
                        added = true;
                        break;
                      }
                    }

                    if (!added) {
                      // Calculate the angle between topLeft and topRight for this specific word
                      let dx = (item.topRight && item.topLeft) ? (item.topRight[0] - item.topLeft[0]) : 0;
                      let dy = (item.topRight && item.topLeft) ? (item.topRight[1] - item.topLeft[1]) : 0;
                      let itemSlope = Math.abs(dx) > 0.0001 ? dy / dx : medianSlope;

                      lineGroups.push({
                        startX: center.x,
                        startY: center.y,
                        slope: itemSlope,
                        items: [item]
                      });
                    }
                  });

                  const fullText = lineGroups.map(group => {
                    group.items.sort((a, b) => getCenter(a).x - getCenter(b).x);
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
          const fileUrl = URL.createObjectURL(file);
          const result = await Tesseract.recognize(
            fileUrl,
            'tur+eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setUploadProgress(parseInt(m.progress * 100)); // Update progress (approximate, max 100)
                }
              }
            }
          );
          extractedData = extractDataFromText(result.data.text);
          URL.revokeObjectURL(fileUrl);
        }
      } catch (ocrError) {
        console.error("OCR Failed Details:", ocrError);
        setError("Could not read text for some files, showing results anyway...");
      }

      const matchedItems = (extractedData.items || []).map(item => {
        const matchedName = findBestProductMatch(item.name, existingProductNames);
        return { ...item, name: matchedName };
      });

      return {
        userId: user.uid,
        uploadPromise, // Save the background upload promise to await it during final save
        tempImageUrl: URL.createObjectURL(file), // Provide a local object URL for immediate display
        fileName: '',
        originalFileName: file.name,
        createdAt: Timestamp.now(),
        title: '',
        date: new Date().toLocaleDateString(),
        isManual: false,
        items: matchedItems,
        totalPrice: extractedData.total || 0
      };
    };

    try {
      // Run OCR on all images concurrently
      const results = await Promise.all(filesToProcess.map(processFile));

      setUploadProgress(100);
      setStatusText(t('common.msg_preparing_queue'));

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

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setError("An error occurred while processing the files.");
    }

  }, [user, privacyMode, t, existingProductNames]);

  const moveToNextOrClose = (currentQueue) => {
    const updatedQueue = [...currentQueue];
    updatedQueue.shift();

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

  // 🔥 OCR Hata yaparsa Manuel Forma Aktarma
  const handleSendToManual = () => {
    const dataToPass = {
      fileName: verifyData.fileName || verifyData.originalFileName.split('.')[0],
      items: verifyData.items
    };
    setShowVerifyModal(false);
    navigate('/texts', { state: { scannedData: dataToPass } });
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
    if (!showItems) setShowItems(true);
  };

  // KAYDI ONAYLA VE VERİTABANINA YAZ
  const handleConfirmSave = async () => {
    if (!verifyData.fileName || !verifyData.fileName.trim()) {
      alert(t('common.msg_enter_store_before_save'));
      return;
    }

    try {
      const itemsToSave = (verifyData.items || []).map(item => ({
        ...item,
        price: parseFloat(item.price) || 0
      }));

      // 🔥 Wait for the background upload to finish before saving to Firestore
      const uploadResult = verifyData.uploadPromise ? await verifyData.uploadPromise : { imageUrl: null, storagePath: null };

      const newReceiptData = {
        userId: verifyData.userId,
        imageUrl: uploadResult.imageUrl || null,
        storagePath: uploadResult.storagePath || null,
        fileName: verifyData.fileName.trim(),
        createdAt: verifyData.createdAt,
        title: verifyData.fileName.trim(),
        date: verifyData.date,
        isManual: verifyData.isManual,
        items: itemsToSave,
        price: Number(verifiedPrice) || 0,
        storeNameCleaned: cleanStoreName(verifyData.fileName)
      };

      await addDoc(collection(db, "receipts"), newReceiptData);
      
      if (verifyData.tempImageUrl) {
        URL.revokeObjectURL(verifyData.tempImageUrl);
      }

      moveToNextOrClose(processedScans);

    } catch (e) {
      console.error("Error saving document: ", e);
      setError(t('common.msg_save_failed'));
    }
  };

  const handleCancelSave = () => {
    if (verifyData?.tempImageUrl) {
      URL.revokeObjectURL(verifyData.tempImageUrl);
    }
    moveToNextOrClose(processedScans);
  };

  const handleCloseAll = () => {
    processedScans.forEach(scan => {
      if (scan.tempImageUrl) {
        URL.revokeObjectURL(scan.tempImageUrl);
      }
    });
    setProcessedScans([]);
    setShowVerifyModal(false);
    setVerifyData(null);
    setVerifiedPrice('');
  };

  const handleDeleteReceipt = async (e, receiptId) => {
    e.stopPropagation();
    if (!window.confirm(t('common.msg_delete_receipt_confirm'))) {
      return;
    }
    try {
      // 🔥 Also delete image from Firebase Storage if it exists
      const receiptToDelete = receipts.find(r => r.id === receiptId);
      if (receiptToDelete?.storagePath) {
        try {
          await deleteObject(ref(storage, receiptToDelete.storagePath));
        } catch (storageErr) {
          console.warn("Could not delete storage file:", storageErr);
        }
      }
      await deleteDoc(doc(db, "receipts", receiptId));
    } catch (err) {
      console.error("Error deleting document: ", err);
      alert(t('common.msg_delete_receipt_failed'));
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
      <div
        className={isModalShowing || showVerifyModal ? 'content-blurred' : ''}
        style={{ transition: 'filter 0.3s ease-in-out' }}
      >
        <div className="container-fluid">

          <div className="mb-5">
            <h1 className="display-6 fw-bold">{t('common.scan_new_receipt')}</h1>
            <p className="text-muted">{t('common.upload_image')}</p>
            {error && <div className="alert alert-danger">{error}</div>}

            <div
              {...getRootProps()}
              className={`dropzone-container ${isDragActive ? 'dropzone-active' : ''}`}
            >
              <input {...getInputProps()} />
              <FaCloudUploadAlt className="dropzone-icon mb-3" />
              <p className="mb-1">
                <span className="dropzone-link-text">{t('common.click_to_upload')}</span> {t('common.or_drag_drop')}
              </p>
              <p className="text-muted small">{t('common.file_limits')}</p>
            </div>

            <div className="form-check mt-3 d-flex justify-content-center align-items-center">
              <input 
                className="form-check-input me-2 mt-0" 
                type="checkbox" 
                id="privacyModeCheckbox" 
                checked={privacyMode} 
                onChange={(e) => setPrivacyMode(e.target.checked)} 
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <label className="form-check-label text-muted" htmlFor="privacyModeCheckbox" style={{ cursor: 'pointer', userSelect: 'none' }}>
                {t('common.privacy_toggle_label')}
              </label>
            </div>
          </div>

          {isUploading && (
            <div className="mb-5">
              <h3 className="h5 mb-3">{t('common.processing')}</h3>
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
              <FaListAlt className="me-2 text-muted" /> {t('common.all_scanned_receipts')}
            </h3>

            <div className="card shadow-sm border-0">
              <div className="list-group list-group-flush">
                <div className="list-group-item bg-body-tertiary text-body-secondary fw-bold small text-uppercase d-flex align-items-center">
                  <div style={{ flex: 2 }}>{t('common.store_name')}</div>
                  <div style={{ flex: 1 }}>{t('common.date')}</div>
                  <div style={{ flex: 1, textAlign: 'right' }}>{t('common.total_price_ocr')}</div>
                  <div style={{ width: '40px' }}></div>
                </div>

                {loadingReceipts && <div className="p-4 text-center text-muted">{t('common.loading_receipts')}</div>}
                {!user && !loadingReceipts && <div className="p-5 text-center text-muted"><Link to="/login">{t('common.log_in')}</Link> {t('common.please_log_in_receipts')}</div>}
                {user && !loadingReceipts && receipts.length === 0 && <div className="p-5 text-center text-muted">{t('common.no_receipts_uploaded')}</div>}

                {user && !loadingReceipts && (
                  <>
                    {receipts.map(receipt => (
                      <div
                        key={receipt.id}
                        className="list-group-item list-group-item-action d-flex align-items-center p-3"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/receipts/${receipt.id}`)}
                      >
                        <div style={{ flex: 2, minWidth: 0 }} className="d-flex align-items-center pe-2">
                          <span className="fw-bold text-truncate">{receipt.fileName}</span>
                        </div>
                        <div style={{ flex: 1 }} className="text-muted small">{formatDate(receipt.createdAt)}</div>
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

                    {receipts.length >= displayLimit && (
                      <div className="list-group-item text-center p-3 bg-light">
                        <button
                          className="btn btn-outline-primary rounded-pill px-4 btn-sm fw-bold shadow-sm"
                          onClick={() => setDisplayLimit(prev => prev + 20)}
                        >
                          <FaPlus className="me-2 small" /> {t('common.load_older_receipts')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImageModal
        isShowing={isModalShowing}
        onClose={closeModal}
        imageUrl={selectedImage.url}
        imageAlt={selectedImage.alt}
      />

      {showVerifyModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
          <div className="modal fade show d-block" style={{ zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow-lg border-0">

                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title fw-bold">
                    {t('common.verify_receipt')} ({processedScans.length} {t('common.msg_remaining')})
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={handleCloseAll} title="Cancel All"></button>
                </div>

                <div className="modal-body p-4">
                  {verifyData?.tempImageUrl && (
                    <div className="mb-4 text-center">
                      <img
                        src={verifyData.tempImageUrl}
                        alt="Scanned Receipt"
                        style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px', border: '1px solid #dee2e6' }}
                      />
                    </div>
                  )}

                  <p className="text-muted mb-4">
                    {t('common.ocr_detected_price')}
                  </p>

                  <div className="text-center mb-4">
                    <div className="p-4 bg-light rounded border shadow-sm mx-auto" style={{ maxWidth: '250px' }}>
                      <FaCheck className="text-success mb-2" size={40} />
                      <input
                        type="text"
                        className="form-control text-center fw-bold mt-2"
                        value={verifyData?.fileName || ''}
                        onChange={(e) => setVerifyData({ ...verifyData, fileName: e.target.value })}
                        placeholder={t('common.store_name')}
                      />
                      <small className="text-muted mt-1 d-block">{t('common.enter_store_name')}</small>
                    </div>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label fw-bold">{t('common.total_price_ocr').replace(' (OCR)', '')}</label>
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
                    <div className="form-text">{t('common.detected_from_ocr')}</div>
                  </div>

                  {verifyData && (
                    <div className="border rounded mb-3 overflow-hidden">
                      <button
                        className="btn btn-light w-100 d-flex justify-content-between align-items-center p-3 text-secondary"
                        onClick={() => setShowItems(!showItems)}
                        style={{ borderRadius: 0, border: 'none', borderBottom: showItems ? '1px solid #dee2e6' : 'none' }}
                      >
                        <span className="fw-bold text-dark">
                          {t('common.parsed_items')} <span className="badge bg-secondary ms-2">{(verifyData.items || []).length}</span>
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
                                  placeholder={t('common.item_name')}
                                />
                                <div className="input-group input-group-sm" style={{ width: '120px' }}>
                                  <span className="input-group-text bg-light text-primary fw-bold border-end-0">{currency?.symbol || '$'}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="form-control form-control-sm text-end text-primary fw-bold border-start-0 ps-0"
                                    value={item.price}
                                    onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                    placeholder={t('common.price')}
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
                              <FaPlus className="me-2" /> {t('common.add_item')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light d-flex justify-content-between">
                  <button className="btn btn-outline-info border-0 d-flex align-items-center" onClick={handleSendToManual}>
                    <FaEdit className="me-1" /> {t('common.use_manual_form')}
                  </button>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-outline-secondary" onClick={handleCancelSave}>
                      <FaTimes className="me-2" /> {t('common.discard')}
                    </button>
                    <button type="button" className="btn btn-success px-4" onClick={handleConfirmSave}>
                      <FaCheck className="me-2" /> {t('common.save_next')}
                    </button>
                  </div>
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