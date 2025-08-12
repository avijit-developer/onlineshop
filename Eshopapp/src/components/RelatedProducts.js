// components/RelatedProducts.js
import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';

const mockRelatedProducts = [
    {
        id: 1,
        title: 'Lorem ipsum dolor sit amet consectetur',
        image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410395/Placeholder_01_1_y1m8t0.png',
        price: 17.0,
    },
    {
        id: 2,
        title: 'Lorem ipsum dolor sit amet consectetur',
        image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_101_mdvn5x.png',
        price: 17.0,
    },
    {
        id: 3,
        title: 'Lorem ipsum dolor sit amet consectetur',
        image: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/A70864C8-1B1F-4014-84A4-450CD75C9CEF_vedkuw.png',
        price: 17.0,
    },
    {
        id: 4,
        title: 'Lorem ipsum dolor sit amet consectetur',
        image: 'https://example.com/image4.jpg',
        price: 17.0,
    },
    {
        id: 5,
        title: 'Lorem ipsum dolor sit amet consectetur',
        image: 'https://example.com/image5.jpg',
        price: 17.0,
    },
    {
        id: 6,
        title: 'Lorem ipsum dolor sit amet consectetur',
        image: 'https://example.com/image6.jpg',
        price: 17.0,
    },
];

const RelatedProducts = () => {
    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <Text style={styles.title} numberOfLines={2}>
                {item.title}
            </Text>
            <Text style={styles.price}>₹{item.price.toFixed(2)}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>You Might Like</Text>
            <FlatList
                data={mockRelatedProducts}
                keyExtractor={(item) => item.id.toString()}
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
