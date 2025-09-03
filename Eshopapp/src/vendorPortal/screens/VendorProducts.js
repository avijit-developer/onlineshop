import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorProducts = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getVendorProducts({ page: 1, limit: 100 });
        if (res?.success) {
          const items = (res.data || []).map(p => ({
            id: p._id || p.id,
            name: p.name,
            price: p.specialPrice ?? p.regularPrice ?? p.price ?? 0,
            oldPrice: p.specialPrice != null ? (p.regularPrice ?? p.price ?? null) : null,
            image: Array.isArray(p.images) ? p.images[0] : p.image,
            stock: p.stock ?? p.inventory?.stock ?? p.quantity ?? p.qty,
            raw: p,
          }));
          setProducts(items);
        }
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('VendorProductDetails', { productId: item.id, product: item.raw || item })}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.price}>₹{item.price}</Text>
        <Text style={styles.meta}>Stock: {item.stock ?? '-'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Products</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  title: { fontSize: 16, fontWeight: '600', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, marginBottom: 12 },
  image: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#f4f4f4' },
  name: { color: '#333', fontWeight: '700' },
  price: { color: '#f7ab18', fontWeight: '700', marginTop: 4 },
  meta: { color: '#8791a1', marginTop: 2 },
});

export default VendorProducts;