import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReceiptsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scan Receipt</Text>
      <Text style={styles.subtitle}>OCR Camera will be integrated here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#6c757d' }
});
