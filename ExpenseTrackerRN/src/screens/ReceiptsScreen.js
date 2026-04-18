import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { auth, db } from '../config/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  // Modal states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const [verifiedPrice, setVerifiedPrice] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "receipts"),
      where("userId", "==", auth.currentUser.uid),
      where("isManual", "==", false),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      let data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setReceipts(data);
      setLoadingList(false);
    });
    return () => unsubscribe();
  }, []);

  const extractDataFromText = (text) => {
    if (!text) return { total: 0, items: [] };
    const normalizedText = text.replace(/\r/g, '\n').toLowerCase();
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const keywordRegex = /(toplam|topla|total|tutar|amount|odenecek|grand|bakiye|genel|sum|nakit|kredi|k\.karti|kart)/i;
    const excludeRegex = /(kdv|vat|tax|indirim|iskonto|para ustu|para üstü|change|kg x|vakif|ziraat|garanti|is bank|iş bank|yapi kredi|yapı kredi|mastercard|visa|maestro)/i;
    const priceRegex = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;
    let possibleTotals = [];
    let extractedItems = [];

    const cleanAndParseNumber = (valStr) => {
      let cleanStr = valStr.replace(/[^0-9.,]/g, '');
      if (cleanStr.includes(',') && cleanStr.includes('.')) cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      else if (cleanStr.includes(',')) cleanStr = cleanStr.replace(',', '.');
      const num = parseFloat(cleanStr);
      return (!isNaN(num) && num > 0 && num < 50000) ? num : null;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (keywordRegex.test(line) && !excludeRegex.test(line)) {
            let matches = line.match(priceRegex);
            if (matches) matches.forEach(m => { const parsed = cleanAndParseNumber(m); if (parsed) possibleTotals.push(parsed); });
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (!excludeRegex.test(nextLine)) {
                    let nextLineMatches = nextLine.match(priceRegex);
                    if (nextLineMatches) nextLineMatches.forEach(m => { const parsed = cleanAndParseNumber(m); if (parsed) possibleTotals.push(parsed); });
                }
            }
        } else if (!keywordRegex.test(line) && !excludeRegex.test(line)) {
            let matches = line.match(priceRegex);
            if (matches && matches.length > 0) {
                const lastMatch = matches[matches.length - 1];
                const parsedPrice = cleanAndParseNumber(lastMatch);
                if (parsedPrice) {
                    let namePart = line.substring(0, line.lastIndexOf(lastMatch)).replace(/[*_]/g, '').trim();
                    if (namePart.length > 2 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(namePart)) {
                        let formattedName = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        extractedItems.push({ name: formattedName, price: parsedPrice });
                    }
                }
            }
        }
    }

    let finalTotal = 0;
    if (possibleTotals.length > 0) finalTotal = Math.max(...possibleTotals);
    else {
        const allMatches = normalizedText.match(priceRegex);
        if (allMatches) {
            const allNumbers = allMatches.map(cleanAndParseNumber).filter(num => num !== null && num < 10000);
            if (allNumbers.length > 0) finalTotal = Math.max(...allNumbers);
        }
    }
    return { total: finalTotal, items: extractedItems };
  };

  const processImage = async (uri) => {
    if (!auth.currentUser) { Alert.alert("Error", "You must be logged in."); return; }
    try {
      setIsProcessing(true);
      setStatusText('Reading text via ML Kit...');

      // 1. ML Kit Text Recognition
      const result = await TextRecognition.recognize(uri);
      
      let fullText = "";
      if (result && result.blocks && result.blocks.length > 0) {
        
        let lineGroups = [];
        
        // ML Kit blocks provide actual frames {top, left, width, height}
        result.blocks.forEach(block => {
            let top = block.frame.top;
            let height = block.frame.height;
            let bottom = top + height;
            
            let added = false;
            // Line Grouping / Overlap Algorithm
            for (let group of lineGroups) {
                let overlapTop = Math.max(group.top, top);
                let overlapBottom = Math.min(group.bottom, bottom);
                let overlapHeight = overlapBottom - overlapTop;
                
                // If overlap height is greater than 30% of the minimum height, it's the same line
                if (overlapHeight > Math.min(height, group.height) * 0.3) {
                    group.items.push(block);
                    added = true;
                    break;
                }
            }
            if (!added) {
                lineGroups.push({ top: top, bottom: bottom, height: height, items: [block] });
            }
        });

        // Top-to-Bottom Sort
        lineGroups.sort((a, b) => a.top - b.top);
        
        // Left-to-Right Sort & Join
        fullText = lineGroups.map(group => {
            group.items.sort((a, b) => a.frame.left - b.frame.left);
            return group.items.map(i => i.text).join('   ');
        }).join('\n');

      }

      setStatusText('Extracting prices...');
      console.log("OCR TEXT: \n", fullText);
      
      const extractedData = extractDataFromText(fullText);

      // Verify Modal Phase
      setIsProcessing(false);
      setVerifyData({
          userId: auth.currentUser.uid,
          imageUrl: null, 
          fileName: "Scanned Receipt",
          title: "Scanned Receipt",
          date: new Date().toLocaleDateString(),
          createdAt: new Date(),
          isManual: false,
          items: extractedData.items
      });
      setVerifiedPrice(extractedData.total.toString());
      setShowVerifyModal(true);

    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      Alert.alert("OCR Error", "Could not process image properly. " + err.message);
    }
  };

  const pickImage = async (useCamera = false) => {
    let result;
    if (useCamera) {
      const perms = await ImagePicker.requestCameraPermissionsAsync();
      if (!perms.granted) { Alert.alert("Error", "Camera permission needed."); return; }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    } else {
      const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perms.granted) { Alert.alert("Error", "Library permission needed."); return; }
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    }

    if (!result.canceled && result.assets[0].uri) {
        processImage(result.assets[0].uri);
    }
  };

  const deleteReceipt = async (id) => {
    Alert.alert("Delete", "Are you sure you want to delete this receipt?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "receipts", id));
      }}
    ]);
  };

  const handleSave = async () => {
    if (!verifyData) return;
    try {
      await addDoc(collection(db, "receipts"), {
        ...verifyData,
        price: parseFloat(verifiedPrice) || 0
      });
      setShowVerifyModal(false);
    } catch(e) {
      Alert.alert("Error", "Could not save receipt.");
    }
  };

  const renderReceiptItem = ({item}) => (
    <View style={styles.receiptItem}>
        <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="receipt-outline" size={24} color="#6c757d" />
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.fileName}</Text>
            <Text style={{ color: '#6c757d', fontSize: 12, marginTop: 4 }}>
                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : item.date}
            </Text>
        </View>
        <Text style={{ fontWeight: 'bold', color: '#0d6efd', fontSize: 16 }}>${item.price?.toFixed(2) || '0.00'}</Text>
        <TouchableOpacity onPress={() => deleteReceipt(item.id)} style={{ padding: 8, marginLeft: 8 }}>
            <Ionicons name="trash-outline" size={20} color="#dc3545" />
        </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.uploadSection}>
        <Text style={styles.title}>Scan New Receipt</Text>
        <Text style={styles.subtitle}>Upload an image or take a photo to auto-detect Total Price via Local ML Kit.</Text>
        
        {isProcessing ? (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#0d6efd" />
            <Text style={styles.processingText}>{statusText}</Text>
          </View>
        ) : (
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.btnCamera} onPress={() => pickImage(true)}>
                <Ionicons name="camera" size={32} color="white" />
                <Text style={styles.btnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGallery} onPress={() => pickImage(false)}>
                <Ionicons name="images" size={32} color="#0d6efd" />
                <Text style={[styles.btnText, { color: '#0d6efd' }]}>Upload Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* RECEIPT LIST */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Scanned Receipts</Text>
        {loadingList ? (
            <ActivityIndicator style={{marginTop:20}} />
        ) : (
            <FlatList
                data={receipts}
                keyExtractor={item => item.id}
                renderItem={renderReceiptItem}
                ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: 'gray'}}>No scanned receipts found.</Text>}
            />
        )}
      </View>

      {/* VERIFY MODAL */}
      <Modal visible={showVerifyModal} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Verify Receipt</Text>
                      <TouchableOpacity onPress={() => setShowVerifyModal(false)}>
                          <Ionicons name="close" size={24} color="#000" />
                      </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSubtitle}>OCR detected the following total price. Please verify.</Text>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>Total Price ($)</Text>
                      <TextInput 
                          style={styles.modalInput} 
                          value={verifiedPrice} 
                          onChangeText={setVerifiedPrice} 
                          keyboardType="decimal-pad"
                      />
                  </View>

                  <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Parsed Items ({verifyData?.items?.length || 0})</Text>
                      <ScrollView style={styles.itemsScroll}>
                          {verifyData?.items?.map((item, idx) => (
                              <View key={idx} style={styles.parsedItemRow}>
                                  <Text style={{ flex:1, color: '#495057' }}>{item.name}</Text>
                                  <Text style={{ fontWeight: 'bold' }}>${item.price}</Text>
                              </View>
                          ))}
                      </ScrollView>
                  </View>

                  <TouchableOpacity style={styles.saveModalBtn} onPress={handleSave}>
                      <Text style={styles.saveModalBtnText}>Confirm & Save</Text>
                  </TouchableOpacity>

              </View>
          </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  uploadSection: { padding: 20, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  title: { fontSize: 26, fontWeight: 'bold', paddingTop: 20 },
  subtitle: { color: '#6c757d', marginBottom: 20, marginTop: 4 },
  
  processingBox: { alignItems: 'center', padding: 30, backgroundColor: '#f1f3f5', borderRadius: 16 },
  processingText: { marginTop: 10, fontWeight: 'bold', color: '#0d6efd' },

  buttonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btnCamera: { flex: 0.48, backgroundColor: '#0d6efd', padding: 20, borderRadius: 16, alignItems: 'center' },
  btnGallery: { flex: 0.48, backgroundColor: '#e9ecef', padding: 20, borderRadius: 16, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', marginTop: 8 },

  listSection: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  
  receiptItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  thumbnailPlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#e9ecef', justifyContent: 'center', alignItems: 'center' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  modalSubtitle: { color: '#6c757d', marginBottom: 20 },
  
  inputGroup: { marginBottom: 20 },
  label: { fontWeight: 'bold', marginBottom: 8, color: '#495057' },
  modalInput: { backgroundColor: '#f1f3f5', padding: 16, borderRadius: 12, fontSize: 20, fontWeight: 'bold' },
  
  itemsScroll: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 12, marginBottom: 20 },
  parsedItemRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e9ecef', paddingVertical: 10 },
  
  saveModalBtn: { backgroundColor: '#198754', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveModalBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
