// components/RelatedProducts.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import api from '../utils/api';

const RelatedProducts = ({ productId, onPressProduct }) => {
    const [items, setItems] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                if (!productId) return;
                const res = await api.getRelatedProductsPublic(productId);
                const mapped = (res?.data || []).map(p => ({
                    id: p._id || p.id,
                    title: p.name,
                    image: (Array.isArray(p.images) && p.images[0]) || '',
                    price: p.specialPrice ?? p.regularPrice ?? 0,
                    regularPrice: p.regularPrice ?? null,
                    specialPrice: p.specialPrice ?? null,
                    tags: Array.isArray(p.tags)
                      ? p.tags.map(v => (typeof v === 'string' ? v : (v && (v.name || v.label || v.title)))).filter(Boolean)
                      : (typeof p.tags === 'string' ? p.tags.split(',').map(s => s.trim()).filter(Boolean) : []),
                }));
                setItems(mapped);
            } catch (_) {
                setItems([]);
            }
        })();
    }, [productId]);

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => onPressProduct && onPressProduct(item)}>
            <Image source={{ uri: item.image }} style={styles.image} />
            {Array.isArray(item.tags) && item.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {item.tags.slice(0,2).map((t, idx) => (
                  <View key={`${t}-${idx}`} style={[styles.tagRibbon, idx > 0 && { marginTop: 4 }]}> 
                    <Text style={styles.tagRibbonText} numberOfLines={1}>{String(t)}</Text>
                  </View>
                ))}
              </View>
            )}
            {(() => {
              const rp = Number(item.regularPrice || 0);
              const sp = Number(item.specialPrice ?? (item.price ?? 0));
              const show = rp > 0 && sp > 0 && sp < rp;
              const pct = show ? Math.round(100 - (sp / rp) * 100) : 0;
              return show ? (
                <View style={styles.discountCornerContainer}><View style={styles.discountCorner}><Text style={styles.discountCornerText}>-{pct}%</Text></View></View>
              ) : null;
            })()}
            <Text style={styles.title} numberOfLines={2}>
                {item.title}
            </Text>
            {item.specialPrice != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.price, { color: '#e53935' }]}>₹{item.specialPrice}</Text>
                    <Text style={{ textDecorationLine: 'line-through', color: '#888' }}>₹{item.regularPrice}</Text>
                </View>
            ) : (
                <Text style={styles.price}>₹{item.price}</Text>
            )}
        </TouchableOpacity>
    );

    if (items.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>You Might Like</Text>
            <FlatList
                data={items}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                numColumns={2}
                columnWrapperStyle={styles.row}
                contentContainerStyle={{ paddingBottom: 40 }}
                scrollEnabled={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    row: {
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    card: {
        width: '48%',
        backgroundColor: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: 150,
        borderRadius: 10,
    },
    tagsContainer: { position: 'absolute', top: 8, left: 8 },
    tagRibbon: { backgroundColor: '#2e7d32', paddingVertical: 2, paddingHorizontal: 6, borderTopRightRadius: 6, borderBottomRightRadius: 6, maxWidth: 100 },
    tagRibbonText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    discountCornerContainer: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
    discountCorner: { backgroundColor: '#e53935', paddingVertical: 2, paddingHorizontal: 18, transform: [{ rotate: '45deg' }], borderRadius: 2, elevation: 3 },
    discountCornerText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    title: {
        fontSize: 13,
        marginTop: 6,
        color: '#333',
    },
    price: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 4,
        color: '#FFA726',
    },
});

export default RelatedProducts;
