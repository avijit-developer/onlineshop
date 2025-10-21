import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, ScrollView, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const currency = (n) => `₹${Number(n || 0).toFixed(2)}`;

const VendorProductDetails = ({ route, navigation }) => {
  const { productId, product: fallback } = route.params || {};
  const [product, setProduct] = useState(fallback || null);
  const [loading, setLoading] = useState(!fallback && !!productId);
  const [variantsVisible, setVariantsVisible] = useState(false);

  useEffect(() => {
    (async () => {
      if (!product && productId) {
        try {
          const vtok = await api.getVendorToken?.();
          const headers = vtok ? { Authorization: `Bearer ${vtok}` } : {};
          const res = await api.request(`/api/v1/products/${productId}`, { headers });
          const payload = (res && (res.data || res.product || (res.data && res.data.product))) || null;
          if (payload) setProduct(payload);
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
  const images = Array.isArray(product.images)
    ? product.images.map(i => (typeof i === 'string' ? i : (i?.url || i?.src || i)))
    : (product.image ? [product.image] : []);
  const primaryImage = images && images.length ? images[0] : null;
  // Remove price display per vendor UI change
  const [brandNameState, setBrandNameState] = useState(product.brand?.name || product.brandName || product.brand || '');
  const [categoryNameState, setCategoryNameState] = useState(
    Array.isArray(product.categories)
      ? product.categories.map(c => c?.name || c).filter(Boolean).join(' / ')
      : (product.category?.name || product.category || '')
  );
  const sku = product.sku || product.skuCode || product.code || product.itemCode || '-';
  const stock = product.stock ?? product.inventory?.stock ?? product.quantity ?? product.qty ?? '-';
  const attributes = product.attributes || product.specs || product.options || product.attributesMap;
  const barcode = product.barcode || product.ean || product.upc;
  const weight = (product.weight || product.netWeight) ? `${(product.weight || product.netWeight)}${product.weightUnit ? ' ' + product.weightUnit : ''}` : null;
  const dimensions = (product.length || product.width || product.height)
    ? `${product.length || '-'} x ${product.width || '-'} x ${product.height || '-'}`
    : null;
  const displayed = new Set([
    'name','images','image','price','regularPrice','specialPrice','listPrice','salePrice','discountPrice','offerPrice',
    'stock','inventory','quantity','qty','sku','skuCode','code','itemCode','brand','brandName','category','categories',
    'barcode','ean','upc','weight','netWeight','weightUnit','length','width','height','lowStockAlert','description','longDescription','details','content','desc'
  ]);
  const otherEntries = Object.entries(product).filter(([k, v]) => {
    const isScalar = ['string','number','boolean'].includes(typeof v);
    return isScalar && !displayed.has(k) && String(v).length > 0;
  });

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
        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {images.slice(1).map((img, idx) => (
              <Image key={idx} source={{ uri: img }} style={{ width: 64, height: 64, borderRadius: 6, backgroundColor: '#f4f4f4', marginRight: 8 }} />
            ))}
          </ScrollView>
        )}
        <Text style={styles.title}>{product.name}</Text>

        {/* Pricing removed for vendor view */}

        {/* Core info */}
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Stock</Text><Text style={styles.kvValue}>{stock}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>SKU</Text><Text style={styles.kvValue}>{sku}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Brand</Text><Text style={styles.kvValue}>{brandNameState || '-'}</Text></View>
        <View style={styles.kvRow}><Text style={styles.kvLabel}>Category</Text><Text style={styles.kvValue}>{categoryNameState || '-'}</Text></View>
        {barcode ? <View style={styles.kvRow}><Text style={styles.kvLabel}>Barcode</Text><Text style={styles.kvValue}>{barcode}</Text></View> : null}
        {weight ? <View style={styles.kvRow}><Text style={styles.kvLabel}>Weight</Text><Text style={styles.kvValue}>{weight}</Text></View> : null}
        {dimensions ? <View style={styles.kvRow}><Text style={styles.kvLabel}>Dimensions</Text><Text style={styles.kvValue}>{dimensions}</Text></View> : null}
        {product.lowStockAlert != null ? (
          <View style={styles.kvRow}><Text style={styles.kvLabel}>Low Stock Alert</Text><Text style={styles.kvValue}>{String(product.lowStockAlert)}</Text></View>
        ) : null}

        {/* Variants popup trigger */}
        {Array.isArray(product.variants) && product.variants.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <TouchableOpacity style={styles.variantBtn} onPress={() => setVariantsVisible(true)}>
              <Icon name="albums-outline" size={16} color="#f7ab18" />
              <Text style={styles.variantBtnText}>View Variants</Text>
            </TouchableOpacity>
          </View>
        )}

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
            <Text style={[styles.kvValue, { fontWeight: '500' }]}>{product.description || product.longDescription || product.details || product.content || product.desc}</Text>
          </View>
        ) : null}

        {otherEntries.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.kvLabel}>Additional Details</Text>
            {otherEntries.map(([k, v]) => (
              <View key={k} style={styles.kvRow}>
                <Text style={styles.kvLabel}>{formatKey(k)}</Text>
                <Text style={styles.kvValue}>{String(v)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {/* Variants Modal */}
      <Modal visible={variantsVisible} transparent animationType="fade" onRequestClose={() => setVariantsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Variants</Text>
              <TouchableOpacity onPress={() => setVariantsVisible(false)}>
                <Icon name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 12 }}>
              {Array.isArray(product.variants) && product.variants.map((v, idx) => {
                const attrs = v?.attributes && typeof v.attributes === 'object' ? (v.attributes.entries ? Object.fromEntries(v.attributes) : v.attributes) : {};
                const name = Object.keys(attrs).length ? Object.entries(attrs).map(([k,val]) => `${k}: ${val}`).join(' / ') : (v?.sku ? `SKU ${v.sku}` : `Variant ${idx+1}`);
                const sku = v?.sku || '-';
                const stock = v?.stock != null ? String(v.stock) : '-';
                const img = Array.isArray(v?.images) && v.images.length ? v.images[0] : null;
                return (
                  <View key={idx} style={styles.variantRow}>
                    {img ? <Image source={{ uri: img }} style={styles.variantThumb} /> : <View style={[styles.variantThumb, { backgroundColor: '#f4f4f4' }]} />}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.variantName} numberOfLines={1}>{name}</Text>
                      <Text style={styles.variantMeta}>SKU: {sku}</Text>
                      <Text style={styles.variantMeta}>Stock: {stock}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  variantBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  variantBtnText: { marginLeft: 6, color: '#f7ab18', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, overflow: 'hidden' },
  modalHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontWeight: '800', color: '#333' },
  variantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  variantThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#f0f0f0' },
  variantName: { color: '#333', fontWeight: '700' },
  variantMeta: { color: '#8791a1', fontSize: 12 },
});

function formatKey(s) {
  try {
    return String(s)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, m => m.toUpperCase());
  } catch { return String(s); }
}

export default VendorProductDetails;