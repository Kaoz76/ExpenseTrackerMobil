import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FaCloudUploadAlt, FaListAlt, FaCheck, FaTimes, FaTrash, FaPlus, FaEdit } from 'react-icons/fa';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCurrency, CURRENCY_MAP } from '../context/CurrencyContext';
import { useLanguage } from '../context/LanguageContext';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, query, where, Timestamp, getDocs } from "firebase/firestore";
import ImageModal from '../components/ImageModal';
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@carviz/capacitor-ocr';
import { extractDataFromText } from '../utils/ocrUtils';
import { enrichItemsWithGemini } from '../services/geminiService';
import { trTitleCase, cleanItemName, findBestProductMatch, cleanStoreName } from '../utils/stringUtils';
import { useReceipts } from '../hooks/useReceipts';
import ReceiptList from '../components/receipts/ReceiptList';
import ReceiptScanZone from '../components/receipts/ReceiptScanZone';
import ReceiptFilters from '../components/receipts/ReceiptFilters';
import ReceiptVerifyModal from '../components/receipts/ReceiptVerifyModal';

import { resizeImage } from '../utils/imageUtils';


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
  const [shouldAnalyzeWithLLM, setShouldAnalyzeWithLLM] = useState(true);
  const [existingProductNames, setExistingProductNames] = useState([]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const { allReceipts, setAllReceipts, loadingReceipts, deleteReceipt, hasMore, loadMoreReceipts } = useReceipts(user);
  const [searchTerm, setSearchTerm] = useState("");

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

  // DOĞRULAMA MODALI STATE'LERİ
  const [processedScans, setProcessedScans] = useState([]);
  const [verifiedPrice, setVerifiedPrice] = useState('');

  // 🔥 Mevcut ürün isimlerini çek (Fuzzy Match için)
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
                // Clean the stored name so fuzzy matching works against clean names
                const cleanedName = trTitleCase(cleanItemName(item.name.trim()));
                if (cleanedName.length > 2) names.add(cleanedName);
              }
            });
          }
        });
        setExistingProductNames([...names]);
      }).catch(err => console.warn("Could not fetch existing products for fuzzy match:", err));
    }
  }, [user]);



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
                    const tl = item.topLeft || [0, 0];
                    const br = item.bottomRight || [0, 0];
                    return { x: (tl[0] + br[0]) / 2, y: (tl[1] + br[1]) / 2 };
                  };

                  const getHeight = (item) => {
                    const tl = item.topLeft || [0, 0];
                    const bl = item.bottomLeft || [0, 0];
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
          const Tesseract = (await import('tesseract.js')).default;
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
          extractedData = extractDataFromText(result.data.text, language, currency?.code || 'USD');
          URL.revokeObjectURL(fileUrl);
        }
      } catch (ocrError) {
        console.error("OCR Failed Details:", ocrError);
        setError("Could not read text for some files, showing results anyway...");
      }

      const matchedItems = (extractedData.items || []).map(item => {
        const matchedName = findBestProductMatch(item.name, existingProductNames);
        // Always clean the matched name — guards against dirty legacy names from Firestore
        return { ...item, name: trTitleCase(cleanItemName(matchedName)) };
      });

      // 🤖 AI Enrichment: Use Gemini 2.5 Flash-Lite to detect brand, type, and size
      let enrichedItems = matchedItems;
      if (shouldAnalyzeWithLLM) {
        try {
          setStatusText(t('common.msg_ai_enriching'));
          enrichedItems = await enrichItemsWithGemini(matchedItems, '', language);
        } catch (aiError) {
          console.warn('AI enrichment failed, using raw OCR items:', aiError);
        }
      }

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
        items: enrichedItems,
        totalPrice: extractedData.total || 0,
        currency: extractedData.currency || currency?.code || 'USD'
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

  // 🔥 OCR Hata yaparsa Manuel Forma Aktarma
  const handleSendToManual = () => {
    const dataToPass = {
      fileName: verifyData.fileName || verifyData.originalFileName.split('.')[0],
      items: verifyData.items
    };
    setShowVerifyModal(false);
    navigate('/texts', { state: { scannedData: dataToPass } });
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
        name: item.name ? trTitleCase(cleanItemName(item.name)) : item.name,
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
        currency: verifyData.currency || currency?.code || 'USD',
        storeNameCleaned: cleanStoreName(verifyData.fileName)
      };

      const docRef = await addDoc(collection(db, "receipts"), newReceiptData);

      if (verifyData.tempImageUrl) {
        URL.revokeObjectURL(verifyData.tempImageUrl);
      }

      // Add to local receipts array so it shows up in real-time
      setAllReceipts(prev => [{ id: docRef.id, ...newReceiptData }, ...prev]);

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
    const success = await deleteReceipt(receiptId);
    if (!success) {
      alert(t('common.msg_delete_receipt_failed'));
    }
  };

  // MODAL
  const [isModalShowing, setIsModalShowing] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });



  const closeModal = () => {
    setIsModalShowing(false);
    setSelectedImage({ url: '', alt: '' });
  };



  return (
    <div className="receipts-page-wrapper p-4">
      <div
        className={isModalShowing || showVerifyModal ? 'content-blurred' : ''}
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

      <ImageModal
        isShowing={isModalShowing}
        onClose={closeModal}
        imageUrl={selectedImage.url}
        imageAlt={selectedImage.alt}
      />

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
      />

    </div>
  );
}

export default Receipts;