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
  // Normalize fields
  const images = Array.isArray(product.images) ? product.images : (product.image ? [product.image] : []);
  const primaryImage = images[0];
  const regularPrice = product.regularPrice ?? product.price ?? 0;
  const specialPrice = product.specialPrice != null ? Number(product.specialPrice) : null;
  const brandName = product.brand?.name || product.brand || '-';
  const categoryName = Array.isArray(product.categories)
    ? product.categories.map(c => c?.name || c).filter(Boolean).join(' / ')
    : (product.category?.name || product.category || '-');
  const sku = product.sku || '-';
  const stock = product.stock ?? product.inventory?.stock ?? '-';
  const attributes = product.attributes;

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
        {!!primaryImage && <Image source={{ uri: primaryImage }} style={styles.image} />}
        <Text style={styles.title}>{product.name}</Text>

        {/* Pricing */}
        {specialPrice != null ? (
          <View style={styles.priceRow}>
            <Text style={[styles.priceSpecial]}>{currency(specialPrice)}</Text>
            <Text style={styles.priceRegular}>{currency(regularPrice)}</Text>
          </View>
        ) : (
          <View style={styles.kvRow}><Text style={styles.kvLabel}>Price</Text><Text style={styles.kvValue}>{currency(regularPrice)}</Text></View>
        )}

        {/* Core info */}
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Stock</Text><Text style={styles.kvValue}>{stock}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>SKU</Text><Text style={styles.kvValue}>{sku}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Brand</Text><Text style={styles.kvValue}>{brandName}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Category</Text><Text style={styles.kvValue}>{categoryName}</Text></View>

        {/* Attributes */}
        {attributes ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.kvLabel}>Attributes</Text>
            <View style={{ marginTop: 6 }}>
              {Array.isArray(attributes) ? (
                attributes.length > 0 ? attributes.map((a, idx) => (
                  <View key={idx} style={styles.attrRow}>
                    <Text style={styles.attrKey}>{a?.name || a?.key || '-'}</Text>
                    <Text style={styles.attrValue}>{Array.isArray(a?.value) ? a.value.join(', ') : (a?.value ?? '-')}</Text>
                  </View>
                )) : <Text style={styles.kvValue}>-</Text>
              ) : (typeof attributes === 'object' ? (
                Object.keys(attributes).map((k) => (
                  <View key={k} style={styles.attrRow}>
                    <Text style={styles.attrKey}>{k}</Text>
                    <Text style={styles.attrValue}>{String(attributes[k])}</Text>
                  </View>
                ))
              ) : null)}
            </View>
          </View>
        ) : null}

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
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  priceSpecial: { color: '#e53935', fontWeight: '800', fontSize: 16 },
  priceRegular: { color: '#8791a1', textDecorationLine: 'line-through', fontWeight: '600' },
  attrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  attrKey: { color: '#8791a1' },
  attrValue: { color: '#333', fontWeight: '600', maxWidth: '60%' },
});

export default VendorProductDetails;