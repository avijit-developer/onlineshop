import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Modal, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import AntDesign from 'react-native-vector-icons/AntDesign';
import RelatedProducts from '../components/RelatedProducts';
import ProductSpecifications from '../components/ProductSpecifications';
import ProductReviews from '../components/ProductReviews';
import { useNavigation, useRoute } from '@react-navigation/native';
import ViewCartFooter from '../components/ViewCartFooter';
import LottieView from 'lottie-react-native';
import { useCart } from '../contexts/CartContext';
import { useWishlist } from '../contexts/WishlistContext';
import api from '../utils/api';

export default function ProductDetailsScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { productId, product: productData } = route.params || {};

    const { addToCart } = useCart();
    const { toggleWishlist, isInWishlist, checkWishlistStatus } = useWishlist();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [showAddAnimation, setShowAddAnimation] = useState(false);
    const lastFetchedProductIdRef = useRef(null);
    const [actionBarHeight, setActionBarHeight] = useState(84);

    // Variant handling
    const [attributeOptions, setAttributeOptions] = useState({}); // { Color: ['Red','Blue'], Size: ['M','L'] }
    const [selectedAttributes, setSelectedAttributes] = useState({});
    const [selectedVariant, setSelectedVariant] = useState(null);

    useEffect(() => {
        console.log('ProductDetailsScreen useEffect triggered:', { productId, productData });
        
        // If we have product data directly, use it
        if (productData) {
            setProduct(productData);
            setLoading(false);
            setupProductData(productData);
            return;
        }
        
        // Otherwise fetch by productId, but only once per id
        if (productId) {
            if (lastFetchedProductIdRef.current === productId) {
                return;
            }
            lastFetchedProductIdRef.current = productId;
            fetchProductDetails();
        } else {
            setError('No product information provided');
            setLoading(false);
        }
    }, [productId]);

    // Check wishlist status when product changes
    useEffect(() => {
        if (product && product._id) {
            checkWishlistStatus(product._id);
        }
    }, [product, checkWishlistStatus]);

    const setupProductData = (productData) => {
        if (!productData) return;
        
        // Build attribute options if configurable
        if (productData.productType === 'configurable' && Array.isArray(productData.variants)) {
            const opts = {};
            for (const v of productData.variants) {
                const attrs = v.attributes || {};
                Object.keys(attrs).forEach(key => {
                    opts[key] = opts[key] || [];
                    if (!opts[key].includes(attrs[key])) opts[key].push(attrs[key]);
                });
            }
            setAttributeOptions(opts);
            
            // Preselect first available options
            const defaults = {};
            Object.keys(opts).forEach(key => { 
                defaults[key] = opts[key][0]; 
            });
            setSelectedAttributes(defaults);
            
            // Find and set initial variant
            const initialVariant = findMatchingVariant(defaults, productData);
            setSelectedVariant(initialVariant);
        } else {
            setAttributeOptions({});
            setSelectedAttributes({});
            setSelectedVariant(null);
        }
    };

    const fetchProductDetails = async () => {
        if (!productId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const res = await api.getProductPublic(productId);
            
            if (res?.success) {
                const p = res.data;
                setProduct(p);
                setupProductData(p);
            } else {
                setError(`Failed to fetch product details: ${res?.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Error fetching product:', err);
            
            // Handle different types of errors
            if (err.message.includes('Network error')) {
                setError('Network error: Please check your internet connection and try again.');
            } else if (err.message.includes('HTTP error')) {
                setError(`Server error: ${err.message}. Please try again later.`);
            } else {
                setError(`Failed to load product: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const createMockProduct = (id) => {
        // Create a simple product for testing
        if (id === 'simple-test') {
            return {
                id: id,
                name: 'Simple Test Product',
                description: 'This is a simple product without variants. It demonstrates the basic product display functionality.',
                shortDescription: 'Simple product for testing',
                images: [
                    'https://via.placeholder.com/400x400/9C27B0/FFFFFF?text=Simple+Product',
                    'https://via.placeholder.com/400x400/E91E63/FFFFFF?text=Simple+Product+2'
                ],
                regularPrice: 599,
                specialPrice: 499,
                productType: 'simple',
                variants: [],
                stock: 50,
                sku: 'SIMPLE-001',
                brand: { name: 'Simple Brand' },
                category: { name: 'Basic Items' },
                vendor: { companyName: 'Simple Vendor' },
                tags: ['simple', 'basic', 'test'],
                tax: 3
            };
        }
        
        // Default configurable product
        return {
            id: id,
            name: `Sample Product ${id}`,
            description: 'This is a sample product description for testing purposes. It demonstrates how the product details screen will look with real data. This product features high-quality materials and excellent craftsmanship.',
            shortDescription: 'Sample product for testing with full features',
            images: [
                'https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=Product+1',
                'https://via.placeholder.com/400x400/4ECDC4/FFFFFF?text=Product+2',
                'https://via.placeholder.com/400x400/45B7D1/FFFFFF?text=Product+3'
            ],
            regularPrice: 1299,
            specialPrice: 999,
            productType: 'configurable',
            variants: [
                {
                    attributes: { Color: 'Red', Size: 'S' },
                    price: 999,
                    specialPrice: 799,
                    stock: 25,
                    sku: 'PROD-RED-S',
                    images: ['https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=Red+S']
                },
                {
                    attributes: { Color: 'Red', Size: 'M' },
                    price: 1099,
                    specialPrice: 899,
                    stock: 30,
                    sku: 'PROD-RED-M',
                    images: ['https://via.placeholder.com/400x400/FF6B6B/FFFFFF?text=Red+M']
                },
                {
                    attributes: { Color: 'Blue', Size: 'S' },
                    price: 1199,
                    specialPrice: 999,
                    stock: 20,
                    sku: 'PROD-BLUE-S',
                    images: ['https://via.placeholder.com/400x400/4ECDC4/FFFFFF?text=Blue+S']
                },
                {
                    attributes: { Color: 'Blue', Size: 'M' },
                    price: 1299,
                    specialPrice: 1099,
                    stock: 35,
                    sku: 'PROD-BLUE-M',
                    images: ['https://via.placeholder.com/400x400/4ECDC4/FFFFFF?text=Blue+M']
                }
            ],
            stock: 110,
            sku: 'PROD-001',
            brand: { name: 'Sample Brand' },
            category: { name: 'Electronics' },
            vendor: { companyName: 'Sample Vendor' },
            tags: ['electronics', 'sample', 'test', 'high-quality'],
            tax: 5
        };
    };

    const findMatchingVariant = (attributes, productData = product) => {
        if (!productData || productData.productType !== 'configurable') return null;
        const attrs = attributes || selectedAttributes;
        const match = (productData.variants || []).find(v => {
            const vattrs = v.attributes || {};
            return Object.keys(attributeOptions).every(k => String(vattrs[k]) === String(attrs[k]));
        });
        return match || null;
    };

    const currentImages = () => {
        if (product?.productType === 'configurable' && selectedVariant?.images?.length > 0) {
            return selectedVariant.images;
        }
        return Array.isArray(product?.images) && product.images.length > 0 ? product.images : [];
    };

    const currentPriceBlock = () => {
        let regular = product?.regularPrice ?? null;
        let special = product?.specialPrice ?? null;
        
        if (product?.productType === 'configurable' && selectedVariant) {
            regular = selectedVariant.price ?? regular;
            special = selectedVariant.specialPrice ?? special;
        }
        
        return { regular, special };
    };

    const currentStock = () => {
        if (product?.productType === 'configurable') {
            if (selectedVariant) {
                return selectedVariant.stock ?? 0;
            }
            // For configurable products without selected variant, show total stock
            const totalStock = (product.variants || []).reduce((sum, v) => sum + (v.stock ?? 0), 0);
            // If no variants have stock, fall back to main product stock
            return totalStock > 0 ? totalStock : (product.stock ?? 0);
        }
        return product?.stock ?? 0;
    };

    const isOutOfStock = () => {
        const stock = currentStock();
        return stock <= 0;
    };

    const getStockStatusText = () => {
        const stock = currentStock();
        if (stock <= 0) {
            return 'Out of Stock';
        }
        if (stock <= 5) {
            return `Low Stock (${stock} left)`;
        }
        if (product?.productType === 'configurable' && selectedVariant) {
            return `In Stock (${stock} available)`;
        }
        return `In Stock (${stock} available)`;
    };

    const getStockStatusColor = () => {
        const stock = currentStock();
        if (stock <= 0) return '#f44336'; // Red for out of stock
        if (stock <= 5) return '#ff9800'; // Orange for low stock
        return '#4caf50'; // Green for in stock
    };

    const handleSelectAttribute = (name, value) => {
        const newAttributes = { ...selectedAttributes, [name]: value };
        setSelectedAttributes(newAttributes);
        
        // Find and set the matching variant
        const variant = findMatchingVariant(newAttributes);
        setSelectedVariant(variant);
        
        // Reset image index if variant has different images
        if (variant?.images?.length > 0) {
            setActiveImageIndex(0);
        }
    };

    const handleAddToCart = () => {
        if (!product) return;
        
        if (isOutOfStock()) {
            Alert.alert('Out of Stock', 'This product is currently out of stock.');
            return;
        }
        
        // Prepare product data for cart
        const cartProduct = {
            ...product,
            selectedVariant: selectedVariant,
            currentPrice: currentPriceBlock(),
            currentStock: currentStock(),
            currentImages: currentImages() // Include the current images
        };
        
        // Add to cart with proper parameters
        addToCart(cartProduct, quantity, selectedAttributes);
        
        // Show success animation only
        setShowAddAnimation(true);
        setTimeout(() => setShowAddAnimation(false), 1500);
    };

    const handleBuyNow = () => {
        if (!product) return;
        
        if (isOutOfStock()) {
            Alert.alert('Out of Stock', 'This product is currently out of stock.');
            return;
        }
        
        // Add to cart first, then navigate to checkout
        handleAddToCart();
        setTimeout(() => {
            navigation.navigate('Cart');
        }, 500);
    };

    const handleToggleWishlist = async () => {
        if (!product || !product._id) {
            Alert.alert('Error', 'Product information not available');
            return;
        }
        
        try {
            const result = await toggleWishlist(product._id);
            if (result.success) {
                // Success feedback could be added here
                console.log('Wishlist updated successfully');
            } else {
                Alert.alert('Error', result.error || 'Failed to update wishlist');
            }
        } catch (error) {
            console.error('Error toggling wishlist:', error);
            Alert.alert('Error', 'Failed to update wishlist');
        }
    };

    const { regular, special } = currentPriceBlock();
    const stock = currentStock();
    const outOfStock = isOutOfStock();



    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1976d2" />
                <Text style={styles.loadingText}>Loading product details...</Text>
                <Text style={styles.debugText}>productId: {productId || 'undefined'}</Text>
                <Text style={styles.debugText}>productData: {productData ? 'provided' : 'not provided'}</Text>
            </View>
        );
    }

    if (error || !product) {
        return (
            <View style={styles.errorContainer}>
                <AntDesign name="exclamationcircleo" size={64} color="#f44336" />
                <Text style={styles.errorText}>{error || 'Product not found'}</Text>
                <Text style={styles.debugText}>productId: {productId || 'undefined'}</Text>
                <Text style={styles.debugText}>productData: {productData ? 'provided' : 'not provided'}</Text>
                
                {productId && (
                    <TouchableOpacity style={styles.retryButton} onPress={fetchProductDetails}>
                        <Text style={styles.retryButtonText}>Retry API Call</Text>
                    </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                    style={[styles.retryButton, { marginTop: 10, backgroundColor: '#666' }]} 
                    onPress={() => {
                        console.log('Current state:', { productId, productData, product, loading, error });
                        const stock = currentStock();
                        const outOfStock = isOutOfStock();
                        Alert.alert('Debug Info', 
                            `productId: ${productId}\n` +
                            `productData: ${productData ? 'provided' : 'not provided'}\n` +
                            `Product Type: ${product?.productType || 'N/A'}\n` +
                            `Current Stock: ${stock}\n` +
                            `Out of Stock: ${outOfStock}\n` +
                            `Selected Variant: ${selectedVariant ? 'Yes' : 'No'}\n` +
                            `Error: ${error || 'None'}`
                        );
                    }}
                >
                    <Text style={styles.retryButtonText}>Show Debug Info</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.retryButton, { marginTop: 10, backgroundColor: '#2196F3' }]} 
                    onPress={() => {
                        navigation.goBack();
                    }}
                >
                    <Text style={styles.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Ensure we have product data before rendering
    if (!product || !product.name) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading product...</Text>
            </View>
        );
    }

    return (
        <>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Header */}
                <TouchableOpacity style={styles.header} onPress={() => navigation.goBack()}>
                    <AntDesign name="arrowleft" size={24} color="black" />
                    <Text style={styles.headerText}>Product Details</Text>
                </TouchableOpacity>

                {/* Product Media (image or video) */}
                {(() => {
                    const imgs = currentImages();
                    const hasVideo = !!product?.videoUrl;
                    const isVideo = hasVideo && activeImageIndex === imgs.length;
                    if (isVideo) {
                        const poster = imgs && imgs.length > 0 ? String(imgs[0]) : '';
                        const html = `
                          <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                              <style>
                                html,body{margin:0;padding:0;background:#000;height:100%;}
                                video{width:100%;height:100%;object-fit:contain;background:#000;}
                              </style>
                            </head>
                            <body>
                              <video src="${String(product.videoUrl)}" ${poster ? `poster="${poster}"` : ''} preload="metadata" controls playsinline webkit-playsinline></video>
                            </body>
                          </html>`;
                        return (
                            <View style={styles.videoContainer}>
                                <WebView
                                    originWhitelist={['*']}
                                    source={{ html }}
                                    style={styles.webView}
                                    allowsInlineMediaPlayback
                                    mediaPlaybackRequiresUserAction={false}
                                />
                            </View>
                        );
                    }
                    const img = imgs[activeImageIndex];
                    if (img) {
                        return <Image source={{ uri: img }} style={styles.mainImage} resizeMode="cover" />;
                    }
                    return null;
                })()}

                {/* Image + Video Thumbnails */}
                {(() => {
                    const imgs = currentImages();
                    const hasVideo = !!product?.videoUrl;
                    const total = imgs.length + (hasVideo ? 1 : 0);
                    if (total <= 1) return null;
                    return (
                    <View style={styles.thumbnailContainer}>
                        {imgs.map((img, index) => (
                            <TouchableOpacity key={index} onPress={() => setActiveImageIndex(index)}>
                                <Image source={{ uri: img }} style={[styles.thumbnail, activeImageIndex === index && styles.activeThumb]} />
                            </TouchableOpacity>
                        ))}
                        {hasVideo && (() => {
                            const poster = imgs && imgs.length > 0 ? String(imgs[0]) : null;
                            return (
                                <TouchableOpacity onPress={() => setActiveImageIndex(imgs.length)}>
                                    <View style={[styles.thumbnail, styles.videoThumbWrapper, activeImageIndex === imgs.length && styles.activeThumb]}>
                                        {poster ? (
                                            <Image source={{ uri: poster }} style={styles.videoThumbImage} />
                                        ) : (
                                            <View style={[styles.videoThumbImage, { backgroundColor: '#000' }]} />
                                        )}
                                        <View style={styles.videoThumbOverlay}>
                                            <AntDesign name="play" size={22} color="#fff" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })()}
                    </View>
                    );
                })()}

                {/* Title */}
                <Text style={styles.title}>{product.name}</Text>

                {/* SKU */}
                {product.sku && (
                    <Text style={styles.sku}>SKU: {product.sku}</Text>
                )}

                {/* Price */}
                <View style={styles.priceContainer}>
                    {special != null && special < regular ? (
                        <>
                            <Text style={styles.specialPrice}>₹{special}</Text>
                            <Text style={styles.originalPrice}>₹{regular}</Text>
                            <Text style={styles.discount}>
                                ({Math.round(((regular - special) / regular) * 100)}% OFF)
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.specialPrice}>₹{regular}</Text>
                    )}
                </View>

                {/* Stock Status */}
                <View style={[styles.stockContainer, { borderLeftColor: getStockStatusColor() }]}>
                    <Text style={[styles.stockText, { color: getStockStatusColor() }]}>
                        {getStockStatusText()}
                    </Text>
                </View>

                {/* Description */}
                {product.description && (
                    <Text style={styles.description}>{product.description}</Text>
                )}

                {/* Short Description */}
                {product.shortDescription && (
                    <Text style={styles.shortDescription}>{product.shortDescription}</Text>
                )}

                {/* Variants */}
                {product.productType === 'configurable' && Object.keys(attributeOptions).length > 0 && (
                    <View style={styles.variantsSection}>
                        <Text style={styles.sectionTitle}>Product Options</Text>
                        {Object.keys(attributeOptions).map(attrName => (
                            <View key={attrName} style={styles.attributeSection}>
                                <Text style={styles.attributeLabel}>{attrName}</Text>
                                <View style={styles.attributeOptions}>
                                    {attributeOptions[attrName].map(val => (
                                        <TouchableOpacity
                                            key={val}
                                            style={[
                                                styles.attributeButton,
                                                selectedAttributes[attrName] === val && styles.attributeSelected,
                                            ]}
                                            onPress={() => handleSelectAttribute(attrName, val)}
                                        >
                                            <Text style={[
                                                styles.attributeText,
                                                selectedAttributes[attrName] === val && styles.attributeTextSelected
                                            ]}>
                                                {val}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))}
                        
                        {/* Selected Variant Info */}
                        {selectedVariant && (
                            <View style={styles.variantInfo}>
                                <Text style={styles.variantInfoText}>
                                    Selected: {Object.entries(selectedAttributes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                                </Text>
                                {selectedVariant.sku && (
                                    <Text style={styles.variantSku}>Variant SKU: {selectedVariant.sku}</Text>
                                )}
                            </View>
                        )}
                        
                        {/* Quantity */}
                        <View style={styles.quantityWrapper}>
                            <Text style={styles.sectionTitle}>Quantity</Text>
                            <View style={styles.quantityControls}>
                                <TouchableOpacity
                                    style={[styles.qtyCircleBtn, quantity <= 1 && styles.qtyCircleBtnDisabled]}
                                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                                    disabled={quantity <= 1}
                                >
                                    <Text style={[styles.qtyBtnText, quantity <= 1 && styles.qtyBtnTextDisabled]}>−</Text>
                                </TouchableOpacity>
                                <View style={styles.qtyBox}>
                                    <Text style={styles.qtyNumber}>{quantity}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.qtyCircleBtn, quantity >= stock && styles.qtyCircleBtnDisabled]}
                                    onPress={() => setQuantity(Math.min(stock, quantity + 1))}
                                    disabled={quantity >= stock}
                                >
                                    <Text style={[styles.qtyBtnText, quantity >= stock && styles.qtyBtnTextDisabled]}>+</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.stockInfo}>
                                {stock > 0 ? `${stock} available` : 'Out of stock'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Simple Product Quantity */}
                {product.productType === 'simple' && (
                    <View style={styles.quantityWrapper}>
                        <Text style={styles.sectionTitle}>Quantity</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={[styles.qtyCircleBtn, quantity <= 1 && styles.qtyCircleBtnDisabled]}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                                disabled={quantity <= 1}
                            >
                                <Text style={[styles.qtyBtnText, quantity <= 1 && styles.qtyBtnTextDisabled]}>−</Text>
                            </TouchableOpacity>
                            <View style={styles.qtyBox}>
                                <Text style={styles.qtyNumber}>{quantity}</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.qtyCircleBtn, quantity >= stock && styles.qtyCircleBtnDisabled]}
                                onPress={() => setQuantity(Math.min(stock, quantity + 1))}
                                disabled={quantity >= stock}
                            >
                                <Text style={[styles.qtyBtnText, quantity >= stock && styles.qtyBtnTextDisabled]}>+</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.stockInfo}>
                            {stock > 0 ? `${stock} available` : 'Out of stock'}
                        </Text>
                    </View>
                )}

                {/* Product Specifications */}
                <ProductSpecifications 
                    product={product}
                    onBrandPress={(brand) => {
                        // Navigate to brand products or show brand info
                        console.log('Brand pressed:', brand);
                    }}
                />

                {/* Product Reviews */}
                <ProductReviews 
                    productId={productId}
                    onReviewPress={() => {
                        navigation.navigate('ReviewForm', { productId, productName: product?.name });
                    }}
                />

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

            <View style={styles.actionsContainer} onLayout={(e) => {
                const h = e?.nativeEvent?.layout?.height || 0;
                if (h && h !== actionBarHeight) setActionBarHeight(h);
            }}>
                <TouchableOpacity 
                    style={[styles.heartButton, isInWishlist(product._id) && styles.heartButtonActive]} 
                    onPress={handleToggleWishlist}
                >
                    <AntDesign 
                        name={isInWishlist(product._id) ? "heart" : "hearto"} 
                        size={20} 
                        color={isInWishlist(product._id) ? "#e53935" : "#333"} 
                    />
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.addToCartButton, outOfStock && styles.buttonDisabled]} 
                    onPress={handleAddToCart}
                    disabled={outOfStock}
                >
                    <Text style={[styles.addToCartText, outOfStock && styles.buttonTextDisabled]}>
                        {outOfStock ? 'Out of Stock' : 'Add to Cart'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.buyNowButton, outOfStock && styles.buttonDisabled]} 
                    onPress={handleBuyNow}
                    disabled={outOfStock}
                >
                    <Text style={[styles.buyNowText, outOfStock && styles.buttonTextDisabled]}>
                        {outOfStock ? 'Out of Stock' : 'Buy Now'}
                    </Text>
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
            
            <ViewCartFooter bottomOffset={actionBarHeight + 8} />
        </>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', padding: 16 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    headerText: { fontSize: 18, fontWeight: '600', marginLeft: 12 },

    mainImage: { width: '100%', height: 300, borderRadius: 12 },
    videoContainer: { width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
    webView: { width: '100%', height: '100%', backgroundColor: '#000' },
    thumbnailContainer: { flexDirection: 'row', marginTop: 10 },
    thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#eee' },
    videoThumbWrapper: { position: 'relative', overflow: 'hidden' },
    videoThumbImage: { width: '100%', height: '100%', borderRadius: 8 },
    videoThumbOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
    activeThumb: { borderColor: '#1976d2', borderWidth: 2 },

    title: { fontSize: 18, fontWeight: '600', marginVertical: 10 },
    sku: { fontSize: 14, color: '#666', marginBottom: 5 },
    priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    specialPrice: { fontSize: 20, fontWeight: '700', color: '#e53935' },
    originalPrice: { fontSize: 16, color: '#888', textDecorationLine: 'line-through' },
    discount: { fontSize: 14, color: '#43a047' },

    stockContainer: {
        backgroundColor: '#f8f9fa',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#4caf50',
    },
    stockText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    outOfStockText: {
        color: '#f44336',
    },

    description: {
        fontSize: 16,
        color: '#333',
        marginBottom: 15,
    },
    shortDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 15,
    },

    variantsSection: {
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
    attributeSection: {
        marginBottom: 15,
    },
    attributeLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#555',
        marginBottom: 5,
    },
    attributeOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    attributeButton: {
        borderWidth: 1,
        borderColor: '#ccc',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    attributeSelected: {
        backgroundColor: '#2196F3',
        borderColor: '#2196F3',
    },
    attributeText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#000',
    },
    attributeTextSelected: {
        color: '#fff',
    },
    variantInfo: {
        marginTop: 15,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    variantInfoText: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
    },
    variantSku: {
        fontSize: 14,
        color: '#e53935',
        fontWeight: '600',
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
    qtyCircleBtnDisabled: {
        borderColor: '#ccc',
        backgroundColor: '#eee',
    },
    qtyBtnTextDisabled: {
        color: '#ccc',
    },
    stockInfo: {
        fontSize: 12,
        color: '#666',
        marginTop: 5,
        textAlign: 'center',
    },
    actionsContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
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
    heartButtonActive: {
        borderColor: '#e53935',
        backgroundColor: '#fff5f5',
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
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonTextDisabled: {
        color: '#ccc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 10,
        color: '#1976d2',
    },
    debugText: {
        fontSize: 12,
        color: '#999',
        marginTop: 5,
        textAlign: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#f44336',
        textAlign: 'center',
        marginTop: 10,
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#1976d2',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    successOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    successCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    successText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#43a047',
        marginTop: 10,
    },
});
