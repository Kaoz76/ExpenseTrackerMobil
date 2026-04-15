import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function ManualEntryScreen() {
  const [marketName, setMarketName] = useState('');
  const [products, setProducts] = useState([{ id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
  const [loading, setLoading] = useState(false);
  
  const addProductRow = () => {
    setProducts([...products, { id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
  };

  const removeProductRow = (id) => {
    if (products.length === 1) return;
    setProducts(products.filter(p => p.id !== id));
  };

  const handleInputChange = (id, field, value) => {
    setProducts(products.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    
    if (!marketName.trim()) {
      Alert.alert('Error', 'Please enter a Market Name.');
      return;
    }

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (!p.type.trim() || !p.brand.trim() || !p.price.trim()) {
          Alert.alert('Error', `Please fill Type, Brand, and Price for Row ${i + 1}`);
          return;
        }
    }

    setLoading(true);
    try {
      const totalAmount = products.reduce((acc, curr) => acc + parseFloat(curr.price || 0), 0);
      
      await addDoc(collection(db, "receipts"), {
        userId: auth.currentUser.uid,
        fileName: marketName,
        title: marketName,
        imageUrl: null,
        isManual: true,
        date: new Date().toLocaleDateString(),
        createdAt: new Date(),
        price: totalAmount,
        items: products
      });

      Alert.alert('Success', 'Expense saved successfully!');
      setMarketName('');
      setProducts([{ id: Date.now(), type: '', brand: '', name: '', size: '', price: '' }]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        <Text style={styles.title}>Manual Entry</Text>
        <Text style={styles.subtitle}>Log expenses without a receipt</Text>

        <View style={styles.card}>
            <Text style={styles.label}>Market / Store Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Migros, Starbucks"
              value={marketName}
              onChangeText={setMarketName}
            />
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        
        {products.map((product, index) => (
          <View key={product.id} style={styles.itemCard}>
            <View style={styles.rowHeader}>
                <Text style={styles.itemIndex}>Item #{index + 1}</Text>
                {products.length > 1 && (
                    <TouchableOpacity onPress={() => removeProductRow(product.id)}>
                        <Ionicons name="trash-outline" size={20} color="#dc3545" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Type *</Text>
                    <TextInput style={styles.input} placeholder="Food" value={product.type} onChangeText={v => handleInputChange(product.id, 'type', v)} />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Brand *</Text>
                    <TextInput style={styles.input} placeholder="Nestle" value={product.brand} onChangeText={v => handleInputChange(product.id, 'brand', v)} />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Name (Optional)</Text>
                    <TextInput style={styles.input} placeholder="Coffee" value={product.name} onChangeText={v => handleInputChange(product.id, 'name', v)} />
                </View>
            </View>

            <View style={styles.row}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Size (Optional)</Text>
                    <TextInput style={styles.input} placeholder="1 L" value={product.size} onChangeText={v => handleInputChange(product.id, 'size', v)} />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Price *</Text>
                    <TextInput style={styles.input} placeholder="0.00" keyboardType="decimal-pad" value={product.price} onChangeText={v => handleInputChange(product.id, 'price', v)} />
                </View>
            </View>

          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addProductRow} disabled={loading}>
            <Ionicons name="add" size={20} color="#0d6efd" />
            <Text style={styles.addBtnText}>Add Another Item</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Expense</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  title: { fontSize: 26, fontWeight: 'bold', paddingTop: 20 },
  subtitle: { color: '#6c757d', marginBottom: 20 },
  
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  
  itemCard: {
      backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, 
      borderLeftWidth: 4, borderLeftColor: '#0d6efd',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  itemIndex: { fontWeight: 'bold', color: '#6c757d' },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  inputGroup: { flex: 0.48 },
  label: { fontSize: 13, color: '#495057', marginBottom: 6, fontWeight: '500' },
  input: { backgroundColor: '#f1f3f5', padding: 12, borderRadius: 8, fontSize: 15 },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#e9ecef', borderRadius: 8, marginBottom: 20 },
  addBtnText: { color: '#0d6efd', fontWeight: 'bold', marginLeft: 8 },

  saveBtn: { backgroundColor: '#198754', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 40 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
