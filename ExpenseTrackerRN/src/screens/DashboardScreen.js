import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, User 👋</Text>
        <Text style={styles.subtitle}>Here is your expense summary</Text>
      </View>

      <View style={styles.mainCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmount}>$4,821.50</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#e8f5e9' }]}>  
          <Ionicons name="arrow-down-circle" size={24} color="#2e7d32" />
          <Text style={styles.statLabel}>Income</Text>
          <Text style={[styles.statValue, { color: '#2e7d32' }]}>$6,500.00</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#ffebee' }]}>
          <Ionicons name="arrow-up-circle" size={24} color="#c62828" />
          <Text style={styles.statLabel}>Expense</Text>
          <Text style={[styles.statValue, { color: '#c62828' }]}>$1,678.50</Text>
        </View>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.transactionItem}>
          <View style={styles.txIcon}><Ionicons name="cart" size={20} color="#0d6efd" /></View>
          <View style={styles.txDetails}>
            <Text style={styles.txTitle}>Migros Supermarket</Text>
            <Text style={styles.txDate}>Today, 14:32</Text>
          </View>
          <Text style={styles.txAmount}>-$125.50</Text>
        </View>
        <View style={styles.transactionItem}>
          <View style={styles.txIcon}><Ionicons name="cafe" size={20} color="#fd7e14" /></View>
          <View style={styles.txDetails}>
            <Text style={styles.txTitle}>Starbucks Coffee</Text>
            <Text style={styles.txDate}>Yesterday</Text>
          </View>
          <Text style={styles.txAmount}>-$12.00</Text>
        </View>
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
