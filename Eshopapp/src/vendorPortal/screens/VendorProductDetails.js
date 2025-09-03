import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const VendorProductDetails = ({ route }) => {
  const { product } = route.params || {};
  if (!product) return null;
  return (
    <View style={styles.container}>
      <Image source={{ uri: product.image }} style={styles.image} />
      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.meta}>Price: ₹{product.price}</Text>
      <Text style={styles.meta}>Stock: {product.stock ?? '-'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  image: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#f4f4f4' },
  title: { fontWeight: '700', color: '#333', marginTop: 12, fontSize: 16 },
  meta: { color: '#666', marginTop: 6 },
});

export default VendorProductDetails;