import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from '../utils/api';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2; // Adjusted for 2 columns with spacing

const placeholder = require('../assets/cat_clothing.png');

const CategoryBlockGrid = () => {
    const [blocks, setBlocks] = useState([]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                console.log('CategoriesGrid: fetching all categories...');
                const res = await api.getCategoriesPublic({ parent: 'all', limit: 1000 });
                console.log('CategoriesGrid: response', res);
                if (!res?.success) return;
                const all = res.data || [];
                console.log('CategoriesGrid: total categories', all.length);
                const parents = all.filter(c => !c.parent);
                console.log('CategoriesGrid: parents', parents.length);
                const byParent = new Map();
                all.forEach(c => {
                  const pid = c.parent;
                  if (!pid) return;
                  const key = (typeof pid === 'object' && pid !== null) ? (pid._id || String(pid)) : String(pid);
                  if (!byParent.has(key)) byParent.set(key, []);
                  byParent.get(key).push(c);
                });
                const built = parents.map(p => {
                    const pid = String(p._id);
                    const children = (byParent.get(pid) || []);
                    console.log('CategoriesGrid: parent', p.name, 'children', children.length);
                    const childImages = children.slice(0,4).map(ch => ch.image).filter(Boolean);
                    const images = childImages.length > 0 ? childImages : [p.image, p.image, p.image, p.image].slice(0,4);
                    return { id: pid, title: p.name, images };
                });
                if (mounted) setBlocks(built);
            } catch (_) {
                console.log('CategoriesGrid: fetch error', _);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.imageGrid}>
                {item.images.map((img, idx) => (
                    <Image key={idx} source={ img ? { uri: img } : placeholder } style={styles.gridImage} />
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
                data={blocks}
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
