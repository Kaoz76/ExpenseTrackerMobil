import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FaCloudUploadAlt, FaListAlt, FaCheck, FaTimes, FaTrash, FaPlus, FaEdit } from 'react-icons/fa';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCY_MAP } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, query, where, Timestamp, getDocs, orderBy, limit } from "firebase/firestore";
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@carviz/capacitor-ocr';
import { extractDataFromText } from '../utils/ocrUtils';
import { enrichItemsWithGemini } from '../services/geminiService';
import { trTitleCase, cleanItemName, findBestProductMatch, cleanStoreName, brandAutoCorrect } from '../utils/stringUtils';
import { useReceipts } from '../hooks/useReceipts';
import ReceiptList from '../components/receipts/ReceiptList';
import ReceiptScanZone from '../components/receipts/ReceiptScanZone';
import ReceiptFilters from '../components/receipts/ReceiptFilters';
import ReceiptVerifyModal from '../components/receipts/ReceiptVerifyModal';
import PerspectiveCropModal from '../components/receipts/PerspectiveCropModal';


import { resizeImage, preprocessForOCR } from '../utils/imageUtils';
import { resizeImageForTesseract } from '../utils/tesseractImageUtils';
import { tesseractParserRules } from '../utils/tesseractParserRules';
import { applyLearnedCorrections, saveCorrection } from '../utils/learningUtils';


