import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Modal } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import RelatedProducts from '../components/RelatedProducts';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { useCart } from '../contexts/CartContext';
import ViewCartFooter from '../components/ViewCartFooter';

const mockProduct = {
    title: 'Arla DANO Full Cream Milk Powder Instant',
    description:
        'Et quidem faciunt, ut summum bonum sit extremum et rationibus conquisitis de voluptate. Sed ut summum bonum sit id,',
    images: [
        { uri: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_101_mdvn5x.png' },
        { uri: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_101_mdvn5x.png' },
        { uri: 'https://res.cloudinary.com/dwjcuweew/image/upload/v1754410273/Placeholder_101_mdvn5x.png' },
    ],
    colorimages: [
            'https://example.com/images/dano1.png',
            'https://example.com/images/dano2.png',
            'https://example.com/images/dano3.png',
        ],
    specialPrice: 499,
    originalPrice: 599,
    colors: ['#f5a623', '#4a90e2', '#50e3c2'],
    sizes: ['S', 'M', 'L', 'XL'],
};

export default function ProductDetailsScreen() {
    const [selectedColor, setSelectedColor] = React.useState(0);
    const [selectedSize, setSelectedSize] = React.useState('M');
    const [disabledSizes] = React.useState(['XXL', 'XXXL']);
    const [quantity, setQuantity] = React.useState(1);
          const navigation  = useNavigation();
    const { addToCart } = useCart();

    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [showAddAnimation, setShowAddAnimation] = useState(false);

    const handleAddToCart = () => {
        const product = {
            id: 'demo-1',
            name: mockProduct.title,
            image: mockProduct.images[0].uri,
            price: `₹${mockProduct.specialPrice}`,
            selectedSize,
            selectedColor: selectedColor.toString(),
        };
        addToCart(product, quantity, selectedSize, selectedColor.toString());
        setShowAddAnimation(true);
        setTimeout(() => setShowAddAnimation(false), 1500);
    };

    return (
        <>
            <ScrollView style={styles.container}>
                {/* Header */}
                <TouchableOpacity style={styles.header} onPress={()=>navigation.goBack()}>
                    <AntDesign name="arrowleft" size={24} color="black" />
                    <Text style={styles.headerText}>Product Details</Text>
                </TouchableOpacity>

                {/* Product Image */}
                <Image source={mockProduct.images[1]} style={styles.mainImage} resizeMode="cover" />

                {/* Image Thumbnails */}
                <View style={styles.thumbnailContainer}>
                    {mockProduct.images.map((img, index) => (
                        <TouchableOpacity key={index} onPress={() => setActiveImageIndex(index)}>
                            <Image source={img} style={[styles.thumbnail, activeImageIndex === index && styles.activeThumb]} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Title */}
                <Text style={styles.title}>{mockProduct.title}</Text>

                {/* Price */}
                <View style={styles.priceContainer}>
                    <Text style={styles.specialPrice}>₹{mockProduct.specialPrice}</Text>
                    <Text style={styles.originalPrice}>₹{mockProduct.originalPrice}</Text>
                    <Text style={styles.discount}>
                        ({Math.round(((mockProduct.originalPrice - mockProduct.specialPrice) / mockProduct.originalPrice) * 100)}% OFF)
                    </Text>
                </View>

                <Text style={styles.description}>{mockProduct.description}</Text>


                {/* Variants */}
                <View style={styles.variantsSection}>
                    <Text style={styles.sectionTitle}>Color Options</Text>
                    <View style={styles.colorOptions}>
                        {mockProduct.colorimages.map((img, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.colorThumb,
                                selectedColor === idx && styles.colorSelected,
                            ]}
                            onPress={() => setSelectedColor(idx)}
                        >
                            <Image source={{ uri: img }} style={styles.colorImage} />
                        </TouchableOpacity>
                    ))}
                    </View>

                    <Text style={styles.sectionTitle}>Size</Text>
                    <View style={styles.sizeRow}>
                        {['S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((size) => (
                            <TouchableOpacity
                                key={size}
                                style={[
                                    styles.sizeButton,
                                    selectedSize === size && styles.sizeSelected,
                                    disabledSizes.includes(size) && styles.sizeDisabled,
                                ]}
                                disabled={disabledSizes.includes(size)}
                                onPress={() => setSelectedSize(size)}
                            >
                                <Text
                                    style={[
                                        styles.sizeText,
                                        disabledSizes.includes(size) && { color: '#aaa' },
                                    ]}
                                >
                                    {size}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.quantityWrapper}>
                        <Text style={styles.sectionTitle}>Quantity</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={styles.qtyCircleBtn}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                            >
                                <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <View style={styles.qtyBox}>
                                <Text style={styles.qtyNumber}>{quantity}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.qtyCircleBtn}
                                onPress={() => setQuantity(quantity + 1)}
                            >
                                <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
                <RelatedProducts 
                  productId={currentProductId}
                  onPressProduct={(p) => {
                    // Navigate to details for selected related product
                    // navigation.navigate('ProductDetails', { productId: p.id });
                  }}
                />
            </ScrollView>


            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.heartButton}>
                    <Text style={styles.heartIcon}>♡</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
                    <Text style={styles.addToCartText}>Add to Cart</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.buyNowButton}>
                    <Text style={styles.buyNowText}>Buy Now</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={showAddAnimation} transparent animationType="fade" onRequestClose={() => setShowAddAnimation(false)}>
                <View style={styles.successOverlay}>
                    <View style={styles.successCard}>
                        <LottieView
                            source={{ uri: 'https://assets10.lottiefiles.com/packages/lf20_jbrw3hcz.json' }}
                            autoPlay
                            loop={false}
                            style={{ width: 140, height: 140 }}
                        />
                        <Text style={styles.successText}>Added to cart</Text>
                    </View>
                </View>
            </Modal>
            <ViewCartFooter />
        </>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    headerText: { fontSize: 18, fontWeight: '600', marginLeft: 12 },

    mainImage: { width: '100%', height: 300, borderRadius: 12 },
    thumbnailContainer: { flexDirection: 'row', marginTop: 10 },
    thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#eee' },
    activeThumb: { borderColor: '#1976d2', borderWidth: 2 },

    title: { fontSize: 18, fontWeight: '600', marginVertical: 10 },
    priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    specialPrice: { fontSize: 20, fontWeight: '700', color: '#e53935' },
    originalPrice: { fontSize: 16, color: '#888', textDecorationLine: 'line-through' },
    discount: { fontSize: 14, color: '#43a047' },

    variantSection: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 10,
        marginTop: 20,
    },
    colorOptions: {
        flexDirection: 'row',
        gap: 10,
    },
    colorThumb: {
        width: 50,
        height: 50,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorSelected: {
        borderColor: '#2196F3',
    },
    colorImage: {
        width: '100%',
        height: '100%',
        borderRadius: 6,
    },
    sizeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    sizeButton: {
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    sizeSelected: {
        backgroundColor: '#2196F3',
        borderColor: '#2196F3',
    },
    sizeDisabled: {
        backgroundColor: '#eee',
        borderColor: '#eee',
    },
    sizeText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#000',
    },
    quantityWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    quantityControls: {
        right: 25,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    qtyCircleBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2196F3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyBtnText: {
        fontSize: 20,
        color: '#2196F3',
        fontWeight: '600',
    },
    qtyBox: {
        width: 40,
        height: 40,
        borderWidth: 1,
        borderColor: '#2196F3',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    relatedTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 10,
        paddingHorizontal: 16,
    },
    relatedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#f9f9f9',
        marginBottom: 8,
        borderRadius: 10,
        marginHorizontal: 16,
    },
    relatedImage: {
        width: 70,
        height: 90,
        marginRight: 10,
        borderRadius: 6,
    },
    relatedName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    oldPrice: {
        textDecorationLine: 'line-through',
        color: '#888',
        fontSize: 14,
    },
    newPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F57C00',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 20,
        marginTop: 10,
    },
    iconBtn: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 50,
        padding: 10,
    },

    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    heartButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
    },
    heartIcon: {
        fontSize: 20,
        color: '#333',
    },
    addToCartButton: {
        flex: 1,
        height: 44,
        backgroundColor: '#000',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
    },
    addToCartText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    buyNowButton: {
        flex: 1,
        height: 44,
        backgroundColor: '#007bff',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
    },
    buyNowText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
    },
    specialPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F57C00',
    },
    originalPrice: {
        fontSize: 16,
        textDecorationLine: 'line-through',
        color: '#888',
    },

    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCard: {
        width: 220,
        paddingVertical: 20,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        alignItems: 'center',
    },
    successText: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
    },

});
