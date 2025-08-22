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
