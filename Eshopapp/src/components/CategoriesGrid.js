import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2; // Adjusted for 2 columns with spacing

const categories = [
    {
        id: '1',
        title: 'Clothing',
        count: 109,
        images: [
            require('../assets/cat_clothing.png'),
            require('../assets/cat_clothing2.png'),
            require('../assets/cat_clothing3.png'),
            require('../assets/cat_clothing4.png'),
        ],
    },
    {
        id: '2',
        title: 'Shoes',
        count: 530,
        images: [
            require('../assets/shoe1.png'),
            require('../assets/shoe2.png'),
            require('../assets/shoe3.png'),
            require('../assets/shoe4.png'),
        ],
    },
    {
        id: '3',
        title: 'Bags',
        count: 87,
        images: [
            require('../assets/bag1.png'),
            require('../assets/bag2.png'),
            require('../assets/bag3.png'),
            require('../assets/bag4.png'),
        ],
    },
    {
        id: '4',
        title: 'Lingerie',
        count: 218,
        images: [
            require('../assets/ling1.png'),
            require('../assets/ling2.png'),
            require('../assets/ling3.png'),
            require('../assets/ling4.png'),
        ],
    },
];

const CategoryBlockGrid = () => {
    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.imageGrid}>
                {item.images.map((img, idx) => (
                    <Image key={idx} source={img} style={styles.gridImage} />
                ))}
            </View>
            <View style={styles.footer}>
                <Text style={styles.title}>{item.title}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Categories</Text>
                <TouchableOpacity style={styles.seeAll}>
                    <Text style={styles.seeAllText}>See All</Text>
                    <Ionicons name="arrow-forward-circle" size={18} color="#FFA726" />
                </TouchableOpacity>
            </View>

            {/* Category Grid */}
            <FlatList
                data={categories}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.row}
                scrollEnabled={false}
            />
        </View>
    );
};

export default CategoryBlockGrid;

const styles = StyleSheet.create({
    container: {
    padding: 16,
    backgroundColor: '#fff',
    top: -5
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18, 
    fontWeight: '700',
    color: '#000',
  },
   title: {
    fontWeight: '600',
    fontSize: 14,
    top: 5
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#FFA726',
    fontWeight: '500',
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: cardWidth,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridImage: {
    width: (cardWidth - 20) / 2,
    height: (cardWidth - 20) / 2,
    borderRadius: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  countBadge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
    color: '#555',
  },
  footer:{
    marginLeft:7,
    marginBottom:7
  }
});
