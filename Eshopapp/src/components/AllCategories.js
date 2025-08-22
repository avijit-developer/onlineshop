import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import api from '../utils/api';

const placeholder = require('../assets/cat1.png');

const AllCategories = () => {
            const navigation  = useNavigation();
            const [categories, setCategories] = useState([]);
            useEffect(() => {
              let mounted = true;
              (async () => {
                try {
                  const res = await api.getCategoriesPublic({ parent: 'root', limit: 50 });
                  if (res?.success && mounted) {
                    setCategories((res.data || []).map(c => ({ id: c._id, name: c.name, image: c.image })));
                  }
                } catch (_) {
                  // ignore
                }
              })();
              return () => { mounted = false; };
            }, []);
  
    return (
        <View style={styles.container}>
            <Text style={styles.title}>All Categories</Text>
            <FlatList
        horizontal
        data={categories}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.imageWrapper} onPress={()=>navigation.navigate('ProductList', { categoryId: item.id, title: item.name })}>
            <Image source={ item.image ? { uri: item.image } : placeholder } style={styles.image} />
          </TouchableOpacity>
        )}
      />
        </View>
    );
};

export default AllCategories;

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  list: {
    gap: 5,
  },
imageWrapper: {
  width: 70,
  height: 70,
  borderRadius: 35,
  backgroundColor: '#fff',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 8,

  // Simulate white ring on white background
  borderWidth: 1,
  borderColor: '#ddd', // light gray border
  elevation: 0, // remove Android shadow
  shadowColor: 'transparent', // remove iOS shadow
},

  image: {
    width: 58,
    height: 58,
    borderRadius: 29,
    resizeMode: 'cover',
  },
});

