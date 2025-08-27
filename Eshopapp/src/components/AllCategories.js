import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useEffect, useState } from 'react';
import api from '../utils/api';

const { width: screenWidth } = Dimensions.get('window');
const placeholder = require('../assets/cat1.png');

const AllCategories = () => {
    const navigation = useNavigation();
    const [categories, setCategories] = useState([]);
    
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await api.getCategoriesPublic({ parent: 'root', limit: 50 });
                if (res?.success && mounted) {
                    const roots = (res.data || []).filter(c => !c.parent);
                    const mapped = roots.map(c => ({ id: c._id, name: c.name, image: c.image }));
                    setCategories(mapped);
                }
            } catch (_) {
                // ignore
            }
        })();
        return () => { mounted = false; };
    }, []);

    const renderCategoryItem = ({ item, index }) => (
        <TouchableOpacity 
            style={styles.categoryCard} 
            onPress={() => navigation.navigate('Category', { categoryId: item.id, title: item.name })}
            activeOpacity={0.8}
        >
            <View style={styles.imageContainer}>
                <Image 
                    source={item.image ? { uri: item.image } : placeholder} 
                    style={styles.categoryImage}
                    defaultSource={placeholder}
                />
                <View style={styles.imageOverlay} />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.categoryName} numberOfLines={2}>
                    {item.name}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Shop by Category</Text>
                <Text style={styles.subtitle}>Explore our wide range of products</Text>
            </View>
            
            <FlatList
                data={categories}
                keyExtractor={item => item.id}
                renderItem={renderCategoryItem}
                numColumns={2}
                columnWrapperStyle={styles.row}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContainer}
                scrollEnabled={false}
            />
        </View>
    );
};

export default AllCategories;

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
    },
    header: {
        marginBottom: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    listContainer: {
        paddingBottom: 10,
    },
    row: {
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    categoryCard: {
        width: (screenWidth - 48) / 2,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    imageContainer: {
        position: 'relative',
        height: 120,
        backgroundColor: '#f8f9fa',
    },
    categoryImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 40,
        backgroundColor: 'linear-gradient(transparent, rgba(0,0,0,0.1))',
    },
    textContainer: {
        padding: 16,
        paddingTop: 12,
        backgroundColor: '#fff',
    },
    categoryName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        textAlign: 'center',
        lineHeight: 18,
        letterSpacing: 0.2,
    },
});

