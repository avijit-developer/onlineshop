import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const currency = (n) => `₹${Number(n || 0).toFixed(2)}`;

const VendorProductDetails = ({ route, navigation }) => {
  const { productId, product: fallback } = route.params || {};
  const [product, setProduct] = useState(fallback || null);
  const [loading, setLoading] = useState(!fallback && !!productId);

  useEffect(() => {
    (async () => {
      if (!product && productId) {
        try {
          const res = await api.request(`/api/v1/products/${productId}`, { headers: {} });
          if (res?.data) setProduct(res.data);
        } catch (_) {}
        finally { setLoading(false); }
      }
    })();
  }, [productId]);

  if (loading) return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator /></View>;
  if (!product) return (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 16 }]}> 
      <Text style={{ color: '#666' }}>Product not found</Text>
    </View>
  );
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Header with back */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack && navigation.goBack()}>
          <Icon name="arrow-back-outline" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.card}>
        <Image source={{ uri: product.image }} style={styles.image} />
        <Text style={styles.title}>{product.name}</Text>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Price</Text><Text style={styles.kvValue}>{currency(product.price)}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Stock</Text><Text style={styles.kvValue}>{product.stock ?? '-'}</Text></View>
        {product.sku ? <View style={styles.kvRow}><Text style={styles.kvLabel}>SKU</Text><Text style={styles.kvValue}>{product.sku}</Text></View> : null}
        {product.brand ? <View style={styles.kvRow}><Text style={styles.kvLabel}>Brand</Text><Text style={styles.kvValue}>{product.brand?.name || product.brand}</Text></View> : null}
        {product.category ? <View style={styles.kvRow}><Text style={styles.kvLabel}>Category</Text><Text style={styles.kvValue}>{product.category?.name || product.category}</Text></View> : null}
        {product.description ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.kvLabel}>Description</Text>
            <Text style={[styles.kvValue, { fontWeight: '500' }]}>{product.description}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 14 },
  image: { width: '100%', height: 220, borderRadius: 8, backgroundColor: '#f4f4f4' },
  title: { fontWeight: '800', color: '#333', marginTop: 12, fontSize: 16 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  kvLabel: { color: '#8791a1' },
  kvValue: { color: '#333', fontWeight: '700' },
});

export default VendorProductDetails;