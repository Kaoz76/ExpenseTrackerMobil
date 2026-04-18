import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export default function DashboardScreen() {
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'receipts'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let expenses = 0;
      const transactions = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        expenses += parseFloat(data.price || 0);
        transactions.push({ id: doc.id, ...data });
      });

      setTotalExpense(expenses);

      // Sort descending by createdAt to avoid needing a Firestore composite index
      transactions.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setRecentTransactions(transactions.slice(0, 5));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0d6efd" />
      </View>
    );
  }

  // Assuming income feature isn't fully implemented yet, showing 0
  const totalIncome = 0;
  const currentBalance = totalIncome - totalExpense;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {auth.currentUser?.email?.split('@')[0] || 'User'} 👋</Text>
        <Text style={styles.subtitle}>Here is your expense summary</Text>
      </View>

      <View style={styles.mainCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmount}>${currentBalance.toFixed(2)}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>
          <Ionicons name="arrow-down-circle" size={24} color="#2e7d32" />
          <Text style={styles.statLabel}>Income</Text>
          <Text style={[styles.statValue, { color: '#2e7d32' }]}>${totalIncome.toFixed(2)}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#ffebee' }]}>
          <Ionicons name="arrow-up-circle" size={24} color="#c62828" />
          <Text style={styles.statLabel}>Expense</Text>
          <Text style={[styles.statValue, { color: '#c62828' }]}>${totalExpense.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentTransactions.length === 0 ? (
          <Text style={{ color: '#6c757d', textAlign: 'center', marginTop: 20 }}>No recent expenses recorded.</Text>
        ) : (
          recentTransactions.map((tx) => (
            <View key={tx.id} style={styles.transactionItem}>
              <View style={styles.txIcon}>
                <Ionicons name={tx.isManual ? "cash" : "receipt"} size={20} color={tx.isManual ? "#0d6efd" : "#fd7e14"} />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txTitle}>{tx.title || tx.fileName || 'Expense'}</Text>
                <Text style={styles.txDate}>{tx.date || new Date().toLocaleDateString()}</Text>
              </View>
              <Text style={styles.txAmount}>-${parseFloat(tx.price || 0).toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, paddingTop: 40, backgroundColor: '#fff' },
  greeting: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#6c757d', marginTop: 4 },
  mainCard: { backgroundColor: '#0d6efd', margin: 20, padding: 24, borderRadius: 16, alignItems: 'center', shadowColor: '#0d6efd', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  balanceAmount: { color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between' },
  statCard: { flex: 1, padding: 16, borderRadius: 12, marginHorizontal: 5, alignItems: 'flex-start' },
  statLabel: { fontSize: 14, color: '#6c757d', marginTop: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  recentSection: { padding: 20, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  txIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f3f5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txDetails: { flex: 1 },
  txTitle: { fontSize: 16, fontWeight: 'bold' },
  txDate: { fontSize: 12, color: '#6c757d', marginTop: 4 },
  txAmount: { fontSize: 16, fontWeight: 'bold', color: '#dc3545' }
});