function Receipts() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [shouldAnalyzeWithLLM, setShouldAnalyzeWithLLM] = useState(Capacitor.isNativePlatform());
  const [existingProductNames, setExistingProductNames] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const { allReceipts, setAllReceipts, loadingReceipts, deleteReceipt, hasMore, loadMoreReceipts } = useReceipts(user);
  const [searchTerm, setSearchTerm] = useState('');
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropQueue, setCropQueue] = useState([]);
  const [croppedFiles, setCroppedFiles] = useState([]);
  const [currentCropIndex, setCurrentCropIndex] = useState(0);
  const [totalCropCount, setTotalCropCount] = useState(0);

  // Component kapanırken bellekten sil
  useEffect(() => {
    return () => {
      if (cropImageUrl) {
        URL.revokeObjectURL(cropImageUrl);
      }
    };
  }, [cropImageUrl]);

  // Çevrimdışı tekrarlayan kayıtları engelleme
  const activeVerifyRef = useRef(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  useEffect(() => {
    activeVerifyRef.current = verifyData;
  }, [verifyData]);

  const filteredReceipts = useMemo(() => {
    let result = allReceipts;
    if (searchTerm.trim() !== '') {
      const search = searchTerm.toLocaleLowerCase('tr-TR');
      result = allReceipts.filter(receipt => {
        const storeName = (receipt.fileName || '').toLocaleLowerCase('tr-TR');
        const formattedPrice = (receipt.price || '').toString();
        const dateStr = receipt.createdAt ? new Date(receipt.createdAt.seconds * 1000).toLocaleDateString() : '';
        return storeName.includes(search) || formattedPrice.includes(search) || dateStr.includes(search);
      });
    }
    return result;
  }, [allReceipts, searchTerm]);

  // Doğrulama modalı state'leri
  const [processedScans, setProcessedScans] = useState([]);
  const [verifiedPrice, setVerifiedPrice] = useState('');

  // Mevcut ürün isimlerini getir (Fuzzy Match için)
  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      getDocs(q).then((snapshot) => {
        const names = new Set();
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.items && Array.isArray(data.items)) {
            data.items.forEach(item => {
              if (item.name && item.name.trim().length > 2) {
                // Karşılaştırma için ismi temizle
                const cleanedName = trTitleCase(cleanItemName(brandAutoCorrect(item.name.trim())));
                if (cleanedName.length > 2) names.add(cleanedName);
              }
            });
          }
        });
        setExistingProductNames([...names]);
      }).catch(err => console.warn("Could not fetch existing products for fuzzy match:", err));
    }
  }, [user]);



  // Dosya yükleme ve OCR
  const processFiles = useCallback(async (acceptedFiles) => {
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
      let processedFileForSave = originalFile;
      let processedFileForOCR = originalFile;

      // Mobil cihazlarda kasmayı önlemek için çözünürlüğü dinamik ayarla
      if (Capacitor.isNativePlatform()) {
        processedFileForSave = await resizeImage(originalFile, 1200, 1600);
        // OCR doğruluğu için görseli iyileştir (ML Kit için)
        processedFileForOCR = await preprocessForOCR(processedFileForSave);
      } else {
        // Web ortamında küçük yazılar için yüksek çözünürlük kullan
        processedFileForSave = await resizeImageForTesseract(originalFile, 1600, 2000, 0.95);
        processedFileForOCR = processedFileForSave;
      }

      // 1. Arka planda Firebase'e yükle
      let uploadPromise = Promise.resolve({ storagePath: null, imageUrl: null });
      if (!privacyMode) {
        // Çevrimdışı isek beklemeyi atla
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          uploadPromise = Promise.resolve({ storagePath: null, imageUrl: null });
        } else {
          const uploadTimeoutMs = 10000;
          uploadPromise = Promise.race([
            (async () => {
              try {
                const timestamp = Date.now();
                const safeFileName = processedFileForSave.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const storagePath = `receipts/${user.uid}/${timestamp}_${safeFileName}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytesResumable(storageRef, processedFileForSave);
                const imageUrl = await getDownloadURL(storageRef);
                return { storagePath, imageUrl };
              } catch (err) {
                console.error("Storage upload failed:", err);
                return { storagePath: null, imageUrl: null };
              }
            })(),
            new Promise(resolve =>
              setTimeout(() => resolve({ storagePath: null, imageUrl: null }), uploadTimeoutMs)
            )
          ]);
        }
      }

      // 2. OCR Analizi
      let extractedData = { total: 0, items: [] };
      let rawOcrText = "";
      try {
        if (Capacitor.isNativePlatform()) {
          const reader = new FileReader();
          reader.readAsDataURL(processedFileForOCR);

          const base64Text = await new Promise((resolve, reject) => {
            reader.onload = async () => {
              try {
                const base64DataWithPrefix = reader.result;
                const commaIndex = base64DataWithPrefix.indexOf(',');
                const base64Raw = commaIndex !== -1 ? base64DataWithPrefix.substring(commaIndex + 1) : null;


                if (!base64Raw) throw new Error("Could not extract raw base64 from image.");

                const result = await Ocr.detectText({ base64: base64Raw });
                if (result && result.textDetections && result.textDetections.length > 0) {
                  const detections = result.textDetections;

                  if (!detections[0] || !detections[0].topLeft || typeof detections[0].topLeft[1] === 'undefined') {
                    resolve(detections.map(item => item.text).join('\n'));
                    return;
                  }

                  const getCenter = (item) => {
                    const tl = item.topLeft || [0, 0];
                    const br = item.bottomRight || [0, 0];
                    return { x: (tl[0] + br[0]) / 2, y: (tl[1] + br[1]) / 2 };
                  };

                  const getHeight = (item) => {
                    const tl = item.topLeft || [0, 0];
                    const bl = item.bottomLeft || [0, 0];
                    return Math.abs(bl[1] - tl[1]);
                  };

                  // Y ekseni yönünü dinamik algıla (iOS/Android eksen farkları için)
                  let isYFlipped = false;
                  for (let det of detections) {
                    if (det.topLeft && det.bottomLeft && typeof det.topLeft[1] === 'number' && typeof det.bottomLeft[1] === 'number') {
                      if (det.bottomLeft[1] < det.topLeft[1]) {
                        isYFlipped = true;
                        break;
                      }
                    }
                  }

                  // Eğimli çekimlerde doğru sıralama için medyan eğimi hesapla
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

                  // Ufak eğimlerde dikey sıralamayı sabitlemek için eğimi sıfırla
                  if (Math.abs(medianSlope) < 0.05) medianSlope = 0;

                  // Yukarıdan aşağıya sıralamayı güvenceye almak için Y eksenine göre sırala
                  detections.sort((a, b) => {
                    let cA = getCenter(a);
                    let cB = getCenter(b);
                    let valA = cA.y - medianSlope * cA.x;
                    let valB = cB.y - medianSlope * cB.x;
                    return isYFlipped ? (valB - valA) : (valA - valB);
                  });

                  let lineGroups = [];

                  detections.forEach(item => {
                    let center = getCenter(item);
                    let itemHeight = getHeight(item);
                    // Koordinat ölçeğini belirle
                    const minHeight = itemHeight < 1 ? 0.02 : 15;
                    const effectiveHeight = Math.max(itemHeight, minHeight);

                    let added = false;
                    for (let group of lineGroups) {
                      // Eğime göre beklenen Y değerini hesapla
                      let projectedY = group.startY + medianSlope * (center.x - group.startX);

                      // Tolerans hesabı için yüksekliği baz al
                      const compareHeight = Math.max(effectiveHeight, group.height || effectiveHeight);
                      const tolerance = compareHeight * 0.5;

                      // Satır hizasındaysa gruba ekle
                      if (Math.abs(center.y - projectedY) < tolerance) {
                        group.items.push(item);
                        group.height = Math.max(group.height || 0, effectiveHeight);
                        added = true;
                        break;
                      }
                    }

                    if (!added) {
                      // Bu kelime için eğim açısını hesapla
                      let dx = (item.topRight && item.topLeft) ? (item.topRight[0] - item.topLeft[0]) : 0;
                      let dy = (item.topRight && item.topLeft) ? (item.topRight[1] - item.topLeft[1]) : 0;
                      let itemSlope = Math.abs(dx) > 0.0001 ? dy / dx : medianSlope;

                      lineGroups.push({
                        startX: center.x,
                        startY: center.y,
                        slope: itemSlope,
                        height: effectiveHeight,
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

          rawOcrText = base64Text;
          extractedData = extractDataFromText(base64Text, language, currency?.code);
        } else {
          const fileUrl = URL.createObjectURL(processedFileForOCR);
          const Tesseract = (await import('tesseract.js')).default;
          // Yanlış eşleşmeleri önlemek için dili dinamik seç
          const ocrLang = language === 'tr' ? 'tur' : 'eng';
          const worker = await Tesseract.createWorker(ocrLang, 1, {
            logger: m => {
              if (m.status === 'recognizing text') {
                setUploadProgress(parseInt(m.progress * 100)); // İlerlemeyi güncelle (yaklaşık, maks 100)
              }
            }
          });

          await worker.setParameters({
            tessedit_pageseg_mode: '6' // Sütun ayrılmasını önlemek için satır satır okumayı zorla
          });

          const result = await worker.recognize(
            fileUrl,
            {},
            {
              blocks: true,
              tsv: true
            }
          );

          // Blok hiyerarşisinden kelimeleri çıkar
          const words = [];
          if (result.data && result.data.blocks) {
            result.data.blocks.forEach(block => {
              if (block.paragraphs) {
                block.paragraphs.forEach(para => {
                  if (para.lines) {
                    para.lines.forEach(line => {
                      if (line.words) {
                        words.push(...line.words);
                      }
                    });
                  }
                });
              }
            });
          }

          const processedText = groupTesseractWordsIntoLines(words);
          rawOcrText = processedText;
          extractedData = extractDataFromText(processedText, language, currency?.code || 'USD', tesseractParserRules);
          
          await worker.terminate();
          URL.revokeObjectURL(fileUrl);
        }
      } catch (ocrError) {
        console.error("OCR Failed Details:", ocrError);
        setError("Could not read text for some files, showing results anyway...");
      }

      const matchedItems = (extractedData.items || []).map(item => {
        const matchedName = findBestProductMatch(item.name, existingProductNames);
        // Eşleşen ismi temizle
        return { ...item, name: trTitleCase(cleanItemName(matchedName)) };
      });

      // AI ile marka, kategori ve boyut tespiti yap
      // Zaman aşımı kontrolü (8 saniye)
      let enrichedItems = matchedItems;
      if (shouldAnalyzeWithLLM) {
        try {
          setStatusText(t('common.msg_ai_enriching'));
          enrichedItems = await Promise.race([
            enrichItemsWithGemini(matchedItems, '', language),
            new Promise(resolve => setTimeout(() => resolve(matchedItems), 8000))
          ]);
        } catch (aiError) {
          console.warn('AI enrichment failed, using raw OCR items:', aiError);
        }
      }

      // Öğrenilmiş kullanıcı düzeltmelerini uygula
      enrichedItems = applyLearnedCorrections(enrichedItems);

      // Kategori atanamayan ürünler için varsayılan kategori
      const fallbackCategory = language === 'tr' ? 'Bilinmeyen' : 'Unknown';
      enrichedItems = enrichedItems.map(item => {
        const priceVal = parseFloat(item.price) || 0;
        let itemType = item.type;
        if (priceVal < 0) {
          itemType = language === 'tr' ? 'İndirim' : 'Discount';
        }
        return {
          ...item,
          type: itemType || fallbackCategory
        };
      });

      return {
        userId: user.uid,
        uploadPromise, // Yükleme işlemini kaydet
        tempImageUrl: URL.createObjectURL(processedFileForSave), // Görüntüleme için yerel URL oluştur
        fileName: '',
        originalFileName: processedFileForSave.name,
        createdAt: Timestamp.now(),
        title: '',
        date: new Date().toLocaleDateString(),
        isManual: false,
        originalItems: JSON.parse(JSON.stringify(enrichedItems)), // Öğrenme kıyaslaması için kopyala
        items: enrichedItems,
        totalPrice: extractedData.total || 0,
        currency: extractedData.currency || currency?.code || 'USD',
        rawOcrText: rawOcrText
      };
    };

    try {
      const results = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        // İşlem durumunu güncelle
        setStatusText(
          t('common.msg_analyzing_receipt')
            .replace('{{current}}', String(i + 1))
            .replace('{{total}}', String(filesToProcess.length))
        );

        const result = await processFile(filesToProcess[i]);
        results.push(result);

        // İlerlemeyi yansıt
        setUploadProgress(((i + 1) / filesToProcess.length) * 100);
      }

      setStatusText(t('common.msg_preparing_queue'));

      setTimeout(() => {
        setProcessedScans(results);
        if (results.length > 0) {
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

  }, [user, privacyMode, shouldAnalyzeWithLLM, t, existingProductNames, currency?.code, language]);

  const prepareAndShowCrop = useCallback(async (file) => {
    setIsUploading(true);
    setStatusText(t('common.msg_preparing_image') || 'Preparing image...');
    try {
      // Bellek kullanımını düşürmek için kırpma öncesi yeniden boyutlandır
      const resized = await resizeImage(file, 1000, 1300);
      setCropFile(resized);
      setCropImageUrl(URL.createObjectURL(resized));
      setCropModalVisible(true);
    } catch (err) {
      console.error("Resize failed:", err);
      setCropFile(file);
      setCropImageUrl(URL.createObjectURL(file));
      setCropModalVisible(true);
    } finally {
      setIsUploading(false);
      setStatusText('');
    }
  }, [t]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;

    if (!user) {
      setError(t('common.msg_must_login_upload'));
      return;
    }

    const filesToProcess = acceptedFiles.slice(0, 10);

    setCroppedFiles([]);
    setCurrentCropIndex(0);
    setTotalCropCount(filesToProcess.length);

    if (filesToProcess.length > 0) {
      const firstFile = filesToProcess[0];
      const remainingFiles = filesToProcess.slice(1);

      setCropQueue(remainingFiles);

      // Android ana iş parçacığını rahatlatmak için modal açılışını geciktir
      setTimeout(() => {
        prepareAndShowCrop(firstFile);
      }, 700);
    }
  }, [user, t, prepareAndShowCrop]);

  const handleCropConfirm = (croppedFile) => {
    // Belleği temizle
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
      setCropImageUrl('');
    }

    const updatedCropped = [...croppedFiles, croppedFile];
    setCroppedFiles(updatedCropped);

    setCropModalVisible(false);
    setCropFile(null);

    if (cropQueue.length > 0) {
      const nextQueue = [...cropQueue];
      const nextFile = nextQueue.shift();
      setCropQueue(nextQueue);
      setCurrentCropIndex(prev => prev + 1);

      // Geçiş yumuşaklığı için beklet
      setTimeout(() => {
        prepareAndShowCrop(nextFile);
      }, 300);
    } else {
      setCroppedFiles([]);
      setTotalCropCount(0);
      setCurrentCropIndex(0);

      // Defer processing by 700ms to yield the main thread to Android OS focus/resume event loop
      setTimeout(() => {
        processFiles(updatedCropped);
      }, 700);
    }
  };

  const handleCropCancel = () => {
    // Belleği temizle
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
      setCropImageUrl('');
    }

    setCropModalVisible(false);
    setCropFile(null);

    if (cropQueue.length > 0) {
      const nextQueue = [...cropQueue];
      const nextFile = nextQueue.shift();
      setCropQueue(nextQueue);
      setCurrentCropIndex(prev => prev + 1);

      // Defer next crop modal by 300ms to allow smooth modal transitions
      setTimeout(() => {
        prepareAndShowCrop(nextFile);
      }, 300);
    } else {
      // If there are accumulated cropped files, process them
      if (croppedFiles.length > 0) {
        const processed = [...croppedFiles];
        setCroppedFiles([]);
        setTotalCropCount(0);
        setCurrentCropIndex(0);

        // Defer processing by 700ms to yield the main thread to Android OS focus/resume event loop
        setTimeout(() => {
          processFiles(processed);
        }, 700);
      } else {
        // No files cropped at all
        setTotalCropCount(0);
        setCurrentCropIndex(0);
      }
    }
  };

  const moveToNextOrClose = (currentQueue) => {
    const updatedQueue = [...currentQueue];
    updatedQueue.shift();

    setProcessedScans(updatedQueue);

    if (updatedQueue.length > 0) {
      setVerifyData(updatedQueue[0]);
      setVerifiedPrice(updatedQueue[0].totalPrice);
    } else {
      setShowVerifyModal(false);
      setVerifyData(null);
      setVerifiedPrice('');
    }
  };

  // OCR hatalıysa manuel forma aktar
  const handleSendToManual = () => {
    const dataToPass = {
      fileName: verifyData.fileName || verifyData.originalFileName.split('.')[0],
      items: verifyData.items
    };
    setShowVerifyModal(false);
    navigate('/texts', { state: { scannedData: dataToPass } });
  };



  // Kaydı onayla ve kaydet
  const handleConfirmSave = async () => {
    if (isSavingDoc) return;
    if (!verifyData.fileName || !verifyData.fileName.trim()) {
      alert(t('common.msg_enter_store_before_save'));
      return;
    }

    try {
      setIsSavingDoc(true);
      const itemsToSave = (verifyData.items || []).map((item, index) => {
        const cleanedName = item.name ? trTitleCase(cleanItemName(brandAutoCorrect(item.name))) : item.name;

        // Kullanıcının yaptığı düzeltmeleri öğren
        const originalItem = verifyData.originalItems && verifyData.originalItems[index];
        if (originalItem) {
          if (originalItem.name !== item.name || originalItem.type !== item.type) {
            saveCorrection(originalItem.name, cleanedName, item.type);
          }
        }

        const priceVal = parseFloat(item.price) || 0;
        let finalType = item.type || '';
        if (priceVal < 0) {
          finalType = verifyData.currency === 'TRY' || language === 'tr' ? 'İndirim' : 'Discount';
        }

        // Takip alanlarını temizleyip kaydet
        const finalItem = { ...item };
        delete finalItem._isLearned;

        return {
          ...finalItem,
          name: cleanedName,
          price: priceVal,
          type: finalType,
          brand: item.brand || '',
          size: item.size || ''
        };
      });

      // Promise zaman aşımı yardımcısı
      const withTimeout = (promise, ms) => {
        let timer;
        return Promise.race([
          promise,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), ms); })
        ]).finally(() => clearTimeout(timer));
      };

      // Zaman aşımlı yükleme denemesi, başarısızsa atla
      let uploadResult = { imageUrl: null, storagePath: null };
      if (verifyData.uploadPromise) {
        try {
          uploadResult = await withTimeout(verifyData.uploadPromise, 6000);
        } catch (uploadErr) {
          console.warn("Upload skipped (offline/slow):", uploadErr.message);
          // Continue without image — Firebase will sync when back online
        }
      }

      // Beklerken modal kapandıysa iptal et
      if (activeVerifyRef.current !== verifyData) {
        console.warn("Save aborted because the modal was closed or changed.");
        setIsSavingDoc(false);
        return;
      }

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
        currency: verifyData.currency || currency?.code || 'USD',
        storeNameCleaned: cleanStoreName(verifyData.fileName)
      };

      // Zaman aşımlı Firestore kaydı (çevrimdışıysa sıraya alır)
      let docId = null;
      try {
        const docRef = await withTimeout(addDoc(collection(db, "receipts"), newReceiptData), 6000);
        docId = docRef.id;
      } catch (writeErr) {
        if (writeErr.message === 'TIMEOUT') {
          // Firestore offline persistence will sync this when back online
          console.warn("Firestore write queued for offline sync");
          docId = 'offline_' + Date.now();
        } else {
          throw writeErr; // Re-throw real errors
        }
      }

      if (verifyData.tempImageUrl) {
        URL.revokeObjectURL(verifyData.tempImageUrl);
      }

      // Anında görünmesi için yerel listeye ekle
      setAllReceipts(prev => [{ id: docId, ...newReceiptData }, ...prev]);

      moveToNextOrClose(processedScans);

    } catch (e) {
      console.error("Error saving document: ", e);
      setError(t('common.msg_save_failed'));
    } finally {
      setIsSavingDoc(false);
    }
  };

  // İptal edilen taramaların dosyalarını temizle
  const cleanupOrphanedUpload = async (scan) => {
    if (!scan?.uploadPromise) return;
    try {
      const result = await scan.uploadPromise;
      if (result?.storagePath) {
        await deleteObject(ref(storage, result.storagePath));
      }
    } catch (err) {
      // Upload may have failed/timed-out — nothing to clean up
      console.warn("Could not clean up orphaned storage file:", err);
    }
  };

  const handleCancelSave = () => {
    if (verifyData?.tempImageUrl) {
      URL.revokeObjectURL(verifyData.tempImageUrl);
    }
    cleanupOrphanedUpload(verifyData);
    moveToNextOrClose(processedScans);
  };

  const handleCloseAll = () => {
    processedScans.forEach(scan => {
      if (scan.tempImageUrl) {
        URL.revokeObjectURL(scan.tempImageUrl);
      }
      cleanupOrphanedUpload(scan);
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
    const success = await deleteReceipt(receiptId);
    if (!success) {
      alert(t('common.msg_delete_receipt_failed'));
    }
  };


  return (
    <div className="receipts-page-wrapper p-4">
      <div
        className={showVerifyModal ? 'content-blurred' : ''}
        style={{ transition: 'filter 0.3s ease-in-out' }}
      >
        <div className="container-fluid">

          <ReceiptScanZone
            onDrop={onDrop}
            error={error}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            statusText={statusText}
            privacyMode={privacyMode}
            setPrivacyMode={setPrivacyMode}
            shouldAnalyzeWithLLM={shouldAnalyzeWithLLM}
            setShouldAnalyzeWithLLM={setShouldAnalyzeWithLLM}
          />

          <div className="mt-5 mb-5">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3">
              <h3 id="scanned-section" className="h5 mb-3 mb-md-0 fw-bold d-flex align-items-center">
                <FaListAlt className="me-2 text-muted" /> {t('common.all_scanned_receipts')}
              </h3>

              {user && allReceipts.length > 0 && (
                <ReceiptFilters
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                />
              )}
            </div>

            <ReceiptList
              user={user}
              loadingReceipts={loadingReceipts}
              allReceipts={allReceipts}
              filteredReceipts={filteredReceipts}
              displayedReceipts={filteredReceipts}
              hasMore={hasMore}
              loadMoreReceipts={loadMoreReceipts}
              handleDeleteReceipt={handleDeleteReceipt}
            />
          </div>
        </div>
      </div>

      <ReceiptVerifyModal
        showVerifyModal={showVerifyModal}
        processedScans={processedScans}
        verifyData={verifyData}
        setVerifyData={setVerifyData}
        verifiedPrice={verifiedPrice}
        setVerifiedPrice={setVerifiedPrice}
        handleCloseAll={handleCloseAll}
        handleSendToManual={handleSendToManual}
        handleCancelSave={handleCancelSave}
        handleConfirmSave={handleConfirmSave}
        isSavingDoc={isSavingDoc}
      />

      {cropFile && cropModalVisible && cropImageUrl && (
        <PerspectiveCropModal
          visible={cropModalVisible}
          imageSrc={cropImageUrl}
          onClose={handleCropCancel}
          onCropComplete={handleCropConfirm}
          title={totalCropCount > 1 ? `${t('common.perspective_crop_title')} (${currentCropIndex + 1} / ${totalCropCount})` : undefined}
        />
      )}

    </div>
  );
}

/**
 * Tesseract kelimelerini uzamsal hizalamalarına göre satırlara gruplar.
 * ML Kit yoluna benzer eğim tabanlı izdüşüm ve yakınlık kümelemesi kullanır.
 * 
 * @param {Array} words - Tesseract kelime objeleri dizisi
 * @returns {string} Gruplanmış ve yeniden oluşturulmuş metin
 */
const groupTesseractWordsIntoLines = (words) => {
  if (!words || words.length === 0) return "";

  // Tesseract sınır kutularını (bbox) standart formata çevir
  const detections = words.map(w => {
    const { x0, y0, x1, y1 } = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
    return {
      text: w.text || "",
      topLeft: [x0, y0],
      topRight: [x1, y0],
      bottomLeft: [x0, y1],
      bottomRight: [x1, y1]
    };
  });

  const getCenter = (item) => {
    const tl = item.topLeft || [0, 0];
    const br = item.bottomRight || [0, 0];
    return { x: (tl[0] + br[0]) / 2, y: (tl[1] + br[1]) / 2 };
  };

  const getHeight = (item) => {
    const tl = item.topLeft || [0, 0];
    const bl = item.bottomLeft || [0, 0];
    return Math.abs(bl[1] - tl[1]);
  };

  // Y ekseni yönünü algıla
  let isYFlipped = false;
  for (let det of detections) {
    if (det.topLeft && det.bottomLeft && typeof det.topLeft[1] === 'number' && typeof det.bottomLeft[1] === 'number') {
      if (det.bottomLeft[1] < det.topLeft[1]) {
        isYFlipped = true;
        break;
      }
    }
  }

  // Medyan eğimi hesapla
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

  if (Math.abs(medianSlope) < 0.05) medianSlope = 0;

  // Yukarıdan aşağıya sırala
  detections.sort((a, b) => {
    let cA = getCenter(a);
    let cB = getCenter(b);
    let valA = cA.y - medianSlope * cA.x;
    let valB = cB.y - medianSlope * cB.x;
    return isYFlipped ? (valB - valA) : (valA - valB);
  });

  let lineGroups = [];

  detections.forEach(item => {
    let center = getCenter(item);
    let itemHeight = getHeight(item);
    const minHeight = itemHeight < 1 ? 0.02 : 15;
    const effectiveHeight = Math.max(itemHeight, minHeight);

    let added = false;
    for (let group of lineGroups) {
      let projectedY = group.startY + medianSlope * (center.x - group.startX);
      const compareHeight = Math.max(effectiveHeight, group.height || effectiveHeight);
      const tolerance = compareHeight * 0.5;

      if (Math.abs(center.y - projectedY) < tolerance) {
        group.items.push(item);
        group.height = Math.max(group.height || 0, effectiveHeight);
        added = true;
        break;
      }
    }

    if (!added) {
      let dx = (item.topRight && item.topLeft) ? (item.topRight[0] - item.topLeft[0]) : 0;
      let dy = (item.topRight && item.topLeft) ? (item.topRight[1] - item.topLeft[1]) : 0;
      let itemSlope = Math.abs(dx) > 0.0001 ? dy / dx : medianSlope;

      lineGroups.push({
        startX: center.x,
        startY: center.y,
        slope: itemSlope,
        height: effectiveHeight,
        items: [item]
      });
    }
  });

  // Her satır içinde soldan sağa sırala ve boşluklarla birleştir
  return lineGroups.map(group => {
    group.items.sort((a, b) => getCenter(a).x - getCenter(b).x);
    return group.items.map(i => i.text).join('   ');
  }).join('\n');
};

export default Receipts;