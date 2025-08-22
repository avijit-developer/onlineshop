import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Modal } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import RelatedProducts from '../components/RelatedProducts';
import { useNavigation, useRoute } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { useCart } from '../contexts/CartContext';
import ViewCartFooter from '../components/ViewCartFooter';
import api from '../utils/api';

export default function ProductDetailsScreen() {
    const navigation  = useNavigation();
    const route = useRoute();
    const { productId } = route.params || {};

    const { addToCart } = useCart();

    const [product, setProduct] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [showAddAnimation, setShowAddAnimation] = useState(false);

    // Variant handling
    const [attributeOptions, setAttributeOptions] = useState({}); // { Color: ['Red','Blue'], Size: ['M','L'] }
    const [selectedAttributes, setSelectedAttributes] = useState({});

    useEffect(() => {
        (async () => {
            if (!productId) return;
            try {
                const res = await api.getProductPublic(productId);
                if (res?.success) {
                    const p = res.data;
                    setProduct(p);
                    // Build attribute options if configurable
                    if (p.productType === 'configurable' && Array.isArray(p.variants)) {
                        const opts = {};
                        for (const v of p.variants) {
                            const attrs = v.attributes || {};
                            Object.keys(attrs).forEach(key => {
                                opts[key] = opts[key] || [];
                                if (!opts[key].includes(attrs[key])) opts[key].push(attrs[key]);
                            });
                        }
                        setAttributeOptions(opts);
                        // Preselect first available options
                        const defaults = {};
                        Object.keys(opts).forEach(key => { defaults[key] = opts[key][0]; });
                        setSelectedAttributes(defaults);
                    } else {
                        setAttributeOptions({});
                        setSelectedAttributes({});
                    }
                }
            } catch (_) {
                // ignore
            }
        })();
    }, [productId]);

    const findMatchingVariant = () => {
        if (!product || product.productType !== 'configurable') return null;
        const attrs = selectedAttributes || {};
        const match = (product.variants || []).find(v => {
            const vattrs = v.attributes || {};
            return Object.keys(attributeOptions).every(k => String(vattrs[k]) === String(attrs[k]));
        });
        return match || null;
    };

    const currentImages = () => {
        return Array.isArray(product?.images) && product.images.length > 0 ? product.images : [];
    };

    const currentPriceBlock = () => {
        let regular = product?.regularPrice ?? null;
        let special = product?.specialPrice ?? null;
        if (product?.productType === 'configurable') {
            const v = findMatchingVariant();
            if (v) {
                regular = v.price ?? regular;
                special = v.specialPrice ?? special;
            }
        }
        return { regular, special };
    };

    const handleSelectAttribute = (name, value) => {
        setSelectedAttributes(prev => ({ ...prev, [name]: value }));
    };

    const handleAddToCart = () => {
        if (!product) return;
        const { regular, special } = currentPriceBlock();
        const cartItem = {
            id: productId,
            name: product.name,
            image: currentImages()[0] || '',
            price: `₹${special ?? regular ?? 0}`,
        };
        // Pass variant info if configurable
        if (product.productType === 'configurable') {
            cartItem.selectedAttributes = selectedAttributes;
        }
        addToCart(cartItem, quantity);
        setShowAddAnimation(true);
        setTimeout(() => setShowAddAnimation(false), 1500);
    };

    const { regular, special } = currentPriceBlock();

    return (
        <>
            <ScrollView style={styles.container}>
                {/* Header */}
                <TouchableOpacity style={styles.header} onPress={()=>navigation.goBack()}>
                    <AntDesign name="arrowleft" size={24} color="black" />
                    <Text style={styles.headerText}>Product Details</Text>
                </TouchableOpacity>

                {/* Product Image */}
                {currentImages()[activeImageIndex] && (
                    <Image source={{ uri: currentImages()[activeImageIndex] }} style={styles.mainImage} resizeMode="cover" />
                )}

                {/* Image Thumbnails */}
                <View style={styles.thumbnailContainer}>
                    {currentImages().map((img, index) => (
                        <TouchableOpacity key={index} onPress={() => setActiveImageIndex(index)}>
                            <Image source={{ uri: img }} style={[styles.thumbnail, activeImageIndex === index && styles.activeThumb]} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Title */}
                <Text style={styles.title}>{product?.name || ''}</Text>

                {/* Price */}
                <View style={styles.priceContainer}>
                    {special != null ? (
                        <>
                            <Text style={styles.specialPrice}>₹{special}</Text>
                            {regular != null && (
                                <Text style={styles.originalPrice}>₹{regular}</Text>
                            )}
                            {regular != null && special < regular && (
                                <Text style={styles.discount}>
                                    ({Math.round(((regular - special) / regular) * 100)}% OFF)
                                </Text>
                            )}
                        </>
                    ) : (
                        regular != null && <Text style={styles.specialPrice}>₹{regular}</Text>
                    )}
                </View>

                <Text style={styles.description}>{product?.description || ''}</Text>

                {/* Variants */}
                {product?.productType === 'configurable' && Object.keys(attributeOptions).length > 0 && (
                    <View style={styles.variantsSection}>
                        {Object.keys(attributeOptions).map(attrName => (
                            <View key={attrName} style={{ marginBottom: 10 }}>
                                <Text style={styles.sectionTitle}>{attrName}</Text>
                                <View style={styles.sizeRow}>
                                    {attributeOptions[attrName].map(val => (
                                        <TouchableOpacity
                                            key={val}
                                            style={[
                                                styles.sizeButton,
                                                selectedAttributes[attrName] === val && styles.sizeSelected,
                                            ]}
                                            onPress={() => handleSelectAttribute(attrName, val)}
                                        >
                                            <Text style={styles.sizeText}>{val}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))}
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
                )}

                {/* Related Products */}
                {productId && (
                    <RelatedProducts 
                        productId={productId}
                        onPressProduct={(p) => {
                            navigation.push('ProductDetails', { productId: p.id });
                        }}
                    />
                )}
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
});
